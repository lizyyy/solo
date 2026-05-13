# 任务输出归档 API

一个用于管理任务输出文件归档的后端服务，提供完整的任务生命周期管理和问题排查能力。

## 核心特性

### 🔄 **完整生命周期**
- 创建任务 - 初始化归档任务，设置策略和权限
- 登记输出 - 登记任务输出文件，支持幂等操作
- 归档任务 - 将输出文件迁移到归档位置
- 撤销任务 - 终止不需要的任务
- 过期清理 - 自动或手动清理过期归档

### 📊 **问题排查专用**
- **时间线追踪**: 每个关键动作都留下完整的时间线记录
  - 动作类型、状态变更前后、操作人、时间戳
  - 详细描述和附加信息
- **导出汇总报告**: 导出 Excel 格式的完整归档报告
  - 任务概览、时间线记录、归档记录、清理记录、统计汇总

### ✅ **防脏数据设计**
- 重复提交相同文件（通过文件哈希判断）
- 状态机校验，不允许非法状态转换
- 任务编号唯一约束

### 🔐 **权限控制**
- 三级访问权限：read/write/admin
- 基于操作人校验

## 技术栈

- **框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展）
- **导出**: pandas + openpyxl

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行演示脚本

```bash
python test_demo.py
```

## API 接口

### 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/tasks | 创建任务 |
| GET | /api/v1/tasks | 查询任务列表 |
| GET | /api/v1/tasks/{task_number} | 获取任务详情（含时间线）|
| POST | /api/v1/tasks/{task_number}/register | 登记输出文件 |
| POST | /api/v1/tasks/{task_number}/archive | 归档任务 |
| POST | /api/v1/tasks/{task_number}/revoke | 撤销任务 |
| POST | /api/v1/tasks/{task_number}/expire | 标记过期 |
| POST | /api/v1/tasks/{task_number}/cleanup | 清理文件 |
| POST | /api/v1/tasks/cleanup/batch | 批量清理过期 |

### 问题排查专用

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/tasks/{task_number}/timelines | 获取任务时间线 |
| POST | /api/v1/export | 导出归档汇总报告（Excel） |

## 任务状态流转

```
CREATED (创建
    |
    v
REGISTERED (登记输出)
    |
    v
ARCHIVED (已归档)
    |
    v
EXPIRED (已过期)
    |
    v
CLEANED (已清理)

可在任意状态撤销 -> REVOKED
```

## 归档策略

- `immediate` - 立即归档
- `delayed` - 延迟归档（默认）
- `manual` - 手动归档

## 时间线示例

每个操作都会记录时间线，用于追溯：

| 动作 | 说明 |
|------|------|
| CREATE | 创建任务 |
| REGISTER | 登记输出 |
| ARCHIVE | 归档任务 |
| REVOKE | 撤销任务 |
| EXPIRE | 标记过期 |
| CLEANUP | 清理文件 |

每条记录包含：
- 动作类型
- 状态变更前/后
- 操作人
- 时间戳
- 详细描述和附加信息

## 导出报告包含：

Excel 报告包含 5 个 Sheet：
1. **任务概览** - 所有任务的基本信息
2. **时间线记录** - 完整的操作历史
3. **归档记录** - 归档操作详情
4. **清理记录** - 清理操作详情
5. **统计汇总** - 各状态任务数量统计

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py      # 配置管理
│   ├── database.py    # 数据库连接
│   ├── models.py      # 数据模型
│   ├── schemas.py     # Pydantic 模型
│   ├── crud.py       # 业务逻辑
│   ├── exporter.py    # 导出服务
│   └── api.py          # API 路由
├── main.py             # 应用入口
├── requirements.txt    # 依赖列表
└── test_demo.py       # 演示脚本
```
