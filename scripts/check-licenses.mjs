import { execFileSync } from "node:child_process";

const forbiddenLicensePattern = /(^|[^A-Z])(?:AGPL|GPL)(?:[^A-Z]|$)/iu;
const pnpmArgs = ["licenses", "list", "--prod", "--json"];

function runPnpm(args) {
  const command = `corepack pnpm ${args.join(" ")}`;

  if (process.platform === "win32") {
    return execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
      encoding: "utf8",
      windowsHide: true,
    });
  }

  try {
    return execFileSync("corepack", ["pnpm", ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
  } catch {
    return execFileSync("pnpm", args, {
      encoding: "utf8",
      windowsHide: true,
    });
  }
}

const rawOutput = runPnpm(pnpmArgs);

const payload = JSON.parse(rawOutput);
const entries = Array.isArray(payload) ? payload : Object.values(payload).flat();
const violations = [];

for (const entry of entries) {
  const name = entry.name ?? entry.packageName ?? entry.package ?? "unknown";
  const version = Array.isArray(entry.versions)
    ? entry.versions.join(",")
    : (entry.version ?? "unknown");
  const license = String(entry.license ?? entry.licenses ?? "UNLICENSED");

  if (forbiddenLicensePattern.test(license)) {
    violations.push(`${name}@${version}: ${license}`);
  }
}

if (violations.length > 0) {
  console.error("Forbidden production dependency licenses found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(
  `Checked ${entries.length} production dependency licenses; no GPL/AGPL licenses found.`,
);
