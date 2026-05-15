# 接口灰度回放校验系统

提供完整的 API 灰度验证链路，支持历史请求回放、响应差异计算、容忍规则配置、确认门禁和开放记录导出。

## 核心特性

- 📋 **历史请求管理** - 批量导入和管理历史请求数据
- 🔄 **智能回放引擎** - 自动回放历史请求到灰度环境
- 📊 **深度差异计算** - 精确识别响应数据差异
- ⚙️ **灵活容忍规则** - 可配置的差异容忍规则引擎
- 👥 **多人确认门禁** - 支持多角色确认审批流程
- 📈 **完整时间追踪** - 每个关键动作都有时间线记录
- 📑 **专业报告导出** - 支持 JSON 和 Excel 格式导出

## 技术栈

- **FastAPI** - 高性能 Web 框架
- **SQLAlchemy** - ORM 数据库层
- **SQLite** - 持久化存储
- **DeepDiff** - 深度差异计算
- **Pandas** - 数据处理和导出

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
DATABASE_URL=sqlite:///./gray_verification.db
API_HOST=0.0.0.0
API_PORT=8000
ENV=development
```

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心流程

### 完整验证流程

```
1. 创建灰度版本
   ↓
2. 导入历史请求数据
   ↓
3. 添加确认人
   ↓
4. 启动回放（后台异步）
   ├─ 调用灰度接口
   ├─ 计算响应差异
   └─ 应用容忍规则
   ↓
5. 确认人审批
   ↓
6. 生成开放结论
   ↓
7. 导出验证报告
```

## API 接口说明

### 灰度版本管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/gray-versions` | 创建灰度版本 |
| GET | `/api/v1/gray-versions` | 获取灰度版本列表 |
| GET | `/api/v1/gray-versions/{version}` | 获取单个灰度版本 |

### 请求管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/gray-versions/{version}/requests` | 批量添加历史请求 |
| GET | `/api/v1/gray-versions/{version}/requests` | 获取请求列表 |

### 回放与验证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/gray-versions/{version}/replay` | 启动回放（后台任务） |
| GET | `/api/v1/gray-versions/{version}/verification-result` | 获取验证结果 |

### 差异管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/gray-versions/{version}/diffs` | 获取差异列表 |

### 容忍规则

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/tolerance-rules` | 创建容忍规则 |
| GET | `/api/v1/tolerance-rules` | 获取规则列表 |

### 确认门禁

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/gray-versions/{version}/confirmers` | 添加确认人 |
| POST | `/api/v1/gray-versions/{version}/confirm` | 提交确认 |
| GET | `/api/v1/gray-versions/{version}/confirmation-status` | 获取确认状态 |

### 开放结论

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/gray-versions/{version}/release` | 创建开放结论 |

### 时间线

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/gray-versions/{version}/timeline` | 获取操作时间线 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/export/json` | 导出 JSON 格式报告 |
| POST | `/api/v1/export/excel` | 导出 Excel 格式报告 |

### 一键创建验证任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/verification-jobs` | 一键创建完整验证任务 |

## 使用示例

### 1. 创建灰度版本

```bash
curl -X POST http://localhost:8000/api/v1/gray-versions \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2.0.0",
    "description": "用户中心灰度验证",
    "target_url": "http://gray-api.example.com",
    "base_url": "http://api.example.com",
    "created_by": "zhangsan"
  }'
```

### 2. 添加历史请求

```bash
curl -X POST http://localhost:8000/api/v1/gray-versions/v2.0.0/requests \
  -H "Content-Type: application/json" \
  -d '[{
    "request_id": "req_001",
    "method": "GET",
    "path": "/api/users/123",
    "headers": {"Authorization": "Bearer token"},
    "base_response": {"id": 123, "name": "test"},
    "base_status_code": 200,
    "base_response_time": 150.5
  }]'
```

### 3. 添加确认人

```bash
curl -X POST http://localhost:8000/api/v1/gray-versions/v2.0.0/confirmers \
  -H "Content-Type: application/json" \
  -d '[{
    "user_id": "user_001",
    "user_name": "张三",
    "role": "开发负责人"
  }, {
    "user_id": "user_002",
    "user_name": "李四",
    "role": "测试负责人"
  }]'
```

### 4. 启动回放

```bash
curl -X POST http://localhost:8000/api/v1/gray-versions/v2.0.0/replay
```

### 5. 创建容忍规则

```bash
curl -X POST http://localhost:8000/api/v1/tolerance-rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "响应时间浮动 10%",
    "description": "允许响应时间有 10% 的浮动",
    "path_pattern": "response_time",
    "tolerance_type": "percentage",
    "tolerance_value": {"max_percent": 10},
    "is_active": true,
    "created_by": "admin"
  }'
```

