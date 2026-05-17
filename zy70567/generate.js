#!/usr/bin/env python3
import sys

js_code = '''#!/usr/bin/env node

const fs = require("fs");
const { Command } = require("commander");

function ipToBigint(ip) {
  const parts = ip.split(".").map(Number);
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

function bigintToIp(n) {
  return [
    Number((n >> 24n) & 0xffn),
    Number((n >> 16n) & 0xffn),
    Number((n >> 8n) & 0xffn),
    Number(n & 0xffn)
  ].join(".");
}

function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr || "32", 10);
  const ipNum = ipToBigint(ip);
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
  return { start: ipNum & mask, end: (ipNum & mask) | (~mask & 0xffffffffn) };
}

function bigintToCidr(start, end) {
  if (start === end) return bigintToIp(start) + "/32";
  let prefix = 32;
  while (prefix > 0) {
    const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
    if ((start & mask) === start && (start | (~mask & 0xffffffffn)) >= end) break;
    prefix--;
  }
  return bigintToIp(start) + "/" + prefix;
}

function parseLine(line, lineNumber) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const parts = trimmed.split(/[,]/).map(p => p.trim());
  if (parts.length < 4) return { lineNumber, rawContent: line, reason: "Not enough fields" };
  const [cidr, team, purpose, environment] = parts;
  try {
    const range = parseCidr(cidr);
    return { lineNumber, cidr, team, purpose, environment, startIp: range.start, endIp: range.end };
  } catch (e) {
    return { lineNumber, rawContent: line, reason: "CIDR parse failed" };
  }
}

function parseInput(content) {
  const lines = content.split("\\n");
  const valid = [], bad = [];
  lines.forEach((line, index) => {
    const result = parseLine(line, index + 1);
    if (result && "cidr" in result) valid.push(result);
    else if (result && "reason" in result) bad.push(result);
  });
  return { valid, bad };
}

function detectOverlaps(entries) {
  const sorted = [...entries].sort((a, b) => a.startIp < b.startIp ? -1 : 1);
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const e1 = sorted[i], e2 = sorted[j];
      if (e2.startIp > e1.endIp) break;
      const overlapStart = e1.startIp > e2.startIp ? e1.startIp : e2.startIp;
      const overlapEnd = e1.endIp < e2.endIp ? e1.endIp : e2.endIp;
      if (overlapStart <= overlapEnd) {
        pairs.push({ entry1: e1, entry2: e2, overlapStart, overlapEnd, overlapCidr: bigintToCidr(overlapStart, overlapEnd) });
      }
    }
  }
  return pairs;
}

function generateTeamSummaries(entries, overlaps) {
  const teamMap = new Map();
  entries.forEach(e => {
    if (!teamMap.has(e.team)) {
      teamMap.set(e.team, { entries: [], overlappingCount: 0 });
    }
    teamMap.get(e.team).entries.push(e);
  });
  overlaps.forEach(p => {
    const t1 = teamMap.get(p.entry1.team);
    const t2 = teamMap.get(p.entry2.team);
    t1.overlappingCount++;
    if (p.entry1.team !== p.entry2.team) t2.overlappingCount++;
  });
  return Array.from(teamMap.entries()).map(([team, data]) => ({
    team,
    totalRanges: data.entries.length,
    environments: [...new Set(data.entries.map(e => e.environment))],
    purposes: [...new Set(data.entries.map(e => e.purpose))],
    overlappingCount: data.overlappingCount
  })).sort((a, b) => b.overlappingCount - a.overlappingCount);
}

function printTerminalSummary(result) {
  console.log("");
  console.log("=== IP Overlap Analysis Summary ===");
  console.log("Total entries:", result.totalEntries);
  console.log("Valid entries:", result.validEntries);
  console.log("Bad entries:", result.badEntries.length);
  console.log("");
  if (result.overlappingPairs.length > 0) {
    console.log("WARNING: Found", result.overlappingPairs.length, "overlaps!");
    result.overlappingPairs.forEach((p, idx) => {
      console.log("Overlap #" + (idx + 1) + ": " + p.overlapCidr);
      console.log("  Entry 1 [line " + p.entry1.lineNumber + "]:", p.entry1.cidr, "|", p.entry1.team);
      console.log("  Entry 2 [line " + p.entry2.lineNumber + "]:", p.entry2.cidr, "|", p.entry2.team);
    });
  } else {
    console.log("OK: No IP overlaps detected");
  }
  if (result.badEntries.length > 0) {
    console.log("\\nERROR: Bad entries:");
    result.badEntries.forEach(b => console.log("  [line " + b.lineNumber + "]", b.reason));
  }
  console.log("\\n=== Team Statistics ===");
  result.teamSummaries.forEach(ts => {
    console.log((ts.overlappingCount > 0 ? "WARNING" : "OK"), ts.team + ":", ts.totalRanges, "ranges,", ts.overlappingCount, "overlaps");
  });
  console.log("");
}

const program = new Command();
program.name("ip-overlap").description("IP overlap detection CLI tool").version("1.0.0");
program.requiredOption("-i, --input <path>", "Input CSV file path");
program.option("-j, --json <path>", "Output JSON result file path");
program.parse(process.argv);
const options = program.opts();

function main() {
  if (!fs.existsSync(options.input)) {
    console.error("ERROR: Input file does not exist:", options.input);
    return 1;
  }
  const content = fs.readFileSync(options.input, "utf8");
  const { valid, bad } = parseInput(content);
  const overlappingPairs = detectOverlaps(valid);
  const teamSummaries = generateTeamSummaries(valid, overlappingPairs);
  const result = { totalEntries: valid.length + bad.length, validEntries: valid.length, badEntries: bad, overlappingPairs, teamSummaries };
  printTerminalSummary(result);
  if (options.json) {
    fs.writeFileSync(options.json, JSON.stringify(result, null, 2), "utf8");
    console.log("JSON output written to:", options.json);
  }
  return overlappingPairs.length > 0 || bad.length > 0 ? 2 : 0;
}

try { process.exit(main()); }
catch (e) { console.error("ERROR:", e.message); process.exit(1); }
'''

with open('final-cli.js', 'w') as f:
    f.write(js_code)

print(f"Written {len(js_code)} characters, {len(js_code.splitlines())} lines")