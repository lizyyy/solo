# SQL慢查询归因板

一个面向内部团队的SQL慢查询分析与优化跟踪系统。

## 核心功能

### 后端 API
- **查询指纹管理** - SQL慢查询的录入、存储和检索
- **执行计划分析** - 自动解析SQL结构，识别表扫描、JOIN操作、排序等
- **索引建议生成** - 基于WHERE条件、JOIN、GROUP BY等自动推荐索引
- **校验拦截机制** - 自动检测无效SQL、危险操作（DROP/TRUNCATE）、过多影响接口
- **状态跟踪** - 待处理/处理中/已优化的完整生命周期管理
- **错误日志** - 完整记录系统异常和处理上下文

### 前端操作页
- **批量导入** - 支持JSON/CSV格式批量导入慢查询数据
- **权限提示** - 明确的负责人和操作权限提示
- **状态管理** - 更新查询状态、记录优化备注
- **报表导出** - 多维度Excel导出（按负责人、时间、索引建议分组）
- **过滤搜索** - 按状态、负责人、有效性筛选

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型和连接
├── schema.py            # Pydantic数据模型
├── analyzer.py          # SQL分析和索引建议引擎
├── requirements.txt     # Python依赖
├── package.json         # 项目配置
├── static/
│   └── index.html       # 前端操作页面
├── exports/             # 导出文件目录
└── slow_queries.db      # SQLite数据库（自动生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问系统

打开浏览器访问: http://localhost:8000

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 前端首页 |
| GET | /api/queries/ | 获取查询列表 |
| GET | /api/queries/{id} | 获取单条查询详情 |
| POST | /api/queries/ | 创建单条查询 |
| POST | /api/queries/batch | 批量导入查询 |
| PUT | /api/queries/{id}/status | 更新查询状态 |
| GET | /api/stats/ | 获取统计数据 |
| GET | /api/errors/ | 获取错误日志 |
| POST | /api/export/ | 导出Excel报表 |

## 失败路径测试

### 1. 无效SQL校验

- SQL过短: `SELECT 1` → 标记为无效，显示校验错误
- 语法错误: `this is not a valid sql query` → 标记为无效
- 危险操作: `DROP TABLE users` → 被系统拦截标记

### 2. 影响接口过多

- 单条记录影响超过10个接口 → 自动标记为无效
- 提示"影响接口过多，请确认是否准确"

### 3. 批量导入容错

- 样例数据包含6条记录，其中3条为脏数据
- 导入结果显示"成功3条，失败0条（但3条被标记为无效）"
- 失败记录不会中断整个导入流程

### 4. 数据持久化

- 重启服务后，所有历史记录、状态、优化备注都完整保留
- 错误日志可追溯历史异常
- SQLite数据库文件可直接备份迁移

## 导出报表说明

Excel文件包含4个Sheet：

1. **全部数据** - 完整的查询列表，含所有字段
2. **按负责人分组** - 统计每人的查询数量、平均执行时间、有效查询数
3. **按索引建议分组** - 相同索引建议的查询聚合统计
4. **按时间分组** - 每日查询趋势和总执行时间统计

## 样例数据说明

点击"加载样例数据（含脏数据）"按钮可导入测试数据：

| SQL指纹 | 类型 | 预期行为 |
|---------|------|---------|
| select_users_by_id | 正常SQL | 生成索引建议，状态正常 |
| join_orders_with_details | 正常SQL | 多表JOIN分析，生成联合索引建议 |
| like_search_username | 正常SQL | 前导通配符警告，无法使用索引 |
| invalid_sql_empty | 无效SQL | SQL过短被标记 |
| dangerous_drop_table | 危险操作 | DROP语句被拦截标记 |
| malformed_sql_syntax | 无效SQL | 语法错误+影响接口过多被标记 |

## 技术栈

- **后端**: FastAPI + SQLAlchemy + Pydantic
- **数据库**: SQLite（可轻松迁移到MySQL/PostgreSQL）
- **前端**: 原生HTML/JavaScript（无需构建工具）
- **导出**: Pandas + OpenPyXL

## 数据闭环流程

1. **录入** - 单条创建或批量导入慢查询
2. **分析** - 自动生成执行计划和索引建议
3. **校验** - 无效SQL和危险操作被拦截标记
4. **分配** - 指定负责人和优先级
5. **优化** - 更新状态、记录优化备注
6. **追溯** - 导出报表、分析优化效果
