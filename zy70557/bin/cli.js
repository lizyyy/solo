#!/usr/bin/env node
const fs = require("fs");

function showHelp() {
  console.log("S3权限策略压缩CLI工具\n\n用法:\n  s3-policy-compactor [选项] <输入文件>\n\n选项:\n  -o, --output <文件>    输出压缩后的策略JSON文件\n  -j, --json <文件>      输出机器可读结果(JSON格式)\n  -r, --report <文件>    输出Markdown审计报告\n  -f, --force            覆盖已存在的输出文件\n  -h, --help             显示帮助信息\n\n退出码:\n  0  成功，无问题\n  1  成功，但存在问题需要注意\n  2  解析错误\n  3  IO错误\n  4  验证错误");
}

function parseArgs(args) {
  const options = { input: null, output: null, jsonOutput: null, report: null, force: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-h": case "--help": showHelp(); process.exit(0);
      case "-o": case "--output": options.output = args[++i]; break;
      case "-j": case "--json": options.jsonOutput = args[++i]; break;
      case "-r": case "--report": options.report = args[++i]; break;
      case "-f": case "--force": options.force = true; break;
      default: if (!arg.startsWith("-")) options.input = arg;
    }
  }
  if (!options.input) { console.error("错误: 必须指定输入文件"); showHelp(); process.exit(3); }
  return options;
}

function parsePolicy(content) {
  const errors = [];
  let policy = null;
  try { policy = JSON.parse(content); } catch (e) {
    errors.push({ line: 1, column: 1, message: e.message, context: "" });
    return { policy: null, errors };
  }
  if (!policy.Version) errors.push({ line: 0, column: 0, message: "缺少 Version 字段", context: "" });
  if (!policy.Statement) errors.push({ line: 0, column: 0, message: "缺少 Statement 字段", context: "" });
  if (policy.Statement && !Array.isArray(policy.Statement)) policy.Statement = [policy.Statement];
  return { policy, errors };
}

function normalizeArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePrincipal(principal) {
  if (!principal) return null;
  if (typeof principal === "string") return { AWS: [principal] };
  const normalized = {};
  for (const [key, value] of Object.entries(principal)) {
    normalized[key] = normalizeArray(value);
  }
  return normalized;
}

function principalsEqual(p1, p2) {
  const np1 = normalizePrincipal(p1);
  const np2 = normalizePrincipal(p2);
  if (!np1 || !np2) return np1 === np2;
  const keys1 = Object.keys(np1).sort();
  const keys2 = Object.keys(np2).sort();
  if (JSON.stringify(keys1) !== JSON.stringify(keys2)) return false;
  for (const key of keys1) {
    const arr1 = [...np1[key]].sort();
    const arr2 = [...np2[key]].sort();
    if (JSON.stringify(arr1) !== JSON.stringify(arr2)) return false;
  }
  return true;
}

function conditionsEqual(c1, c2) {
  if (!c1 || !c2) return c1 === c2;
  return JSON.stringify(c1) === JSON.stringify(c2);
}

function canMergeStatements(s1, s2) {
  if (s1.Effect !== s2.Effect) return false;
  if (!principalsEqual(s1.Principal, s2.Principal)) return false;
  if (!conditionsEqual(s1.Condition, s2.Condition)) return false;
  return true;
}

function mergeStatements(statements) {
  if (statements.length < 2) return statements[0];
  const base = statements[0];
  const allActions = new Set();
  const allResources = new Set();
  for (const stmt of statements) {
    normalizeArray(stmt.Action).forEach(a => allActions.add(a));
    normalizeArray(stmt.Resource).forEach(r => allResources.add(r));
  }
  return { ...base, Action: Array.from(allActions).sort(), Resource: Array.from(allResources).sort() };
}

