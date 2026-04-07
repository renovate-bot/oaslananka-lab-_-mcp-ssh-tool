import { describe, expect, test } from "@jest/globals";
import {
  createAuthError,
  createBadRequestError,
  createConnectionError,
  createFilesystemError,
  createPackageManagerError,
  createPatchError,
  createSudoError,
  createTimeoutError,
  wrapError,
} from "../../src/errors.js";
import { ErrorCode, SSHMCPError } from "../../src/types.js";

describe("error helpers", () => {
  test("create helpers return structured errors", () => {
    expect(createAuthError("auth").code).toBe(ErrorCode.EAUTH);
    expect(createConnectionError("conn").code).toBe(ErrorCode.ECONN);
    expect(createTimeoutError("timeout").code).toBe(ErrorCode.ETIMEOUT);
    expect(createSudoError("sudo").code).toBe(ErrorCode.ENOSUDO);
    expect(createPackageManagerError("pm").code).toBe(ErrorCode.EPMGR);
    expect(createFilesystemError("fs").code).toBe(ErrorCode.EFS);
    expect(createPatchError("patch").code).toBe(ErrorCode.EPATCH);
    expect(createBadRequestError("bad").recoverable).toBe(false);
  });

  test("wrapError preserves SSHMCPError instances", () => {
    const original = new SSHMCPError(ErrorCode.ECONN, "boom");
    expect(wrapError(original, ErrorCode.EFS)).toBe(original);
  });

  test("wrapError converts unknown errors", () => {
    const wrapped = wrapError(new Error("boom"), ErrorCode.EFS, "hint");

    expect(wrapped.code).toBe(ErrorCode.EFS);
    expect(wrapped.message).toBe("boom");
    expect(wrapped.hint).toBe("hint");
    expect(wrapped.toJSON()).toEqual(
      expect.objectContaining({
        code: ErrorCode.EFS,
        message: "boom",
      }),
    );
  });
});
