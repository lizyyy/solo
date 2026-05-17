# 测试隔离名单 CLI (quarantine-tests)

一个可反复运行的测试隔离名单管理工具，帮助团队按到期时间和失败原因清理被隔离的测试用例。

## 功能特性

- ✅ **参数解析与输入校验**：完整的命令行参数支持和文件验证
- 📊 **测试元数据解析**：支持 CSV 和 JSON 格式的输入文件
- 🔍 **坏行追溯**：解析错误会记录源文件位置和行号
- ⏰ **到期提醒**：自动识别已超期和7天内即将到期的测试
- 👥 **负责人汇总**：按负责人统计隔离测试数量
- 📋 **多格式输出**：终端摘要、JSON结果、HTML可视化报告

## 快速开始

### 1. 运行自检（推荐）

先运行自检命令验证工具功能，同时生成示例数据：

```bash
python3 quarantine_tests.py --selftest
```

### 2. 处理实际数据

```bash
# 处理单个CSV文件
python3 quarantine_tests.py --input your_tests.csv

# 处理多个文件
python3 quarantine_tests.py --input tests.csv --input more_tests.json

# 指定输出目录
python3 quarantine_tests.py --input tests.csv --output ./my_reports
```

## 输入文件格式

### CSV 格式

```csv
test_name,quarantine_reason,owner,due_date,last_result
test_login_success,依赖外部服务不稳定,张三,2026-05-10,失败
test_payment_flow,第三方API变更,李四,2026-05-20,失败
```

### JSON 格式

```json
{
  "tests": [
    {
      "test_name": "api_v2_check",
      "quarantine_reason": "v2接口下线",
      "owner": "李四",
      "due_date": "2026-05-15",
      "last_result": "失败"
    }
  ]
}
```

### 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `test_name` | 测试用例名称 | ✅ |
| `quarantine_reason` | 隔离原因 | ✅ |
| `owner` | 负责人 | ✅ |
| `due_date` | 到期日期 (YYYY-MM-DD) | ✅ |
| `last_result` | 最近执行结果 | ✅ |

## 输出说明

工具会在输出目录生成以下文件：

1. **quarantine_report.json** - 机器可读的完整数据
2. **quarantine_report.html** - 适合分享的可视化报告
3. **parse_errors.json** - 解析错误详情（便于修复数据）

### HTML 报告预览

报告包含：
- 统计卡片（总测试数、有效测试、超期、即将到期）
- 已超期测试列表（红色高亮）
- 7天内即将到期测试列表（黄色高亮）
- 解析错误详情

## 命令行参数

```
--input, -i      输入文件路径 (CSV或JSON格式)，可多次指定
--output, -o     输出目录 (默认: ./quarantine_reports)
--selftest       运行自检命令，生成测试数据并验证所有功能
--help, -h       显示帮助信息
```

## 示例输出

### 终端摘要

```
============================================================
        测试隔离名单 - 摘要报告
============================================================
生成时间: 2026-05-17 15:30:00

总测试数:    10
有效测试:    7
无效测试:    3
已超期:      2 🔴
即将到期:    3 🟡

按负责人统计:
  - 张三: 2个测试 (超期: 1)
  - 李四: 3个测试 (超期: 1)
  - 王五: 2个测试 (超期: 0)
============================================================
```

## 项目结构

```
quarantine_tests.py       # 主程序
├── TestCase              # 测试用例数据模型
├── ParseError            # 解析错误记录
├── ReportData            # 报告数据聚合
├── InputValidator        # 输入校验
├── TestCaseParser        # 文件解析器
├── ReportGenerator       # 报告生成
├── QuarantineManager     # 主逻辑
└── SelfTester            # 自检模块
```

## 常见问题

**Q: 如何处理解析错误？**
A: 查看输出目录中的 `parse_errors.json`，里面记录了每个错误的文件位置、行号和原始内容。

**Q: 支持哪些日期格式？**
A: 目前只支持标准的 `YYYY-MM-DD` 格式。

**Q: 可以合并多个来源的测试数据吗？**
A: 可以，多次使用 `--input` 参数即可，工具会自动合并结果。

## 许可证

MIT License
