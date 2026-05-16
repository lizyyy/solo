# CDN 源站故障切换 API

解决 CDN 源站临时切换后经常忘记恢复的问题，提供完整的状态机管理和恢复提醒机制。

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务启动在: http://localhost:8000
API 文档: http://localhost:8000/docs

### 3. 初始化样例数据
```bash
pip install requests  # 如果没装的话
python init_sample.py
```

---

## 核心 API 调用 (curl 示例)

### ✅ 1. 创建域名配置
```bash
curl -X POST http://localhost:8000/api/domains \
  -H "Content-Type: application/json" \
  -d '{
    "domain_name": "video.example.com",
    "primary_origin": "primary-video.example.com",
    "backup_origin": "backup-video.example.com"
  }'
```

### ✅ 2. 查询所有域名
```bash
curl http://localhost:8000/api/domains
```

### ✅ 3. 创建切换请求
```bash
curl -X POST http://localhost:8000/api/switches \
  -H "Content-Type: application/json" \
  -d '{
    "domain_name": "img.example.com",
    "switch_reason": "华东区域 5xx 错误率超过 15%，持续 3 分钟",
    "recovery_condition": "主源站 5xx 率低于 1%，持续 10 分钟",
    "created_by": "ops-alert-system"
  }'
```
返回示例:
```json
{
  "code": 0,
  "message": "切换请求已创建",
  "data": { "switch_id": "xxx" }
}
```

### ✅ 4. 推进切换状态
```bash
# 把下面的 SWITCH_ID 换成实际返回的 ID
curl -X POST http://localhost:8000/api/switches/SWITCH_ID/advance
```

状态机流转:
```
pending → switching → switched → recovering → completed
              ↓
            cancelled/failed
```

### ✅ 5. 查询切换记录
```bash
# 全部
curl http://localhost:8000/api/switches

# 按状态过滤
curl 'http://localhost:8000/api/switches?status=switched'
```

### ✅ 6. 人工修正
```bash
curl -X POST http://localhost:8000/api/switches/SWITCH_ID/manual-fix \
  -H "Content-Type: application/json" \
  -d '{
    "primary_health": true,
    "status": "recovering"
  }'
```

### ✅ 7. 导出切换报告
```bash
curl http://localhost:8000/api/switches/SWITCH_ID/export
```

### ✅ 8. 检查恢复提醒
```bash
curl http://localhost:8000/api/reminders
```
自动检测切换超过 24 小时未恢复的记录。

---

## ❌ 被规则拦住的路径示例

### 场景 1: 主源站健康时的切换请求
```bash
# cdn.example.org 的主源站标记为 healthy-cdn.example.org
curl -X POST http://localhost:8000/api/switches \
  -H "Content-Type: application/json" \
  -d '{
    "domain_name": "cdn.example.org",
    "switch_reason": "测试健康源站切换",
    "recovery_condition": "测试恢复",
    "created_by": "test"
  }'

# 然后推进状态
curl -X POST http://localhost:8000/api/switches/SWITCH_ID/advance
```
**预期结果**: `{"code": 400, "message": "主源站健康，无需切换"}`

### 场景 2: 重复切换（幂等保护）
```bash
# 对同一个域名连续发起两次切换请求
curl -X POST http://localhost:8000/api/switches \
  -H "Content-Type: application/json" \
  -d '{"domain_name": "img.example.com", "switch_reason": "第一次请求", "recovery_condition": "xxx"}'

# 第二次会被拦截
curl -X POST http://localhost:8000/api/switches \
  -H "Content-Type: application/json" \
  -d '{"domain_name": "img.example.com", "switch_reason": "第二次请求", "recovery_condition": "xxx"}'
```
**预期结果**: `{"code": 409, "message": "存在进行中的切换记录，幂等保护已触发"}`

### 场景 3: 主源站未恢复时强行切回
```bash
# 先切到备用源站（推进到 switched 状态）
# 然后强行推进恢复
curl -X POST http://localhost:8000/api/switches/SWITCH_ID/advance
```
**预期结果**: `{"code": 400, "message": "主源站未恢复健康，暂不能切回"}`

---

## 数据模型

### Domain - 域名配置
| 字段 | 说明 |
|------|------|
| domain_name | 域名 |
| primary_origin | 主源站 |
| backup_origin | 备用源站 |
| current_origin | 当前使用的源站 |
| is_switched | 是否已切到备用 |

### SwitchRecord - 切换记录
| 字段 | 说明 |
|------|------|
| switch_reason | 切换原因 |
| recovery_condition | 恢复条件 |
| status | 状态 (pending/switching/switched/recovering/completed) |
| primary_health | 主源站健康状态 |
| switched_at | 切换时间 |
| recovered_at | 恢复时间 |
| reminder_time | 提醒时间（24小时后） |

### SwitchException - 异常记录
| 字段 | 说明 |
|------|------|
| raw_input | 原始输入 |
| error_message | 错误信息 |
| resolution | 处理结论 |

---

## 本地持久化

数据存储在 SQLite 数据库文件: `cdn_switch.db`
- 可直接查看: `sqlite3 cdn_switch.db`
- 查看表: `.tables`
- 查询记录: `SELECT * FROM switch_records;`

---

## 健康检查逻辑

- 源站地址包含 `unhealthy` → 始终返回不健康
- 源站地址包含 `healthy` → 始终返回健康
- 其他地址 → 首次随机，后续保持该状态
