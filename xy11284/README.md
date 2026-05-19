# 宠物医院药房管理系统

基于 FastAPI 的宠物医院药房处方校验管理系统，支持剂量计算、批号校验、禁忌组合检测、敏感字段脱敏等核心功能。

## 功能特性

### ✅ 规则校验引擎
- **剂量上下限校验**：根据宠物体重自动计算推荐剂量范围，拦截超标处方
- **批号过期校验**：自动检测药品批号有效期，过期拦截、临期警告
- **库存数量校验**：检查库存是否充足，不足时拦截
- **禁忌组合校验**：检测药品间的配伍禁忌，危险组合拦截

### ✅ 批量处理与重试
- 支持处方批量提交
- 被拦截的项目支持单独重试
- 重试不影响已通过的记录

### ✅ 敏感字段处理
- API返回自动脱敏（手机号、身份证、邮箱等）
- 日志记录自动脱敏
- CSV导出自动脱敏

### ✅ 审计留痕
- 所有操作完整记录
- 每条处方的校验结果可追溯
- 支持按处方、操作类型查询日志

### ✅ 数据导出
- 支持CSV格式导出
- 可选择是否包含被拦截的记录
- 导出时敏感字段自动脱敏

## 项目结构

```
.
├── main.py                 # FastAPI 主应用，包含所有API端点
├── database.py             # 数据库模型和连接配置
├── schemas.py              # Pydantic 数据模型
├── rules_engine.py         # 规则校验引擎核心
├── security.py             # 敏感字段脱敏和日志过滤
├── config.py               # 系统配置
├── init_data.py            # 测试数据初始化脚本
├── test_prescription.py    # 完整流程测试脚本
├── curl_examples.sh        # curl 命令示例
├── requirements.txt        # Python 依赖
└── README.md               # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化测试数据

```bash
python init_data.py
```

这将创建：
- 4种常用兽药（阿莫西林、头孢氨苄、布洛芬、庆大霉素）
- 5条库存记录（含1个即将过期的批号）
- 2组禁忌组合（阿莫西林+布洛芬警告，布洛芬+庆大霉素危险）

### 3. 启动服务

```bash
uvicorn main:app --reload
```

服务启动后访问：
- API 服务：http://localhost:8000
- 交互式文档：http://localhost:8000/docs

### 4. 运行测试

#### 方式一：Python 测试脚本（推荐）

```bash
python test_prescription.py
```

将执行完整测试流程：
- 正常剂量处方（通过）
- 剂量超标处方（拦截）
- 禁忌组合处方（识别）
- 即将过期批号（警告）
- 审计日志查看
- 敏感字段脱敏验证
- 统计数据查看

#### 方式二：curl 命令

```bash
chmod +x curl_examples.sh
./curl_examples.sh
```

## API 端点说明

### 处方管理
- `POST /api/v1/prescriptions/process` - 提交并处理处方
- `POST /api/v1/prescriptions/retry/{prescription_id}` - 重试被拦截项目
- `GET /api/v1/prescriptions/` - 查询处方列表
- `GET /api/v1/prescriptions/{prescription_id}` - 获取单张处方详情

### 药品与库存
- `GET /api/v1/medicines/` - 获取药品列表
- `GET /api/v1/inventory/` - 获取库存列表

### 审计与统计
- `GET /api/v1/audit-logs/` - 查询审计日志
- `GET /api/v1/dashboard/stats` - 获取统计面板数据

### 数据导出
- `POST /api/v1/export/prescriptions` - 到处处方数据CSV

## 处方JSON格式示例

### 正常处方（会通过）
```json
{
  "prescription_no": "PRES-2024-001",
  "doctor_name": "张医生",
  "pet_name": "旺财",
  "pet_weight_kg": 10.0,
  "owner_name": "李先生",
  "owner_phone": "13800138000",
  "diagnosis": "皮肤感染",
  "items": [
    {
      "medicine_name": "阿莫西林片剂",
      "medicine_id": 1,
      "batch_number": "AMX-2024-001",
      "dosage": 150.0,
      "dosage_unit": "mg",
      "frequency": "每日2次",
      "quantity": 14,
      "unit_price": 2.5
    }
  ]
}
```

### 剂量超标处方（会被拦截）
```json
{
  "prescription_no": "PRES-2024-002",
  "doctor_name": "张医生",
  "pet_name": "小咪",
  "pet_weight_kg": 3.0,
  "items": [
    {
      "medicine_name": "阿莫西林片剂",
      "medicine_id": 1,
      "batch_number": "AMX-2024-001",
      "dosage": 100.0,
      "dosage_unit": "mg",
      "quantity": 14
    }
  ]
}
```
*注：3kg猫咪推荐范围30-60mg，100mg超标67%，会被拦截*

## 校验结果说明

API返回的处理结果包含：
- `total`: 总项目数
- `success_count`: 通过数量
- `failed_count`: 拦截数量
- `passed_items`: 已通过项目列表，含原因
- `blocked_items`: 被拦截项目列表，含原因

每个项目的 `reason` 字段会详细说明通过或拦截的原因。

## 敏感字段配置

在 `config.py` 中配置：
```python
SENSITIVE_FIELDS = ["owner_phone", "owner_id_card", "pet_birthday"]
```

支持自动识别的字段类型：
- 手机号：前3后4，中间****
- 身份证：前6后4，中间********
- 邮箱：用户名前2字符+****@域名
- 其他敏感字段：直接显示****

## 技术栈

- **框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展支持PostgreSQL/MySQL）
- **数据验证**: Pydantic
- **日志**: Python logging + 自定义脱敏过滤器

## 扩展建议

1. **用户认证**: 添加 JWT 认证，区分医生、药师、管理员角色
2. **库存扣减**: 处方审核通过后自动扣减库存
3. **消息通知**: 拦截时发送通知给开单医生
4. **报表功能**: 增加用药统计、异常趋势分析
5. **药品说明书**: 关联药品详细说明文档

## 许可证

MIT License
