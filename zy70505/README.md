# 设备事件顺序修复API服务

## 概述

解决跨机房设备事件到达顺序混乱问题，提供事件顺序检测、冲突记录、人工修正和时间线导出功能。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

### 3. 运行测试脚本

```bash
chmod +x test_api.sh
./test_api.sh
```

## API接口说明

### 1. 创建设备事件

```bash
curl -X POST "http://localhost:8000/api/events" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_sequence": 1,
    "event_type": "POWER_ON",
    "event_data": {"voltage": 220},
    "receive_time": "2024-01-15T10:00:00",
    "room_id": "room-beijing-01"
  }'
```

**自动冲突检测：**
- 重复序号 → 标记为 conflict
- 序号倒退 → 标记为 conflict  
- 序号跳号 → 标记为 conflict

### 2. 查询事件列表

```bash
# 查询所有事件
curl "http://localhost:8000/api/events"

# 按设备查询
curl "http://localhost:8000/api/events?device_id=DEV001"

# 按状态查询
curl "http://localhost:8000/api/events?status=conflict"
```

### 3. 推进事件状态

```bash
# pending -> processing
curl -X POST "http://localhost:8000/api/events/1/status?target_status=processing"

# processing -> fixed
curl -X POST "http://localhost:8000/api/events/1/status?target_status=fixed"
```

**状态流转图：**
```
pending → processing → conflict → fixed
                        ↓
                   manual_corrected
```

**幂等性保证：** 重复提交同一状态推进请求会失败，不会重复推进。

### 4. 查询冲突记录

```bash
# 查询所有冲突
curl "http://localhost:8000/api/conflicts"

# 查询未解决冲突
curl "http://localhost:8000/api/conflicts?resolved=false"
```

### 5. 人工修正事件序号

```bash
curl -X POST "http://localhost:8000/api/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "DEV001",
    "event_id": 4,
    "corrected_sequence": 3,
    "reason": "跨机房延迟导致序号错误",
    "operator": "客服张三"
  }'
```

**修正操作会：**
1. 更新事件的序号
2. 记录修正历史（原始序号、修正序号、原因、操作人）
3. 标记事件状态为 manual_corrected
4. 解决对应的冲突记录

### 6. 生成时间线报告

```bash
curl "http://localhost:8000/api/timeline/DEV001"
```

报告包含：
- 事件序列链
- 所有事件详情
- 冲突记录汇总
- 人工修正记录
- 异常检测（缺失序号、重复序号）

### 7. 导出设备数据

```bash
curl "http://localhost:8000/api/export/DEV001"
```

导出内容包含：
- 统计摘要（事件数、冲突数、修正数）
- 事件列表（含原始输入、处理依据）
- 冲突解释（每条异常的说明和结论）

## 数据模型

### device_events (设备事件表)
- id: 事件ID
- device_id: 设备编号
- event_sequence: 事件序号
- event_type: 事件类型
- event_data: 事件数据
- receive_time: 接收时间
- room_id: 机房ID
- raw_input: 原始输入（用于追溯）
- status: 状态
- created_at: 创建时间

### conflict_records (冲突记录表)
- id: 冲突ID
- device_id: 设备编号
- event_id: 关联事件ID
- conflict_type: 冲突类型
- conflict_detail: 冲突详情
- resolution: 解决方案
- resolved_by: 解决人
- resolved_at: 解决时间

### manual_corrections (人工修正表)
- id: 修正ID
- device_id: 设备编号
- event_id: 事件ID
- original_sequence: 原始序号
- corrected_sequence: 修正后序号
- reason: 修正原因
- operator: 操作人
- created_at: 修正时间

### timeline_reports (时间线报告表)
- id: 报告ID
- device_id: 设备编号
- report_data: 报告数据(JSON)
- generated_at: 生成时间

## 核心规则

1. **序号排序**：事件按 event_sequence 排序展示
2. **乱序识别**：创建时自动检测重复、倒退、跳号
3. **冲突保留**：所有冲突记录保留，不自动删除
4. **人工修正**：修正记录完整可追溯
5. **失败路径保留**：raw_input 字段保留原始请求

## 验收场景

### 场景1: 正常创建和查询
```bash
# 创建事件1、2、3（正常顺序）
# 查询事件列表确认顺序正确
```

### 场景2: 重复提交同一动作
```bash
# 推进事件到 processing
# 再次推进到 processing → 应该失败
# 推进到 fixed → 成功
# 再次推进到 fixed → 应该失败
```

### 场景3: 导出摘要解释异常
```bash
# 创建乱序事件（产生冲突）
# 人工修正
# 导出数据 → 查看 conflict_explanations 字段
```
