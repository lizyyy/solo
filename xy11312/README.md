# 校车调度责任判定系统

解决家长申诉、GPS轨迹和司机打卡对不上的问题，实现自动化责任判定。

## 功能特性

### 1. 数据接收
- 司机、车辆、学生基础信息管理
- 司机打卡数据导入（单条/批量）
- GPS轨迹数据导入（单条/批量）
- 家长申诉数据导入（单条/批量）

### 2. 匹配与裁定
- **自动匹配**：根据线路、时间关联申诉、GPS和打卡数据
- **自动裁定**：基于GPS速度、打卡时间、延误时长判定责任
- **人工裁定**：支持手动指定责任方和原因
- 责任类型：driver(司机) / traffic(交通) / weather(天气) / school(学校) / parent(家长) / other(其他) / unknown(未知)

### 3. 复核机制
- 支持对裁定结果进行复核
- 复核可修改责任判定
- 保留完整复核历史记录

### 4. 导出功能
- 导出裁定记录到Excel
- 支持按时间、状态、线路筛选
- 导出文件自动脱敏

### 5. 幂等性保证
- 所有导入接口支持幂等键
- 重复提交返回已存在记录
- 不会重复扣款/派单/计算

### 6. 批量操作容错
- 批量导入时逐条处理
- 失败记录不影响成功记录
- 返回详细的成功/失败明细
- 支持重试失败记录

### 7. 敏感数据脱敏
- 手机号：138****0001
- 姓名：李*
- API返回、日志、导出文件全程脱敏

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 运行完整流程测试

```bash
python test_flow.py
```

## API接口说明

### 基础数据
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/drivers/` | 创建司机 |
| POST | `/buses/` | 创建车辆 |
| POST | `/students/` | 创建学生 |

### 数据导入
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/checkins/` | 导入司机打卡 |
| POST | `/gps/` | 导入GPS轨迹 |
| POST | `/complaints/` | 导入家长申诉 |

### 批量导入
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/batch/checkins/` | 批量导入打卡 |
| POST | `/batch/gps/` | 批量导入GPS |
| POST | `/batch/complaints/` | 批量导入申诉 |

### 裁定与复核
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/rulings/auto/{complaint_id}` | 自动裁定 |
| POST | `/rulings/manual/` | 人工裁定 |
| POST | `/reviews/` | 复核裁定 |

### 查询与导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/complaints/` | 获取申诉列表 |
| GET | `/complaints/{id}` | 获取申诉详情 |
| POST | `/export/rulings` | 导出裁定记录 |

## 使用示例

### 1. 创建基础数据

```bash
curl -X POST "http://localhost:8000/drivers/" \
  -H "Content-Type: application/json" \
  -d '{"driver_name":"张司机","driver_phone":"13800138001","employee_id":"DRV001"}'
```

### 2. 导入家长申诉

```bash
curl -X POST "http://localhost:8000/complaints/" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "complaint_001",
    "complaint_number": "COMP20240101001",
    "student_name": "李明",
    "parent_name": "李父",
    "parent_phone": "13900139001",
    "bus_route": "1号线",
    "stop_name": "中关村站",
    "complaint_date": "2024-01-01T07:30:00",
    "scheduled_arrival": "2024-01-01T07:20:00",
    "actual_arrival": "2024-01-01T07:45:00",
    "complaint_type": "delay",
    "description": "校车晚点25分钟"
  }'
```

### 3. 自动裁定

```bash
curl -X POST "http://localhost:8000/rulings/auto/1"
```

### 4. 复核裁定

```bash
curl -X POST "http://localhost:8000/reviews/" \
  -H "Content-Type: application/json" \
  -d '{
    "ruling_id": 1,
    "reviewer": "张调度",
    "review_result": "revised",
    "review_notes": "当天有交通事故",
    "new_responsibility": "traffic"
  }'
```

### 5. 导出记录

```bash
curl -X POST "http://localhost:8000/export/rulings" \
  -H "Content-Type: application/json" \
  -d '{"export_format": "xlsx"}' \
  -o rulings_export.xlsx
```

## 项目结构

```
.
├── main.py              # FastAPI主程序
├── models.py            # 数据库模型
├── schemas.py           # Pydantic模型
├── services.py          # 业务逻辑
├── config.py            # 配置文件
├── requirements.txt     # 依赖列表
├── test_flow.py         # 流程测试脚本
├── README.md            # 说明文档
└── bus_scheduling.db    # SQLite数据库(运行后生成)
```

## 裁定逻辑说明

### 责任判定规则
1. **延误 ≤ 5分钟**：正常波动，未知责任
2. **延误 > 30分钟**：大概率交通拥堵
3. **司机打卡晚于发车时间15分钟**：司机责任
4. **GPS平均速度 < 10km/h**：交通拥堵
5. **延误 > 15分钟，无其他迹象**：司机责任

### 匹配逻辑
- 通过线路名称关联车辆
- 通过时间窗口匹配GPS和打卡记录
- GPS匹配窗口：申诉时间 ± 60分钟
- 打卡匹配窗口：申诉时间 ± 120分钟

## 注意事项

1. **幂等键**：导入数据时建议提供唯一的 idempotency_key，系统会自动生成哈希确保幂等
2. **敏感数据**：所有涉及个人信息的字段在API返回、日志、导出时都会自动脱敏
3. **批量处理**：批量导入时即使部分失败，成功的记录也会被保存，失败记录会返回详细错误
4. **数据库**：默认使用SQLite，生产环境可修改 config.py 切换到其他数据库
