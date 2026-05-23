# 园区访客通行多源导入巡检 CLI

一个用于园区访客通行数据多源导入和巡检的命令行工具，支持访客预约表、闸机记录、临时车牌截图和退款流水的导入、校验、修复和报表生成。

## 功能特性

- ✅ **多源数据导入**: 支持 CSV 和 Excel 格式，支持 4 种数据源类型
- ✅ **导入策略**: 支持忽略、覆盖、追加三种策略，防止数据重复
- ✅ **数据校验**: 内置 7 条校验规则，含跨天权限专项检查
- ✅ **自动修复**: 可自动修复常见数据问题
- ✅ **审计追踪**: 完整记录所有操作历史，谁在什么时候改了什么
- ✅ **任务管理**: 异步任务失败状态区分（等待重试/等待人工/永久失败）
- ✅ **报表生成**: 安保主管视角，重点展示原始行号、失败清单、修正清单
- ✅ **数据导出**: 支持 CSV、Excel 格式导出
- ✅ **清晰退出码**: 脚本友好的退出码设计

## 快速开始

### 安装依赖

```bash
npm install
npm run build
```

### 初始化数据库

```bash
npm run dev init
# 或编译后
npm start init
```

### 完整工作流程

```bash
# 1. 导入访客预约表
npm run dev -- import samples/visitor_appointment.csv -s visitor_appointment -t append

# 2. 查看导入批次列表
npm run dev -- list

# 3. 校验数据（使用返回的 batchId）
npm run dev -- check <batchId>

# 4. 查看失败记录
npm run dev -- failures <batchId>

# 5. 自动修复可修复的问题
npm run dev -- fix <batchId> --auto

# 6. 生成巡检报表
npm run dev -- report <batchId>

# 7. 导出处理后的数据
npm run dev -- export <batchId> -f excel
```

## 命令详解

### init - 初始化数据库

```bash
park-inspect init
```

初始化本地 SQLite 数据库，创建必要的数据表。数据文件位于 `.park-inspect/data.db`。

### import - 导入数据

```bash
park-inspect import <文件路径> -s <数据源类型> [选项]
```

**选项:**
- `-s, --source <type>`: 数据源类型，必需
  - `visitor_appointment`: 访客预约表
  - `gate_record`: 闸机记录
  - `temp_plate`: 临时车牌
  - `refund_flow`: 退款流水
- `-t, --strategy <strategy>`: 导入策略，默认 `append`
  - `ignore`: 如果文件已导入过则忽略
  - `overwrite`: 覆盖同类型旧数据
  - `append`: 追加数据
- `-o, --operator <name>`: 操作员名称

**示例:**
```bash
# 导入访客预约表，追加模式
park-inspect import 访客预约20240101.csv -s visitor_appointment

# 导入闸机记录，覆盖旧数据
park-inspect import 闸机记录.xlsx -s gate_record -t overwrite -o zhangsan
```

### list - 列出导入批次

```bash
park-inspect list
```

查看所有导入批次的状态和统计信息。

### check - 校验数据

```bash
park-inspect check <batchId> [选项]
```

**选项:**
- `-o, --operator <name>`: 操作员名称

**校验规则:**
1. 手机号格式校验
2. 身份证号格式校验（非必填）
3. 车牌号格式校验（非必填）
4. 访问日期必填校验
5. 时间范围逻辑校验
6. **跨天权限专项检查**: 检测临时放行跨天权限是否收回
7. 访客姓名必填校验

**退出码:**
- `0`: 全部校验通过
- `1`: 执行出错
- `2`: 存在校验不通过的记录

### failures - 查看失败记录

```bash
park-inspect failures <batchId>
```

查看指定批次的所有失败记录，包含原始行号、问题原因等。

### fix - 修复数据

```bash
park-inspect fix <batchId> [选项]
```

**选项:**
- `-a, --auto`: 自动修复可自动修复的问题
- `-r, --record <recordId>`: 指定记录ID手动修复
- `-f, --field <field>`: 要修复的字段名
- `-v, --value <value>`: 修复后的值
- `--reason <reason>`: 修复原因
- `-o, --operator <name>`: 操作员名称

**示例:**
```bash
# 自动修复
park-inspect fix <batchId> --auto

# 手动修复指定字段
park-inspect fix <batchId> -r <recordId> -f visitorPhone -v 13800138000 --reason "补充手机号"
```

### fixed - 查看已修复记录

```bash
park-inspect fixed <batchId>
```

查看指定批次所有已修复的记录。

### report - 生成巡检报表

```bash
park-inspect report <batchId>
```

生成安保主管视角的巡检报表，重点展示：
- 基本信息（批次、文件名、时间、操作员）
- 数据统计（总数、有效、问题、已修复）
- **失败清单**（原始行号、访客姓名、问题原因、处理建议）
- **修复清单**（原始行号、访客姓名、修复内容）

**退出码:**
- `0`: 无问题记录
- `1`: 执行出错
- `2`: 存在问题记录

### history - 查看操作历史

```bash
park-inspect history [选项]
```

**选项:**
- `-b, --batch <batchId>`: 按批次筛选
- `-r, --record <recordId>`: 按记录筛选
- `-o, --operator <name>`: 按操作员筛选
- `-l, --limit <number>`: 显示条数，默认 100

### export - 导出数据

```bash
park-inspect export <batchId> [选项]
```

