# 同卡异地白名单异常清单后端API

写字楼门禁日志异常检测系统，用于识别同卡异地刷卡异常。

## 技术栈
- FastAPI - Web框架
- SQLite - 数据库
- SQLAlchemy - ORM
- Pytest - 测试框架

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问: http://localhost:8000/docs

### 3. 造测试数据
```bash
python seed_data.py
```

## API 主流程 (curl示例)

### 创建异常检测任务
```bash
curl -X POST "http://localhost:8000/api/detection/tasks" \
  -H "Content-Type: application/json" \
  -d '{"name": "2024年5月异常检测", "time_window_minutes": 60}'
```

### 查询异常列表
```bash
curl "http://localhost:8000/api/anomalies?status=pending"
```

### 推进异常状态
```bash
curl -X PATCH "http://localhost:8000/api/anomalies/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing", "handler": "张三"}'
```

### 人工修正异常
```bash
curl -X POST "http://localhost:8000/api/anomalies/1/correct" \
  -H "Content-Type: application/json" \
  -d '{"conclusion": "确认为异常", "is_anomaly": true, "handler": "张三", "remark": "已核实员工当天不在两地"}'
```

### 撤回/关闭异常
```bash
curl -X POST "http://localhost:8000/api/anomalies/1/close" \
  -H "Content-Type: application/json" \
  -d '{"reason": "误报，系统时间同步问题", "handler": "李四"}'
```

### 导出异常报告
```bash
curl "http://localhost:8000/api/anomalies/export?format=csv" -o anomalies.csv
```

## 冲突处理路径

### 并发处理同一异常
```bash
# 终端1
curl -X PATCH "http://localhost:8000/api/anomalies/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing", "handler": "张三"}'

# 终端2 (同时执行) - 会返回409冲突
curl -X PATCH "http://localhost:8000/api/anomalies/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing", "handler": "李四"}'
```

## 运行测试
```bash
pytest -v
```

## 核心规则说明
1. **时间排序**: 刷卡日志按时间排序
2. **异地规则**: 同一张卡短时间内在不同门区刷卡
3. **人员匹配**: 关联员工信息判断合理性
4. **白名单过滤**: 白名单人员跳过异常检测
5. **报告导出**: 支持CSV格式导出
