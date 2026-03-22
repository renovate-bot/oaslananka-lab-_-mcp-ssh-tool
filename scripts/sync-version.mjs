#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

console.log(`Syncing version ${version} to all files...`);

// mcp.json
const mcpJsonPath = path.join(root, 'mcp.json');
if (fs.existsSync(mcpJsonPath)) {
  const mcpJson = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
  mcpJson.version = version;
  fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2) + '\n');
  console.log('  Updated: mcp.json');
}

// registry/mcp-ssh-tool/mcp.json
const regPath = path.join(root, 'registry', 'mcp-ssh-tool', 'mcp.json');
if (fs.existsSync(regPath)) {
  const regJson = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  regJson.version = version;
  fs.writeFileSync(regPath, JSON.stringify(regJson, null, 2) + '\n');
  console.log('  Updated: registry/mcp-ssh-tool/mcp.json');
}

// src/mcp.ts — server version string
const mcpTsPath = path.join(root, 'src', 'mcp.ts');
if (fs.existsSync(mcpTsPath)) {
  let mcpTs = fs.readFileSync(mcpTsPath, 'utf8');
  mcpTs = mcpTs.replace(
    /version: ['"][0-9]+\.[0-9]+\.[0-9]+['"]/,
    `version: '${version}'`
  );
  fs.writeFileSync(mcpTsPath, mcpTs);
  console.log('  Updated: src/mcp.ts');
}

console.log(`\nDone. All files synced to version ${version}`);
