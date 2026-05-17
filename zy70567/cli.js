#!/usr/bin/env node

const fs = require("fs");
const { Command } = require("commander");

function ipToBigint(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`无效IP地址: ${ip}`);
  }
  return (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
}

function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = parseInt(prefixStr || "32", 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`无效CIDR前缀: ${prefixStr}`);
  }
  const ipNum = ipToBigint(ip);
  const mask = prefix === 0 ? 0n : (0xffffffffn << BigInt(32 - prefix));
  return { start: ipNum & mask, end: (ipNum & mask) | (~mask & 0xffffffffn) };
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
  const lines = content.split("\n");
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
        pairs.push({ entry1: e1, entry2: e2, overlapStart, overlapEnd });
      }
    }
  }
  return pairs;
}

const program = new Command();
program.name("ip-overlap").description("IP段重叠检测CLI工具").version("1.0.0");
program.requiredOption("-i, --input <path>", "输入CSV文件路径");
program.option("-j, --json <path>", "输出JSON结果文件路径");
program.parse(process.argv);
const options = program.opts();

function main() {
  if (!fs.existsSync(options.input)) {
    console.error("ERROR: 输入文件不存在:", options.input);
    return 1;
  }
  const content = fs.readFileSync(options.input, "utf8");
  const { valid, bad } = parseInput(content);
  const overlappingPairs = detectOverlaps(valid);
  
  console.log("\n=== IP Overlap Analysis ===");
  console.log("Total entries:", valid.length + bad.length);
  console.log("Valid entries:", valid.length);
  console.log("Bad entries:", bad.length);
  console.log("");
  if (overlappingPairs.length > 0) {
    console.log("WARNING: 发现 " + overlappingPairs.length + " 个重叠!");
    overlappingPairs.forEach((p, idx) => {
      console.log(`Overlap #${idx + 1}: ${p.entry1.cidr} (${p.entry1.team}) vs ${p.entry2.cidr} (${p.entry2.team})`);
    });
  } else {
    console.log("OK: 未发现IP重叠");
  }
  if (bad.length > 0) {
    console.log("\nERROR: Bad entries:");
    bad.forEach(b => console.log(`  [line ${b.lineNumber}] ${b.reason}`));
  }
  console.log("");
  if (options.json) {
    const cleanPairs = overlappingPairs.map(p => ({
      entry1: { lineNumber: p.entry1.lineNumber, cidr: p.entry1.cidr, team: p.entry1.team, purpose: p.entry1.purpose, environment: p.entry1.environment },
      entry2: { lineNumber: p.entry2.lineNumber, cidr: p.entry2.cidr, team: p.entry2.team, purpose: p.entry2.purpose, environment: p.entry2.environment }
    }));
    const result = { totalEntries: valid.length + bad.length, validEntries: valid.length, badEntries: bad, overlappingPairs: cleanPairs };
    fs.writeFileSync(options.json, JSON.stringify(result, null, 2), "utf8");
    console.log("JSON输出已写入:", options.json);
  }
  return overlappingPairs.length > 0 || bad.length > 0 ? 2 : 0;
}

try { process.exit(main()); }
catch (e) { console.error("ERROR:", e.message); process.exit(1); }