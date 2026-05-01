# 药店处方外配复核 API 服务

基于 FastAPI 的药店处方外配复核系统，支持处方单、医保结算、药品批号库存和退药记录的导入、风险校验、复核状态流转及审计报告导出。

## 功能特性

- **批次导入**: 支持处方、结算、库存、退药记录的批量导入
- **风险校验**: 内置 6 条校验规则，逐单检测风险问题
- **复核管理**: 支持复核状态流转（待审核/审核中/通过/驳回/需整改）
- **整改备注**: 支持添加复核意见和整改备注
- **审计报告**: 自动生成 Markdown 格式的审计报告

## 校验规则

| 规则代码 | 规则名称 | 严重程度 | 说明 |
|-----------|----------|----------|------|
| R001 | 处方日期晚于结算日期 | 高 | 检测处方日期是否晚于医保结算日期 |
| R002 | 药品批号不存在 | 高 | 检测处方药品批号在库存中是否存在 |
| R003 | 退药数量超过原发药 | 高 | 检测退药数量是否超过原处方发药数量 |
| R004 | 结算金额一致性 | 中 | 检测医保+自付金额之和是否等于总金额 |
| R005 | 库存数量充足 | 中 | 检测处方药品数量是否超过库存数量 |
| R006 | 过期药品 | 高 | 检测处方药品是否已过期 |

## 快速开始

### 环境要求

- Python 3.9+
- pip

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 使用示例

### 1. 批次导入数据

使用示例数据文件位于 `sample_data/batch_import_sample.json`

```bash
curl -X POST "http://localhost:8000/api/import/batch" \
  -H "Content-Type: application/json" \
  -d @sample_data/batch_import_sample.json
```

### 2. 逐单风险校验

```bash
curl "http://localhost:8000/api/validate/RX20260501002"
```

预期响应示例：
```json
{
  "prescription_no": "RX20260501002",
  "total_rules": 6,
  "passed_count": 3,
  "failed_count": 3,
  "has_high_severity_issues": true,
  "results": [
    {
      "rule_code": "R001",
      "rule_name": "处方日期晚于结算日期校验",
      "passed": false,
      "severity": "high",
      "description": "处方日期(2026-05-02)晚于结算日期(2026-04-30)",
      "affected_data": {...}
    },
    ...
  ]
}
```

### 3. 更新复核状态

```bash
curl -X PUT "http://localhost:8000/api/review/RX20260501002/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "needs_rectification",
    "reviewer": "张药师",
    "review_comment": "存在多处高风险问题",
    "rectification_note": "请核对处方日期和药品批号后重新提交"
  }'
```

复核状态可选值：
- `pending` - 待审核
- `in_review` - 审核中
- `approved` - 已通过
- `rejected` - 已驳回
- `needs_rectification` - 需整改

### 4. 导出审计报告

```bash
# 获取 Markdown 格式报告
curl "http://localhost:8000/api/report/markdown?batch_no=SAMPLE_BATCH_20260501"

# 或获取报告统计信息
curl "http://localhost:8000/api/report/stats?batch_no=SAMPLE_BATCH_20260501"
```

## 运行测试

```bash
pytest -v
```

测试文件位于 `tests/` 目录，覆盖：
- 完整流程：导入 → 校验 → 复核 → 报告生成
- 规则测试：退药数量超过原发药的检测

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI 应用入口
│   ├── models.py        # SQLAlchemy 数据模型
│   ├── schemas.py       # Pydantic 请求/响应模型
│   ├── database.py     # 数据库配置
│   ├── rules.py        # 校验规则模块
│   └── services.py     # 业务逻辑服务层
├── sample_data/
│   └── batch_import_sample.json   # 示例数据
├── tests/
│   ├── __init__.py
│   ├── conftest.py     # pytest 配置
│   └── test_full_workflow.py    # 测试用例
├── requirements.txt
└── README.md
```

## 数据模型

### 示例数据说明

示例数据 `sample_data/batch_import_sample.json` 包含：

| 类型 | 数量 | 说明 |
|------|------|------|
| 处方 | 3 张 | RX20260501001~003 |
| 结算 | 3 条 | 对应每张处方 |
| 库存 | 4 条 | 含过期药品、库存不足等场景 |
| 退药 | 1 条 | 退药数量超过原发药 |

**预设风险场景：
1. **RX20260501002**: 处方日期晚于结算日期 + 批号不存在
2. **RX20260501003**: 退药数量(3盒) > 原发药数量(2盒) + 库存不足(仅1盒) + 药品已过期
3. **RX20260501001**: 正常处方（用于对比）

## 注意事项

- 数据库默认使用 SQLite，数据库文件为 `pharmacy.db`
- 所有日期时间格式使用 ISO 8601 格式
- 支持重复导入，会自动更新已有数据
