# 版本提醒器后端服务

多源湖仓分区版本检测和提醒服务，支持规则版本管理、历史回溯、多格式报告输出。

## 核心功能

### 1. 多源湖仓分区管理
- 支持多环境（prod/test/uat）分区数据管理
- **每个分区保留完整原始输入**，便于追溯数据来源
- 字段：来源系统、环境、库表、分区字段、记录数、文件大小等

### 2. 检测规则管理
- **双规则版本**：标准规则(normal) + 宽松规则(wide)
- 宽松规则作为"检测规则过宽的变体"用于对比测试
- 支持历史规则版本回溯，旧批次仍能解释当时的判断口径

### 3. 批次检测
- 批量执行分区检测
- 记录每次检测使用的规则版本
- 实时统计通过/失败/警告数量

### 4. 失败项单独存储
- 检测失败项独立保存到 `failed_items/` 目录
- 包含原始数据、错误信息、当时使用的规则版本
- 方便接手时直接看到失败原因

### 5. 多格式报告输出
- **JSON格式**：结构化数据，便于系统对接
- **Markdown格式**：易读性好，便于人工查看
- **下载接口**：支持文件下载
- 报告包含：
  - 处理前后对比
  - 执行时间
  - 下一步建议
  - 失败项统计

### 6. 发票红冲记录追踪
- 按环境名称查询发票红冲记录
- 每条记录保留完整原始输入
- 支持关联源分区ID

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI入口
│   ├── config.py            # 配置文件
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py       # 数据模型定义
│   │   └── store.py         # 数据存储层
│   ├── services/
│   │   ├── __init__.py
│   │   ├── detector.py      # 检测服务
│   │   └── report_generator.py  # 报告生成
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # API路由
│   └── utils/
│       ├── __init__.py
│       └── sample_data.py   # 样例数据
├── data/                     # JSON数据存储目录
├── failed_items/             # 失败项存储目录
├── reports/                  # 报告存储目录
├── requirements.txt
├── test_service.py           # 快速测试脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行测试（验证功能）

```bash
python test_service.py
```

测试脚本会：
- 初始化样例数据（5个分区、2条规则、3条发票记录）
- 执行标准规则和宽松规则两次检测
- 生成JSON和Markdown报告
- 验证失败项存储和规则版本回溯

### 3. 启动服务

```bash
python -m uvicorn app.main:app --reload
```

### 4. 访问API文档

打开浏览器访问：http://localhost:8000/docs

## API接口列表

### 分区管理
- `POST /api/v1/partitions` - 新增分区
- `GET /api/v1/partitions` - 获取分区列表
- `GET /api/v1/partitions/{id}` - 获取分区详情

### 规则管理
- `POST /api/v1/rules` - 新增规则
- `GET /api/v1/rules` - 获取规则列表
- `GET /api/v1/rules/version/{version}` - 按版本获取历史规则

### 发票红冲
- `POST /api/v1/invoices` - 新增发票记录
- `GET /api/v1/invoices` - 获取发票列表
- `GET /api/v1/invoices/environment/{env}` - 按环境查询

### 检测执行
- `POST /api/v1/detection/run` - 执行批量检测
- `GET /api/v1/batches/{id}` - 获取批次详情
- `GET /api/v1/batches/{id}/results` - 获取检测结果
- `GET /api/v1/batches/{id}/failed` - 获取失败项

### 报告输出
- `GET /api/v1/reports/{id}/json` - JSON格式报告
- `GET /api/v1/reports/{id}/markdown` - Markdown格式报告
- `GET /api/v1/reports/{id}/download` - 下载报告

## 规则说明

### 标准规则 (normal)
- 最小记录数：100条
- 最大记录数：100,000条
- 最小文件大小：1MB
- 最大文件大小：1000MB
- 日期容忍：7天

### 宽松规则 (wide - 过宽变体)
- 最小记录数：1条
- 最大记录数：1,000,000条
- 最小文件大小：0.01MB
- 最大文件大小：10,000MB
- 日期容忍：90天

## 关键设计要点

### 1. 原始输入可追溯
所有数据实体（分区、发票记录）都包含 `original_input` 字段，完整保留数据接入时的原始信息。

### 2. 规则版本可回溯
每个批次记录使用的规则版本，通过 `get_rule_by_version()` 可获取当时的规则配置。

### 3. 失败项独立存储
失败数据不混入正常结果，单独存储便于问题排查。

### 4. 多环境支持
通过 `environment` 字段可以快速筛选不同环境的数据。
