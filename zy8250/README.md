# Scheduler Audit CLI

一个用于巡检 macOS LaunchAgent 和 cron 定时任务的 TypeScript CLI 工具，帮助运维人员在交接班前检查定时任务是否存在漂移或异常。

## 功能特性

- 🔍 **多文件解析**: 支持解析 YAML、plist、cron dump、JSONL 和 CSV 格式的输入文件
- 📊 **全面检测**: 检测禁用任务、重复触发、跨时区误判、SLA 违规、脚本路径失效等多种问题
- 📝 **多格式输出**: 支持导出 issues.csv 和 scheduler_audit.md 报告
- 🔧 **详细错误报告**: 坏 YAML 或缺字段时，清晰报告文件、行号和字段信息

## 检测的问题类型

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| `DISABLED` | High | 任务被禁用 |
| `DUPLICATE_TRIGGER` | Medium | 多个任务有相同的触发时间 |
| `TIMEZONE_MISMATCH` | High | 时区配置不匹配 |
| `SLA_VIOLATION` | Critical | 超过 SLA 未运行 |
| `SCRIPT_PATH_INVALID` | Critical | 脚本路径不存在 |
| `EXPECTED_MISSING` | High | 实际任务不在预期配置中 |
| `ACTUAL_MISSING` | Critical | 预期任务在实际系统中不存在 |
| `SCHEDULE_MISMATCH` | High | 计划时间不匹配 |
| `COMMAND_MISMATCH` | High | 命令不匹配 |
| `ENVIRONMENT_MISMATCH` | Medium | 环境变量不匹配 |
| `OWNER_MISMATCH` | Medium | 负责人不匹配 |
| `ENABLED_MISMATCH` | High | 启用状态不匹配 |
| `UNEXPECTED_JOB` | Medium | 发现未预期的任务 |

## 安装

```bash
npm install
```

## 使用方法

### 命令概览

```bash
# 验证输入文件格式
npm run dev -- validate

# 执行完整的任务巡检
npm run dev -- audit

# 导出巡检结果
npm run dev -- export
```

### 全局选项

| 选项 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--expected-jobs <path>` | `-e` | `expected_jobs.yaml` | 预期任务 YAML 文件路径 |
| `--launch-agents-dir <path>` | `-l` | `launchagents` | LaunchAgents plist 目录路径 |
| `--cron-dump <path>` | `-c` | `cron_dump.txt` | cron 导出文件路径 |
| `--last-runs <path>` | `-r` | `last_runs.jsonl` | 上次运行记录 JSONL 文件路径 |
| `--owners <path>` | `-o` | `owners.csv` | 负责人 CSV 文件路径 |

### 命令详解

#### 1. validate - 验证输入文件

验证所有输入文件的格式和内容是否正确。

```bash
# 使用默认路径
npm run dev -- validate

# 指定自定义路径
npm run dev -- validate \
  -e ./config/expected_jobs.yaml \
  -l ./config/launchagents \
  -c ./config/cron_dump.txt \
  -r ./config/last_runs.jsonl \
  -o ./config/owners.csv
```

#### 2. audit - 执行任务巡检

执行完整的任务巡检，检测所有类型的问题。

```bash
# 基础巡检
npm run dev -- audit

# 以 JSON 格式输出结果
npm run dev -- audit --json
```

#### 3. export - 导出巡检结果

将巡检结果导出到 issues.csv 和 scheduler_audit.md 文件。

```bash
# 导出到默认路径
npm run dev -- export

# 指定自定义输出路径
npm run dev -- export \
  --issues-csv ./output/issues.csv \
  --report-md ./output/scheduler_audit.md
```

## 使用 sample 数据演示

项目包含完整的 sample 数据，可以直接用于演示 CLI 的所有功能。

### 快速演示

```bash
# 1. 进入 sample 目录
cd sample

# 2. 验证 sample 数据文件
npm run dev -- validate \
  -e ./sample/expected_jobs.yaml \
  -l ./sample/launchagents \
  -c ./sample/cron_dump.txt \
  -r ./sample/last_runs.jsonl \
  -o ./sample/owners.csv

# 3. 执行巡检
npm run dev -- audit \
  -e ./sample/expected_jobs.yaml \
  -l ./sample/launchagents \
  -c ./sample/cron_dump.txt \
  -r ./sample/last_runs.jsonl \
  -o ./sample/owners.csv

# 4. 导出结果
npm run dev -- export \
  -e ./sample/expected_jobs.yaml \
  -l ./sample/launchagents \
  -c ./sample/cron_dump.txt \
  -r ./sample/last_runs.jsonl \
  -o ./sample/owners.csv
