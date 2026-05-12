#!/usr/bin/env node

import path from "node:path";

function parsePackJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    const lines = output.split(/\r?\n/u);
    for (let start = 0; start < lines.length; start += 1) {
      const first = lines[start]?.trim() ?? "";
      if (!first.startsWith("[") && !first.startsWith("{")) {
        continue;
      }

      let candidate = "";
      for (let end = start; end < lines.length; end += 1) {
        candidate = candidate.length > 0 ? `${candidate}\n${lines[end]}` : (lines[end] ?? "");
        try {
          return JSON.parse(candidate.trim());
        } catch {
          // Keep extending because lifecycle logs may surround the JSON payload.
        }
      }
    }
    throw new SyntaxError("Unable to parse pnpm pack --json output");
  }
}

let output = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  output += chunk;
});
process.stdin.on("end", () => {
  const parsed = parsePackJson(output);
  const result = Array.isArray(parsed) ? parsed[0] : parsed;
  const filename = result?.filename ?? result?.name ?? result?.path;
  if (typeof filename !== "string" || filename.length === 0) {
    throw new Error("pnpm pack output did not contain a filename");
  }
  console.log(path.basename(filename));
});
