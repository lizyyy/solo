# 影像科增强药剂核销 CLI 工具

## 简介

`contrast-cli` 是一个面向本地影像科小团队的命令行工具，用于管理增强药剂的核销工作。支持导入预约清单、药剂批次和开瓶记录，自动检查核销状态、剩余量合理性和退费一致性。

## 功能特性

- ✅ 导入数据：支持 CSV 和 JSON 双格式
- ✅ 核销检查：患者核销状态、批次剩余量、退费一致性
- ✅ 待处理项：查看未完成核销的预约
- ✅ 人工修正：标记特殊情况的手工处理
- ✅ 日结报告：生成每日核销汇总报告
- ✅ 幂等导入：重复导入同一天数据不会产生重复
- ✅ 严格校验：缺少预约号、重复批号、退费用药冲突时明确报错

## 快速开始

### 安装依赖

```bash
cd contrast-cli
npm install
```

### 编译项目

```bash
npm run build
```

### 使用 ts-node 直接运行（开发模式）

```bash
npm run dev -- <command> [options]
```

## 命令详解

### 1. 导入数据 (import)

导入预约清单、药剂批次或开瓶记录。

```bash
# 导入预约清单 (CSV)
npm run dev -- import samples/appointments.csv -t appointments

# 导入药剂批次 (JSON)
npm run dev -- import samples/batches.json -t batches

# 导入开瓶记录
npm run dev -- import samples/usage-partial.csv -t usage
```

**数据类型：**
- `appointments`：预约清单
- `batches`：药剂批次信息
- `usage`：开瓶/使用记录

### 2. 核销检查 (check)

执行完整的核销检查。

```bash
# 检查指定日期
npm run dev -- check 2026-05-10

# 检查今天（默认）
npm run dev -- check
```

检查内容包括：
- 每个患者是否完成核销
- 批次剩余量是否合理
- 退费记录与未使用记录是否一致

### 3. 查看待处理项 (pending)

查看当天未完成核销的预约。

```bash
npm run dev -- pending 2026-05-10
```

### 4. 人工修正 (correct)

标记需要人工干预的特殊情况。

```bash
# 剂量调整
npm run dev -- correct 2026-05-10 \
  --type dose_adjustment \
  -a APT20260510002 \
  -r "患者特殊情况，实际使用95ml" \
  --original "100ml" \
  --corrected "95ml" \
  -o "张药师"

# 退费确认
npm run dev -- correct 2026-05-10 \
  --type refund_confirm \
  -a APT20260510005 \
  -r "患者已确认退费" \
  -o "李药师"

# 其他类型
npm run dev -- correct 2026-05-10 \
  --type other \
  -r "系统升级导致数据延迟" \
  -o "王主管"
```

**修正类型：**
- `dose_adjustment`：剂量调整
- `refund_confirm`：退费确认
- `batch_merge`：批次合并
- `other`：其他

### 5. 生成日结报告 (report)

```bash
# 文本格式（默认）
npm run dev -- report 2026-05-10

# 保存到文件
npm run dev -- report 2026-05-10 -o report-20260510.txt

# JSON 格式
npm run dev -- report 2026-05-10 -f json

# JSON 格式保存到文件
npm run dev -- report 2026-05-10 -f json -o report-20260510.json
```

### 6. 清空数据 (clear)

```bash
# 交互式确认
npm run dev -- clear

# 强制清空
npm run dev -- clear -f
```

## 数据文件格式

### 预约清单 (appointments)

| 字段 | 说明 | 必填 |
|------|------|------|
| appointmentId | 预约号 | ✅ |
| patientName | 患者姓名 | ✅ |
| patientId | 患者ID | |
| scheduledDate | 预约日期 (YYYY-MM-DD) | ✅ |
| scheduledTime | 预约时间 | ✅ |
| contrastAgent | 药剂名称 | ✅ |
| plannedDose | 计划剂量 (ml) | ✅ |
| department | 科室 | |
| doctor | 医生 | |

### 药剂批次 (batches)

| 字段 | 说明 | 必填 |
|------|------|------|
| batchNumber | 批号 | ✅ |
| contrastAgent | 药剂名称 | ✅ |
| totalVolume | 总量 (ml) | ✅ |
| expiryDate | 有效期 | ✅ |
| importDate | 入库日期 | ✅ |
| manufacturer | 生产厂家 | |

### 开瓶记录 (usage)

| 字段 | 说明 | 必填 |
|------|------|------|
| appointmentId | 预约号 | ✅ |
| batchNumber | 批号 | ✅ |
| openedAt | 开瓶时间 (ISO格式) | ✅ |
| actualDose | 实际用量 (ml) | ✅ |
| isRefund | 是否退费 (true/false) | ✅ |
| operator | 操作人员 | |
| notes | 备注 | |

