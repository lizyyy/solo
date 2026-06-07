# 多语言客服翻译回看系统

线上反馈工单和脱敏规则备注的统一管理平台。

## 核心特性

- ✅ **单一数据源**：导出明细、页面展示、接口返回读取同一份结果
- ✅ **四要素自检**：重复导入检测、模型版本变更检测、补录后重算、导出一致性校验
- ✅ **全链路证据留存**：原始行号、人工改动、处理状态全程可追溯
- ✅ **三步工作流**：导入 → 脱敏复核 → 产品复盘，支持运营复核机制
- ✅ **双入口使用**：CLI 命令行 + REST API，均输出证据摘要

## 快速开始（新人 5 分钟跑通）

### 1. 安装依赖

```bash
pip install -e .
# 或者
pip install -r requirements.txt
export PYTHONPATH=src
```

### 2. 导入样例数据（第一步：导入反馈工单）

```bash
# 批量导入样例（含重复工单和模型版本变更场景）
trans-review import-file samples/batch_import.json --batch-no BATCH-2024-06-01
```

你会看到：
- 第 1 条和第 4 条是同一工单（FB20240601001），系统自动标记 `duplicate_import`
- 第 1 条和第 4 条是同一样本（SAMPLE-001）但模型版本不同（v2.1.0 vs v2.2.0），系统自动标记 `model_version_changed`

### 3. 运行自检

```bash
trans-review validate all
```

你会看到系统检测出：
- 重复导入问题
- 模型版本变更问题
- 导出一致性检查（通过）

### 4. 查看记录和证据摘要

```bash
# 列出所有记录
trans-review list --show-evidence

# 查看单条详情
trans-review show <record_id>
```

重点看 `证据摘要` 部分，包含：
- 原始行号（original_line_no）
- 工单 ID
- 异常类型
- 人工改动次数
- 反馈摘要

### 5. 第二步：脱敏规则复核（知识库编辑小乔操作）

```bash
# 给第一条记录加脱敏备注
trans-review desensitize <record_id> \
  --rule-name "用户隐私保护规则" \
  --rule-desc "用户手机号、地址等个人信息需脱敏" \
  --reviewer "xiaoqiao" \
  --is-desensitized \
  --remark "已检查，无敏感信息"
```

### 6. 推进工作流

```bash
# 推进到脱敏复核完成
trans-review workflow advance <record_id> --to desensitization --operator xiaoqiao

# 推进到产品复盘
trans-review workflow advance <record_id> --to product --operator xiaoqiao
```

### 7. 第三步：运营复核（针对模型版本变更的记录）

```bash
# 查看需要运营复核的记录
trans-review workflow needs-review

# 运营复核通过
trans-review workflow review <record_id> --approve --operator reviewer01 --remark "确认版本变更，数据有效"

# 或驳回
# trans-review workflow review <record_id> --reject --operator reviewer01 --remark "版本不一致，需重新确认"
```

### 8. 完成全流程

```bash
trans-review workflow complete <record_id> --operator product_manager
```

### 9. 导出报告

```bash
trans-review export -o report.json
```

导出内容包含每条记录的完整数据 + 证据摘要。

### 10. 启动 API 服务（可选）

```bash
trans-review serve --port 8000
```

访问 http://localhost:8000/docs 查看 Swagger 文档。

## 核心概念

### 三步工作流

```
STEP1_IMPORT (导入反馈工单)
    ↓
STEP2_DESENSITIZATION (脱敏规则复核)  ← 知识库编辑小乔
    ↓
STEP3_PRODUCT (产品复盘)
    ↓
COMPLETED (完成)
```

**特殊情况**：如果检测到「同一样本编号但模型版本变更」，状态会变为 `NEEDS_RECHECK`，不会自动推进到下一正常状态，必须经过运营复核。

### 异常类型

| 类型 | 说明 | 处理方式 |
|------|------|----------|
| duplicate_import | 同一工单被重复导入 | 标记异常，人工确认 |
| model_version_changed | 同一样本编号但模型版本不同 | 必须运营复核 |
| supplementary_record | 补录数据 | 重算，记录重算次数 |
| data_inconsistent | 导出数据与原始数据不一致 | 高危，立即排查 |

### 证据摘要（所有入口统一输出）

每条记录的证据摘要包含：
- `record_id` / `sample_no` / `model_version` - 记录标识
- `status` / `current_step` - 状态和流程
- `abnormal_types` - 异常类型列表
- `original_line_no` - 线上反馈工单原始行号 ⭐
- `ticket_id` - 工单 ID
- `has_manual_changes` / `manual_change_count` - 人工改动情况 ⭐
- `has_desensitization_note` - 脱敏复核情况 ⭐
- `recheck_count` - 重算次数
- `feedback_summary` - 工单内容摘要
- `desensitization_summary` - 脱敏复核摘要

## 目录结构

```
.
├── src/translation_review/
│   ├── models.py          # 数据模型定义
│   ├── storage.py         # 数据存储层
│   ├── processor.py       # 核心数据处理（导入/去重/重算）
│   ├── validator.py       # 自检模块
│   ├── workflow.py        # 工作流管理
│   ├── api.py             # FastAPI 接口
│   └── cli.py             # Click 命令行
├── samples/               # 样例数据
├── tests/                 # 测试用例
├── data/                  # 运行时数据（自动创建）
├── requirements.txt
└── pyproject.toml
```

## API 接口速查

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/records/import` | 导入单条记录，返回证据摘要 |
| POST | `/records/batch-import` | 批量导入 |
| GET | `/records` | 列表，支持 `?include_evidence=true` |
| GET | `/records/{id}` | 详情 + 证据 + 工作流进度 + 日志 |
| GET | `/records/{id}/evidence` | 仅证据摘要 |
| POST | `/records/{id}/desensitization` | 添加脱敏备注 |
| POST | `/records/{id}/translation` | 更新翻译 |
| POST | `/records/{id}/recalculate` | 重算 |
| POST | `/workflow/{id}/advance/desensitization` | 推进到脱敏 |
| POST | `/workflow/{id}/advance/product` | 推进到产品复盘 |
| POST | `/workflow/{id}/operator-review` | 运营复核 |
| POST | `/workflow/{id}/complete` | 完成流程 |
| GET | `/workflow/needs-review` | 需要运营复核的列表 |
| GET | `/validation/check` | 运行所有自检 |
| GET | `/export` | 导出数据 |

## 常见问题

**Q: 为什么模型版本变了但样本编号没变的记录不能直接过？**

A: 这是最容易出问题的场景。可能是数据导入错误，也可能是同一批样本用新模型重跑。留给运营复核人看证据（原始行号、工单内容、两次模型翻译对比）再决定，比系统自动判断更安全。

**Q: 运营复核人怎么回到原始证据？**

A: 证据摘要里有 `original_line_no`（原始行号）、`ticket_id`（工单 ID）、`feedback_summary`（工单内容摘要），可以直接定位到原始工单。所有人工改动都有日志。

**Q: 导出的和页面上看的不一样怎么办？**

A: 系统从设计上保证了导出、API、CLI 都从同一份存储读数据。可以运行 `trans-review validate export-consistency` 检查一致性，如果有问题会报 `data_inconsistent`。
