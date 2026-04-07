import { afterEach, describe, expect, jest, test } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";
import { createTransferService, formatETA, formatSize, formatSpeed } from "../../src/transfer.js";

describe("createTransferService", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  test("uploads files with progress", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "transfer-test-"));
    const localPath = path.join(tempDir, "upload.txt");
    fs.writeFileSync(localPath, "hello world");
    const writeFile = jest.fn(
      (
        _remotePath: string,
        _data: Buffer,
        _options: object,
        callback: (err?: Error | null) => void,
      ) => callback(null),
    );
    const onProgress = jest.fn();

    const service = createTransferService({
      sessionManager: {
        getSession: () =>
          ({
            sftp: { writeFile },
          }) as any,
      },
    });

    const result = await service.uploadFileWithProgress(localPath, "/tmp/upload.txt", {
      sessionId: "session-1",
      onProgress,
    });

    expect(result.success).toBe(true);
    expect(result.size).toBe(11);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        percentage: 100,
      }),
    );
  });

  test("downloads files with progress", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "transfer-test-"));
    const localPath = path.join(tempDir, "download.txt");
    const onProgress = jest.fn();

    const service = createTransferService({
      sessionManager: {
        getSession: () =>
          ({
            sftp: {
              stat: (
                _remotePath: string,
                callback: (err: Error | null, stats: { size: number }) => void,
              ) => callback(null, { size: 5 }),
              readFile: (
                _remotePath: string,
                callback: (err: Error | null, data: Buffer) => void,
              ) => callback(null, Buffer.from("hello")),
            },
          }) as any,
      },
    });

    const result = await service.downloadFileWithProgress("/tmp/remote.txt", localPath, {
      sessionId: "session-1",
      onProgress,
    });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(localPath, "utf8")).toBe("hello");
    expect(onProgress).toHaveBeenCalled();
  });

  test("rejects missing SFTP sessions", async () => {
    const service = createTransferService({
      sessionManager: {
        getSession: () => ({ ssh: {} }) as any,
      },
    });

    await expect(
      service.uploadFileWithProgress("a", "b", { sessionId: "session-1" }),
    ).rejects.toThrow("SFTP subsystem is unavailable");
  });

  test("rejects missing sessions", async () => {
    const service = createTransferService({
      sessionManager: {
        getSession: () => undefined,
      },
    });

    await expect(
      service.downloadFileWithProgress("remote", "local", { sessionId: "missing" }),
    ).rejects.toThrow("Session not found or expired");
  });

  test("formats transfer metrics", () => {
    expect(formatSpeed(2048)).toContain("KB/s");
    expect(formatSpeed(1024 * 1024)).toContain("MB/s");
    expect(formatSpeed(12)).toBe("12 B/s");
    expect(formatSize(1024 * 1024 * 1024)).toContain("GB");
    expect(formatSize(1024 * 1024)).toContain("MB");
    expect(formatSize(1024)).toContain("KB");
    expect(formatSize(5)).toBe("5 B");
    expect(formatETA(61)).toBe("1m 1s");
    expect(formatETA(5)).toBe("5s");
    expect(formatETA(3605)).toBe("1h 0m");
  });

  test("wraps SFTP callback failures for upload and download", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "transfer-test-"));
    const localPath = path.join(tempDir, "upload.txt");
    fs.writeFileSync(localPath, "hello");

    const uploadService = createTransferService({
      sessionManager: {
        getSession: () =>
          ({
            sftp: {
              writeFile: (
                _remotePath: string,
                _data: Buffer,
                _options: object,
                callback: (err?: Error | null) => void,
              ) => callback(new Error("upload failed")),
            },
          }) as any,
      },
    });

    await expect(
      uploadService.uploadFileWithProgress(localPath, "/tmp/upload.txt", {
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Failed to upload");

    const downloadService = createTransferService({
      sessionManager: {
        getSession: () =>
          ({
            sftp: {
              stat: (
                _remotePath: string,
                callback: (err: Error | null, stats: { size: number }) => void,
              ) => callback(new Error("stat failed"), { size: 0 }),
              readFile: (
                _remotePath: string,
                callback: (err: Error | null, data: Buffer) => void,
              ) => callback(new Error("read failed"), Buffer.alloc(0)),
            },
          }) as any,
      },
    });

    await expect(
      downloadService.downloadFileWithProgress("/tmp/remote.txt", localPath, {
        sessionId: "session-1",
      }),
    ).rejects.toThrow("Failed to download");
  });
});
