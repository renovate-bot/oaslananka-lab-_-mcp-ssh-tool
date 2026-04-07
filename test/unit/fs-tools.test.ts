import { describe, expect, jest, test } from "@jest/globals";
import { createFsService } from "../../src/fs-tools.js";

function createLinuxOSInfo() {
  return {
    platform: "linux" as const,
    distro: "ubuntu",
    version: "22.04",
    arch: "x64",
    shell: "bash",
    packageManager: "apt" as const,
    init: "systemd" as const,
    defaultShell: "bash" as const,
  };
}

describe("createFsService", () => {
  test("uses SSH fallback for basic file operations", async () => {
    const execCommand: any = jest.fn();
    execCommand
      .mockResolvedValueOnce({ code: 0, stdout: "hello", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({
        code: 0,
        stdout: "file\t12\t1700000000\t644",
        stderr: "",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: "a.txt\tfile\t5\t1700000000\nb\tdirectory\t0\t1700000001\n",
        stderr: "",
      })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    const metrics = {
      recordFileRead: jest.fn(),
      recordFileWrite: jest.fn(),
    };
    const service = createFsService({
      sessionManager: {
        getSession: () => ({ ssh: { execCommand } }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics,
    } as any);

    await expect(service.readFile("session-1", "/tmp/demo.txt")).resolves.toBe("hello");
    await expect(service.writeFile("session-1", "/tmp/demo.txt", "data", 0o644)).resolves.toBe(
      true,
    );
    await expect(service.statFile("session-1", "/tmp/demo.txt")).resolves.toEqual(
      expect.objectContaining({
        type: "file",
        size: 12,
      }),
    );
    await expect(service.listDirectory("session-1", "/tmp", 0, 1)).resolves.toEqual({
      entries: [
        expect.objectContaining({
          name: "a.txt",
          type: "file",
        }),
      ],
      nextToken: "1",
    });
    await expect(service.makeDirectories("session-1", "/tmp/demo")).resolves.toBe(true);
    await expect(service.removeRecursive("session-1", "/tmp/demo")).resolves.toBe(true);
    await expect(service.renameFile("session-1", "/tmp/a", "/tmp/b")).resolves.toBe(true);

    expect(metrics.recordFileRead).toHaveBeenCalled();
    expect(metrics.recordFileWrite).toHaveBeenCalled();
  });

  test("uses SFTP when available", async () => {
    const existingDirs = new Set<string>(["/existing"]);
    const unlink = jest.fn((_path: string, callback: (err?: Error | null) => void) =>
      callback(null),
    );
    const rmdir = jest.fn((_path: string, callback: (err?: Error | null) => void) =>
      callback(null),
    );
    const rename = jest.fn((_from: string, _to: string, callback: (err?: Error | null) => void) =>
      callback(null),
    );
    const service = createFsService({
      sessionManager: {
        getSession: () =>
          ({
            ssh: { execCommand: jest.fn() },
            sftp: {
              readFile: (_path: string, callback: (err: Error | null, data: Buffer) => void) =>
                callback(null, Buffer.from("hello")),
              writeFile: (
                _path: string,
                _data: Buffer,
                _opts: object,
                callback: (err?: Error | null) => void,
              ) => callback(null),
              chmod: (_path: string, _mode: number, callback: (err?: Error | null) => void) =>
                callback(null),
              rename,
              stat: (
                filePath: string,
                callback: (
                  err: Error | null,
                  stats: { mode?: number; size?: number; mtime?: number },
                ) => void,
              ) => {
                if (filePath === "/root") {
                  callback(null, { mode: 0o040755 });
                  return;
                }
                if (filePath === "/root/nested") {
                  callback(null, { mode: 0o040755 });
                  return;
                }
                if (existingDirs.has(filePath)) {
                  callback(null, { mode: 0o040755 });
                  return;
                }
                callback(new Error("missing"), { mode: 0 });
              },
              readdir: (
                dirPath: string,
                callback: (
                  err: Error | null,
                  list: Array<{
                    filename: string;
                    attrs: { mode?: number; size?: number; mtime?: number };
                  }>,
                ) => void,
              ) => {
                if (dirPath === "/tmp") {
                  callback(null, [
                    { filename: "demo.txt", attrs: { mode: 0o100644, size: 5, mtime: 1700000000 } },
                  ]);
                  return;
                }
                if (dirPath === "/root") {
                  callback(null, [
                    {
                      filename: "child.txt",
                      attrs: { mode: 0o100644, size: 1, mtime: 1700000000 },
                    },
                    { filename: "nested", attrs: { mode: 0o040755, size: 0, mtime: 1700000000 } },
                  ]);
                  return;
                }
                callback(null, []);
              },
              mkdir: (dirPath: string, callback: (err?: Error | null) => void) => {
                existingDirs.add(dirPath);
                callback(null);
              },
              unlink,
              rmdir,
            },
          }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(service.readFile("session-1", "/tmp/demo.txt")).resolves.toBe("hello");
    await expect(service.writeFile("session-1", "/tmp/demo.txt", "hello", 0o644)).resolves.toBe(
      true,
    );
    await expect(service.listDirectory("session-1", "/tmp")).resolves.toEqual({
      entries: [
        expect.objectContaining({
          name: "demo.txt",
          type: "file",
        }),
      ],
    });
    await expect(service.makeDirectories("session-1", "/a/b")).resolves.toBe(true);
    await expect(service.removeRecursive("session-1", "/root")).resolves.toBe(true);
    await expect(service.renameFile("session-1", "/tmp/demo.txt", "/tmp/demo2.txt")).resolves.toBe(
      true,
    );
    expect(rename).toHaveBeenCalled();
    expect(unlink).toHaveBeenCalled();
    expect(rmdir).toHaveBeenCalled();
  });

  test("pathExists and type helpers handle failures", async () => {
    const execCommand: any = jest.fn();
    execCommand.mockResolvedValue({ code: 1, stdout: "", stderr: "nope" });
    const service = createFsService({
      sessionManager: {
        getSession: () => ({ ssh: { execCommand } }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(service.pathExists("session-1", "/missing")).resolves.toBe(false);
    await expect(service.isDirectory("session-1", "/missing")).resolves.toBe(false);
    await expect(service.isFile("session-1", "/missing")).resolves.toBe(false);
  });

  test("handles missing sessions and successful path helpers", async () => {
    const service = createFsService({
      sessionManager: {
        getSession: () => undefined,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(service.readFile("missing", "/tmp/demo")).rejects.toThrow(
      "Session missing not found or expired",
    );

    const execCommand: any = jest.fn();
    execCommand.mockResolvedValue({
      code: 0,
      stdout: "file\t10\t1700000000\t644",
      stderr: "",
    });
    const activeService = createFsService({
      sessionManager: {
        getSession: () => ({ ssh: { execCommand } }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(activeService.pathExists("session-1", "/tmp/demo")).resolves.toBe(true);
    await expect(activeService.getFileSize("session-1", "/tmp/demo")).resolves.toBe(10);
    await expect(activeService.isFile("session-1", "/tmp/demo")).resolves.toBe(true);
  });

  test("cleans up temp files when sftp writes fail", async () => {
    const unlink = jest.fn((_path: string, callback: (err?: Error | null) => void) =>
      callback(null),
    );
    const service = createFsService({
      sessionManager: {
        getSession: () =>
          ({
            ssh: { execCommand: jest.fn() },
            sftp: {
              writeFile: (
                _path: string,
                _data: Buffer,
                _opts: object,
                callback: (err?: Error | null) => void,
              ) => callback(new Error("write failed")),
              unlink,
            },
          }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(service.writeFile("session-1", "/tmp/demo", "data")).rejects.toMatchObject({
      code: "EFS",
    });
    expect(unlink).toHaveBeenCalled();
  });

  test("uses stats helper methods and unlinks single files over SFTP", async () => {
    const unlink = jest.fn((_path: string, callback: (err?: Error | null) => void) =>
      callback(null),
    );
    const stat: any = jest.fn();
    stat.mockImplementationOnce(
      (
        _path: string,
        callback: (
          err: Error | null,
          stats: {
            mode?: number;
            size?: number;
            mtime?: number;
            isFile?: () => boolean;
            isDirectory?: () => boolean;
            isSymbolicLink?: () => boolean;
          },
        ) => void,
      ) =>
        callback(null, {
          mode: 0,
          size: 7,
          mtime: 1700000000,
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false,
        }),
    );
    stat.mockImplementationOnce(
      (
        _path: string,
        callback: (
          err: Error | null,
          stats: {
            mode?: number;
            size?: number;
            mtime?: number;
            isFile?: () => boolean;
            isDirectory?: () => boolean;
            isSymbolicLink?: () => boolean;
          },
        ) => void,
      ) =>
        callback(null, {
          mode: 0o100644,
          size: 1,
          mtime: 1700000000,
        }),
    );
    const service = createFsService({
      sessionManager: {
        getSession: () =>
          ({
            ssh: { execCommand: jest.fn() },
            sftp: {
              stat,
              unlink,
              readdir: (
                _dirPath: string,
                callback: (
                  err: Error | null,
                  list: Array<{
                    filename: string;
                    attrs: { mode?: number; size?: number; mtime?: number };
                  }>,
                ) => void,
              ) =>
                callback(null, [
                  {
                    filename: "link.txt",
                    attrs: { mode: 0o120777, size: 0, mtime: 1700000000 },
                  },
                ]),
            },
          }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(service.statFile("session-1", "/tmp/dir")).resolves.toEqual(
      expect.objectContaining({ type: "directory", size: 7 }),
    );
    await expect(service.listDirectory("session-1", "/tmp")).resolves.toEqual({
      entries: [
        expect.objectContaining({
          name: "link.txt",
          type: "symlink",
        }),
      ],
    });
    await expect(service.removeRecursive("session-1", "/tmp/file")).resolves.toBe(true);
    expect(unlink).toHaveBeenCalledWith("/tmp/file", expect.any(Function));
  });

  test("wraps SFTP read, mkdir, and rename failures", async () => {
    const service = createFsService({
      sessionManager: {
        getSession: () =>
          ({
            ssh: { execCommand: jest.fn() },
            sftp: {
              readFile: (_path: string, callback: (err: Error | null, data: Buffer) => void) =>
                callback(new Error("read failed"), Buffer.alloc(0)),
              stat: (
                _path: string,
                callback: (
                  err: Error | null,
                  stats: { mode?: number; size?: number; mtime?: number },
                ) => void,
              ) => callback(new Error("missing"), { mode: 0 }),
              mkdir: (_path: string, callback: (err?: Error | null) => void) =>
                callback(Object.assign(new Error("mkdir failed"), { code: 2 })),
              rename: (_from: string, _to: string, callback: (err?: Error | null) => void) =>
                callback(new Error("rename failed")),
            },
          }) as any,
        getOSInfo: async () => createLinuxOSInfo(),
      },
      metrics: {
        recordFileRead: jest.fn(),
        recordFileWrite: jest.fn(),
      },
    } as any);

    await expect(service.readFile("session-1", "/tmp/demo")).rejects.toMatchObject({ code: "EFS" });
    await expect(service.makeDirectories("session-1", "/tmp/demo")).rejects.toMatchObject({
      code: "EFS",
    });
    await expect(service.renameFile("session-1", "/tmp/a", "/tmp/b")).rejects.toMatchObject({
      code: "EFS",
    });
  });
});