**选项:**
- `-f, --format <format>`: 导出格式，`csv` 或 `excel`，默认 `csv`
- `--failures`: 仅导出失败记录
- `--audit`: 导出审计日志
- `--report`: 导出报表文本
- `-o, --output <path>`: 输出文件路径

**示例:**
```bash
# 导出完整数据为 Excel
park-inspect export <batchId> -f excel

# 导出失败记录
park-inspect export <batchId> --failures -o 失败记录.csv

# 导出审计日志
park-inspect export <batchId> --audit
```

### tasks - 管理异步任务

```bash
park-inspect tasks [选项]
```

**选项:**
- `-s, --status <status>`: 按状态筛选
  - `pending`: 等待执行
  - `retry`: 等待重试
  - `manual`: 等待人工处理
  - `failed`: 永久失败
- `--retry <taskId>`: 标记任务为重试
- `--manual <taskId>`: 标记任务为等待人工处理

**任务状态说明:**
- **pending**: 任务创建，等待执行
- **processing**: 任务正在执行中
- **retry**: 执行失败，等待自动重试（最多重试 3 次）
- **manual**: 需要人工介入处理
- **permanent_failed**: 达到最大重试次数，永久失败
- **completed**: 任务执行成功

## 数据源字段映射

### 访客预约表 (visitor_appointment)

| 原始字段 | 映射字段 | 说明 |
|---------|---------|------|
| 姓名/访客姓名/name | visitorName | 访客姓名 |
| 电话/手机号/phone | visitorPhone | 手机号 |
| 身份证/身份证号/idCard | idCard | 身份证号 |
| 车牌号/车牌/plate | plateNumber | 车牌号 |
| 访问日期/日期/visitDate | visitDate | 访问日期 |
| 开始时间/入场时间/startTime | startTime | 开始时间 |
| 结束时间/离场时间/endTime | endTime | 结束时间 |

### 闸机记录 (gate_record)

| 原始字段 | 映射字段 | 说明 |
|---------|---------|------|
| 姓名/访客姓名/name | visitorName | 访客姓名 |
| 电话/手机号/phone | visitorPhone | 手机号 |
| 车牌号/车牌/plate | plateNumber | 车牌号 |
| 日期/通行日期/date | visitDate | 通行日期 |
| 入场时间/通行时间/passTime | startTime | 通行时间 |
| 出场时间/endTime | endTime | 出场时间 |
| 闸机号/gateNo | gateNo | 闸机编号 |

### 临时车牌 (temp_plate)

| 原始字段 | 映射字段 | 说明 |
|---------|---------|------|
| 车主/姓名/owner | visitorName | 车主姓名 |
| 联系电话/phone | visitorPhone | 联系电话 |
| 车牌号/临时车牌/plate | plateNumber | 车牌号 |
| 有效期开始/startDate/date | visitDate | 有效期开始日期 |
| 开始时间 | startTime | 开始时间 |
| 结束时间 | endTime | 结束时间 |

### 退款流水 (refund_flow)

| 原始字段 | 映射字段 | 说明 |
|---------|---------|------|
| 申请人/姓名/applicant | visitorName | 申请人姓名 |
| 联系电话/phone | visitorPhone | 联系电话 |
| 申请日期/refundDate/date | visitDate | 申请日期 |
| 申请时间 | startTime | 申请时间 |
| 完成时间 | endTime | 完成时间 |

## 数据存储

所有数据存储在当前目录下的 `.park-inspect/data.db` 文件中（SQLite 数据库）。

**数据表:**
- `import_batches`: 导入批次
- `visitor_records`: 访客记录
- `check_results`: 校验结果
- `async_tasks`: 异步任务
- `audit_logs`: 审计日志
- `system_config`: 系统配置

## 退出码说明

| 退出码 | 含义 |
|-------|------|
| 0 | 执行成功 |
| 1 | 执行出错（参数错误、文件不存在等） |
| 2 | 存在问题记录（校验或报表时） |

这使得工具非常适合在脚本中自动化使用：

```bash
#!/bin/bash

# 导入数据
park-inspect import data.csv -s visitor_appointment
if [ $? -ne 0 ]; then
  echo "导入失败"
  exit 1
fi

# 获取 batchId（实际使用时需要解析输出）
BATCH_ID="..."

# 校验数据
park-inspect check $BATCH_ID
CHECK_EXIT=$?

if [ $CHECK_EXIT -eq 1 ]; then
  echo "校验执行出错"
  exit 1
elif [ $CHECK_EXIT -eq 2 ]; then
  echo "发现问题记录，尝试自动修复"
  park-inspect fix $BATCH_ID --auto
fi

# 生成报表
park-inspect report $BATCH_ID

# 导出数据
park-inspect export $BATCH_ID -f excel
```

## 项目结构

```
.
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── commands/           # 子命令
│   │   ├── init.ts
│   │   ├── import.ts
│   │   ├── check.ts
│   │   ├── fix.ts
│   │   ├── report.ts
│   │   ├── history.ts
│   │   ├── export.ts
│   │   └── tasks.ts
│   ├── db/                 # 数据库
│   │   └── database.ts
│   ├── services/           # 业务服务
│   │   ├── importService.ts
│   │   ├── checkService.ts
│   │   ├── fixService.ts
│   │   ├── reportService.ts
│   │   ├── exportService.ts
│   │   ├── auditService.ts
│   │   └── taskService.ts
│   ├── types/              # 类型定义
│   │   └── index.ts
│   └── utils/              # 工具函数
│       └── index.ts
├── samples/                # 示例数据
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
