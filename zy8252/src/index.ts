#!/usr/bin/env node

import { Command } from "commander";
import { registerValidateCommand } from "./commands/validate";
import { registerRunCommand } from "./commands/run";
import { registerExportCommand } from "./commands/export";

const program = new Command();

program
  .name("beacon-inspector")
  .description("海事航标灯巡检包复核工具 - 用于换季前航标灯巡检数据的校验、分析和报告生成")
  .version("1.0.0");

registerValidateCommand(program);
registerRunCommand(program);
registerExportCommand(program);

program.addHelpText(
  "after",
  `

示例命令:
  # 校验数据
  $ beacon-inspector validate --data-dir ./sample_data

  # 运行数据处理
  $ beacon-inspector run --data-dir ./sample_data --output ./output

  # 导出报告
  $ beacon-inspector export --data-dir ./sample_data --output-dir ./output

工作流程:
  1. validate - 校验输入文件的字段格式和坐标有效性
  2. run - 按天重建每个航标的电池余量、灯质状态、告警消缺和恶劣天气复巡窗口
  3. export - 导出 issues.csv 与 beacon_report.md

输入文件格式:
  - buoys.csv: 航标基本信息
  - battery_logs.jsonl: 电池日志记录（JSON Lines格式）
  - repairs.csv: 维修和巡检记录
  - weather.csv: 天气记录
  - lamp_rules.yaml: 灯质规则配置
`
);

program.parse(process.argv);
