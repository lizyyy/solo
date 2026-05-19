# 社区食堂配餐管理系统

一个完整的社区食堂配餐管理后端系统，支持老人信息管理、菜单管理、配餐冲突检查、配送管理、回访管理等功能。

## 功能特性

### 1. 老人信息管理
- 老人基本信息（姓名、性别、年龄、电话、身份证、地址等）
- 饮食禁忌和慢病标签
- 配送路线和顺序
- 敏感字段自动脱敏（手机号、身份证等）

### 2. 菜单管理
- 按日期创建早中晚餐菜单
- 过敏原标注
- 重复日期自动检测

### 3. 配餐管理
- 单人配餐和批量配餐
- 自动冲突检测（根据饮食禁忌和慢病标签）
- 改餐功能（记录原因和操作人）
- 配餐确认
- 幂等性保证（重复提交不重复创建）

### 4. 配送管理
- 配送单创建
- 按路线和顺序排序
- 配送状态跟踪（待配送、已送达、配送失败）
- 配送签收记录

### 5. 回访管理
- 满意度调查（非常好、好、一般、差、非常差）
- 投诉和建议记录
- 饮食反馈
- 后续处理记录

### 6. 报告和导出
- 日报统计
- 配送路线单
- 冲突报告
- JSON格式导出

### 7. 历史记录
- 所有操作记录
- 变更前后对比
- 操作人追踪

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **日志**: Loguru
- **数据校验**: Pydantic

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库（可选，会创建示例数据）

```bash
python init_db.py
```

### 3. 启动服务

```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或者直接运行：

```bash
python app/main.py
```

### 4. 访问API文档

启动后访问: http://localhost:8000/docs

可以在Swagger UI中直接测试所有API接口。

## API接口说明

### 老人管理
- `POST /api/v1/elderly` - 创建老人信息
- `PUT /api/v1/elderly/{id}` - 更新老人信息
- `GET /api/v1/elderly/{id}` - 获取单个老人信息
- `GET /api/v1/elderly` - 获取老人列表

### 菜单管理
- `POST /api/v1/menus` - 创建菜单
- `GET /api/v1/menus/{date}` - 获取指定日期菜单

### 配餐管理
- `POST /api/v1/meals/allocate` - 单人配餐
- `POST /api/v1/meals/allocate/batch` - 批量配餐
- `PUT /api/v1/meals/{id}/modify` - 改餐
- `PUT /api/v1/meals/{id}/confirm` - 确认配餐
- `GET /api/v1/meals/conflicts/{date}` - 获取当日冲突

### 配送管理
- `POST /api/v1/deliveries/create` - 创建配送单
- `GET /api/v1/deliveries/batch/{batch_id}` - 获取批次配送单
- `PUT /api/v1/deliveries/{id}/deliver` - 标记已送达
- `PUT /api/v1/deliveries/{id}/fail` - 标记配送失败

### 回访管理
- `POST /api/v1/followups` - 创建回访记录
- `GET /api/v1/followups/{date}` - 获取指定日期回访
- `PUT /api/v1/followups/{id}/action` - 更新处理措施

### 报告管理
- `GET /api/v1/reports/daily/{date}` - 获取日报
- `GET /api/v1/reports/delivery-route/{date}` - 获取配送路线单
- `GET /api/v1/reports/conflicts/{date}` - 获取冲突报告
- `GET /api/v1/reports/export/{type}/{date}` - 导出报告

### 操作历史
- `GET /api/v1/history` - 获取操作历史记录

## 使用示例

### 完整工作流示例

```bash
# 1. 创建老人信息
curl -X POST "http://localhost:8000/api/v1/elderly?name=张爷爷&age=78&dietary_restrictions=低盐&chronic_diseases=高血压&delivery_route=A区"

# 2. 创建菜单（明天的菜单）
curl -X POST "http://localhost:8000/api/v1/menus?menu_date=2025-01-16&breakfast=小米粥&breakfast=馒头&lunch=米饭&lunch=红烧肉&lunch=炒青菜"

