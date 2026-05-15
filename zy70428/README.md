# 数据保留策略服务

## 项目概述

本服务用于管理高峰发票红冲记录与短信发送记录的数据保留策略，支持数据清理审批、人工修正、口径变更处理和结果导出。

## 启动方式

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 样例来源

### 高峰发票红冲记录

包含8条真实场景样例数据：
- **高峰时段记录（5条）**：大型企业发票红冲，金额较大，需保留
  - 上海汽车集团股份有限公司
  - 宝钢股份有限公司
  - 中国石化上海石油分公司
  - 上海电气集团股份有限公司
  - 交通银行股份有限公司

- **非高峰时段记录（3条）**：小型企业/个体户，建议清理
  - 上海小型贸易公司A
  - 上海小型贸易公司B
  - 个体工商户陈某

### 短信发送记录

包含5条短信发送记录，关联发票红冲业务，记录发送状态和手机号码。

## 主流程

### 数据保留策略执行流程

```
1. 数据导入
   ↓
2. 生成候选清单
   ↓ 系统自动判断：保留/清理
3. 部门初审
   ↓
4. 财务复核
   ↓
5. 终审
   ↓
6. 生成处理结论
   ↓
7. 导出执行结果
```

### 关键步骤说明

1. **生成候选清单**：系统根据口径版本自动筛选数据，生成保留/清理建议
2. **三级审批**：部门初审 → 财务复核 → 终审，每级审批留痕
3. **候选清单保护**：清理/回滚前必须先生成候选清单，避免误伤真实数据
4. **持久化存储**：所有处理结论和材料摘要保存在SQLite数据库，本地重启不丢失

## 失败路径：报告口径变更

### 场景描述

当上级部门调整报告口径（如：保留期限从3年改为5年、高峰时段定义变更等），需要对已生成的候选清单进行口径变更处理。

### 处理流程

```
1. 发现口径变更需求
   ↓
2. 触发口径变更API
   ↓
3. 系统标记：caliber_changed 状态
   ↓
4. 更新所有项目的系统判断
   ↓
5. 强制保留所有数据（避免误删）
   ↓
6. 记录失败原因
   ↓
7. 重新生成候选清单（使用新口径）
```

### 变更影响

- 候选清单状态变为：`caliber_changed`（口径变更）
- 所有项目系统判断更新为："口径变更，需重新判断"
- 所有项目强制标记为保留（`is_kept=True`）
- 清单摘要追加口径变更记录和原因

## 人工修正机制

### 核心规则

1. **不覆盖系统判断**：系统判断字段保留原始值，新增 `manual_decision` 字段记录人工判断
2. **修改留痕**：所有修改记录在 `manual_modifications` 表，包含：
   - 修改字段
   - 修改前值
   - 修改后值
   - 修改人
   - 修改时间
   - 修改备注
   - 修改原因

3. **备注追加**：项目备注字段自动追加人工修正记录，可追溯

### 使用示例

```json
POST /manual-modify/
{
  "candidate_list_id": 1,
  "candidate_item_id": 3,
  "field_name": "final_value",
  "modified_value": "{...修改后的值...}",
  "modifier": "张三",
  "modification_remark": "该客户为重要合作伙伴，特殊保留",
  "reason": "重要客户豁免"
}
```

## 导出功能

### 导出内容

1. **清单基本信息**：名称、数据源、口径版本、状态、当前节点
2. **项目明细**：
   - 原始值（`original_value`）
   - 建议值（`suggested_value`）
   - 最终值（`final_value`）
   - 系统判断
   - 人工判断
   - 保留标记
   - 动作类型
   - 备注
3. **短信发送清单详情**（可开关）：
   - 批次号
   - 手机号码
   - 短信内容
   - 发送时间
   - 发送状态
4. **修改记录**：所有人工修正的前后对比
5. **审批历史**：按节点回查各层级审批意见

### 按审批节点回查

```json
POST /export/
{
  "candidate_list_id": 1,
  "include_sms_details": true,
  "filter_by_node": "财务复核"
}
```

## API接口列表

### 数据管理
- `POST /invoice-reversal/` - 创建发票红冲记录
- `GET /invoice-reversal/` - 查询发票红冲记录
- `POST /sms-send/` - 创建短信发送记录
- `GET /sms-send/` - 查询短信发送记录

### 候选清单
- `POST /candidate-list/generate/` - 生成候选清单
- `GET /candidate-list/` - 查询候选清单列表
- `GET /candidate-list/{list_id}/` - 查询单个候选清单

### 审批流程
- `POST /approval/` - 处理审批

### 人工修正
- `POST /manual-modify/` - 人工修正
- `GET /modifications/candidate-list/{list_id}/` - 查询修改记录

### 异常处理
- `POST /caliber-change/{list_id}/` - 处理口径变更

### 处理结论
- `POST /processing-conclusion/` - 创建处理结论
- `GET /processing-conclusion/` - 查询处理结论列表
- `GET /processing-conclusion/candidate-list/{list_id}/` - 查询指定清单的结论

### 导出功能
- `POST /export/` - 导出数据

## 数据库结构

核心数据表：
- `invoice_reversal_records` - 发票红冲记录
- `sms_send_records` - 短信发送记录
- `candidate_lists` - 候选清单
- `candidate_items` - 候选项目
- `approval_nodes` - 审批节点
- `manual_modifications` - 人工修改记录
- `processing_conclusions` - 处理结论

## 注意事项

1. **数据持久化**：使用SQLite数据库，文件名为 `data_retention.db`，定期备份
2. **审批流**：严格按照三级审批流程，不可跳过
3. **口径变更**：变更后建议重新生成候选清单
4. **人工修正**：修改备注必须填写，便于审计追溯
