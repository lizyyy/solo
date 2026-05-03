# 航空配餐调度复核工具

一个本地全栈 Web 小工具，用于航空配餐调度员在航班推出前复核餐食装载舱单。

## 功能特性

### 核心功能
- **多格式数据导入**：支持航班餐食订单 CSV、座位/特殊餐规则 YAML、厨房出库扫码 JSONL、机上装载确认 JSON
- **SQLite 数据持久化**：所有数据存储在本地 SQLite 数据库中
- **批次时间线展示**：直观展示厨房出库、机上装载、机型变更等时间线
- **舱位容量检查**：各舱位配餐数量与容量对比
- **特殊餐匹配验证**：特殊餐座位规则匹配检查
- **保温窗口风险预警**：热餐/冷餐保温时间监控与风险提醒

### 交互功能
- **异常人工备注**：支持为各类异常添加人工备注
- **问题导出**：导出问题列表为 issues.csv
- **舱单报告导出**：生成并导出 manifest_report.md

### 边界情况处理
- **临时换机检测**：检测机型变更导致的舱位容量变化
- **重复扫码识别**：自动识别并标记重复的厨房出库扫码记录

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装步骤

1. 安装依赖：
```bash
cd /Users/lzy/pro/solocoder/pro/zy8175/repo/zy8175
pip install -r requirements.txt
```

2. 启动服务：
```bash
python run.py
```

3. 打开浏览器访问：
```
http://localhost:5000
```

### 使用示例

#### 方式一：使用样本数据

1. 启动服务后，点击右上角 **"导入样本数据"** 按钮
2. 系统将自动导入预设的航班数据
3. 从左侧航班列表选择航班（如 MU5101 或 MU5102）
4. 查看各标签页的数据

#### 方式二：手动导入数据

1. 点击右上角 **"导入数据"** 按钮
2. 选择相应格式的数据文件
3. 支持的文件类型：
   - `.csv` - 航班餐食订单
   - `.yaml` / `.yml` - 座位/特殊餐规则
   - `.jsonl` - 厨房出库扫码记录
   - `.json` - 机上装载确认

## 数据格式说明

### 航班餐食订单 (CSV)

| 字段 | 说明 | 示例 |
|------|------|------|
| flight_number | 航班号 | MU5101 |
| aircraft_registration | 飞机注册号 | B-1234 |
| aircraft_type | 机型 | B737-800 |
| departure_airport | 出发机场 | PEK |
| arrival_airport | 到达机场 | SHA |
| scheduled_departure_time | 计划起飞时间 | 2026-05-03T08:00:00+08:00 |
| order_id | 订单ID | ORD-MU5101-001 |
| cabin_class | 舱位等级 | Business / Economy |
| seat_number | 座位号 | 01A |
| meal_type | 餐食类型 | Beef Steak |
| meal_category | 餐食类别 | regular / special |
| special_meal_code | 特殊餐代码 | VML, DBML, CHML |
| special_meal_description | 特殊餐描述 | Vegetarian Oriental Meal |
| is_special | 是否特殊餐 | 0 / 1 |
| quantity | 数量 | 1 |
| temperature_type | 温度类型 | hot / cold / ambient |

### 座位/特殊餐规则 (YAML)

```yaml
seat_rules:
  - rule_name: "B737-800 商务舱座位规则"
    aircraft_type: "B737-800"
    cabin_class: "Business"
    seat_range_start: "01A"
    seat_range_end: "06F"
    special_meal_allowed: "VML,VGML,DBML,CHML,SPML"
    priority_meal: true
    meal_type_restriction: "hot,ambient"
    description: "商务舱座位1A-6F"
```

### 厨房出库扫码 (JSONL)

每行一个 JSON 对象：

```json
{
  "scan_id": "SCAN-20260503-0001",
  "flight_number": "MU5101",
  "meal_id": "MEAL-BEEF-001",
  "meal_type": "Beef Steak",
  "temperature_type": "hot",
  "quantity": 1,
  "scan_time": "2026-05-03T06:30:00+08:00",
  "operator_id": "OP-001",
  "galley_id": "G1",
  "container_id": "CNT-HOT-001"
}
```

### 机上装载确认 (JSON)

```json
{
  "loading_confirms": [
    {
      "confirm_id": "LOAD-20260503-0001",
      "flight_number": "MU5101",
      "meal_id": "MEAL-BEEF-001",
      "meal_type": "Beef Steak",
      "temperature_type": "hot",
      "quantity": 1,
      "loading_time": "2026-05-03T07:00:00+08:00",
      "loader_id": "LD-001",
      "aircraft_position": "B12",
      "container_id": "CNT-HOT-001",
      "galley_compartment": "Front Galley - Hot Storage 1"
    }
  ]
}
```

## 特殊餐代码说明

