# 校车运营队学生迟到补登 API

## 项目简介
本项目为校车运营队提供学生迟到补登功能，支持批量导入迟到记录，处理特殊情况（学生未刷卡但司机手工标记上车、迟到周报一致性），并提供详细的错误处理和人工备注功能。

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

## API 接口

### 导入迟到记录
**POST** `/api/late-records/import`

#### 请求参数
```json
{
  "records": [
    {
      "student_id": "2024001",
      "student_name": "张三",
      "class_name": "三年级一班",
      "route_number": "校车A线",
      "bus_plate": "京A12345",
      "driver_name": "李师傅",
      "late_date": "2024-05-20",
      "scheduled_arrival": "07:30",
      "actual_arrival": "07:45",
      "late_minutes": 15,
      "reason_category": "交通拥堵",
      "is_driver_marked": true,
      "is_weekly_consistent": false
    }
  ]
}
```

#### 字段说明
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| student_id | string | 是 | 学生学号 |
| student_name | string | 是 | 学生姓名 |
| class_name | string | 是 | 班级名称 |
| route_number | string | 是 | 校车线路编号 |
| bus_plate | string | 是 | 校车车牌号 |
| driver_name | string | 是 | 司机姓名 |
| late_date | string | 是 | 迟到日期 (YYYY-MM-DD) |
| scheduled_arrival | string | 是 | 计划到达时间 (HH:MM) |
| actual_arrival | string | 是 | 实际到达时间 (HH:MM) |
| late_minutes | integer | 是 | 迟到分钟数 |
| reason_category | string | 是 | 迟到原因分类 |
| is_driver_marked | boolean | 否 | 司机手工标记上车（学生未刷卡） |
| is_weekly_consistent | boolean | 否 | 迟到周报一致性标记 |
| status | string | 否 | 记录状态：pending/confirmed/archived |
| remark | string | 否 | 人工备注 |

#### 响应示例
```json
{
  "success": true,
  "total_count": 10,
  "success_count": 8,
  "failed_count": 2,
  "need_manual_review_count": 1,
  "successful_records": [...],
  "failed_records": [
    {
      "original_data": {
        "student_id": "2024002",
        "student_name": "李四",
        "late_minutes": -5
      },
      "error_reason": "迟到分钟数不能为负数",
      "suggestion": "请核对实际到达时间，重新计算迟到分钟数"
    }
  ],
  "need_manual_review_records": [
    {
      "record_id": "rec_123456",
      "original_data": {...},
      "review_reason": "司机手工标记上车，需确认学生实际乘车情况",
      "current_status": "pending"
    }
  ]
}
```

### 更新记录状态（添加备注）
**PUT** `/api/late-records/<record_id>/status`

#### 请求参数
```json
{
  "status": "confirmed",
  "remark": "已核实学生确实上车，因考勤机故障未刷卡"
}
```

### 查询导入记录
**GET** `/api/late-records`

支持参数：`status`, `student_id`, `late_date`, `page`, `page_size`

## 测试运行
```bash
python test_api.py
```

## 状态流转规则
- pending → confirmed：正常确认
- pending → archived：归档取消
- confirmed → archived：归档
- **禁止越级**：不能直接从 pending 以外的状态开始
