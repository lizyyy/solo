# 幼儿园校车晨检复核系统

一个用于幼儿园校车管理员晨检和接送复核的本地桌面工具。

## 功能特性

- **数据导入**：支持导入学生台账 CSV、刷卡上下车 JSONL、车辆路线 YAML、随车老师备注 CSV
- **状态重建**：重建每趟车的上车、下车、交接状态
- **异常检测**：自动检测未下车、错线路、重复刷卡、临时请假仍上车等异常
- **筛选查询**：支持按日期、车辆筛选记录
- **人工处理**：支持人工标记异常为已处理并持久化
- **数据导出**：导出 issues.csv 和 handover_report.md

## 项目结构

```
zy8232/
├── app.py                 # Flask 主应用（包含前端界面）
├── database.py            # SQLite 数据库操作
├── data_importer.py       # 数据导入模块
├── trip_processor.py      # 行程处理与异常检测
├── requirements.txt       # Python 依赖
├── sample_data/           # 示例数据
│   ├── students.csv       # 学生台账
│   ├── swipe_records.jsonl # 刷卡记录
│   ├── routes.yaml        # 车辆路线
│   └── teacher_notes.csv  # 老师备注
├── data/                  # 数据存储目录
└── school_bus.db          # SQLite 数据库
```

## 环境要求

- Python 3.8+
- pip

## 安装步骤

1. 进入项目目录：
```bash
cd /Users/lzy/pro/solocoder/pro/zy8232/repo/zy8232
```

2. 创建虚拟环境（可选但推荐）：
```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

## 启动方式

```bash
python app.py
```

启动后，浏览器访问：`http://localhost:5000`

## 使用说明

### 1. 加载示例数据

进入 "数据导入" 标签页，点击 **"加载示例数据"** 按钮，系统会自动导入预设的示例数据。

示例数据包含以下演示场景：

#### 演示场景 1：跨午夜晚托路线
- **学生**：S011 (黄丽)、S012 (林强)
- **路线**：R004 (4号线，晚托专用)
- **说明**：
  - 5月2日 19:00 上车（晚托开始）
  - 5月3日 00:15 下车（跨午夜）
- **检测结果**：系统会识别为 5月2日 的行程，并标记为 "跨午夜晚托" 异常

#### 演示场景 2：重复刷卡错误
- **学生**：S001 (张明)
- **日期**：2026-05-04
- **说明**：
  - 07:30:15 第一次刷卡上车
  - 07:30:18 3秒后重复刷卡上车
- **检测结果**：系统会检测到 "重复刷卡" 异常

#### 演示场景 3：错线路
- **学生**：S002 (李红)
- **日期**：2026-05-04
- **说明**：
  - 应乘坐 R001 线路
  - 实际同时在 V001/R001 和 V002/R002 刷卡
- **检测结果**：系统会检测到 "错线路" 异常

#### 演示场景 4：未下车
- **学生**：S007 (孙丽)、S010 (郑浩)
- **说明**：
  - S007: 5月3日下午上车后未下车
  - S010: 5月3日下午上车后未下车
- **检测结果**：系统会检测到 "未下车" 异常

#### 演示场景 5：请假仍上车
- **学生**：S010 (郑浩)
- **日期**：2026-05-03
- **说明**：
  - 老师备注记录 S010 今日请假
  - 但该学生实际刷卡上车
- **检测结果**：系统会检测到 "请假仍上车" 异常

### 2. 数据处理

加载数据后，系统会自动提示处理行程。也可以在 "仪表盘" 标签页点击 **"重新处理行程"** 按钮。

### 3. 查看异常

进入 "异常记录" 标签页，可以：
- 按日期、车辆、状态筛选
- 点击 "查看" 查看详情
- 点击 "处理" 标记为已处理

### 4. 查看行程状态

进入 "行程状态" 标签页，可以查看所有学生的上下车状态。

### 5. 导出数据

进入 "数据导出" 标签页，可以导出：
- **issues.csv**：所有异常记录
- **handover_report.md**：Markdown 格式的交接报告

## 数据格式说明

### 学生台账 (students.csv)

| 字段 | 说明 |
|------|------|
| student_id | 学生ID |
| name | 姓名 |
| grade | 年级 |
| class_name | 班级 |
| parent_name | 家长姓名 |
| parent_phone | 家长电话 |
| route_id | 分配线路ID |
| pickup_stop | 接站点 |
| dropoff_stop | 送站点 |

### 刷卡记录 (swipe_records.jsonl)

每行一个 JSON 对象：

| 字段 | 说明 |
|------|------|
| swipe_id | 刷卡记录ID |
| student_id | 学生ID |
| timestamp | 时间 (YYYY-MM-DD HH:MM:SS) |
| direction | 方向 (ON=上车, OFF=下车) |
| vehicle_id | 车辆ID |
| route_id | 线路ID |
| stop_name | 站点名称 |

### 车辆路线 (routes.yaml)

```yaml
routes:
  - route_id: R001
    route_name: 1号线
    vehicle_id: V001
    teacher_name: 王老师
    teacher_phone: 13900139001
    is_night_route: false  # 是否晚托路线（跨午夜）
    stops:
      - stop_name: 阳光花园东门
        stop_order: 1
```

### 老师备注 (teacher_notes.csv)

| 字段 | 说明 |
|------|------|
| note_id | 备注ID |
| student_id | 学生ID |
| date | 日期 (YYYY-MM-DD) |
| note_type | 类型 (请假/备注) |
| description | 描述 |

## 异常类型说明

| 类型 | 触发条件 |
|------|----------|
| 重复刷卡 | 同一学生短时间内多次同向刷卡 |
| 错线路 | 学生实际乘坐线路与分配线路不符 |
| 未下车 | 学生上车后未检测到下车记录 |
| 请假仍上车 | 请假学生当天有上车记录 |
| 跨午夜晚托 | 晚托路线学生凌晨刷卡（自动归属前一天） |

## 数据持久化

所有数据存储在 SQLite 数据库 `school_bus.db` 中，包括：
- 学生信息
- 刷卡记录
- 路线信息
- 异常记录及处理状态
- 行程状态

## 注意事项

1. 第一次运行会自动创建数据库
2. 示例数据仅供演示，实际使用请导入真实数据
3. 晚托路线的 `is_night_route` 必须设为 `true` 才能正确处理跨午夜情况

## 技术栈

- **后端**：Python 3 + Flask
- **前端**：原生 HTML + CSS + JavaScript
- **数据库**：SQLite
- **数据格式**：CSV, JSONL, YAML

## 许可证

仅供内部使用。