```

### Sample 数据说明

| 文件 | 说明 |
|------|------|
| `sample/expected_jobs.yaml` | 包含 5 个预期任务配置 |
| `sample/launchagents/` | 包含 4 个 plist 文件，覆盖多种场景 |
| `sample/cron_dump.txt` | 包含 4 个 cron 任务 |
| `sample/last_runs.jsonl` | 包含任务运行历史记录 |
| `sample/owners.csv` | 包含负责人信息 |

### Sample 数据中的问题场景

1. **com.example.cleanup**:
   - 实际被禁用（预期启用）
   - 计划时间从 2:00 改为 3:00
   - 时区从 Asia/Shanghai 改为 America/New_York
   - 命令多了 `--force` 参数
   - PATH 环境变量不同
   - 超过 SLA 未运行

2. **com.example.monitor**:
   - 负责人不匹配
   - 脚本路径不存在

3. **com.example.unexpected**:
   - 不在预期配置中（未预期的任务）

4. **com.example.disabled_job**:
   - 预期任务但实际不存在

5. **cron 任务**:
   - 部分任务不在预期配置中

## 输入文件格式

### 1. expected_jobs.yaml (预期任务配置)

```yaml
- name: com.example.backup
  type: launchagent
  schedule: 每 3600 秒
  command: /usr/local/bin/backup.sh --daily
  enabled: true
  owner: zhangsan
  sla: 7200
  environment:
    PATH: /usr/local/bin:/usr/bin:/bin
    TZ: Asia/Shanghai
  description: 每日备份任务
```

**必填字段**: `name`, `type`, `schedule`, `command`, `enabled`, `owner`, `sla`, `environment`

### 2. LaunchAgent plist 文件

标准的 macOS LaunchAgent plist 格式，包含 `Label`, `ProgramArguments`, `StartInterval` 或 `StartCalendarInterval` 等字段。

### 3. cron_dump.txt (cron 任务导出)

标准的 crontab 格式:

```
# 注释
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin

0 8 * * * /usr/local/bin/generate_report.sh
*/5 * * * * /usr/local/bin/health_check.sh
```

### 4. last_runs.jsonl (任务运行记录)

每行一个 JSON 对象:

```json
{"jobName":"com.example.backup","timestamp":1746348000000,"exitCode":0,"duration":120,"output":"Backup completed"}
```

**必填字段**: `jobName`, `timestamp`, `exitCode`, `duration`

### 5. owners.csv (负责人信息)

```csv
jobName,owner,email,department
com.example.backup,zhangsan,zhangsan@example.com,运维部
```

**必填列**: `jobName`, `owner`, `email`, `department`

## 输出文件格式

### issues.csv

| 列名 | 说明 |
|------|------|
| Issue ID | 问题唯一标识 |
| 任务名称 | 任务名称 |
| 任务类型 | launchagent 或 cron |
| 问题类型 | 问题类型代码 |
| 严重程度 | critical/high/medium/low |
| 问题描述 | 详细描述 |
| 负责人 | 任务负责人 |
| 上次运行 | 上次运行时间 |
| 检测时间 | 问题检测时间 |

### scheduler_audit.md

包含以下部分:
- 概览统计
- 问题统计（按严重程度、按类型）
- 文件解析错误（如有）
- 任务详情（按问题严重程度分组）
- 附录：问题类型说明

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 执行成功，无 Critical 问题 |
| 1 | validate 命令发现验证错误 |
| 2 | audit 命令发现 Critical 问题 |

## 项目结构

```
.
├── src/
│   ├── index.ts                 # CLI 入口
│   ├── types/
│   │   └── index.ts             # 类型定义
│   ├── parsers/
│   │   ├── yaml-parser.ts       # YAML 解析器
│   │   ├── plist-parser.ts      # plist 解析器
│   │   ├── cron-parser.ts       # cron 解析器
│   │   ├── jsonl-parser.ts      # JSONL 解析器
│   │   └── csv-parser.ts        # CSV 解析器
│   ├── core/
│   │   ├── job-rebuilder.ts     # 任务重建
│   │   ├── issue-detector.ts    # 问题检测
│   │   └── export.ts             # 报告导出
│   └── utils/
│       └── index.ts              # 工具函数
├── sample/
│   ├── expected_jobs.yaml
│   ├── launchagents/
│   │   ├── com.example.backup.plist
│   │   ├── com.example.cleanup.plist
│   │   ├── com.example.monitor.plist
│   │   └── com.example.unexpected.plist
│   ├── cron_dump.txt
│   ├── last_runs.jsonl
│   └── owners.csv
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 编译 TypeScript
npm run build

# 开发模式运行
npm run dev -- <command>

# 编译后运行
npm run start -- <command>
```

## License

MIT
