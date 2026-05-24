# 剧场烟火审批 API

解决剧场演出临时加烟火效果时，舞监、消防和道具组确认散在群聊的问题。

## 技术栈
- Python 3.8+
- FastAPI
- SQLite
- ReportLab (PDF生成)

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn app.main:app --reload
```
服务运行在: http://localhost:8000
API文档: http://localhost:8000/docs

### 3. 造数
```bash
python seed_data.py
```

### 4. 自检
```bash
python self_test.py
```

## API 接口

### 创建演出场次
```bash
curl -X POST "http://localhost:8000/performances" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "《天鹅湖》新年场",
    "date": "2024-12-31T19:30:00",
    "venue": "国家大剧院",
    "is_temporary": false
  }'
```

### 提交烟火点位
```bash
curl -X POST "http://localhost:8000/performances/1/points" \
  -H "Content-Type: application/json" \
  -d '[{
    "location_code": "STAGE-LEFT-01",
    "x_coordinate": -5.0,
    "y_coordinate": 2.0,
    "distance_to_audience": 8.5,
    "firework_type": "冷焰火",
    "quantity": 20
  }]'
```

### 提交消防审批
```bash
curl -X POST "http://localhost:8000/performances/1/approvals" \
  -H "Content-Type: application/json" \
  -d '{
    "department": "消防部门",
    "approver_name": "王建国",
    "certificate_number": "XF-2024-001234"
  }'
```

### 提交试放记录
```bash
curl -X POST "http://localhost:8000/performances/1/test-records" \
  -H "Content-Type: application/json" \
  -d '{
    "test_time": "2024-12-30T15:00:00",
    "tester_name": "李明",
    "witness_name": "张华",
    "video_evidence_url": "https://example.com/video.mp4"
  }'
```

### 规则判定
```bash
curl "http://localhost:8000/performances/1/check"
```

### 生成审批报告
```bash
curl -X POST "http://localhost:8000/performances/1/report" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_manager_name": "舞监-张三",
    "fire_department_name": "消防-李四",
    "prop_team_name": "道具-王五"
  }'
```

## 失败路径演示

### 安全距离不足（点位<5米）
```bash
curl -X POST "http://localhost:8000/performances/1/points" \
  -H "Content-Type: application/json" \
  -d '[{
    "location_code": "DANGER-001",
    "x_coordinate": 0.0,
    "y_coordinate": 0.0,
    "distance_to_audience": 3.0,
    "firework_type": "危险烟花",
    "quantity": 10
  }]'
```
**预期结果**: `校验失败: 点位 DANGER-001: 距离观众区 3.0m 低于安全距离 5.0m`

### 临时加场未复核被拦截
```bash
# 创建临时加场
curl -X POST "http://localhost:8000/performances" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "临时加场",
    "date": "2024-12-31T22:00:00",
    "venue": "小剧场",
    "is_temporary": true
  }'

# 尝试直接确认责任（会被拦截）
curl -X POST "http://localhost:8000/performances/2/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_manager_name": "张三",
    "fire_department_name": "李四",
    "prop_team_name": "王五"
  }'
```
**预期结果**: 403 Forbidden - `临时加场未完成全部复核，禁止确认责任`

## 核心功能

### ✅ 点位校验
- 观众区安全距离 >= 5米
- 自动校验并标记点位状态

### ✅ 审批状态机
```
pending → points_submitted → points_verified → fire_approved 
        → test_completed → props_confirmed → final_approved
```

### ✅ 试放留痕
- 强制要求视频证据链接
- 测试员和见证人双签字

### ✅ 加场拦截
- 临时加场(is_temporary=true)必须走完完整审批流程

### ✅ 重复提交检测
- 相同材料SHA256哈希去重
- 重复提交返回已有记录ID和可解释说明

### ✅ 报告导出
- 自动生成PDF审批报告
- 包含三方责任确认