## 演示流程

以下是一个完整的演示流程，展示核销前后的变化。

### 步骤 1: 清空数据，确保环境干净

```bash
npm run dev -- clear -f
```

### 步骤 2: 导入基础数据

```bash
# 导入预约清单 (8个预约)
npm run dev -- import samples/appointments.csv -t appointments

# 导入药剂批次
npm run dev -- import samples/batches.json -t batches
```

### 步骤 3: 导入部分开瓶记录，查看待处理项

```bash
# 导入部分使用记录 (5条，包含1条退费)
npm run dev -- import samples/usage-partial.csv -t usage

# 查看待处理项（应该有3个待处理）
npm run dev -- pending 2026-05-10

# 执行核销检查（应该显示问题）
npm run dev -- check 2026-05-10
```

### 步骤 4: 导入剩余开瓶记录

```bash
# 导入完整记录（注意：重复的会被幂等跳过）
npm run dev -- import samples/usage-complete.json -t usage

# 再次查看待处理项（应该为0）
npm run dev -- pending 2026-05-10
```

### 步骤 5: 标记人工修正

```bash
# 患者李四剂量从100ml调整为95ml
npm run dev -- correct 2026-05-10 \
  --type dose_adjustment \
  -a APT20260510002 \
  -r "患者体重较轻，实际使用95ml" \
  --original "100ml" \
  --corrected "95ml" \
  -o "张药师"
```

### 步骤 6: 生成日结报告

```bash
# 文本格式
npm run dev -- report 2026-05-10

# 保存到文件
npm run dev -- report 2026-05-10 -o samples/report-demo.txt
```

## 错误场景测试

### 场景 1: 缺少预约号

```bash
npm run dev -- import samples/error-appointments-missing-id.csv -t appointments
# 预期：报错，提示"缺少预约号"
```

### 场景 2: 重复批号但信息不一致

```bash
# 先导入正常批次
npm run dev -- import samples/batches.json -t batches

# 再导入重复批号（总量不同）
npm run dev -- import samples/error-batches-duplicate.json -t batches
# 预期：报错，提示"重复药剂批号，但批次信息不一致"
```

### 场景 3: 同一预约同时有用药和退费

```bash
npm run dev -- import samples/error-usage-conflict.csv -t usage
# 预期：报错，提示"同时存在用药和退费记录"
```

## 项目结构

```
contrast-cli/
├── src/
│   ├── commands/          # CLI 命令处理
│   │   ├── import.ts
│   │   ├── check.ts
│   │   ├── pending.ts
│   │   ├── correct.ts
│   │   └── report.ts
│   ├── models/            # 数据模型
│   │   └── index.ts
│   ├── services/          # 业务服务
│   │   ├── dataStore.ts   # 数据存储（幂等导入）
│   │   ├── importer.ts    # 数据导入（CSV/JSON）
│   │   └── reconciler.ts  # 核销引擎
│   ├── utils/
│   │   └── logger.ts      # 日志工具
│   └── index.ts           # CLI 入口
├── samples/               # 测试样例数据
│   ├── appointments.csv
│   ├── batches.json
│   ├── usage-partial.csv
│   ├── usage-complete.json
│   ├── error-appointments-missing-id.csv
│   ├── error-batches-duplicate.json
│   └── error-usage-conflict.csv
├── data/                  # 运行时数据（自动生成）
├── package.json
└── tsconfig.json
```

## 核销规则说明

### 患者核销状态

| 状态 | 说明 |
|------|------|
| completed | 已完成（有用药记录，剂量合理） |
| refunded | 已退费（有退费记录） |
| missing_usage | 缺少用药记录（无开瓶记录） |
| pending | 待确认 |

### 批次剩余量检查

- 剩余量 = 总量 - 已用量 - 退费量
- 剩余量 < 0：错误（超量使用）
- 0 < 剩余量 < 10ml：警告（剩余较少）
- 剩余量 >= 10ml：正常

### 退费一致性检查

- 退费记录必须对应有效的预约号
- 退费剂量应与计划剂量一致（允许 ±5ml 误差）

### 数据校验规则

1. **缺少预约号**：导入时直接报错
2. **重复药剂批号**：
   - 信息完全一致：跳过（幂等）
   - 信息不一致：报错
3. **用药/退费冲突**：同一预约号不能同时有用药和退费记录
4. **引用完整性**：使用记录的预约号和批号必须已存在

## 注意事项

1. 日期格式统一使用 `YYYY-MM-DD`
2. 时间戳建议使用 ISO 8601 格式（如 `2026-05-10T08:35:00`）
3. 数据文件存储在 `data/` 目录，可手动备份
4. 幂等导入基于指纹识别，相同内容重复导入不会产生重复数据

## License

MIT
