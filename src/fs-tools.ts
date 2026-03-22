import { FileStatInfo, DirEntry, DirListResult } from './types.js';
import { createFilesystemError, wrapError } from './errors.js';
import { logger } from './logging.js';
import { sessionManager } from './session.js';
import { ErrorCode } from './types.js';
import type { SFTPWrapper, Stats, FileEntry } from 'ssh2';
import { metrics } from './metrics.js';

/**
 * Promisified SFTP operations for ssh2 SFTPWrapper
 */

function sftpReadFile(sftp: SFTPWrapper, path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.readFile(path, (err: Error | null | undefined, data: Buffer) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function sftpWriteFile(sftp: SFTPWrapper, path: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(path, data, {}, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sftpStat(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.stat(path, (err: Error | null | undefined, stats: Stats) => {
      if (err) reject(err);
      else resolve(stats);
    });
  });
}

function sftpReaddir(sftp: SFTPWrapper, path: string): Promise<FileEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err: Error | null | undefined, list: FileEntry[]) => {
      if (err) reject(err);
      else resolve(list);
    });
  });
}

function sftpMkdir(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(path, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sftpRmdir(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rmdir(path, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sftpUnlink(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(path, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sftpRename(sftp: SFTPWrapper, oldPath: string, newPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(oldPath, newPath, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function sftpChmod(sftp: SFTPWrapper, path: string, mode: number): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.chmod(path, mode, (err: Error | null | undefined) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Recursively creates directories (mkdir -p equivalent)
 * ssh2 doesn't have native recursive mkdir, so we implement it manually
 */
async function sftpMkdirRecursive(sftp: SFTPWrapper, dirPath: string): Promise<void> {
  const parts = dirPath.split('/').filter(p => p);
  let currentPath = dirPath.startsWith('/') ? '' : '.';

  for (const part of parts) {
    currentPath = currentPath === '' ? `/${part}` : `${currentPath}/${part}`;
    try {
      await sftpStat(sftp, currentPath);
    } catch (err) {
      // Directory doesn't exist, create it
      try {
        await sftpMkdir(sftp, currentPath);
      } catch (mkdirErr: any) {
        // Ignore EEXIST errors (race condition)
        if (mkdirErr.code !== 4) { // SFTP error code 4 = No such file (parent doesn't exist) or already exists
          throw mkdirErr;
        }
      }
    }
  }
}

/**
 * Recursively removes a directory
 * ssh2 doesn't have native recursive rmdir, so we implement it manually
 */
async function sftpRmdirRecursive(sftp: SFTPWrapper, dirPath: string): Promise<void> {
  const entries = await sftpReaddir(sftp, dirPath);

  for (const entry of entries) {
    const entryPath = `${dirPath}/${entry.filename}`;
    const mode = entry.attrs.mode ?? 0;

    // Check if directory using POSIX mode bits
    const isDir = (mode & 0o170000) === 0o040000;

    if (isDir) {
      await sftpRmdirRecursive(sftp, entryPath);
    } else {
      await sftpUnlink(sftp, entryPath);
    }
  }

  await sftpRmdir(sftp, dirPath);
}

/**
 * Reads a file from the remote system
 */
export async function readFile(
  sessionId: string,
  path: string,
  encoding: string = 'utf8'
): Promise<string> {
  logger.debug('Reading file', { sessionId, path, encoding });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    const data = await sftpReadFile(session.sftp, path);
    const result = data.toString(encoding as BufferEncoding);
    metrics.recordFileRead(data.length);
    logger.debug('File read successfully', { sessionId, path, size: result.length });
    return result;
  } catch (error) {
    logger.error('Failed to read file', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to read file ${path}. Check if the file exists and is readable.`
    );
  }
}

/**
 * Writes data to a file on the remote system (atomic operation using temp file)
 */
export async function writeFile(
  sessionId: string,
  path: string,
  data: string,
  mode?: number
): Promise<boolean> {
  logger.debug('Writing file', { sessionId, path, size: data.length, mode });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    // Use atomic write: write to temp file, then rename
    const tempPath = `${path}.tmp.${Date.now()}`;

    try {
      // Write to temporary file
      await sftpWriteFile(session.sftp, tempPath, Buffer.from(data, 'utf8'));

      // Set permissions if specified
      if (mode !== undefined) {
        await sftpChmod(session.sftp, tempPath, mode);
      }

      // Atomic rename
      await sftpRename(session.sftp, tempPath, path);
      metrics.recordFileWrite(Buffer.byteLength(data, 'utf8'));

      logger.debug('File written successfully', { sessionId, path });
      return true;
    } catch (writeError) {
      // Clean up temp file on failure
      try {
        await sftpUnlink(session.sftp, tempPath);
        logger.debug('Cleaned up temp file after error', { tempPath });
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp file', { tempPath, cleanupError });
      }
      throw writeError;
    }
  } catch (error) {
    logger.error('Failed to write file', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to write file ${path}. Check directory permissions and disk space.`
    );
  }
}

/**
 * Gets file/directory statistics
 */
export async function statFile(
  sessionId: string,
  path: string
): Promise<FileStatInfo> {
  logger.debug('Getting file stats', { sessionId, path });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    const stats = await sftpStat(session.sftp, path);

    // Safe type detection using POSIX mode bits (GÖREV 3.2)
    let type: FileStatInfo['type'] = 'other';
    const mode = stats.mode ?? 0;

    // POSIX mode bit masks for file type detection
    if ((mode & 0o170000) === 0o100000) {
      type = 'file';
    } else if ((mode & 0o170000) === 0o040000) {
      type = 'directory';
    } else if ((mode & 0o170000) === 0o120000) {
      type = 'symlink';
    } else if (typeof stats.isFile === 'function') {
      // Fallback: use method if available
      if (stats.isFile()) type = 'file';
      else if (stats.isDirectory()) type = 'directory';
      else if (stats.isSymbolicLink?.()) type = 'symlink';
    }

    const statInfo: FileStatInfo = {
      size: stats.size ?? 0,
      mtime: new Date(typeof stats.mtime === 'number' ? stats.mtime * 1000 : Date.now()),
      mode,
      type
    };

    logger.debug('File stats retrieved', { sessionId, path, type, size: stats.size });
    return statInfo;
  } catch (error) {
    logger.error('Failed to get file stats', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to get stats for ${path}. Check if the path exists.`
    );
  }
}

/**
 * Lists directory contents with pagination
 */
export async function listDirectory(
  sessionId: string,
  path: string,
  page?: number,
  limit: number = 100
): Promise<DirListResult> {
  logger.debug('Listing directory', { sessionId, path, page, limit });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    const fileList = await sftpReaddir(session.sftp, path);

    // Convert to our DirEntry format
    const entries: DirEntry[] = fileList.map((item: FileEntry) => {
      let type: DirEntry['type'] = 'other';
      const attrs = item.attrs;

      // Use POSIX mode bits for type detection
      const mode = attrs.mode ?? 0;
      if ((mode & 0o170000) === 0o100000) {
        type = 'file';
      } else if ((mode & 0o170000) === 0o040000) {
        type = 'directory';
      } else if ((mode & 0o170000) === 0o120000) {
        type = 'symlink';
      }

      return {
        name: item.filename,
        type,
        size: attrs.size,
        mtime: new Date(typeof attrs.mtime === 'number' ? attrs.mtime * 1000 : Date.now()),
        mode: attrs.mode
      };
    });

    // Apply pagination if requested
    if (page !== undefined) {
      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const paginatedEntries = entries.slice(startIndex, endIndex);

      const hasMore = endIndex < entries.length;
      const nextToken = hasMore ? String(page + 1) : undefined;

      logger.debug('Directory listed with pagination', {
        sessionId,
        path,
        total: entries.length,
        page,
        returned: paginatedEntries.length,
        hasMore
      });

      return {
        entries: paginatedEntries,
        nextToken
      };
    }

    logger.debug('Directory listed', { sessionId, path, count: entries.length });
    return { entries };
  } catch (error) {
    logger.error('Failed to list directory', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to list directory ${path}. Check if the directory exists and is readable.`
    );
  }
}

/**
 * Creates directories recursively (mkdir -p equivalent)
 */
export async function makeDirectories(
  sessionId: string,
  path: string
): Promise<boolean> {
  logger.debug('Creating directories', { sessionId, path });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    await sftpMkdirRecursive(session.sftp, path);
    logger.debug('Directories created successfully', { sessionId, path });
    return true;
  } catch (error) {
    logger.error('Failed to create directories', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to create directories ${path}. Check parent directory permissions.`
    );
  }
}

/**
 * Removes files or directories recursively (rm -rf equivalent)
 */
export async function removeRecursive(
  sessionId: string,
  path: string
): Promise<boolean> {
  logger.debug('Removing path recursively', { sessionId, path });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    // Check if path exists and get its type
    const stats = await sftpStat(session.sftp, path);

    if (stats.isDirectory()) {
      // Remove directory recursively
      await sftpRmdirRecursive(session.sftp, path);
    } else {
      // Remove file
      await sftpUnlink(session.sftp, path);
    }

    logger.debug('Path removed successfully', { sessionId, path });
    return true;
  } catch (error) {
    logger.error('Failed to remove path', { sessionId, path, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to remove ${path}. Check if the path exists and you have write permissions.`
    );
  }
}

/**
 * Renames/moves a file or directory
 */
export async function renameFile(
  sessionId: string,
  from: string,
  to: string
): Promise<boolean> {
  logger.debug('Renaming file', { sessionId, from, to });

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found or expired`);
  }

  try {
    await sftpRename(session.sftp, from, to);
    logger.debug('File renamed successfully', { sessionId, from, to });
    return true;
  } catch (error) {
    logger.error('Failed to rename file', { sessionId, from, to, error });
    throw wrapError(
      error,
      ErrorCode.EFS,
      `Failed to rename ${from} to ${to}. Check if the source exists and destination is writable.`
    );
  }
}

/**
 * Checks if a path exists on the remote system
 */
export async function pathExists(sessionId: string, path: string): Promise<boolean> {
  try {
    await statFile(sessionId, path);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets the size of a file
 */
export async function getFileSize(sessionId: string, path: string): Promise<number> {
  const stats = await statFile(sessionId, path);
  return stats.size;
}

/**
 * Checks if a path is a directory
 */
export async function isDirectory(sessionId: string, path: string): Promise<boolean> {
  try {
    const stats = await statFile(sessionId, path);
    return stats.type === 'directory';
  } catch (error) {
    return false;
  }
}

/**
 * Checks if a path is a file
 */
export async function isFile(sessionId: string, path: string): Promise<boolean> {
  try {
    const stats = await statFile(sessionId, path);
    return stats.type === 'file';
  } catch (error) {
    return false;
  }
}
