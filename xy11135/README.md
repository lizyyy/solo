# 文印店打印队列排错 CLI

专为文印店场景设计的打印队列问题排查工具，自动检测任务重试、打印机改名、失败任务等问题，并生成排错报告和可复跑队列。

## 项目结构

```
.
├── src/
│   ├── cli.js         # 主入口
│   ├── parser.js      # 解析模块
│   ├── validator.js   # 校验模块
│   └── reporter.js    # 报告生成模块
├── examples/
│   └── print-queue.txt # 样例输入
├── test/
│   └── run-test.js    # 测试脚本
└── package.json
```

## 功能特性

- ✅ 解析打印队列数据
- 🔍 检测任务重试记录（超过阈值报警）
- 🔄 检测打印机名称变化
- ❌ 识别失败和卡住的任务
- 📋 生成详细排错报告
- 🔁 输出可复跑队列文件
- ⚡ 智能退出码提示处理结果

## 文印店真实处理流程

### 第一步：预览排查结果

先预览问题，不生成文件：

```bash
node src/cli.js examples/print-queue.txt --preview
```

**预期输出：**
- 显示解析的任务总数
- 展示问题统计（错误、警告、提示）
- 列出建议重跑的任务

### 第二步：正式执行排错

确认后正式执行，生成报告和可复跑队列：

```bash
node src/cli.js examples/print-queue.txt
```

**预期输出：**
```
📂 正在解析打印队列: examples/print-queue.txt
✅ 解析完成，共发现 12 个打印任务
🔍 正在校验任务...

==================================================
📊 文印店打印队列排错 - 执行摘要
==================================================
总任务: 12
❌ 错误: 2
⚠️  警告: 2
ℹ️  提示: 0
🔄 建议重跑: 4
==================================================

📝 正在生成报告...
✅ 报告已生成: output/debug-report-2024-05-19.txt
🔄 可复跑队列已生成: output/rerun-queue-2024-05-19.txt
⚡ 检测到部分问题，退出码: 2 (PARTIAL_SUCCESS)
```

### 第三步：查看详细报告

查看生成的排错报告：

```bash
cat output/debug-report-*.txt
```

**报告包含：**
1. 概览统计
2. 问题详情（任务重试、打印机改名、失败任务等）
3. 建议重跑任务列表
4. 完整任务状态清单

查看可复跑队列：

```bash
cat output/rerun-queue-*.txt
```

## 退出码说明

| 退出码 | 含义 | 场景 |
|--------|------|------|
| 0 | 完全成功 | 无任何问题 |
| 2 | 部分成功 | 存在警告或可重跑任务 |
| 1 | 错误 | 存在严重错误 |

## 样例输入说明

`examples/print-queue.txt` 包含典型文印店场景：
- 多次重试的任务（员工手册修订版）
- 改名的打印机（HP-LaserJet-(重命名)1楼、HP-LaserJet-2楼-new）
- 失败和卡住的任务
- 正常完成的任务

## 运行测试

```bash
npm test
```

测试内容包括：
1. 帮助信息显示
2. 预览模式执行
3. 完整执行模式
4. 报告文件生成验证
5. 可复跑队列验证

## 模块说明

### [parser.js](file:///Users/mac/pro/solo/workspaces/xy11135/src/parser.js)
- `parsePrintQueue()`: 解析队列文件为结构化数据
- `parseRetryHistory()`: 分析任务重试历史

### [validator.js](file:///Users/mac/pro/solo/workspaces/xy11135/src/validator.js)
- `validateJobs()`: 执行完整校验，返回问题列表
- `generateRerunJobs()`: 生成建议重跑的任务列表

### [reporter.js](file:///Users/mac/pro/solo/workspaces/xy11135/src/reporter.js)
- `generateReport()`: 生成排错报告和可复跑队列
- `printConsoleSummary()`: 在控制台输出摘要

## 自定义配置

在 `src/validator.js` 中可调整：
- `MAX_RETRY_ALLOWED`: 最大允许重试次数（默认3）
- `RENAME_INDICATORS`: 打印机改名识别关键词
- `suggestAlternativePrinter()`: 备用打印机建议规则
