# 社区食堂配餐管理系统

专为社区食堂设计的配餐管理系统，支持老人信息管理、忌口/慢病标签、配餐复核、配送路线和导出报告等功能。

## 功能特点

- 👴 **老人信息管理**：完整记录老人基本信息、忌口、慢性病、过敏史
- 🍽️ **配餐智能校验**：自动检查菜单与老人饮食禁忌的冲突
- 🔄 **配餐流程**：待复核 → 已确认 → 已配送，完整的状态流转
- 🚚 **配送路线管理**：按路线分组，支持批量配餐
- 📊 **数据导出**：Excel/CSV格式导出配餐清单、特殊饮食报告
- 🔒 **敏感字段保护**：身份证、手机号、地址自动脱敏
- 📝 **审计日志**：所有操作记录可追溯
- 💾 **本地持久化**：SQLite数据库，重启数据不丢失

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成样例数据

```bash
python init_data.py
```

会在 `data/` 目录下生成3个样例Excel文件：
- `sample_routes.xlsx` - 配送路线数据
- `sample_elders.xlsx` - 老人信息数据（包含多种慢病和忌口情况）
- `sample_menus.xlsx` - 菜单数据

### 3. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 4. 访问API文档

打开浏览器访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 完整操作流程

### 第一步：导入基础数据

#### 1.1 导入配送路线

在 Swagger UI 中找到 `POST /api/v1/import/routes` 接口
- 点击 "Try it out"
- 选择文件 `data/sample_routes.xlsx`
- 点击 "Execute"

预期结果：
```json
{
  "success": 3,
  "failed": 0,
  "errors": [],
  "warnings": []
}
```

#### 1.2 导入老人信息

使用 `POST /api/v1/import/elders` 接口
- 选择文件 `data/sample_elders.xlsx`

预期结果：
```json
{
  "success": 5,
  "failed": 0,
  "errors": [],
  "warnings": []
}
```

可以通过 `GET /api/v1/elders` 查看导入的老人信息，注意**敏感字段已自动脱敏**：
- 身份证号显示为：`110**********1234`
- 手机号显示为：`138****8001`

#### 1.3 导入菜单

使用 `POST /api/v1/import/menus` 接口
- 选择文件 `data/sample_menus.xlsx`

### 第二步：批量生成配餐记录

使用 `POST /api/v1/meals/batch` 接口

参数：
- `menu_id`: 菜单ID（先通过GET /api/v1/menus获取菜单列表）
- `route_id`: 可选，按路线批量配餐

系统会自动：
1. 为每个活跃老人创建配餐记录
2. 检查菜单与老人忌口的冲突
3. 在 `warnings` 字段中返回冲突警告

### 第三步：配餐复核

使用 `POST /api/v1/meals/{meal_id}/review` 接口

参数：
```json
{
  "status": "confirmed",
  "review_notes": "已核对无误",
  "reviewed_by": "张管理员"
}
```

状态选项：
- `pending` - 待复核（初始状态）
- `confirmed` - 已确认
- `cancelled` - 已取消

### 第四步：配送确认

使用 `POST /api/v1/meals/{meal_id}/deliver` 接口

参数：
```json
{
  "status": "delivered",
  "delivery_notes": "已送达，老人签收",
  "delivered_by": "李配送员"
}
```

### 第五步：导出报告

#### 5.1 导出每日配餐清单

使用 `GET /api/v1/export/meals` 接口

参数：
- `report_date`: 日期，如 `2024-01-15`
- `route_id`: 可选，按路线筛选
- `format`: 导出格式 `xlsx` 或 `csv`

导出的Excel文件中**敏感字段已自动脱敏**。

#### 5.2 导出特殊饮食报告

使用 `GET /api/v1/export/dietary` 接口

导出所有有特殊饮食要求的老人列表，方便厨师准备特殊餐食。

#### 5.3 导出配送路线清单

使用 `GET /api/v1/export/routes` 接口

按路线分组导出配送清单。

## 主要API接口

### 老人管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/elders` | 获取老人列表 |
| GET | `/api/v1/elders/{id}` | 获取老人详情 |
| POST | `/api/v1/elders` | 创建老人 |
| PUT | `/api/v1/elders/{id}` | 更新老人 |
| DELETE | `/api/v1/elders/{id}` | 禁用老人 |