function findOverlyBroadIssues(statement, index) {
  const issues = [];
  const actions = normalizeArray(statement.Action);
  const resources = normalizeArray(statement.Resource);
  for (const action of actions) {
    if (action === "s3:*" || action === "*") {
      issues.push({ type: "overly_broad", severity: "high", statementIndex: index, field: "Action", value: action, message: "动作权限过宽: " + action, suggestion: "建议使用更具体的动作，如 s3:GetObject" });
    }
  }
  for (const resource of resources) {
    if (resource === "*" || resource === "arn:aws:s3:::*") {
      issues.push({ type: "overly_broad", severity: "critical", statementIndex: index, field: "Resource", value: resource, message: "资源权限过宽，匹配所有bucket: " + resource, suggestion: "强烈建议限制到具体的bucket" });
    } else if (resource.endsWith("*")) {
      issues.push({ type: "overly_broad", severity: "medium", statementIndex: index, field: "Resource", value: resource, message: "资源路径使用过宽通配符: " + resource, suggestion: "建议限制到具体的前缀或对象" });
    }
  }
  return issues;
}

function compactPolicy(policy) {
  const issues = [];
  const mergeCandidates = [];
  const statements = [...policy.Statement];
  for (let i = 0; i < statements.length; i++) {
    issues.push(...findOverlyBroadIssues(statements[i], i));
  }
  const used = new Set();
  for (let i = 0; i < statements.length; i++) {
    if (used.has(i)) continue;
    const group = [i];
    used.add(i);
    for (let j = i + 1; j < statements.length; j++) {
      if (used.has(j)) continue;
      if (canMergeStatements(statements[i], statements[j])) {
        group.push(j);
        used.add(j);
      }
    }
    if (group.length > 1) {
      const merged = mergeStatements(group.map(idx => statements[idx]));
      mergeCandidates.push({ statementIndices: group, mergedStatement: merged, reason: "主体、效果、条件相同，合并动作和资源" });
    }
  }
  const compactedStatements = [...statements];
  for (const mc of mergeCandidates) {
    for (const idx of mc.statementIndices.sort((a, b) => b - a)) {
      compactedStatements.splice(idx, 1);
    }
    compactedStatements.splice(mc.statementIndices[0], 0, mc.mergedStatement);
  }
  const originalCount = statements.length;
  const compactedCount = compactedStatements.length;
  const issueCount = {};
  for (const issue of issues) {
    issueCount[issue.type] = (issueCount[issue.type] || 0) + 1;
  }
  return { originalPolicy: policy, compactedPolicy: { ...policy, Statement: compactedStatements }, issues, mergeCandidates, parseErrors: [], stats: { originalStatementCount: originalCount, compactedStatementCount: compactedCount, reductionPercent: originalCount > 0 ? ((originalCount - compactedCount) / originalCount * 100) : 0, issueCount } };
}