| 代码 | 英文描述 | 中文描述 |
|------|----------|----------|
| VML | Vegetarian Oriental Meal | 东方素食餐 |
| VGML | Vegetarian Meal | 素食餐 |
| VJML | Vegetarian Jain Meal | 耆那素食餐 |
| DBML | Diabetic Meal | 糖尿病餐 |
| CHML | Child Meal | 儿童餐 |
| SPML | Seafood Meal | 海鲜餐 |
| KSML | Kosher Meal | 犹太餐 |

## 保温窗口配置

配置文件位于 `backend/config.py`：

- **热餐保温窗口**：20-90 分钟
  - < 20 分钟：正常
  - 20-90 分钟：即将超时（风险预警）
  - > 90 分钟：已超时（严重警告）

- **冷餐冷藏窗口**：20-240 分钟
  - < 20 分钟：正常
  - 20-240 分钟：即将超时（风险预警）
  - > 240 分钟：已超时（严重警告）

## 边界情况处理

### 1. 临时换机导致舱位容量变化

**检测逻辑**：
- 系统会记录同一航班的多个舱位配置
- 当检测到不同机型的配置时，标记为机型变更
- 比较原配置与新配置的座位数和配餐容量
- 如果已订餐食数量超过新机型容量，标记为容量问题

**操作流程**：
1. 在"舱位容量"标签页查看配置变更
2. 系统会高亮显示原配置与当前配置的差异
3. 可手动添加新机型配置（点击"+ 添加舱位"）
4. 保存后系统自动重新计算容量匹配

**样本数据中的示例**：
- 可在样本数据中模拟添加不同机型配置来测试此功能

### 2. 重复扫码

**检测逻辑**：
- 导入厨房出库扫码数据时，系统自动检测重复记录
- 重复判定条件：相同 meal_id + quantity + scan_time
- 重复记录标记 `is_duplicate = 1`，并记录原始扫码ID

**处理方式**：
- 重复记录在匹配时被自动忽略
- 在数据导入结果中显示重复数量
- 时间线中不显示重复扫码事件

**样本数据中的示例**：
- `kitchen_scans.jsonl` 第14行记录：
  ```json
  {"scan_id": "SCAN-20260503-0014", "flight_number": "MU5101", "meal_id": "MEAL-CHKN-002", ... "scan_time": "2026-05-03T06:45:00+08:00"}
  ```
  与第6行记录的 meal_id 和 scan_time 完全相同，会被标记为重复

## 目录结构

```
zy8175/
├── backend/                    # 后端代码
│   ├── __init__.py
│   ├── app.py                 # Flask 应用入口
│   ├── config.py              # 配置文件
│   ├── database.py            # 数据库操作
│   ├── exporter.py            # 导出模块
│   ├── importer.py            # 数据导入模块
│   └── services.py            # 业务逻辑服务
├── samples/                    # 样本数据
│   ├── flight_orders.csv      # 航班订单
│   ├── seat_rules.yaml        # 座位规则
│   ├── kitchen_scans.jsonl    # 厨房扫码
│   └── loading_confirms.json  # 装载确认
├── static/                     # 静态资源
│   ├── css/
│   │   └── style.css          # 样式文件
│   └── js/
│       └── app.js             # 前端应用
├── templates/                  # 模板文件
│   └── index.html             # 主页面
├── data/                       # 数据目录（运行时创建）
│   └── catering.db            # SQLite 数据库
├── requirements.txt           # Python 依赖
└── run.py                     # 启动入口
```

## API 接口

### 航班管理
- `GET /api/flights` - 获取航班列表
- `GET /api/flights/<flight_number>` - 获取航班详情
- `POST /api/flights/<flight_number>/match` - 执行餐食匹配
- `GET /api/flights/<flight_number>/check-aircraft` - 检查机型变更
- `GET /api/flights/<flight_number>/special-meals` - 获取特殊餐信息

### 数据导入
- `POST /api/import` - 导入数据文件
- `POST /api/import/samples` - 导入样本数据

### 问题管理
- `POST /api/issues` - 创建问题
- `POST /api/issues/<id>/resolve` - 解决问题
- `POST /api/flights/<flight_number>/notes` - 添加备注

### 导出功能
- `GET /api/export/issues` - 导出问题 CSV
- `GET /api/export/manifest/<flight_number>` - 导出舱单报告

## 故障排除

### 端口被占用
如果端口 5000 被占用，修改 `run.py` 中的端口配置：
```python
app.run(debug=True, port=5001, host='0.0.0.0')
```

### 数据库问题
删除 `data/catering.db` 文件后重启服务，数据库会自动重建。

### 样本数据导入失败
检查 `samples/` 目录下文件是否存在且格式正确。

## 开发说明

### 修改配置
编辑 `backend/config.py` 调整保温窗口等参数。

### 添加新功能
- 后端业务逻辑：`backend/services.py`
- 前端交互：`static/js/app.js`
- 页面样式：`static/css/style.css`

## 许可证

本工具仅供教育和演示目的使用。
