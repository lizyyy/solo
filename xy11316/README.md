# 🚌 校车调度服务

家长申诉、GPS轨迹匹配、迟到责任判定系统

## 功能特性

- ✅ **数据导入**: 支持站点时刻表CSV、GPS轨迹JSON、家长申诉单JSON
- ✅ **错误处理**: 坏数据完整保留（原始位置、失败原因、修改建议）
- ✅ **异常检测**: GPS轨迹与时刻表智能匹配，自动识别迟到、站点偏离
- ✅ **责任判定**: 自动判定责任方（司机、交通、学校、待调查）
- ✅ **多维度筛选**: 按负责人、时间、状态、异常类型、严重级别筛选
- ✅ **报告导出**: 导出与查询结果一致的CSV报告
- ✅ **本地持久化**: SQLite本地数据库，重启数据不丢失
- ✅ **历史记录**: 完整的处理历史和操作日志

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 3. 查看API文档

打开浏览器访问 http://localhost:3000 查看完整API文档

## 项目结构

```
school-bus-schedule-service/
├── src/
│   ├── config/
│   │   └── database.js      # 数据库配置
│   ├── services/
│   │   ├── importService.js    # 数据导入服务
│   │   ├── anomalyService.js   # 异常检测服务
│   │   └── exportService.js    # 导出服务
│   ├── utils/
│   │   └── errorHandler.js     # 错误处理工具
│   ├── routes/
│   │   └── index.js           # API路由
│   ├── public/
│   │   └── index.html         # API文档页面
│   └── index.js               # 服务入口
├── examples/                   # 示例数据
│   ├── stops.csv
│   ├── gps_data.json
│   └── complaints.json
├── data/                       # SQLite数据库目录
├── uploads/                    # 上传文件临时目录
├── exports/                    # 导出文件目录
└── package.json
```

## API接口

### 数据导入
- `POST /api/import/stops` - 导入站点时刻表CSV
- `POST /api/import/gps` - 导入GPS轨迹JSON
- `POST /api/import/complaints` - 导入家长申诉单JSON

### 异常检测
- `POST /api/anomalies/analyze` - 分析线路异常
- `GET /api/anomalies` - 查询异常记录（支持筛选）
- `PUT /api/anomalies/:id/handle` - 处理异常记录

### 错误记录
- `GET /api/import-errors` - 查看导入错误记录
- `PUT /api/import-errors/:id/resolve` - 标记错误已解决

### 导出报告
- `GET /api/export/anomalies` - 导出异常记录CSV
- `GET /api/export/complaints` - 导出申诉记录CSV

### 历史与统计
- `GET /api/processing-history` - 查看处理历史
- `GET /api/dashboard/summary` - 仪表盘统计摘要

### 健康检查
- `GET /api/health` - 服务健康状态

## 筛选参数说明

### 异常记录筛选
- `driver_id` - 司机ID
- `driver_name` - 司机姓名（模糊匹配）
- `status` - 状态: pending/resolved/rejected
- `anomaly_type` - 异常类型: late_arrival/stop_deviation/no_show
- `severity` - 严重级别: high/medium/low
- `responsibility` - 责任判定: driver/traffic/school/investigate
- `start_date` - 开始日期 (YYYY-MM-DD)
- `end_date` - 结束日期 (YYYY-MM-DD)
- `limit` - 返回数量限制

### 导入错误筛选
- `import_type` - 导入类型: stops/gps/complaints
- `resolved` - 是否已解决: true/false
- `start_date` - 开始日期
- `end_date` - 结束日期

## 使用示例

```bash
# 1. 导入站点数据
curl -X POST http://localhost:3000/api/import/stops \
  -F "file=@examples/stops.csv"

# 2. 导入GPS数据
curl -X POST http://localhost:3000/api/import/gps \
  -F "file=@examples/gps_data.json"

# 3. 导入申诉数据
curl -X POST http://localhost:3000/api/import/complaints \
  -F "file=@examples/complaints.json"

# 4. 分析线路异常
curl -X POST http://localhost:3000/api/anomalies/analyze \
  -H "Content-Type: application/json" \
  -d '{"route_id": "R001", "date": "2024-01-15"}'

# 5. 查询待处理异常
curl http://localhost:3000/api/anomalies?status=pending&severity=high

# 6. 按司机筛选
curl http://localhost:3000/api/anomalies?driver_id=D001

# 7. 处理异常
curl -X PUT http://localhost:3000/api/anomalies/1/handle \
  -H "Content-Type: application/json" \
  -d '{"handler": "调度员A", "status": "resolved", "responsibility": "traffic"}'

# 8. 查看导入错误
curl http://localhost:3000/api/import-errors

# 9. 导出报告
curl -o anomalies_report.csv http://localhost:3000/api/export/anomalies?status=pending
```

## 数据库表结构

- `stops` - 站点信息
- `gps_records` - GPS轨迹记录
- `complaints` - 家长申诉单
- `import_errors` - 导入错误记录（含原始数据、错误原因、修改建议）
- `anomaly_records` - 异常检测记录
- `processing_history` - 处理历史记录
- `drivers` - 司机信息

## 数据持久化

所有数据存储在 `data/database.db` SQLite数据库文件中：
- ✅ 服务重启后数据完整保留
- ✅ 第二次运行可查询所有历史处理结果
- ✅ 错误记录永久保存（可标记为已解决）

## 技术栈

- **框架**: Express.js
- **数据库**: SQLite3
- **数据解析**: csv-parser, multer
- **日期处理**: moment
- **导出格式**: json2csv
- **跨域支持**: CORS
