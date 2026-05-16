# 数据管道断点续跑 API

解决夜间数据管道失败后，值班同学只能整批重跑的问题，**避免重复写入已成功的分片**。

## 核心功能

- ✅ **水位校验**: 按顺序执行分片，防止跳跃执行
- ✅ **分片去重**: 已成功的分片不会重复执行
- ✅ **状态机管理**: pending → running → success/failed
- ✅ **失败补偿**: 从失败点继续执行
- ✅ **人工修正**: 手动调整分片状态
- ✅ **写入摘要导出**: 完整的写入统计
- ✅ **历史记录**: 保留原始输入和处理结论

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> 如果8000端口被占用，可以换成其他端口（如8001），并相应调整后续curl命令中的端口号。

服务启动后访问: http://localhost:8000/docs

### 3. 初始化样例数据

（新开一个终端窗口）

```bash
python init_sample_data.py
```

这个脚本会创建一个包含5个分片的管道，并模拟"分片0和1成功、分片2失败"的场景。

## API 接口说明

### 基础信息

- 服务地址: http://localhost:8000
- API 文档: http://localhost:8000/docs
- 健康检查: `GET /health`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pipelines` | 创建管道 |
| GET | `/api/pipelines` | 查询所有管道 |
| GET | `/api/pipelines/{id}` | 查询单个管道 |
| GET | `/api/pipelines/{id}/shards` | 查询管道分片 |
| POST | `/api/pipelines/resume` | 续跑管道 |
| PUT | `/api/pipelines/{id}/status` | 更新管道状态 |
| PUT | `/api/pipelines/{id}/shards/{index}/complete` | 完成分片 |
| POST | `/api/pipelines/{id}/manual-correction` | 人工修正 |
| GET | `/api/pipelines/{id}/export-summary` | 导出摘要 |
| GET | `/api/pipelines/{id}/history` | 查询历史记录 |

## Curl 调用示例

（假设样例初始化后管道 ID 为 1，请根据实际返回的 ID 调整）

### 1. 查询管道详情

```bash
curl -X GET "http://localhost:8000/api/pipelines/1" | jq
```

### 2. 查询所有分片状态

```bash
curl -X GET "http://localhost:8000/api/pipelines/1/shards" | jq
```

### 3. 续跑管道（从失败点继续）

```bash
curl -X POST "http://localhost:8000/api/pipelines/resume" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_id": 1}' | jq
```

### 4. 完成一个分片（模拟成功写入）

```bash
curl -X PUT "http://localhost:8000/api/pipelines/1/shards/2/complete" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "write_summary": {
      "records_written": 198520,
      "records_skipped": 8,
      "records_failed": 0,
      "duration_seconds": 142
    }
  }' | jq
```

### 5. 人工修正分片状态

```bash
curl -X POST "http://localhost:8000/api/pipelines/1/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "shard_index": 2,
    "new_status": "success",
    "reason": "数据已通过其他渠道手动导入",
    "write_summary": {"records_written": 198520}
  }' | jq
```

### 6. 导出写入摘要

```bash
curl -X GET "http://localhost:8000/api/pipelines/1/export-summary" | jq
```

### 7. 查看操作历史

```bash
curl -X GET "http://localhost:8000/api/pipelines/1/history" | jq
```

## 被规则拦截的场景示例

### 场景 1: 重复执行已成功的分片

分片0和1已经成功，再次续跑时它们会被拦截：

```bash
curl -X POST "http://localhost:8000/api/pipelines/resume" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_id": 1}' | jq
```

**预期结果**:
```json
{
  "executable_shards": 3,
  "warnings": [
    "分片 0 已成功执行，不允许重复执行",
    "分片 1 已成功执行，不允许重复执行"
  ],
  "shards": [
    {"shard_index": 2, "range_start": "...", "range_end": "..."},
    {"shard_index": 3, "range_start": "...", "range_end": "..."},
    {"shard_index": 4, "range_start": "...", "range_end": "..."}
  ]
}
```

### 场景 2: 跳跃执行超过水位点

当前水位点是1（分片0和1已完成），尝试直接执行分片4：

```bash
curl -X POST "http://localhost:8000/api/pipelines/resume" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_id": 1, "skip_shards": [4]}' | jq
```

**预期结果**:
```json
{
  "executable_shards": 0,
  "warnings": [
    "分片 4 超过当前水位点 1，不允许跳跃执行"
  ],
  "shards": []
}
```

### 场景 3: 强制跳过校验（危险操作）

如果确实需要强制执行，可以加上 `force: true`（谨慎使用！）：

```bash
curl -X POST "http://localhost:8000/api/pipelines/resume" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_id": 1, "skip_shards": [4], "force": true}' | jq
```

## 数据模型

### Pipeline（管道）
- `pipeline_name`: 管道名称（唯一）
- `total_shards`: 总分片数
- `current_watermark`: 当前水位点（已连续成功的最大分片索引）
- `status`: 状态 (pending/running/success/failed/paused)
- `last_failure_reason`: 最后失败原因
- `config`: 配置信息

### Shard（分片）
- `pipeline_id`: 所属管道ID
- `shard_index`: 分片索引
- `shard_range_start/range_end`: 分片范围
- `status`: 状态 (pending/running/success/failed/skipped)
- `failure_reason`: 失败原因
- `retry_count`: 重试次数
- `write_summary`: 写入摘要
- `raw_input`: 原始输入

### PipelineHistory（历史记录）
- `action`: 操作类型 (create/resume/complete_shard/manual_correction...)
- `status_before/status_after`: 状态变化
- `raw_input`: 原始输入
- `conclusion`: 处理结论
- `operator`: 操作人

## 典型使用流程

### 夜间管道失败后的处理

1. **报警触发**: 管道执行失败，收到报警
2. **查询状态**: `GET /api/pipelines/{id}` 查看失败点
3. **排查问题**: 查看失败分片的 `failure_reason`
4. **修复问题**: 修复网络/资源等问题
5. **断点续跑**: `POST /api/pipelines/resume` - 自动跳过已成功的分片
6. **监控执行**: 持续关注新的分片执行情况
7. **导出确认**: 全部完成后导出写入摘要确认

### 人工介入场景

1. 某些分片数据已通过其他方式导入
2. 分片数据已损坏，确认跳过
3. 状态机卡住需要手动调整

使用 `manual-correction` 接口进行人工修正，所有操作都会记录在历史中。

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 入口
│   ├── models.py        # 数据模型定义
│   ├── service.py       # 核心业务逻辑
│   └── database.py      # 数据库配置
├── requirements.txt     # 依赖列表
├── init_sample_data.py  # 样例数据初始化
└── README.md           # 本文档
```

## 注意事项

1. **默认使用 SQLite 本地持久化**，数据库文件为 `pipeline_resume.db`
2. 生产环境建议替换为 MySQL/PostgreSQL
3. `force=true` 参数谨慎使用，可能导致数据重复写入
4. 所有异常路径都会保留 `raw_input` 用于事后排查
