# 任务失败归因系统

基于边缘节点清册的任务失败归因后端服务

## 功能特性

1. **失败归因分析** - 自动识别任务状态提前结束的原因，说明被哪条规则拦截
2. **历史查询** - 支持按批次、操作者、风险类型过滤查询
3. **明细保留** - 部分成功时保留每条任务明细，不整批标记成功
4. **回滚候选清单** - 清理/回滚前先生成候选清单，避免误伤真实数据
5. **多格式输出** - 支持 JSON、Markdown、Excel 下载三种输出格式
6. **原始记录追溯** - 人工改动不直接覆盖结论，可追溯到 IoT 设备回执原始记录

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLAlchemy + SQLite
- **依赖**: Python 3.8+

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_sample_data.py
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问接口文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心 API 接口

### 任务批次管理

```bash
# 创建批次
POST /api/v1/batches/

# 查询批次（支持过滤）
GET /api/v1/batches/?operator=张三&risk_type=security&status=partial_success

# 完成批次
POST /api/v1/batches/{batch_id}/complete
```

### 归因分析

```bash
# 执行归因分析（支持传入边缘节点清册）
POST /api/v1/attribution/analyze
{
  "batch_id": "BATCH-2024-001",
  "edge_node_inventory": [
    {
      "node_id": "NODE-001",
      "node_name": "北京边缘节点1",
      "responsibility_team": "运维一组"
    }
  ]
}

# 人工修改归因结论
PATCH /api/v1/attribution/{task_id}/manual-modify
```

### 历史查询

```bash
GET /api/v1/attribution/history?batch_id=xxx&risk_type=security&is_manual_modified=false
```

### 输出接口

```bash
# JSON 格式
GET /api/v1/output/{batch_id}/json

# Markdown 格式
GET /api/v1/output/{batch_id}/markdown

# Excel 下载
GET /api/v1/output/{batch_id}/download
```

### 回滚候选清单

```bash
# 生成回滚候选
POST /api/v1/rollback/candidates/{batch_id}?created_by=管理员

# 查询候选清单
GET /api/v1/rollback/candidates/{batch_id}

# 审批候选
POST /api/v1/rollback/candidate/{candidate_id}/approve?approved_by=管理员
```

### IoT 回执追溯

```bash
# 按任务查询回执
GET /api/v1/iot-receipts/task/{task_id}?responsibility_team=运维一组

# 按节点查询回执
GET /api/v1/iot-receipts/node/{node_id}
```

## 预置归因规则

系统预置以下归因规则，可扩展：

| 规则代码 | 规则名称 | 风险类型 |
|---------|---------|---------|
| SEC_001 | 安全认证失败 | security |
| NET_001 | 网络连接超时 | network |
| DATA_001 | 数据完整性校验失败 | data_integrity |
| DEV_001 | 设备健康状态异常 | device_health |
| CFG_001 | 配置参数无效 | configuration |

## 测试流程示例

1. 初始化样例数据后，执行归因分析：

```bash
curl -X POST "http://localhost:8000/api/v1/attribution/analyze" \
  -H "Content-Type: application/json" \
  -d '{"batch_id": "BATCH-2024-001"}'
```

2. 查看 Markdown 报告：

```bash
curl "http://localhost:8000/api/v1/output/BATCH-2024-001/markdown
```

3. 生成回滚候选清单：

```bash
curl -X POST "http://localhost:8000/api/v1/rollback/candidates/BATCH-2024-001?created_by=测试"
```

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt       # 依赖列表
├── init_sample_data.py    # 样例数据初始化
├── app/
│   ├── __init__.py
│   ├── database.py        # 数据库配置
│   ├── models/            # 数据模型
│   ├── schemas/          # Pydantic 模型
│   ├── api/              # API 路由
│   └── services/         # 业务逻辑
│       ├── rule_engine.py    # 规则引擎
│       ├── output_service.py # 输出服务
│       └── rollback_service.py # 回滚服务
```
