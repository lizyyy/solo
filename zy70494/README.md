# 响应压缩策略后端服务

## 项目概述

这是一个完整的响应压缩策略后端服务，用于管理供应商数据压缩流程，包含主流程处理、异常流检测、人工修正、报告生成、历史查询等功能。

## 技术栈

- **框架**: Flask 2.3.3
- **数据库**: SQLAlchemy (默认 SQLite)
- **跨域**: Flask-CORS

## 项目结构

```
zy70494/
├── app.py                      # 应用入口
├── config.py                   # 配置文件
├── requirements.txt            # 依赖包
├── .env                        # 环境变量
├── app/
│   ├── __init__.py
│   ├── models/                 # 数据模型
│   │   ├── __init__.py
│   │   ├── supplier.py         # 供应商模型
│   │   ├── execution.py        # 执行批次模型
│   │   ├── compression.py      # 压缩策略/执行模型
│   │   ├── evidence.py         # 证据链/错误样本模型
│   │   ├── correction.py       # 人工修正模型
│   │   └── report.py           # 报告/证据模型
│   ├── api/                    # API接口
│   │   ├── __init__.py
│   │   ├── suppliers.py        # 供应商管理
│   │   ├── compression.py      # 压缩执行
│   │   ├── evidence.py         # 证据链/错误处理
│   │   ├── correction.py       # 人工修正
│   │   ├── query.py            # 历史查询
│   │   └── reports.py          # 报告生成
│   └── utils/                  # 工具类
│       ├── __init__.py
│       ├── response.py         # 统一响应格式
│       └── helpers.py          # 辅助函数
└── test_flow.py                # 完整流程测试脚本
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 http://localhost:5001 启动

### 3. 运行完整流程测试

```bash
python test_flow.py
```

## 功能模块

### 1. 主流程：补录供应商目录 → 执行压缩

- **供应商导入**: 支持批量导入供应商数据，生成批次号
- **压缩策略管理**: 创建、查询压缩策略，支持不同风险等级
- **压缩执行**: 按策略执行压缩，生成证据链

### 2. 异常流：证据链断开 → 错误样本识别 → 人工修正

- **证据链验证**: 验证每个压缩执行的证据链完整性
- **错误样本识别**: 自动识别异常并记录错误样本
- **人工修正**: 支持人工备注修正，保留系统原始判断

### 3. 报告生成

- **审计报告**: 生成包含所有错误样本的审计报告
- **法务证据页**: 每个报告包含法务复核样本
- **重跑标记**: 通过重跑标记关联输入、动作、结论

### 4. 历史查询

支持以下维度过滤：
- 按批次ID
- 按操作者
- 按风险类型
- 按执行状态

### 5. 策略解释

- 压缩前：策略适用范围说明
- 压缩后：压缩效果和验证结果说明

## API 接口

### 供应商管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/suppliers | 批量导入供应商 |
| GET | /api/suppliers | 查询供应商列表 |
| GET | /api/suppliers/<code> | 查询单个供应商 |

### 压缩管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/compression/strategies | 创建压缩策略 |
| GET | /api/compression/strategies | 查询策略列表 |
| POST | /api/compression/execute | 执行压缩 |
| GET | /api/compression/executions/<id>/explanation | 策略解释 |

### 证据与错误

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/evidence/chain/<execution_id>/break | 故意断开证据链（测试用） |
| POST | /api/evidence/chain/<batch_id>/validate | 验证证据链 |
| GET | /api/evidence/chain/<execution_id> | 查询证据链详情 |
| GET | /api/evidence/errors/<batch_id> | 查询错误样本 |
| POST | /api/evidence/errors/<id>/mark-reported | 标记已报告 |

### 人工修正

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/corrections | 创建人工修正（**不覆盖系统原始判断**） |
| GET | /api/corrections/batch/<batch_id> | 按批次查询修正记录 |
| GET | /api/corrections/supplier/<code> | 按供应商查询修正记录 |

**重要说明**: 创建人工修正时，系统原始状态（执行状态、供应商风险等级）会被完整保留，不会被覆盖。修正记录仅存储在人工修正表中，用于审计追溯。返回数据包含：
- `original_status`: 系统原始执行状态
- `corrected_status`: 人工修正的状态意见
- `original_risk_level`: 系统原始风险等级
- `corrected_risk_level`: 人工修正的风险等级意见
- `original_system_judgment`: 系统原始判断摘要
- `system_judgment_preserved`: 系统判断已保留标记（恒为true）

### 历史查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/history/batches | 查询批次（支持过滤） |
| GET | /api/history/executions | 查询执行记录 |
| GET | /api/history/unified | 统一查询（成功/异常路径） |
| GET | /api/history/statistics | 统计概览 |

### 报告管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reports | 生成报告 |
| GET | /api/reports | 查询报告列表 |
| GET | /api/reports/<id> | 查询报告详情 |
| GET | /api/reports/rerun/<flag> | 按重跑标记查询 |

## 统一响应格式

### 成功响应

```json
{
    "success": true,
    "code": 0,
    "message": "操作成功",
    "data": { ... }
}
```

### 错误响应

```json
{
    "success": false,
    "code": 30001,
    "message": "证据链断裂",
    "data": { ... }
}
```

### 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| 10001 | 参数错误 |
| 10002 | 缺少必要参数 |
| 20001 | 供应商不存在 |
| 20002 | 供应商已存在 |
| 30001 | 证据链断裂 |
| 30002 | 证据验证失败 |
| 30003 | 检测到错误样本 |
| 40001 | 执行失败 |
| 40002 | 批次不存在 |
| 50001 | 报告不存在 |
| 60001 | 不允许此修正操作 |
| 99999 | 系统内部错误 |

## 验收要点

1. ✅ **主流程**: 补录供应商目录 → 执行压缩策略
2. ✅ **异常流**: 证据链断开检测 → 错误样本识别 → 人工修正
3. ✅ **人工修正**: 保留系统原始判断，不直接覆盖
4. ✅ **历史查询**: 支持按批次、操作者、风险类型过滤
5. ✅ **接口返回**: 清晰的返回码和错误体结构
6. ✅ **统一查询**: 成功路径和异常路径都可从同一入口查看
7. ✅ **法务证据**: 报告包含法务证据页复核样本
8. ✅ **重跑标记**: 标记关联输入、动作、结论
9. ✅ **策略解释**: 压缩前后都有策略说明

## 数据库模型

- **Supplier**: 供应商信息
- **ExecutionBatch**: 执行批次记录
- **CompressionStrategy**: 压缩策略配置
- **CompressionExecution**: 压缩执行记录
- **EvidenceChain**: 证据链节点
- **ErrorSample**: 错误样本记录
- **ManualCorrection**: 人工修正记录
- **Report**: 审计报告
- **ReportEvidence**: 报告证据链