### 配送路线

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/routes` | 获取路线列表 |
| POST | `/api/v1/routes` | 创建路线 |

### 菜单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/menus` | 获取菜单列表 |
| POST | `/api/v1/menus` | 创建菜单 |

### 配餐管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/meals` | 获取配餐列表 |
| POST | `/api/v1/meals` | 创建单条配餐 |
| POST | `/api/v1/meals/batch` | 批量创建配餐 |
| POST | `/api/v1/meals/{id}/review` | 复核配餐 |
| POST | `/api/v1/meals/{id}/deliver` | 配送确认 |
| POST | `/api/v1/meals/{id}/cancel` | 取消配餐 |

### 数据导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/import/routes` | 导入路线 |
| POST | `/api/v1/import/elders` | 导入老人 |
| POST | `/api/v1/import/menus` | 导入菜单 |
| GET | `/api/v1/export/meals` | 导出配餐清单 |
| GET | `/api/v1/export/dietary` | 导出特殊饮食报告 |
| GET | `/api/v1/export/routes` | 导出配送路线清单 |

### 统计与审计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/statistics/daily` | 每日配餐统计 |
| GET | `/api/v1/audit-logs` | 查看审计日志 |

## 数据模型

### 老人 (Elder)
- 基本信息：姓名、身份证号、电话、地址、房间号
- 健康信息：出生日期、性别
- 饮食信息：忌口、慢性病、过敏史、备注
- 配送信息：所属路线
- 状态：活跃/非活跃/禁用

### 配餐 (MealDistribution)
- 关联老人和菜单
- 特殊要求、实际菜品
- 状态流转：待复核 → 已确认 → 已配送/已取消
- 复核信息：复核人、复核时间、复核备注
- 配送信息：配送人、配送时间、配送备注

### 菜单 (Menu)
- 日期、用餐类型（早餐/午餐/晚餐）
- 菜品：主菜、副菜1、副菜2、汤品、主食
- 所属路线
- 特殊说明

## 敏感字段处理

系统在以下层面自动处理敏感数据：

1. **API返回层**：通过 `ElderSafe` 模型，身份证号和手机号自动脱敏
2. **导出文件层**：Excel/CSV导出时，敏感字段已脱敏
3. **日志层**：日志输出时自动脱敏身份证、手机号
4. **审计层**：审计日志中记录脱敏前的原始值（用于问题追溯）

脱敏规则：
- 身份证：`110101********1234`
- 手机号：`138****8001`
- 地址：`北京市朝****楼1单元`

## 目录结构

```
.
├── main.py              # 应用入口
├── requirements.txt     # 依赖列表
├── init_data.py         # 样例数据生成脚本
├── README.md           # 说明文档
├── app/
│   ├── api/
│   │   └── routes.py   # API路由
│   ├── models/
│   │   └── models.py   # 数据模型
│   ├── schemas/
│   │   └── schemas.py  # Pydantic模式
│   ├── services/       # 业务逻辑
│   │   ├── elder_service.py
│   │   ├── meal_service.py
│   │   ├── menu_service.py
│   │   ├── route_service.py
│   │   ├── import_service.py
│   │   ├── export_service.py
│   │   └── audit_service.py
│   ├── core/           # 核心配置
│   │   ├── config.py
│   │   └── database.py
│   └── utils/          # 工具函数
│       └── logging.py
├── data/               # 数据目录
│   ├── canteen.db     # SQLite数据库
│   └── *.xlsx         # 样例数据
├── exports/            # 导出文件目录
└── logs/               # 日志目录
```

## 测试异常场景

系统已内置以下异常处理：

1. **身份证号重复**：导入时检测重复身份证号，返回警告
2. **无效手机号格式**：数据校验不通过
3. **菜单与忌口冲突**：配餐时自动检测并警告
4. **状态流转错误**：如已配送的配餐不能再复核
5. **非活跃老人无法配餐**：业务规则校验

可以通过修改样例数据中的身份证号为重复值来测试异常导入场景。

## 数据持久化

数据库文件位于 `data/canteen.db`，重启服务数据不会丢失。

如需重置数据：
```bash
rm data/canteen.db
python main.py  # 会自动创建新的空数据库
```
