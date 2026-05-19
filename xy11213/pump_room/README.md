# 泵房巡检台账管理系统

## 项目简介
小区工程主管泵房巡检台账管理后端系统，解决微信群散记录问题，支持完整业务流程。

## 核心功能
- ✅ 报修单管理（创建、查询、详情）
- ✅ 派工、到场、复测、关闭全流程
- ✅ 24小时内重复报修自动拦截
- ✅ 超时4小时自动升级机制
- ✅ 复测不通过留痕，需重新处理
- ✅ 所有操作可追溯，显示操作原因
- ✅ 批量操作，明确成功/失败详情
- ✅ 幂等性保证，重复操作无副作用

## 技术栈
- Python 3.8+
- Flask 3.0
- Flask-SQLAlchemy
- SQLite (本地数据库)

## 快速开始

### 1. 安装依赖
```bash
cd pump_room
pip install -r requirements.txt
```

### 2. 初始化数据
```bash
python init_data.py
```

### 3. 启动服务
```bash
python app.py
```

服务将在 `http://localhost:5001` 启动

### 4. 接口文档
详见 [API_DOCS.md](./API_DOCS.md)

## 快速测试示例

### 创建报修单
```bash
curl -X POST http://localhost:5001/api/repairs \
  -H "Content-Type: application/json" \
  -d '{
    "pump_room_id": 1,
    "report_source": "微信群",
    "problem_type": "水泵异响",
    "description": "1号泵运行有异常噪音",
    "reporter": "李工"
  }'
```

### 派工
```bash
curl -X POST http://localhost:5000/api/repairs/1/assign \
  -H "Content-Type: application/json" \
  -d '{"staff_id": 1}'
```

### 标记到场
```bash
curl -X POST http://localhost:5000/api/repairs/1/arrive
```

### 复测通过
```bash
curl -X POST http://localhost:5000/api/repairs/1/reinspect \
  -H "Content-Type: application/json" \
  -d '{
    "inspector": "张工",
    "result": "已修复",
    "description": "轴承更换完成，运行正常",
    "is_passed": true
  }'
```

### 关闭工单
```bash
curl -X POST http://localhost:5000/api/repairs/1/close
```

### 批量创建
```bash
curl -X POST http://localhost:5000/api/batch/create-repairs \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"pump_room_id": 1, "problem_type": "水泵异响", "description": "异响", "reporter": "李工"},
      {"pump_room_id": 2, "problem_type": "压力异常", "description": "压力低", "reporter": "王工"}
    ]
  }'
```

## 项目结构
```
pump_room/
├── app.py           # 主应用，路由定义
├── models.py        # 数据库模型
├── services.py      # 业务逻辑服务
├── config.py        # 配置文件
├── requirements.txt # 依赖列表
├── .env            # 环境变量
├── init_data.py    # 初始化数据脚本
├── API_DOCS.md     # 接口文档
└── README.md       # 项目说明
```
