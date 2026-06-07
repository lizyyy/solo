# 发票 OCR 置信度复核系统

> 手机号漏遮检测 · 脱敏规则复核 · 可解释导出报告

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🔍 **漏遮检测** | 自动检测导出中手机号漏遮，定位到具体字段 |
| 📝 **复核流程** | 运营老唐补录脱敏规则备注 → 算法同事复核 OCR 置信度 |
| 📤 **可解释导出** | 每条字段说明：为什么被留下、缺什么材料、该找谁 |
| 📊 **可视化看板** | ECharts 3D/图表展示，点击工单可追溯原始反馈 |
| 🔒 **脱敏复查** | 所有输出物（JSON/报告/日志）自动脱敏，无原始号码 |
| 🎬 **一键演示** | 新人照 README 三步跑通完整流程 |

---

## 🚀 快速开始

### 0. 环境要求
- Python 3.7+ （无第三方依赖，仅用标准库）

### 1. 一键跑通演示

```bash
# 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy72512

# 运行完整演示（7步全流程）
python ocr_review.py demo
```

**演示会自动走完以下三步核心流程：**
1. 📥 导入线上反馈工单（样例数据）
2. 🔍 自动检测手机号漏遮
3. 📝 运营老唐补看脱敏规则备注
4. 📤 生成脱敏导出（自动更新）
5. 📊 生成 HTML 可视化看板
6. 🔒 脱敏复查（确认无原始号码）

### 2. 分步操作指南

#### 步骤 1: 初始化系统
```bash
python ocr_review.py init
```
导入样例脱敏规则（手机号、身份证、银行卡、邮箱）。

#### 步骤 2: 导入线上反馈工单
```bash
python ocr_review.py import --file samples/sample_tickets.json
```
样例包含 3 张工单，覆盖不同漏遮场景。

#### 步骤 3: 检测手机号漏遮
```bash
# 批量检测所有工单
python ocr_review.py detect

# 检测指定工单
python ocr_review.py detect --ticket-id TICKET-20260601-001
```

#### 步骤 4: 运营老唐复核
```bash
# 查看待我处理的工单
python ocr_review.py review --list

# 对某个工单补充脱敏规则备注
python ocr_review.py review --ticket-id TICKET-20260601-001 \
  --notes '[
    {"field_name": "buyer_phone", "note": "已补充脱敏规则，该字段需按手机号规则遮蔽"},
    {"field_name": "seller_phone", "note": "已补充脱敏规则，文本中的手机号也需要处理"}
  ]'
```

#### 步骤 5: 算法同事复核
```bash
# 查看待算法处理的工单
python ocr_review.py algorithm --list

# 对某个OCR置信度低的字段进行复核
python ocr_review.py algorithm --ticket-id TICKET-20260601-003 \
  --reviewer "王算法" \
  --notes '[
    {"field_name": "buyer_id_card", "note": "算法已修复，OCR模型已更新该字段的识别策略"}
  ]'
```

#### 步骤 6: 生成脱敏导出
```bash
python ocr_review.py export --ticket-id TICKET-20260601-001
```
生成三个文件：
- `output/EXPORT-xxx_data.json` - 脱敏后的数据
- `output/EXPORT-xxx_report.txt` - 详细报告（含每条字段的处理原因）
- `output/EXPORT-xxx_summary.txt` - 快速摘要（下一步找谁）

#### 步骤 7: 生成可视化看板
```bash
python ocr_review.py report --dashboard
```
用浏览器打开生成的 HTML 文件，查看：
- 📊 工单状态分布饼图
- 🔒 泄露类型分布饼图
- 📈 每日泄露趋势 & OCR 置信度折线图
- 📋 工单列表（点击可追溯原始反馈）

#### 步骤 8: 脱敏复查审计
```bash
# 审计整个输出目录
python ocr_review.py audit --dir output

# 审计单个文件
python ocr_review.py audit --file output/EXPORT-xxx_data.json
```
确认所有输出物中没有原始手机号等敏感数据。

---

## 📁 项目结构

