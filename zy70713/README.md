# 推送 Token 生命周期排查 CLI

运营团队专属的推送失败原因分析工具，帮助排查 Token 失效、设备换绑、用户退订等问题。

## 功能特性

- ✅ **多数据源支持**: CSV/JSON/Excel 格式导入
- 🔄 **Token 状态机**: 完整追踪 Token 生命周期
- 📱 **设备换绑检测**: 自动识别同一设备的 Token 变更
- 🚫 **退订拦截检测**: 标记已退订用户
- 📊 **失败原因归因**: 自动分类（过期/无效/换绑/退订）
- 📍 **来源追踪**: 每条记录保留原始文件位置
- 📈 **多格式报告**: 文本/JSON/CSV/Excel/HTML 输出
- 🎯 **结果稳定**: 重复运行排序一致，便于对比

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
# 或使用 poetry
poetry install
```

### 2. 生成示例数据（可选）

```bash
python -m push_token_cli.main sample
# 或安装后
push-token-check sample
```

### 3. 运行分析

```bash
python -m push_token_cli.main analyze \
  --tokens sample_data/tokens.csv \
  --bindings sample_data/bindings.csv \
  --unsubscribes sample_data/unsubscribes.csv \
  --failures sample_data/failures.csv \
  --output reports
```

### 4. 查看报告

报告生成在 `reports/` 目录下：
- `token_report.txt` - 纯文本报告
- `token_report.json` - JSON 格式报告
- `token_report.csv` - CSV 格式报告
- `token_report.xlsx` - Excel 格式报告
- `token_report.html` - 可视化 HTML 报告

## 使用说明

### 命令选项

```bash
push-token-check analyze [OPTIONS]

选项:
  -t, --tokens PATH        Token 列表文件
  -b, --bindings PATH      绑定关系文件
  -u, --unsubscribes PATH  退订记录文件
  -f, --failures PATH      推送失败记录文件
  -o, --output PATH        报告输出目录 (默认: ./reports)
  --format TEXT            报告格式: text/json/csv/excel/html/all (默认: all)
  --show-console/--no-show-console  是否显示控制台摘要 (默认: 显示)
```

### 数据格式要求

#### 1. Token 列表 (tokens.csv)
```csv
token,device_id,user_id,create_time,update_time
APA91bF8xQZ1...,device_001,user_001,2024-01-01 10:00:00,2024-01-15 08:30:00
```

#### 2. 绑定关系 (bindings.csv)
```csv
user_id,device_id,token,bind_time,unbind_time
user_001,device_001,APA91bF8xQZ1...,2024-01-01 10:05:00,
```

#### 3. 退订记录 (unsubscribes.csv)
```csv
token,user_id,device_id,unsubscribe_time,reason
APA91bF8xQZ3...,user_003,device_003,2024-02-10 12:00:00,用户主动退订
```

#### 4. 推送失败 (failures.csv)
```csv
token,user_id,device_id,fail_time,error_code,error_message
APA91bF8xQZ1...,user_001,device_001,2024-02-12 09:00:00,INVALID_REGISTRATION,Invalid token
```

### 支持的字段别名

工具会自动识别以下字段别名（不区分大小写）：

| 标准字段名 | 支持的别名 |
|-----------|-----------|
| token | push_token, pushtoken, device_token |
| device_id | deviceid, device |
| user_id | userid, user |
| create_time | created |
| update_time | updated |
| bind_time | bindtime |
| unbind_time | unbindtime |
| fail_time | timestamp |
| error_code | code |
| error_message | msg, err_msg |

## 项目结构

```
push_token_cli/
├── __init__.py       # 版本信息
├── parser.py         # 数据解析模块
├── state_machine.py  # Token 状态机
├── rule_engine.py    # 规则引擎（整合分析）
├── reporter.py       # 报告生成模块
└── main.py           # CLI 入口
```

## 核心流程

1. **数据解析**: 读取各种格式文件，保留原始位置信息
2. **状态构建**: 基于状态机构建 Token 生命周期
3. **换绑检测**: 检测同一设备上的 Token 变更
4. **退订标记**: 识别用户退订状态
5. **失败归因**: 根据状态和错误码分类原因
6. **报告生成**: 输出多格式排查报告

## 作为模块使用

```python
from push_token_cli.rule_engine import RuleEngine
from push_token_cli.reporter import Reporter

engine = RuleEngine()
engine.load_tokens("data/tokens.csv")
engine.load_bindings("data/bindings.csv")
engine.load_failures("data/failures.csv")

result = engine.analyze()

reporter = Reporter(result)
reporter.generate_html_report("report.html")
```
