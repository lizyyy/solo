# 离线补账包回放器

智能售货柜运维专用的离线补账包回放、校验和对账工具。

## 功能特性

- **事件去重**: 自动识别重复事件，避免同一批事件被重复补传
- **时间校验**: 检查事件时间倒序、时钟漂移问题
- **库存管理**: 精确跟踪每台柜机的货道库存变化
- **支付核对**: 确保支付金额与商品数量匹配
- **称重校验**: 验证称重变化与取货数量是否一致
- **人工补录**: 支持人工补录覆盖 AI 识别结果
- **幂等入账**: 同一批次重复 apply 无副作用
- **撤销支持**: 可撤销最近一次已应用的批次
- **REST API**: 提供查询、导出等 API 接口
- **报告导出**: 支持 Markdown 对账报告、CSV 库存差异表、JSON 审计证据

## 项目结构

```
offline_replay_tool/
├── pyproject.toml           # 项目配置
├── README.md               # 本文档
├── src/
│   └── offline_replay_tool/
│       ├── __init__.py
│       ├── cli.py          # CLI 入口
│       ├── config.py       # 配置模型
│       ├── models.py       # 数据模型
│       ├── parser.py       # 事件解析器
│       ├── validator.py    # 事件校验器
│       ├── quarantine.py   # 隔离区管理
│       ├── replay.py       # 回放状态机
│       ├── ledger.py       # 幂等账本
│       ├── api.py          # REST API 路由
│       └── reports.py      # 报告导出
├── tests/
│   └── test_core.py        # 单元测试
└── examples/
    ├── cab001_bundle1.jsonl  # 一号柜示例补账包
    └── cab002_bundle1.jsonl  # 二号柜示例补账包
```

## 安装

### 环境要求

- Python 3.9+
- pip 或 poetry

### 安装步骤

```bash
# 进入项目目录
cd offline_replay_tool

# 使用 pip 安装（推荐）
pip install -e .

# 或使用 poetry 安装
poetry install
```

## 快速开始

以下是使用示例数据验证核心流程的完整步骤。

### 1. 初始化配置

```bash
# 在临时目录中测试（推荐）
mkdir -p /tmp/replay-test && cd /tmp/replay-test

# 初始化配置文件
replay-tool init --data-dir ./data --output-dir ./output
```

这将创建：
- `replay-tool-config.json` - 配置文件
- `./data/` - 数据目录
- `./output/` - 输出目录

查看生成的配置文件：

```bash
cat replay-tool-config.json
```

### 2. 导入补账包

使用示例数据文件：

```bash
# 从项目目录复制示例文件（根据实际路径调整）
cp /path/to/offline_replay_tool/examples/*.jsonl ./

# 导入一号柜补账包
replay-tool import-bundle cab001_bundle1.jsonl

# 导入二号柜补账包
replay-tool import-bundle cab002_bundle1.jsonl
```

记录输出的批次号，例如：
- `BATCH_20260501_100000_xxxxxx` (一号柜)
- `BATCH_20260501_100100_yyyyyy` (二号柜)

### 3. 校验批次

```bash
# 校验所有批次
replay-tool check

# 或校验指定批次
replay-tool check --batch-id BATCH_20260501_100000_xxxxxx
```

校验内容包括：
- 字段缺失
- 事件 ID 重复
- 时间倒序
- 未知柜机或 SKU
- 货道库存越界
- 支付单号冲突
- 称重变化与商品数量不匹配

### 4. 回放事件（试运行）

```bash
# 试运行模式（不实际修改数据）
replay-tool replay --dry-run BATCH_20260501_100000_xxxxxx
```

查看回放结果，确认：
- 订单状态是否正确
- 预期金额与实际支付是否匹配
- 库存变更是否合理

### 5. 确认入账

```bash
# 确认应用第一个批次
replay-tool apply BATCH_20260501_100000_xxxxxx

# 确认应用第二个批次
replay-tool apply BATCH_20260501_100100_yyyyyy
```

### 6. 验证幂等性

```bash
# 重复应用同一批次
replay-tool apply BATCH_20260501_100000_xxxxxx

# 输出应显示："批次已应用，跳过重复应用（幂等）"
```

### 7. 查看系统状态

```bash
replay-tool status
```

### 8. 撤销操作

```bash
# 撤销最近一次应用的批次
replay-tool undo

# 确认撤销
```

### 9. 启动 REST API 服务

```bash
# 启动服务（默认端口 8000）
replay-tool serve

# 或指定端口
replay-tool serve --host 0.0.0.0 --port 8080
```

服务启动后，访问以下地址：
- http://127.0.0.1:8000/ - 首页
- http://127.0.0.1:8000/docs - Swagger API 文档
- http://127.0.0.1:8000/redoc - ReDoc API 文档

### 10. API 调用示例

```bash
# 获取所有柜机库存
curl http://127.0.0.1:8000/api/inventory

# 获取指定柜机库存
curl http://127.0.0.1:8000/api/inventory?cabinet_id=CAB001

# 获取批次列表
curl http://127.0.0.1:8000/api/batches

# 获取隔离事件
curl http://127.0.0.1:8000/api/quarantine

# 获取审计日志
curl http://127.0.0.1:8000/api/audit

# 导出 Markdown 对账报告
curl -X POST http://127.0.0.1:8000/api/export/markdown

# 导出 CSV 库存差异表
curl -X POST http://127.0.0.1:8000/api/export/csv

# 导出 JSON 审计证据
curl -X POST http://127.0.0.1:8000/api/export/json
```

### 11. 导出报告