```
.
├── ocr_review.py              # 快捷入口脚本
├── README.md                  # 本文档
├── requirements.txt           # 依赖说明（无第三方依赖）
├── src/
│   └── ocr_review/
│       ├── __init__.py
│       ├── models/            # 数据模型
│       │   ├── ticket.py      # 工单 + 状态流转
│       │   ├── rule.py        # 脱敏规则
│       │   ├── ocr.py         # OCR置信度记录
│       │   └── export.py      # 导出记录
│       ├── storage/           # 数据存储层
│       ├── importer/          # 工单导入模块
│       ├── detector/          # 漏遮检测模块
│       ├── review/            # 复核工作流
│       ├── exporter/          # 脱敏导出模块
│       ├── report/            # 报告生成（含HTML看板）
│       ├── audit/             # 脱敏复查审计
│       ├── cli/               # 命令行入口
│       └── utils/             # 工具函数（脱敏算法）
├── samples/
│   ├── sample_tickets.json    # 样例工单数据
│   └── sample_rules.json      # 样例脱敏规则
├── data/                      # 运行时数据存储
└── output/                    # 导出文件输出目录
```

---

## 🔄 核心工作流

```
线上反馈工单导入
       ↓
[自动检测] 手机号漏遮 → 标记具体字段
       ↓
[运营老唐] 补录脱敏规则备注 → 标记已处理字段
       ↓
        ├─ 所有字段已处理 → 生成脱敏导出 → 结束
        ↓
[算法同事] OCR 置信度低的字段复核
       ↓
  补充算法备注 → 生成脱敏导出 → 脱敏复查 → 结束
```

### 状态流转说明

| 状态 | 说明 | 负责人 |
|------|------|--------|
| `imported` | 刚导入，未检测 | 系统 |
| `detected_leak` | 检测到漏遮，待运营处理 | **运营老唐** |
| `review_pending` | 需算法同事复核 OCR | **算法同事** |
| `reviewed_by_operation` | 运营已复核 | - |
| `reviewed_by_algorithm` | 算法已复核 | - |
| `resolved` | 问题已解决 | - |

---

## 📋 导出报告示例

导出报告中每个字段都会说明：

```
[1] 🔴 字段: buyer_phone
    脱敏状态: 未脱敏
    泄露风险: high
    导出值: 138****5678
    说明: 该字段检测到敏感数据但未脱敏。OCR识别结果包含敏感信息，需确认脱敏规则配置。
    下一步: 请运营同事补充脱敏规则配置
    负责人: 运营老唐

[2] 🟡 字段: buyer_id_card
    脱敏状态: 未脱敏
    泄露风险: high
    导出值: 1101**********1234
    说明: 该字段检测到敏感数据但未脱敏。OCR置信度较低(0.58)，建议算法同事复核识别准确性。
    下一步: 请算法同事确认OCR识别结果并调整脱敏策略
    负责人: 算法同事
```

---

## 🔒 脱敏安全特性

1. **输出全脱敏**：所有导出的 JSON、TXT、日志文件中的敏感数据自动遮蔽
2. **审计检查**：`audit` 命令递归扫描输出目录，报告发现的原始敏感数据
3. **看板安全**：HTML 看板中的所有数据均已脱敏，无原始手机号
4. **失败定位**：审计失败时精确指出文件路径、行号、字段名

---

## 🎯 针对不同角色的使用方式

### 算法同事
```bash
# 查看待我处理的工单
python ocr_review.py algorithm --list

# 复核并添加备注
python ocr_review.py algorithm --ticket-id xxx --note "算法已修复"

# 查看综合报告（解释性结果）
python ocr_review.py report
```

### 算法运营老唐
```bash
# 查看待我处理的工单
python ocr_review.py review --list

# 补充脱敏规则备注
python ocr_review.py review --ticket-id xxx --note "已补充脱敏规则"

# 生成脱敏导出
python ocr_review.py export --ticket-id xxx
```

### 新人上手
```bash
# 一键跑通演示，然后对照 README 理解每一步
python ocr_review.py demo
```

---

## 📌 关键设计要点（对应需求）

| 需求点 | 实现位置 |
|--------|----------|
| 点到手机号漏遮能回到线上反馈工单 | HTML看板点击事件，预留跳转接口 |
| 不只剩漂亮画面 | 报告包含每条字段的完整处理链路 |
| 说明为什么被留下、缺什么、找谁 | 导出字段的 explanation / next_step / responsible_role |
| 补录备注后导出跟着变 | 重新 export 自动读取最新备注 |
| 别急着归正常，留给算法同事 | OCR置信度<0.7 时自动标记 responsible="algorithm" |
| 所有输出无原始号码 | exporter + audit 双层保障 |
| 失败时指到具体字段 | audit 输出包含 file, line, field 三级定位 |

---

## 📝 License

内部工具，仅供发票 OCR 置信度复核使用。
