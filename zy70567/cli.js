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
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`无效CIDR前缀: ${prefixStr}`);
  }
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

function generateMarkdownReport(result) {
  const lines = [];
  lines.push("# IP 段重叠检测报告");
  lines.push("");
  lines.push("## 执行摘要");
  lines.push("");
  lines.push(`- **总条目数**: ${result.totalEntries}`);
  lines.push(`- **有效条目**: ${result.validEntries}`);
  lines.push(`- **坏行数量**: ${result.badEntries.length}`);
  lines.push(`- **重叠数量**: ${result.overlappingPairs.length}`);
  lines.push(`- **检测结果**: ${result.overlappingPairs.length > 0 ? "⚠️ 发现重叠" : "✅ 无重叠"}`);
  lines.push("");
  
  if (result.overlappingPairs.length > 0) {
    lines.push("## 重叠详情");
    lines.push("");
    result.overlappingPairs.forEach((p, idx) => {
      lines.push(`### 重叠 #${idx + 1}: \`${p.overlapCidr}\``);
      lines.push("");
      lines.push("| 条目 | 行号 | CIDR | 团队 | 用途 | 环境 |");
      lines.push("|------|------|------|------|------|------|");
      lines.push(`| Entry 1 | ${p.entry1.lineNumber} | \`${p.entry1.cidr}\` | ${p.entry1.team} | ${p.entry1.purpose} | ${p.entry1.environment} |`);
      lines.push(`| Entry 2 | ${p.entry2.lineNumber} | \`${p.entry2.cidr}\` | ${p.entry2.team} | ${p.entry2.purpose} | ${p.entry2.environment} |`);
      lines.push("");
    });
  }
  
  if (result.teamSummaries && result.teamSummaries.length > 0) {
    lines.push("## 团队归属汇总");
    lines.push("");
    lines.push("| 团队 | 网段数 | 重叠次数 | 环境 | 用途 |");
    lines.push("|------|--------|----------|------|------|");
    result.teamSummaries.forEach(ts => {
      const status = ts.overlappingCount > 0 ? "⚠️" : "✅";
      lines.push(`| ${status} ${ts.team} | ${ts.totalRanges} | ${ts.overlappingCount} | ${ts.environments.join(", ")} | ${ts.purposes.join(", ")} |`);
    });
    lines.push("");
  }
  
  if (result.badEntries.length > 0) {
    lines.push("## 坏行详情");
    lines.push("");
    lines.push("| 行号 | 原因 | 原始内容 |");
    lines.push("|------|------|----------|");
    result.badEntries.forEach(b => {
      lines.push(`| ${b.lineNumber} | ${b.reason} | \`${(b.rawContent || "").slice(0, 50)}\` |`);
    });
    lines.push("");
  }
  
  lines.push("---");
  lines.push(`*生成时间: ${new Date().toISOString()}*`);
  return lines.join("\n");
}

const program = new Command();
program.name("ip-overlap").description("IP段重叠检测CLI工具").version("1.0.0");
program.requiredOption("-i, --input <path>", "输入CSV文件路径");
program.option("-j, --json <path>", "输出JSON结果文件路径");
program.option("-m, --markdown <path>", "输出Markdown报告文件路径");
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
  const teamSummaries = generateTeamSummaries(valid, overlappingPairs);
  
  console.log("\n=== IP Overlap Analysis ===");
  console.log("Total entries:", valid.length + bad.length);
  console.log("Valid entries:", valid.length);
  console.log("Bad entries:", bad.length);
  console.log("");
  if (overlappingPairs.length > 0) {
    console.log("WARNING: 发现 " + overlappingPairs.length + " 个重叠!");
    overlappingPairs.forEach((p, idx) => {
      console.log(`Overlap #${idx + 1}: ${p.overlapCidr}`);
      console.log(`  [line ${p.entry1.lineNumber}] ${p.entry1.cidr} | ${p.entry1.team} | ${p.entry1.purpose}`);
      console.log(`  [line ${p.entry2.lineNumber}] ${p.entry2.cidr} | ${p.entry2.team} | ${p.entry2.purpose}`);
    });
  } else {
    console.log("OK: 未发现IP重叠");
  }
  
  console.log("\n=== 团队归属汇总 ===");
  teamSummaries.forEach(ts => {
    const status = ts.overlappingCount > 0 ? "WARNING" : "OK";
    console.log(`${status} ${ts.team}: ${ts.totalRanges} 网段, ${ts.overlappingCount} 重叠 | 环境:${ts.environments.join(",")} | 用途:${ts.purposes.join(",")}`);
  });
  
  if (bad.length > 0) {
    console.log("\nERROR: Bad entries:");
    bad.forEach(b => console.log(`  [line ${b.lineNumber}] ${b.reason}`));
  }
  console.log("");
  
  const result = { totalEntries: valid.length + bad.length, validEntries: valid.length, badEntries: bad, overlappingPairs, teamSummaries };
  
  if (options.json) {
    const cleanPairs = overlappingPairs.map(p => ({
      overlapCidr: p.overlapCidr,
      entry1: { lineNumber: p.entry1.lineNumber, cidr: p.entry1.cidr, team: p.entry1.team, purpose: p.entry1.purpose, environment: p.entry1.environment },
      entry2: { lineNumber: p.entry2.lineNumber, cidr: p.entry2.cidr, team: p.entry2.team, purpose: p.entry2.purpose, environment: p.entry2.environment }
    }));
    const jsonResult = { ...result, overlappingPairs: cleanPairs };
    fs.writeFileSync(options.json, JSON.stringify(jsonResult, null, 2), "utf8");
    console.log("JSON输出已写入:", options.json);
  }
  
  if (options.markdown) {
    const mdContent = generateMarkdownReport(result);
    fs.writeFileSync(options.markdown, mdContent, "utf8");
    console.log("Markdown报告已写入:", options.markdown);
  }
  
  return overlappingPairs.length > 0 || bad.length > 0 ? 2 : 0;
}

try { process.exit(main()); }
catch (e) { console.error("ERROR:", e.message); process.exit(1); }