```bash
# 导出 Markdown 对账报告
replay-tool export --type markdown

# 导出 CSV 库存差异表
replay-tool export --type csv

# 导出 JSON 审计证据
replay-tool export --type json
```

导出的文件将保存到 `./output/` 目录。

## CLI 命令详解

### init - 初始化配置

```bash
replay-tool init [OPTIONS]

Options:
  --data-dir, -d    数据目录路径 (默认: ./data)
  --output-dir, -o  输出目录路径 (默认: ./output)
  --config, -c      配置文件路径 (默认: replay-tool-config.json)
```

### import-bundle - 导入补账包

```bash
replay-tool import-bundle [OPTIONS] FILES...

Arguments:
  FILES...  一个或多个 JSONL 文件路径

Options:
  --config, -c  配置文件路径
```

### check - 校验事件

```bash
replay-tool check [OPTIONS]

Options:
  --batch-id, -b  指定批次 ID 校验（不指定则校验所有）
  --config, -c    配置文件路径
```

### replay - 回放事件

```bash
replay-tool replay [OPTIONS] BATCH_ID

Arguments:
  BATCH_ID  批次 ID

Options:
  --dry-run, -n  试运行模式（不实际修改数据）
  --config, -c   配置文件路径
```

### apply - 确认入账

```bash
replay-tool apply [OPTIONS] BATCH_ID

Arguments:
  BATCH_ID  批次 ID

Options:
  --config, -c  配置文件路径
```

### undo - 撤销批次

```bash
replay-tool undo [OPTIONS]

Options:
  --config, -c  配置文件路径
```

### serve - 启动 API 服务

```bash
replay-tool serve [OPTIONS]

Options:
  --host, -H   监听地址 (默认: 127.0.0.1)
  --port, -p   监听端口 (默认: 8000)
  --reload, -r 自动重载（开发模式）
  --config, -c 配置文件路径
```

### export - 导出报告

```bash
replay-tool export [OPTIONS]

Options:
  --type, -t  导出格式: markdown|csv|json (默认: markdown)
  --config, -c 配置文件路径
```

### status - 查看状态

```bash
replay-tool status [OPTIONS]

Options:
  --config, -c 配置文件路径
```

## 配置文件说明

配置文件 `replay-tool-config.json` 包含以下部分：

```json
{
  "cabinets": [
    {
      "cabinet_id": "CAB001",
      "name": "一号柜",
      "location": "A栋一楼大厅"
    }
  ],
  "skus": [
    {
      "sku_id": "SKU001",
      "name": "农夫山泉500ml",
      "price": 2.0,
      "weight_per_unit": 520.0
    }
  ],
  "channels": [
    {
      "channel_id": "CAB001_CH01",
      "sku_id": "SKU001",
      "capacity": 20,
      "initial_quantity": 15
    }
  ],
  "deduplication_window_seconds": 3600,
  "max_clock_drift_seconds": 300,
  "abnormal_weight_threshold_percent": 20.0,
  "data_dir": "./data",
  "output_dir": "./output"
}
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| cabinets | 柜机列表 | [] |
| skus | 商品 SKU 列表 | [] |
| channels | 货道配置列表 | [] |
| deduplication_window_seconds | 事件去重窗口（秒） | 3600 |
| max_clock_drift_seconds | 允许的最大时钟漂移（秒） | 300 |
| abnormal_weight_threshold_percent | 称重异常阈值（百分比） | 20.0 |
| data_dir | 数据存储目录 | ./data |
| output_dir | 报告输出目录 | ./output |

## 事件类型

支持以下事件类型：

| 事件类型 | 说明 | 必需字段 |
|----------|------|----------|
| door_open | 开门事件 | event_id, cabinet_id, timestamp |
| door_close | 关门事件 | event_id, cabinet_id, timestamp |
| item_take | 取货事件 | event_id, cabinet_id, order_id, sku_id, channel_id, quantity |
| item_return | 归还事件 | event_id, cabinet_id, order_id, sku_id, channel_id, quantity |
| weight_sample | 称重采样 | event_id, cabinet_id, order_id, changes |
| payment_callback | 支付回调 | event_id, cabinet_id, order_id, payment_id, payment_status, amount |
| manual_correction | 人工补录 | event_id, cabinet_id, order_id, item_changes |

## 运行测试

```bash
# 运行单元测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_core.py::TestLedger -v
```

## 数据目录结构

```
data/
├── bundles/          # 原始补账包备份
├── snapshots/        # 撤销用的快照
├── inventory.json    # 库存数据
├── batches.json      # 批次信息
├── audit.json        # 审计日志
└── quarantine.json   # 隔离事件
```

## 注意事项

1. **幂等性**: `apply` 命令对同一批次多次执行无副作用
2. **撤销限制**: 仅能撤销最近一次已应用的批次
3. **试运行**: 使用 `replay --dry-run` 查看变更再确认
4. **数据备份**: 应用批次前会自动创建快照用于撤销
5. **隔离事件**: 校验失败的事件会进入隔离区，不参与回放

## 故障排查

### 问题：配置文件不存在

```
错误: 配置文件不存在: replay-tool-config.json
```

**解决**: 先运行 `replay-tool init` 初始化配置

### 问题：批次不存在

```
批次不存在: BATCH_xxx
```

**解决**: 确认批次 ID 正确，或先运行 `replay-tool import-bundle` 导入

### 问题：服务端口被占用

```
OSError: [Errno 48] Address already in use
```

**解决**: 使用 `--port` 指定其他端口，或关闭占用端口的进程

## 许可证

MIT License

## 支持

如有问题，请提交 Issue 或联系运维团队。