# 3. 批量配餐
curl -X POST "http://localhost:8000/api/v1/meals/allocate/batch?menu_date=2025-01-16&meal_type=lunch"

# 4. 查看冲突
curl "http://localhost:8000/api/v1/meals/conflicts/2025-01-16"

# 5. 创建配送单
curl -X POST "http://localhost:8000/api/v1/deliveries/create?delivery_date=2025-01-16&meal_type=lunch"

# 6. 标记配送完成
curl -X PUT "http://localhost:8000/api/v1/deliveries/1/deliver?delivered_by=配送员小王"

# 7. 创建回访记录
curl -X POST "http://localhost:8000/api/v1/followups?elderly_id=1&follow_up_date=2025-01-16&overall_satisfaction=good"

# 8. 查看日报
curl "http://localhost:8000/api/v1/reports/daily/2025-01-16"
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── models/              # 数据模型
│   │   ├── __init__.py
│   │   ├── elderly.py       # 老人模型
│   │   ├── menu.py          # 菜单模型
│   │   ├── meal.py          # 配餐模型
│   │   ├── delivery.py      # 配送模型
│   │   ├── followup.py      # 回访模型
│   │   └── history.py       # 操作历史模型
│   ├── services/            # 业务逻辑层
│   │   ├── __init__.py
│   │   ├── elderly.py       # 老人服务
│   │   ├── menu.py          # 菜单服务
│   │   ├── meal.py          # 配餐服务
│   │   ├── delivery.py      # 配送服务
│   │   ├── followup.py      # 回访服务
│   │   ├── report.py        # 报告服务
│   │   └── history.py       # 历史记录服务
│   ├── core/                # 核心配置
│   │   ├── __init__.py
│   │   ├── config.py        # 配置管理
│   │   ├── database.py      # 数据库连接
│   │   └── logging.py       # 日志配置
│   └── utils/               # 工具函数
│       ├── __init__.py
│       ├── mask.py          # 敏感字段脱敏
│       └── validators.py    # 数据校验
├── requirements.txt
├── init_db.py               # 数据库初始化脚本
└── README.md
```

## 数据持久化

系统使用SQLite数据库，数据文件为 `canteen.db`，位于项目根目录。重启服务后数据不会丢失。

## 敏感字段处理

以下字段会自动脱敏处理（在API返回、导出文件和日志中）：
- 手机号（如：138****8001）
- 身份证号（如：11010*********1234）
- 地址
- 紧急联系人信息

## 冲突检测规则

系统会自动检测以下冲突：

1. **饮食禁忌冲突**：菜品名称中包含老人的饮食禁忌关键词（如：低盐、低糖、海鲜禁忌等）
2. **慢病建议**：根据慢病标签给出特殊餐食建议（如：糖尿病建议低糖餐，高血压建议低盐餐）

支持的饮食禁忌类型：低盐、低脂、低糖、无糖、素食、辛辣禁忌、海鲜禁忌、坚果禁忌、牛奶禁忌、鸡蛋禁忌、糖尿病餐、高血压餐、胃病餐、软食、半流质、流质

支持的慢病类型：糖尿病、高血压、心脏病、冠心病、痛风、肾病、肝病、胃病、高血脂、高尿酸、骨质疏松、关节炎、中风、阿尔茨海默

## 幂等性保证

- 配餐：根据老人ID、日期、餐别生成唯一ID，重复提交直接返回已有记录
- 菜单：同一日期只能有一个菜单
- 配送单：同一日期同一餐别只能创建一次
- 回访：同一配送单只能有一条回访记录

## 日志

系统日志位于 `logs/` 目录下，包含：
- 所有操作日志
- 错误日志
- 数据库操作日志

## 注意事项

1. 本系统使用SQLite数据库，适合中小规模社区使用
2. 敏感字段脱敏在服务端处理，前端无需额外处理
3. 所有修改操作都会记录操作历史，可追溯
4. 建议定期备份数据库文件 `canteen.db`
