# 隐患闭环管理系统

一个完整的隐患管理系统，支持隐患登记、派发、整改、复查、归档全流程管理，具备幂等性、敏感字段脱敏、操作审计和数据导出功能。

## 功能特性

### 核心业务流程
- ✅ **隐患登记**: 安全员登记隐患，填写标题、描述、位置、等级等信息
- ✅ **隐患派发**: 安全员将隐患派发给指定整改人，设置截止时间
- ✅ **隐患整改**: 整改人提交整改说明和照片
- ✅ **隐患复查**: 安全员复查整改结果，通过或驳回
- ✅ **隐患归档**: 复查通过的隐患可归档，完成闭环

### 安全特性
- ✅ **幂等性保障**: 重复提交相同操作不会产生重复数据
- ✅ **敏感字段脱敏**: 手机号、用户ID等敏感信息自动脱敏
- ✅ **操作审计日志**: 所有操作都记录日志，可追溯
- ✅ **权限控制**: 不同角色只能执行对应权限的操作

### 数据管理
- ✅ **数据持久化**: 使用SQLite数据库，重启后数据不丢失
- ✅ **数据导出**: 支持导出Excel和JSON格式
- ✅ **统计分析**: 统计隐患总数、闭环率、状态分布等

## 项目结构

```
.
├── requirements.txt     # 依赖包列表
├── database.py          # 数据库模型和连接配置
├── services.py          # 核心业务逻辑服务
├── utils.py             # 工具函数（脱敏、日志等）
├── exporter.py          # 数据导出模块
├── api.py               # FastAPI REST接口
├── cli.py               # 命令行工具
└── test_system.py       # 系统测试用例
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行演示

```bash
python cli.py demo
```

该命令将执行完整的隐患生命周期演示，包括：
- 登记隐患
- 派发隐患
- 整改隐患
- 复查隐患
- 归档隐患
- 导出Excel报告

### 3. 运行API服务

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

API文档地址: http://localhost:8000/docs

### 4. 运行测试

```bash
python test_system.py
```

## 使用指南

### 命令行工具

```bash
# 查看帮助
python cli.py --help

# 登记隐患
python cli.py register --hazard-no H001 --title "消防通道堵塞" --description "..." --location "A栋1楼"

# 派发隐患
python cli.py assign --hazard-no H001 --rectifier-id R001

# 整改隐患
python cli.py rectify --hazard-no H001 --description "已完成整改"

# 复查隐患
python cli.py recheck --hazard-no H001 --passed --opinion "符合要求"

# 归档隐患
python cli.py archive --hazard-no H001

# 查看隐患详情
python cli.py get --hazard-no H001

# 列出所有隐患
python cli.py list

# 查看统计数据
python cli.py statistics

# 查看操作日志
python cli.py logs

# 导出Excel
python cli.py export-excel --output report.xlsx

# 导出JSON
python cli.py export-json --output report.json
```

### API接口示例

```bash
# 登记隐患
curl -X POST "http://localhost:8000/hazards/register?hazard_no=H001&title=测试&description=...&location=...&level=一般&operator_id=SA001"

# 获取隐患详情
curl "http://localhost:8000/hazards/H001"

# 获取统计数据
curl "http://localhost:8000/statistics"

# 导出Excel
curl "http://localhost:8000/export/excel" -o report.xlsx
```

## 内置用户

系统初始化时会创建以下测试用户：

| 用户ID | 用户名 | 角色 | 说明 |
|--------|--------|------|------|
| SA001 | 张安全 | 安全员 | 可登记、派发、复查、归档 |
| R001 | 李整改 | 整改人 | 可执行整改操作 |
| RV001 | 王复查 | 复查员 | 可执行复查操作 |
| ADMIN001 | 管理员 | 管理员 | 拥有所有权限 |

## 隐患状态流转

```
已登记(registered)
    ↓
已派发(assigned)
    ↓
已整改(rectified)
    ↓
已复查(rechecked)
    ↓
已归档(archived)

* 复查不通过时返回已派发状态，重新整改
```

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite
- **数据导出**: openpyxl
- **日志**: Python logging

## 测试覆盖

- 敏感字段脱敏测试
- 幂等性测试
- 完整生命周期测试
- 数据导出测试
- 错误处理测试
- 数据持久化测试
