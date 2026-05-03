# Feature Flag Replay Service

一个本地 FastAPI + SQLite 的功能开关发布回放服务，用于审计和回放功能开关的历史发布事件。

## 功能特性

- **多格式导入**: 支持导入 `flags.yaml`、`segments.json`、`rollout_events.jsonl` 和 `users.csv`
- **审计批次**: 每次导入创建独立的审计批次，数据隔离
- **时间回放**: 按时间点回放每个用户命中的开关版本
- **异常检测**: 自动检测乱序事件、引用已删除分群等异常
- **报告导出**: 支持导出 `issues.csv` 和 `replay_report.md`

## 核心坑位处理

### 1. 百分比灰度哈希桶稳定
使用 SHA256 哈希算法确保同一用户对同一开关的哈希桶稳定：
```python
# 核心实现
combined = f"{user_key}:{flag_key}"
hash_obj = hashlib.sha256(combined.encode())
hash_int = int(hash_obj.hexdigest()[:16], 16)
return hash_int % num_buckets
```
- 用户 + 开关 组合产生固定桶号
- 百分比扩展/收缩时，已进入灰度的用户保持稳定

### 2. Kill Switch 覆盖
Kill Switch 具有最高优先级，直接覆盖所有其他规则：
```python
if flag["is_kill_switch"]:
    result["value"] = flag["kill_switch_value"]
    result["is_kill_switch_override"] = True
    return result
```
- 激活时立即对所有用户生效
- 用于紧急回滚场景

### 3. 乱序事件处理
事件导入时按 `(timestamp, version)` 排序，回放时检测异常：
```python
# 导入时排序
events.sort(key=lambda x: (x.get("timestamp", ""), x.get("version", 0)))

# 回放时检测异常
if delete_event.timestamp < later_version.timestamp:
    # 标记为 out_of_order_event
```
- 检测"先删除后更新"的乱序问题

### 4. 引用已删除分群
目标规则引用的分群不存在或已删除时：
```python
segment = self.get_segment_at_time(segment_key, timestamp)
if segment is None:
    result["segment_reference_issue"] = f"Segment '{segment_key}' not found or deleted"
    continue  # 跳过此规则，继续下一个
```
- 标记异常但不中断评估
- 继续尝试后续规则或使用默认值

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
# 或
uvicorn main:app --reload --port 8000
```

服务启动后访问: http://localhost:8000/docs 查看 Swagger UI

## API 使用示例

### 1. 创建审计批次并上传数据
```bash
curl -X POST "http://localhost:8000/api/batches?name=release_v2.1" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "flags_file=@samples/flags.yaml" \
  -F "segments_file=@samples/segments.json" \
  -F "events_file=@samples/rollout_events.jsonl" \
  -F "users_file=@samples/users.csv"
```

响应示例:
```json
{
  "id": 1,
  "name": "release_v2.1",
  "created_at": "2024-01-15T10:30:00"
}
```

### 2. 查看所有批次
```bash
curl "http://localhost:8000/api/batches"
```

### 3. 执行回放
```bash
curl -X POST "http://localhost:8000/api/batches/1/replay"
```

或指定时间范围:
```bash
curl -X POST "http://localhost:8000/api/batches/1/replay?start_time=2024-01-15T00%3A00%3A00Z&end_time=2024-01-16T00%3A00%3A00Z&step_minutes=60"
```

响应示例:
```json
{
  "batch_id": 1,
  "replayed_users": 10,
  "replayed_flags": 3,
  "timestamps": 8,
  "anomalies_found": 5
}
```

### 4. 查看回放结果
```bash
curl "http://localhost:8000/api/batches/1/replay/results?limit=20"
```

按用户筛选:
```bash
curl "http://localhost:8000/api/batches/1/replay/results?user_key=user_001"
```

按开关筛选:
```bash
curl "http://localhost:8000/api/batches/1/replay/results?flag_key=dark_mode"
```

### 5. 查询异常
```bash
curl "http://localhost:8000/api/batches/1/anomalies"
```

按类型筛选:
```bash
curl "http://localhost:8000/api/batches/1/anomalies?anomaly_type=segment_reference"
```

### 6. 导出 Issues CSV
```bash
curl -O "http://localhost:8000/api/batches/1/export/issues.csv"
```

### 7. 导出回放报告 (Markdown)
```bash
curl -O "http://localhost:8000/api/batches/1/export/replay_report.md"
```

## 数据格式说明

### flags.yaml
```yaml
flags:
  - key: feature_name
    version: 1
    created_at: "2024-01-01T00:00:00Z"
    default_value: false
    rollout_percent: 50
    is_kill_switch: false
    kill_switch_value: false
    targeting_rules:
      - type: segment
        segment_key: beta_testers
        value: true
      - type: percentage
        percentage: 20
        value: true
```

### segments.json
```json
[
  {
    "key": "beta_testers",
    "version": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "user_keys": ["user_001", "user_002"]
  }
]
```

### rollout_events.jsonl (每行一个 JSON)
```json
{"type": "flag_update", "flag_key": "dark_mode", "version": 1, "timestamp": "2024-01-15T10:00:00Z", "data": {"rollout_percent": 50}}
{"type": "kill_switch_activate", "flag_key": "dark_mode", "version": 2, "timestamp": "2024-01-15T14:00:00Z", "data": {"kill_switch_value": false}}
{"type": "flag_delete", "flag_key": "old_feature", "version": 3, "timestamp": "2024-01-15T16:00:00Z", "data": {}}
```

### users.csv
```csv
user_key,name,email,plan
user_001,Alice,alice@example.com,premium
user_002,Bob,bob@example.com,free
```

## 运行测试
```bash
pytest -v
```

## 项目结构
```
.
├── main.py              # FastAPI 主应用
├── requirements.txt     # 依赖
├── test_main.py         # pytest 测试
├── samples/             # 示例数据
│   ├── flags.yaml
│   ├── segments.json
│   ├── rollout_events.jsonl
│   └── users.csv
└── README.md
```

## 数据库模型

- **AuditBatch**: 审计批次，隔离每次导入
- **FlagHistory**: 开关版本历史
- **SegmentHistory**: 分群版本历史
- **RolloutEvent**: 发布事件日志
- **User**: 用户数据
- **ReplayResult**: 回放结果
- **Anomaly**: 检测到的异常
