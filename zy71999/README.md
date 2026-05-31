# 脚本运行账本 (Script Ledger)

解决凌晨批处理跑完后，值班群里只剩几张截图和一句"已补跑"，第二天研发再问就没人确定哪条脚本真的成功了的问题。

## 功能特性

### 核心记录功能
- 记录脚本命令、工作目录、参数、退出码
- 自动计算脚本文件哈希和关键输出文件哈希
- 记录人工补跑说明和失败原因
- 支持标记补跑记录和回滚记录

### 智能检测
- **路径空格检测**: 自动识别包含空格的路径（cwd、命令、输出文件）
- **重复运行检测**: 5分钟内相同命令+目录+参数的重复执行
- **文件版本检测**: 通过脚本哈希检测是否使用旧版本（回滚后未更新）
- **失败脚本检测**: 区分有失败原因和无失败原因的失败
- **输出文件缺失检测**: 退出码为0但输出文件不存在
- **回滚完整性检测**: 回滚后输出文件是否恢复到原版本
- **可疑成功检测**: 之前短时间内有失败记录的成功运行

### 问题分类引擎
自动将脚本分为三类：
| 类别 | 含义 | 处理建议 |
|------|------|----------|
| ✓ 不用动 | 执行成功且无异常 | 无需处理 |
| ⚠ 要补跑 | 失败但可重试（网络超时、锁冲突、无失败原因等） | 值班人员可直接补跑 |
| ✗ 找研发确认 | 代码错误、语法错误、配置错误等 | 必须联系研发人员 |

### 数据安全
- **重复导入保留失败原因**: 默认保留已有失败原因，不会被新导入的空值覆盖
- **去重机制**: 相同命令+目录+参数在5分钟内自动去重
- **哈希校验**: 脚本和输出文件的哈希值永久保存，可事后验证

## 快速开始

### 1. 生成测试数据（可选）
```bash
python3 generate_test_data.py
```

### 2. 记录一条脚本运行
```bash
# 成功脚本
./ledger record \
  --command "python batch_process.py --date 20240531" \
  --cwd /data/scripts \
  --exit-code 0 \
  --output result_20240531.csv \
  --note "值班人张三"

# 失败脚本并记录原因
./ledger record \
  --command "python batch_process.py --date 20240531" \
  --cwd /data/scripts \
  --exit-code 1 \
  --failure "网络超时，连接数据库失败"
```

### 3. 查看记录
```bash
# 列出最近20条
./ledger list

# 列出所有
./ledger list --all

# 按命令过滤
./ledger list --command "*.py"

# 查看详情
./ledger show <记录ID>
```

### 4. 补跑记录
```bash
# 标记补跑（关联原失败记录）
./ledger rerun <原记录ID> \
  --command "python batch_process.py --date 20240531" \
  --exit-code 0 \
  --note "清理锁文件后补跑成功"
```

### 5. 生成报告
```bash
# 生成JSON账本和TXT问题清单
./ledger report

# 同时打印到控制台
./ledger report --print

# 指定输出前缀
./ledger report --output 20240531_batch
```

### 6. 导入导出
```bash
# 导出账本
./ledger export backup_20240531.json

# 导入账本（默认保留原有失败原因）
./ledger import backup_20240531.json

# 导入时覆盖失败原因（谨慎使用）
./ledger import backup_20240531.json --overwrite-failure
```

### 7. 直接执行并记录
```bash
# 执行命令并自动记录退出码和时间
./ledger exec --cwd /data/scripts --output result.csv -- python batch_process.py --date 20240531
```

### 8. 添加备注和失败原因
```bash
# 添加备注
./ledger note <记录ID> "已确认数据正确"

# 更新失败原因
./ledger failure <记录ID> "数据库密码过期"
```

## 项目结构

```
script_ledger/
├── __init__.py          # 包初始化
├── __main__.py          # 模块入口
├── ledger.py            # 账本核心：记录、查询、去重、导入导出
├── detector.py          # 智能检测：7种问题类型
├── classifier.py        # 问题分类：三类自动判定
└── cli.py               # 命令行接口
```

## 典型工作流

### 凌晨值班流程
```bash
# 1. 跑批处理，每条记录下来
./ledger exec --cwd /data/scripts --output result.csv -- python batch.py --date 20240531

# 2. 某条失败，记录失败原因
./ledger failure <失败记录ID> "网络超时，DB连接不上"

# 3. 修复后补跑，标记为补跑
./ledger rerun <失败记录ID> --command "python batch.py --date 20240531" --exit-code 0

# 4. 全部跑完生成报告
./ledger report --print

# 5. 把报告和账本发到群里
```

### 第二天研发核查
```bash
# 查看所有失败记录
./ledger list | grep "✗"

# 查看某条详情
./ledger show <记录ID>

# 检查输出文件是否被篡改
./ledger show <记录ID>  # 会显示文件哈希
```

## 问题清单示例

```
============================================================
脚本运行账本 - 问题清单
生成时间: 2024-05-31 08:00:00
============================================================

总计: 10 条记录
  ✓ 不用动: 6
  ⚠ 要补跑: 3
  ✗ 找研发确认: 1

------------------------------------------------------------
【找研发确认】 (1 条)
------------------------------------------------------------
记录ID: abc123
执行命令: python data_load.py
退出码: 1
失败原因: SyntaxError: invalid syntax at line 42
判定原因: 失败原因已知：SyntaxError: invalid syntax...，建议研发确认

------------------------------------------------------------
【要补跑】 (3 条)
------------------------------------------------------------
记录ID: def456
执行命令: python batch_process.py --date 20240531
退出码: 1
失败原因: 网络超时，连接数据库失败
判定原因: 失败原因已知：网络超时...，可尝试补跑

...

============================================================
操作建议
============================================================

【要补跑】的脚本可以尝试重新执行:
  - def456: cd /data/scripts && python batch_process.py --date 20240531
  - ...

【找研发确认】的脚本请联系相关研发人员:
  - abc123: python data_load.py
    原因: 失败原因已知：SyntaxError: invalid syntax...，建议研发确认
```

## 环境变量

- `SCRIPT_LEDGER_PATH`: 账本文件路径（默认: `script_ledger.json`）

## 数据格式

账本使用JSON存储，每条记录包含：
```json
{
  "id": "abc123...",
  "command": "python batch.py --date 20240531",
  "cwd": "/data/scripts",
  "args": [],
  "exit_code": 0,
  "output_files": ["result.csv"],
  "note": "值班人张三",
  "failure_reason": "",
  "start_time": 1717113600.0,
  "end_time": 1717113620.0,
  "is_rerun": false,
  "rerun_of": null,
  "rollback_to": null,
  "script_hash": "d9e9bfbf...",
  "file_hashes": {
    "result.csv": "a1b2c3d4..."
  }
}
```