### 6. 提交确认

```bash
# 开发负责人确认
curl -X POST http://localhost:8000/api/v1/gray-versions/v2.0.0/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "dev_lead_001",
    "confirmed": true,
    "comment": "验证通过，差异在可接受范围内"
  }'

# 测试负责人确认
curl -X POST http://localhost:8000/api/v1/gray-versions/v2.0.0/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_lead_001",
    "confirmed": true,
    "comment": "测试用例全部通过"
  }'
```

### 7. 创建开放结论

```bash
curl -X POST http://localhost:8000/api/v1/gray-versions/v2.0.0/release \
  -H "Content-Type: application/json" \
  -d '{
    "conclusion_type": "release",
    "summary": "所有验证通过，差异均在容忍范围内，可以正式发布",
    "released_by": "zhangsan"
  }'
```

### 8. 导出报告

```bash
# 导出 JSON
curl -X POST http://localhost:8000/api/v1/export/json \
  -H "Content-Type: application/json" \
  -d '{"version": "v2.0.0"}'

# 导出 Excel
curl -X POST http://localhost:8000/api/v1/export/excel \
  -H "Content-Type: application/json" \
  -d '{"version": "v2.0.0"}' \
  -o verification_report.xlsx
```

### 9. 一键创建完整验证任务

```bash
curl -X POST http://localhost:8000/api/v1/verification-jobs \
  -H "Content-Type: application/json" \
  -d '{
    "version": "v2.1.0",
    "description": "订单系统灰度验证",
    "target_url": "http://gray-order.example.com",
    "base_url": "http://order.example.com",
    "created_by": "zhangsan",
    "requests": [...],
    "confirmers": [...]
  }'
```

## 状态流转

```
PENDING (待处理)
    ↓
REPLAYING (回放中)
    ↓
DIFFING (差异计算中)
    ↓
PENDING_CONFIRM (待确认)
    ↓
   ├─ CONFIRMED (已确认)
   │       ↓
   │   RELEASED (已发布)
   │
   └─ REJECTED (已拒绝)
```

## 数据模型

### GrayVersion - 灰度版本
- version: 版本号
- description: 描述
- target_url: 灰度环境地址
- base_url: 基准环境地址
- created_by: 创建人
- status: 状态

### HistoryRequest - 历史请求
- request_id: 请求唯一标识
- method: HTTP 方法
- path: 请求路径
- headers: 请求头
- query_params: 查询参数
- request_body: 请求体
- base_response: 基准响应
- base_status_code: 基准状态码
- base_response_time: 基准响应时间
- gray_response: 灰度响应
- gray_status_code: 灰度状态码
- gray_response_time: 灰度响应时间

### ResponseDiff - 响应差异
- diff_path: 差异路径
- diff_type: 差异类型
- base_value: 基准值
- gray_value: 灰度值
- level: 差异级别 (critical/error/warning/info)
- is_tolerated: 是否已容忍

### ToleranceRule - 容忍规则
- name: 规则名称
- path_pattern: 路径匹配模式
- tolerance_type: 容忍类型 (always/percentage/value_range)
- tolerance_value: 容忍配置

### Confirmer - 确认人
- user_id: 用户 ID
- user_name: 用户姓名
- role: 角色
- confirmed: 是否已确认
- confirmed_at: 确认时间
- comment: 确认意见

### ReleaseConclusion - 开放结论
- conclusion_type: 结论类型
- summary: 总结
- total_requests: 总请求数
- success_requests: 成功请求数
- failed_requests: 失败请求数
- total_diffs: 总差异数
- critical_diffs: 严重差异数
- error_diffs: 错误差异数
- warning_diffs: 警告差异数
- tolerated_diffs: 已容忍差异数

### Timeline - 时间线
- action: 动作类型
- actor: 操作者
- details: 详情
- created_at: 时间戳

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic 模式
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py      # API 路由
│   └── services/
│       ├── __init__.py
│       ├── replay_service.py       # 回放服务
│       ├── diff_service.py         # 差异计算服务
│       ├── confirmation_service.py # 确认与发布服务
│       └── export_service.py       # 导出服务
├── main.py                # 应用入口
├── requirements.txt       # 依赖列表
├── .env.example           # 环境变量示例
└── README.md              # 项目文档
```

## 防重复提交机制

1. **版本号唯一** - 相同版本号无法重复创建
2. **请求 ID 唯一** - 相同 request_id 不会重复添加
3. **回放状态检查** - 回放中不会重复触发
4. **时间线记录** - 所有操作都有完整记录，便于审计

## 开发说明

### 运行测试

```bash
# 待补充
```

### 代码规范

- 使用 PEP 8 规范
- 类型注解完整
- 异常处理完善

## 许可证

MIT License
