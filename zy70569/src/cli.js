#!/usr/bin/env node
import { Command } from "commander";
import { readSamples, readRules } from "./fileReader.js";
import { compareSamples } from "./sampleComparer.js";
import { printSummary, exportJSON, exportHTML } from "./reportGenerator.js";
const program = new Command();
program.name("cdn-cache-sim").description("CDN缓存键模拟CLI工具").version("1.0.0");
program.command("analyze").description("分析URL样本并生成缓存键报告").requiredOption("-s, --samples <file>", "URL样本文件 (CSV/JSON)").requiredOption("-r, --rules <file>", "缓存规则配置文件 (JSON)").option("-j, --json <output>", "导出JSON报告").option("-h, --html <output>", "导出HTML报告").option("--no-summary", "不显示终端摘要").action(async (opts) => { try { const samples = await readSamples(opts.samples); const rules = await readRules(opts.rules); const results = compareSamples(samples, rules); if (opts.summary) printSummary(results); if (opts.json) await exportJSON(results, opts.json); if (opts.html) await exportHTML(results, opts.html, rules); } catch (e) { console.error("错误:", e.message); process.exit(1); } });
program.parse();