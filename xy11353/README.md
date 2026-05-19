# 园区安保核验系统

访客预约、临时车牌、黑名单三位一体核验系统，解决门岗放错人问题。

## 功能特性

- **访客预约管理**: 支持单人/批量创建、修改、查询访客预约
- **临时车牌管理**: 关联访客的临时车牌登记与核验
- **黑名单管理**: 身份证/车牌黑名单登记与自动拦截
- **智能核验**: 多维度核验（预约有效期、门岗匹配、黑名单等）
- **筛选查询**: 按负责人、时间、状态、异常类型多维度筛选
- **报告导出**: 支持Excel格式导出核验记录
- **批量操作**: 批量导入时明确区分成功/失败项，失败可重试

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

- API文档: http://localhost:8000/docs
- ReDoc文档: http://localhost:8000/redoc

### 3. 导入样例数据并测试完整流程

新开一个终端窗口运行：

```bash
python sample_data.py
```

该脚本会自动完成：
- 创建4条样例访客预约（含正常、过期、黑名单等场景）
- 添加2条黑名单记录
- 模拟6种核验场景（正常通过、黑名单拦截、门岗错误、过期预约等）
- 多维度筛选查询核验记录
- 导出Excel报告
- 展示系统统计信息

## 核心API使用指南

### 访客预约

#### 创建访客预约
```bash
curl -X POST "http://localhost:8000/visitors/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "id_card": "110101199001011234",
    "phone": "13800138001",
    "company": "华为技术有限公司",
    "visit_purpose": "商务洽谈",
    "host_name": "李四",
    "host_department": "市场部",
    "expected_start": "2024-01-15T09:00:00",
    "expected_end": "2024-01-15T18:00:00",
    "license_plate": "京A12345",
    "gate_number": "东门",
    "responsible_person": "王队长",
    "notes": "重要客户"
  }'
```

#### 批量创建访客
```bash
curl -X POST "http://localhost:8000/visitors/batch/" \
  -H "Content-Type: application/json" \
  -d '[{...}, {...}]'
```

### 黑名单管理

#### 添加黑名单
```bash
curl -X POST "http://localhost:8000/blacklist/" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "440101198012129999",
    "identifier_type": "id_card",
    "reason": "多次违规进入园区",
    "added_by": "系统管理员",
    "is_active": true
  }'
```

### 核验接口

#### 车牌核验
```bash
curl -X POST "http://localhost:8000/verify/" \
  -H "Content-Type: application/json" \
  -d '{
    "plate_number": "京A12345",
    "gate_number": "东门",
    "verified_by": "门岗1号"
  }'
```

#### 身份证核验
```bash
curl -X POST "http://localhost:8000/verify/" \
  -H "Content-Type: application/json" \
  -d '{
    "id_card": "110101199001011234",
    "gate_number": "东门",
    "verified_by": "门岗1号"
  }'
```

### 查询与筛选

#### 按负责人查询
```bash
curl "http://localhost:8000/verification-records/?responsible_person=王队长"
```

#### 按状态查询（被拒绝）
```bash
curl "http://localhost:8000/verification-records/?status=rejected"
```

#### 按异常类型查询（黑名单）
```bash
curl "http://localhost:8000/verification-records/?exception_type=blacklisted"
```

#### 按时间范围查询
```bash
curl "http://localhost:8000/verification-records/?start_date=2024-01-01T00:00:00&end_date=2024-12-31T23:59:59"
```

#### 组合筛选
```bash
curl "http://localhost:8000/verification-records/?responsible_person=王队长&status=rejected&gate_number=东门"
```

### 导出报告

```bash
curl -o verification_report.xlsx "http://localhost:8000/verification-records/export/"
```

### 查看统计信息

```bash
curl "http://localhost:8000/stats/summary"
```

## 核验异常类型说明

| 异常类型 | 说明 |
|---------|------|
| `no_exception` | 无异常，核验通过 |
| `blacklisted` | 身份证或车牌在黑名单中 |
| `invalid_plate` | 未找到有效预约记录 |
| `expired_visit` | 预约已过期 |
| `wrong_gate` | 门岗编号不匹配 |
| `id_mismatch` | 身份信息不匹配 |

## 核验状态说明

| 状态 | 说明 |
|-----|------|
| `pending` | 待核验/预约未生效 |
| `approved` | 核验通过，允许进入 |
| `rejected` | 核验拒绝，禁止进入 |
| `expired` | 预约已过期 |

## 如何解释拦截原因

当某条记录被拦截时，可通过以下步骤向相关方解释：

1. 获取核验记录ID（核验接口返回 `record_id`）
2. 查询该记录详情：
```bash
curl "http://localhost:8000/verification-records/{record_id}"
```
3. 查看 `exception_type` 和 `exception_details` 字段，即可获得明确的拦截原因

示例解释话术：
> "您的身份证号440101198012129999在系统黑名单中，原因为'多次违规进入园区'，因此无法进入。如需解除，请联系安保处。"

> "您预约的是东门进入，但当前在西门核验，门岗不匹配，请前往东门进入。"

## 项目结构

```
.
├── main.py              # FastAPI主应用，包含所有API端点
├── models.py            # 数据库模型定义
├── schemas.py           # Pydantic数据模式（请求/响应格式）
├── crud.py              # 数据库操作封装
├── database.py          # 数据库连接配置
├── sample_data.py       # 样例数据和测试脚本
├── requirements.txt     # Python依赖列表
└── README.md           # 本文档
```

## 数据库

系统使用SQLite数据库（`security_system.db`），包含以下表：
- `visitors`: 访客预约记录
- `temporary_plates`: 临时车牌
- `blacklist`: 黑名单
- `verification_records`: 核验历史记录

## 注意事项

1. 批量操作失败不会影响已成功的记录，可单独重试失败项
2. Excel导出支持最多10000条记录
3. 所有时间字段均支持ISO格式（如 `2024-01-15T09:00:00`）
4. 开发环境可直接访问 `/docs` 使用交互式API文档