function generateReport(result, inputFile) {
  const lines = [];
  lines.push("# S3 Bucket 策略审计报告");
  lines.push("");
  lines.push("生成时间: " + new Date().toLocaleString("zh-CN"));
  lines.push("分析文件: " + inputFile);
  lines.push("");
  lines.push("## 执行摘要");
  lines.push("");
  lines.push("| 指标 | 值 |");
  lines.push("|------|----|");
  lines.push("| 原始语句数 | " + result.stats.originalStatementCount + " |");
  lines.push("| 压缩后语句数 | " + result.stats.compactedStatementCount + " |");
  lines.push("| 压缩率 | " + result.stats.reductionPercent.toFixed(1) + "% |");
  lines.push("| 发现问题数 | " + result.issues.length + " |");
  lines.push("");
  if (result.issues.length > 0) {
    lines.push("## 问题详细列表");
    lines.push("");
    const bySeverity = { critical: [], high: [], medium: [], low: [] };
    for (const issue of result.issues) {
      bySeverity[issue.severity].push(issue);
    }
    const severityLabels = { critical: "🚨 严重 (Critical)", high: "🔴 高 (High)", medium: "⚠️ 中 (Medium)", low: "ℹ️ 低 (Low)" };
    for (const sev of ["critical", "high", "medium", "low"]) {
      if (bySeverity[sev].length > 0) {
        lines.push("### " + severityLabels[sev]);
        lines.push("");
        for (const issue of bySeverity[sev]) {
          lines.push("#### 语句 #" + issue.statementIndex + " - " + issue.type);
          lines.push("");
          lines.push("- 字段: " + issue.field);
          lines.push("- 值: `" + issue.value + "`");
          lines.push("- 描述: " + issue.message);
          if (issue.suggestion) lines.push("- 建议: " + issue.suggestion);
          lines.push("");
        }
      }
    }
  }
  if (result.mergeCandidates.length > 0) {
    lines.push("## 合并操作明细");
    lines.push("");
    for (let i = 0; i < result.mergeCandidates.length; i++) {
      const mc = result.mergeCandidates[i];
      lines.push("### 合并 #" + (i + 1));
      lines.push("");
      lines.push("- 合并语句: #" + mc.statementIndices.join(", #"));
      lines.push("- 合并原因: " + mc.reason);
      lines.push("");
    }
  }
  lines.push("## 压缩后策略");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(result.compactedPolicy, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("*此报告由 S3 Policy Compactor 工具自动生成*");
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  // Check for existing output files
  const outputFiles = [options.output, options.jsonOutput, options.report].filter(Boolean);
  for (const f of outputFiles) {
    if (fs.existsSync(f) && !options.force) {
      console.error("错误: 文件已存在: " + f);
      console.error("使用 -f 或 --force 选项覆盖");
      process.exit(3);
    }
  }
  try {
    const inputContent = fs.readFileSync(options.input, "utf8");
    const parseResult = parsePolicy(inputContent);
    if (parseResult.errors.length > 0) {
      console.error("解析错误:");
      parseResult.errors.forEach(err => console.error("  行 " + err.line + ": " + err.message));
      process.exit(2);
    }
    const compactResult = compactPolicy(parseResult.policy);
    console.log("");
    console.log("=== 策略压缩摘要 ===");
    console.log("原始语句数: " + compactResult.stats.originalStatementCount);
    console.log("压缩后语句数: " + compactResult.stats.compactedStatementCount);
    console.log("压缩率: " + compactResult.stats.reductionPercent.toFixed(1) + "%");
    console.log("");
    if (compactResult.issues.length > 0) {
      console.log("发现 " + compactResult.issues.length + " 个问题:");
      compactResult.issues.forEach(issue => {
        const severityIcon = { low: "ℹ️", medium: "⚠️", high: "🔴", critical: "🚨" }[issue.severity];
        console.log("  " + severityIcon + " 语句 " + issue.statementIndex + " [" + issue.type + "]: " + issue.message);
      });
      console.log("");
    }
    if (compactResult.mergeCandidates.length > 0) {
      console.log("合并了 " + compactResult.mergeCandidates.length + " 组重复授权:");
      compactResult.mergeCandidates.forEach((mc, idx) => {
        console.log("  合并 #" + (idx + 1) + ": 语句 " + mc.statementIndices.join(", ") + " → " + mc.reason);
      });
      console.log("");
    }
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(compactResult.compactedPolicy, null, 2));
      console.log("✓ 压缩策略已保存到: " + options.output);
    }
    if (options.jsonOutput) {
      fs.writeFileSync(options.jsonOutput, JSON.stringify(compactResult, null, 2));
      console.log("✓ 机器可读结果已保存到: " + options.jsonOutput);
    }
    if (options.report) {
      const report = generateReport(compactResult, options.input);
      fs.writeFileSync(options.report, report);
      console.log("✓ Markdown报告已保存到: " + options.report);
    }
    console.log("");
    const hasIssues = compactResult.issues.length > 0;
    const hasCritical = compactResult.issues.some(i => i.severity === "critical");
    if (hasCritical) { console.log("🚨 存在严重问题，请查看报告详情"); process.exit(1); }
    else if (hasIssues) { console.log("⚠️ 存在需要注意的问题"); process.exit(1); }
    else { console.log("✓ 策略压缩完成，无重大问题"); process.exit(0); }
  } catch (err) {
    console.error("错误: " + err.message);
    process.exit(3);
  }
}
main();
