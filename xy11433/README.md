# 学校实验室耗材验收回放链路服务

## 项目概述

本系统是学校实验室耗材验收全链路管理服务，支持多来源数据导入、重复识别、状态追踪、异常回放和审计导出等核心功能。

## 核心特性

### 1. 多源数据导入
- 支持 **领用单、采购到货表、老师补签记录、临时补录单、班次记录** 五种数据来源
- Excel批量导入，自动解析标准格式
- 保留 **来源文件、原始行号、原始值** 完整证据链
- 人工改判 **不覆盖原始数据**，保留改判历史

### 2. 智能去重
- 基于耗材名称、规格、批号、数量、来源的复合去重
- 标记重复记录并关联原始记录
- 重复数据保留独立记录不覆盖

### 3. 状态全链路追踪
- 每种状态变更记录 **时间、操作者、变更原因**
- 支持: 待验收 → 已验收 → 课题组借用/损耗 → 待审计 → 审计通过
- 异常状态自动标记

### 4. 异步任务处理
- **等重试**: 自动重试失败任务，可配置重试次数和间隔
- **等人工**: 需要人工介入的任务标记
- **永久失败**: 超过重试次数的任务标记
- **服务恢复**: 重启后自动恢复未完成任务

### 5. 异常回放与对账
- 自动对账检测: 缺少去向、借用损耗混合、缺处理原因
- 异常记录 **修正前后对比**
- 同一异常原因在列表、详情、报告中统一展示

### 6. 多维度导出
- 耗材记录清单（含原始来源信息）
- 单记录完整历史（状态变更+审计日志+导入证据）
- 异常处理报告（含修正前后对比）

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 启动服务

```bash
# 方式1: 使用启动脚本
chmod +x start.sh
./start.sh

# 方式2: 手动启动
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

服务启动后访问: http://localhost:8000/docs

### CLI命令行工具

```bash
# 生成测试数据（造数）
python scripts/cli.py mock --count 100 --operator 张三

# 对账检查
python scripts/cli.py reconcile --operator 李四

# 导入Excel
python scripts/cli.py import --file ./领用单.xlsx --source 领用单 --by 王五

# 导出记录
python scripts/cli.py export

# 变更状态
python scripts/cli.py status --id 1 --to 已验收 --reason "检查合格" --operator 赵六

# 查看记录详情
python scripts/cli.py show --id 1

# 解决异常
python scripts/cli.py resolve --id 1 --resolution "补全去向信息" --by 管理员

# 运行完整工作流演示
python scripts/cli.py workflow
```

## API接口文档

### 1. 耗材记录接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/records` | 获取记录列表（支持分页和筛选） |
| GET | `/api/v1/records/{id}` | 获取单条记录详情 |
| POST | `/api/v1/records` | 新增单条记录 |
| PUT | `/api/v1/records/{id}` | 更新记录 |
| POST | `/api/v1/records/{id}/change-status` | 变更状态 |
| GET | `/api/v1/records/{id}/history` | 获取完整历史 |
| GET | `/api/v1/records/{id}/status-history` | 获取状态历史 |
| GET | `/api/v1/records/{id}/import-evidence` | 获取导入证据 |

### 2. 数据导入接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/import/excel` | 导入Excel文件 |
| POST | `/api/v1/import/correct/{id}` | 人工改判记录 |

### 3. 回放链路接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/replay/mock-data` | 生成测试数据 |
| POST | `/api/v1/replay/reconcile` | 对账检查 |
| GET | `/api/v1/replay/exceptions` | 获取异常列表 |
| GET | `/api/v1/replay/exceptions/{id}` | 获取异常详情 |
| POST | `/api/v1/replay/exceptions/{id}/resolve` | 解决异常 |
| GET | `/api/v1/replay/exceptions/{id}/diff` | 查看修正前后对比 |

### 4. 异步任务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/tasks` | 创建任务 |
| GET | `/api/v1/tasks` | 获取任务列表 |
| GET | `/api/v1/tasks/{task_id}` | 获取任务状态 |
| POST | `/api/v1/tasks/{task_id}/execute` | 执行任务 |
| POST | `/api/v1/tasks/{task_id}/retry` | 重试任务 |
| POST | `/api/v1/tasks/{task_id}/manual` | 转人工处理 |
| POST | `/api/v1/tasks/process-pending` | 批量处理待办任务 |
| POST | `/api/v1/tasks/recover-on-startup` | 恢复服务任务 |

### 5. 数据导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/export/consumable-records` | 导出耗材记录 |
| POST | `/api/v1/export/record-history/{id}` | 导出单记录历史 |
| POST | `/api/v1/export/exceptions` | 导出异常报告 |
| GET | `/api/v1/export/download/{filename}` | 下载导出文件 |

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置文件
│   ├── database.py            # 数据库连接
│   ├── models.py              # 数据模型
│   ├── schemas.py             # Pydantic模式
│   ├── api/
│   │   ├── __init__.py
│   │   ├── records.py         # 记录接口
│   │   ├── imports.py         # 导入接口
│   │   ├── replay.py          # 回放接口
│   │   ├── tasks.py           # 任务接口
│   │   └── exports.py         # 导出接口
│   └── services/
│       ├── __init__.py
│       ├── import_service.py  # 导入服务
│       ├── replay_service.py  # 回放服务
│       ├── task_service.py    # 任务服务
│       └── export_service.py  # 导出服务
├── scripts/
│   ├── __init__.py
│   └── cli.py                 # 命令行工具
├── uploads/                   # 上传文件目录
├── exports/                   # 导出文件目录
├── logs/                      # 日志目录
├── main.py                    # 应用入口
├── requirements.txt           # 依赖列表
├── start.sh                   # 启动脚本
└── README.md                  # 项目说明
```

## 数据模型说明

### ConsumableRecord（耗材记录）
- 核心字段：记录编号、耗材名称、规格、数量、批号、来源
- 状态字段：当前状态、是否重复、重复关联
- 审计字段：原始文件名、原始行号、创建人

### StatusHistory（状态变更历史）
- 记录每次状态变更的：原状态、新状态、变更原因、操作者、时间

### ImportEvidence（导入证据）
- 保留原始值、解析后标准值
- 人工改判历史记录
- 改判不覆盖原始数据

### AsyncTask（异步任务）
- 状态流转：待处理 → 处理中 → 等重试/等人工/永久失败/已完成
- 支持重试计数和下次重试时间

### ReplayException（回放异常）
- 记录修正前后数据对比
- 关联处理方案和处理人

### AuditLog（审计日志）
- 记录所有操作的变更前后数据
- 支持差异对比

## 审计要点

1. **数据可追溯性**
   - 每条记录均可追溯到来源文件和行号
   - 所有状态变更均有操作者和原因

2. **数据一致性**
   - 列表、详情、历史、导出文件数字一致
   - 异常修正的原因在所有视图中一致

3. **原始证据保留**
   - 人工改判不覆盖原始导入数据
   - 可随时查看原始值和解析值对比

4. **异常透明性**
   - 异常修正前后差异明确展示
   - 同一异常在各视图展示相同的处理原因
