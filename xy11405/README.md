# 乡镇药房近效期异常回执状态机系统

## 功能概述

这是一个专门为乡镇药房设计的近效期异常回执状态管理系统，用于管理进销存导出、手写调拨单、退货照片等数据的处理流程。

### 核心特性

- **批次管理**: 支持批次创建、数据导入、附件上传
- **状态机流转**: 草稿 → 待复核 → 已通过/已驳回 → 冻结 → 归档
- **幂等处理**: 重复请求自动去重，支持忽略/覆盖/追加三种模式
- **审计追踪**: 完整记录谁在什么时候改过什么
- **异步任务**: 支持自动重试、人工介入、永久失败三种失败状态
- **Excel导出**: 多Sheet报表，重点展示冻结前后状态、人工理由

## 项目结构

```
src/receipt_system/
├── __init__.py          # 版本信息
├── config.py            # 配置管理
├── models.py            # 数据模型定义
├── database.py          # 数据库连接
├── state_machine.py     # 状态机核心逻辑
├── schemas.py           # API数据结构
├── api.py               # FastAPI接口
├── cli.py               # CLI命令行工具
├── task_processor.py    # 异步任务处理器
└── exporter.py          # Excel导出模块

examples/
├── sample_data.json     # 示例数据
└── automated_flow.py    # 完整流程演示脚本
```

## 快速开始

### 安装依赖

```bash
pip install -e .
```

### 运行自动化流程演示

```bash
python examples/automated_flow.py
```

### 启动API服务

```bash
uvicorn receipt_system.api:app --host 0.0.0.0 --port 8000
# 或直接运行
python -m receipt_system.api
```

API文档地址: http://localhost:8000/docs

### CLI使用

```bash
# 创建批次
receipt-cli batch create --pharmacy-id PHARM001 --pharmacy-name "XX镇中心大药房" --region "华东区" --created-by "张三"

# 导入数据
receipt-cli batch import BATCH-001 data.json --duplicate-action overwrite

# 复核
receipt-cli batch review BATCH-001 --approved --reviewed-by "李四"

# 冻结
receipt-cli batch freeze BATCH-001 --frozen-by "王五" --reason "数据异常待核查"

# 解冻
receipt-cli batch unfreeze BATCH-001 --unfrozen-by "王五"

# 导出Excel
receipt-cli export --batch-ids BATCH-001 -o output.xlsx

# 查看审计日志
receipt-cli audit list --batch-id BATCH-001

# 启动任务工作进程
receipt-cli task worker
```

### CLI退出码

| 退出码 | 含义 |
|--------|------|
| 0      | 成功 |
| 1      | 通用错误 |
| 2      | 资源未找到 |
| 3      | 状态转换无效 |

## API接口

### 批次管理
- `POST /batches` - 创建批次
- `GET /batches` - 列出批次
- `GET /batches/{id}` - 获取批次详情
- `GET /batches/{id}/summary` - 获取批次汇总

### 回执管理
- `POST /batches/{id}/import` - 导入回执数据
- `GET /batches/{id}/receipts` - 列出回执
- `POST /batches/{id}/review` - 复核
- `POST /batches/{id}/freeze` - 冻结
- `POST /batches/{id}/unfreeze` - 解冻
- `POST /batches/{id}/archive` - 归档

### 附件管理
- `POST /batches/{id}/attachments` - 上传附件
- `GET /batches/{id}/attachments` - 列出附件

### 审计日志
- `GET /batches/{id}/audit-logs` - 获取审计日志
- `GET /receipts/{id}/transitions` - 获取状态流转历史

### 任务管理
- `GET /tasks` - 列出任务
- `POST /tasks/{id}/retry` - 重试任务

### 导出
- `POST /export` - 导出Excel
- `GET /export/summary` - 获取导出汇总

## 状态流转图

```
草稿(DRAFT)
    ↓
待复核(PENDING_REVIEW)
    ↓        ↓
已通过(APPROVED) → 已驳回(REJECTED)
    ↓                ↓
冻结(FROZEN) ←──────┘
    ↓
归档(ARCHIVED)
```

## 异步任务状态

| 状态 | 说明 | 处理方式 |
|------|------|----------|
| PENDING | 待处理 | 自动执行 |
| PROCESSING | 处理中 | 正在执行 |
| WAITING_RETRY | 等待重试 | 自动重试N次 |
| WAITING_MANUAL | 待人工处理 | 需要人工介入重试 |
| PERMANENT_FAILED | 永久失败 | 无法自动恢复 |
| COMPLETED | 已完成 | 成功结束 |

## 导出报表说明

Excel文件包含以下Sheet:

1. **批次汇总** - 批次基本信息、状态统计、冻结信息
2. **回执明细** - 每条回执的完整信息，重点显示冻结前状态
3. **冻结记录** - 所有冻结/解冻操作的详细记录，包含人工理由
4. **审计日志** - 所有操作的完整历史记录(可选)

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic 2.0
- **CLI框架**: Click
- **Excel导出**: Pandas + OpenPyXL
- **数据库**: SQLite (可配置为其他)
