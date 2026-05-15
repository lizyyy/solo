# 器降噪网关 - 采购询价单审核系统

## 项目概述

器降噪网关是一个基于FastAPI的后端服务系统，用于采购询价单的自动审核、异常检测和数据降噪。系统支持规则版本管理、多维度查询过滤、脏行自动识别吞噬等功能。

### 核心功能

1. **采购询价单审核** - 基于规则引擎自动校验询价单数据
2. **规则版本管理** - 支持多版本规则，规则变更不影响历史批次解释
3. **脏行吞噬机制** - 自动识别并标记异常脏数据
4. **多维度查询过滤** - 按批次、操作者、风险类型等条件过滤
5. **统一查询入口** - 异常路径和成功路径从同一入口查询

## 项目结构

```
.
├── main.py                  # FastAPI应用主入口
├── api.py                   # API路由定义
├── database.py              # 数据库配置
├── models.py                # 数据模型定义
├── schemas.py               # Pydantic模式定义
├── noise_reduction.py       # 降噪引擎核心逻辑
├── data_generator.py        # 测试数据生成器
├── test_noise_reduction.py  # 自检测试脚本
├── requirements.txt         # 依赖包列表
└── README.md               # 项目说明文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检测试

```bash
python test_noise_reduction.py
```

### 3. 启动服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 批次处理

- `POST /api/v1/batch/process` - 处理采购询价单批次
- `POST /api/v1/batch/generate` - 自动生成并处理测试批次

### 查询接口

- `POST /api/v1/records/query` - 按条件查询审核记录
- `POST /api/v1/batches/query` - 按条件查询批次列表
- `GET /api/v1/batch/{batch_no}` - 获取批次详情

### 规则管理

- `GET /api/v1/rules` - 获取所有规则版本
- `POST /api/v1/rules/{version}/activate` - 激活指定规则版本

### 统计摘要

- `GET /api/v1/summary/risk-types` - 风险类型统计
- `GET /api/v1/summary/operators` - 操作者统计

## 数据模型

### 规则版本 (RuleVersion)
- `version`: 版本号
- `rule_content`: 规则内容（JSON）
- `description`: 描述
- `is_active`: 是否激活

### 批次 (Batch)
- `batch_no`: 批次号
- `operator`: 操作者
- `department`: 部门
- `total_records`: 总记录数
- `valid_records`: 有效记录数
- `invalid_records`: 无效记录数
- `swallowed_records`: 被吞记录数
- `status`: 处理状态

### 询价单 (InquiryForm)
- `form_no`: 单据号
- `supplier_name`: 供应商
- `material_code`: 物料编码
- `material_name`: 物料名称
- `quantity`: 数量
- `quoted_price`: 报价
- `is_valid`: 是否有效
- `risk_type`: 风险类型
- `risk_level`: 风险等级
- `is_swallowed`: 是否被吞

## 风险类型说明

| 风险类型 | 风险等级 | 说明 |
|---------|---------|------|
| 价格异常 | 高风险 | 价格超出有效范围 |
| 数量异常 | 中风险 | 数量超出有效范围 |
| 供应商缺失 | 高风险 | 供应商名称无效 |
| 物料编码无效 | 中风险 | 物料编码格式错误 |
| 联系方式无效 | 低风险 | 联系电话格式错误 |
| 规格不完整 | 低风险 | 规格描述不完整 |
| 交付周期过长 | 中风险 | 交付天数超出限制 |
| 脏行被吞 | 严重风险 | 检测到脏行标记，记录被吞 |

## 使用示例

### 生成测试批次

```bash
# 生成包含20条记录的批次，其中3条异常、1条被吞
curl -X POST "http://localhost:8000/api/v1/batch/generate?batch_size=20&dirty_count=3&swallow_count=1"
```

### 查询记录

```bash
# 按操作者和风险类型过滤
curl -X POST "http://localhost:8000/api/v1/records/query" \
  -H "Content-Type: application/json" \
  -d '{"operator": "审核员_A", "risk_type": "价格异常"}'

# 查询所有被吞记录
curl -X POST "http://localhost:8000/api/v1/records/query" \
  -H "Content-Type: application/json" \
  -d '{"is_swallowed": true}'
```

### 切换规则版本

```bash
# 激活v2.0版本规则
curl -X POST "http://localhost:8000/api/v1/rules/v2.0/activate"
```

## 自检功能

运行自检测试脚本验证系统边界情况：

```bash
python test_noise_reduction.py
```

测试覆盖范围：
- ✓ 规则初始化
- ✓ 价格校验
- ✓ 数量校验
- ✓ 脏行被吞功能
- ✓ 供应商校验
- ✓ 物料编码校验
- ✓ 规则版本切换
- ✓ 批量处理功能
- ✓ 多维度查询过滤

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite (可扩展到PostgreSQL/MySQL)
- **ORM**: SQLAlchemy
- **数据验证**: Pydantic
- **测试**: pytest

## 注意事项

1. 每个批次处理时会绑定当时激活的规则版本，历史记录可以准确追溯当时的判断口径
2. 被吞记录(`is_swallowed=True`)会被特殊标记，但仍可查询追溯
3. 规则版本变更后，新批次使用新规则，旧批次的解释口径保持不变
4. 所有查询接口统一，支持同时查询正常、异常、被吞的记录
