# 工会福利领取核销 API 服务

一个用于工会福利领取核销的小型 API 服务，支持材料提交、幂等性检查、审计追踪和数据追溯功能。

## 功能特性

1. **材料提交与核销** - 工会干事可提交福利材料，系统自动处理
2. **幂等性保证** - 同一批材料重复提交时返回原有处理结果，不生成新记录
3. **审计追踪** - 记录谁改过结论、为什么改、改动前后的值
4. **数据追溯** - 关键字段可从原始输入追到最终报告

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn main:app --reload
```

服务将在 http://localhost:8000 启动

### API 文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 1. 提交材料

```bash
POST /api/submissions
```

请求体：
```json
{
  "submitter": "张三",
  "department": "技术部",
  "benefit_type": "节日福利",
  "beneficiary": "李四",
  "beneficiary_id_card": "110101199001011234",
  "amount": 50000,
  "application_date": "2024-05-01",
  "description": "五一劳动节福利申请",
  "raw_materials": {
    "application_form": "申请书.pdf",
    "id_card_copy": "身份证复印件.jpg"
  }
}
```

### 2. 修改审核结论

```bash
PUT /api/verifications/{record_id}
```

请求体：
```json
{
  "operator": "王五",
  "conclusion": "审核不通过",
  "reason": "材料不完整，缺少医疗证明",
  "review_notes": "需要补充相关材料"
}
```

### 3. 查询数据追溯

```bash
GET /api/submissions/{submission_id}/trace
```

返回内容：
- 提交材料详情
- 核销记录
- 审计日志
- 关键字段追溯路径

### 4. 查询审计日志

```bash
GET /api/audit-logs?submission_id={id}
```

### 5. 列出提交记录

```bash
GET /api/submissions?department=技术部&benefit_type=节日福利
```

## 运行测试

```bash
python test_api.py
```

## 核心设计

### 幂等性实现

基于关键字段（身份证号、福利类型、申请日期、金额）生成 SHA256 哈希作为幂等键，确保同一批材料不会被重复处理。

### 审计日志

每次修改结论时自动记录：
- 操作人
- 操作类型
- 修改的字段
- 改动前后的值
- 修改原因

### 数据追溯

关键字段（受益人、福利类型、金额）可以从原始输入追踪到最终报告，便于复盘和审计。

## 数据库表结构

- **material_submissions** - 材料提交表
- **verification_records** - 核销记录表
- **audit_logs** - 审计日志表
