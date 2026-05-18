# 共享会议室门禁日志核对CLI工具

## 功能特性

### 核心处理
- **跨天记录检测**: 自动识别跨天使用会议室的记录，单独列出便于审计
- **门禁补传检测**: 检测短时间内相似记录，识别可能的网络延迟补传
- **可复跑去重**: 通过记录哈希持久化，确保重复运行不会重复追加记录

### 错误处理
- 某个文件解析失败时，工具仍会完成其它文件的处理
- 生成详细的错误报告，包含错误位置和原因

## 安装

```bash
npm install
```

## 使用方法

### 基本使用（使用默认配置）

```bash
npm start
# 或
node src/cli.js
```

### 命令行参数

```bash
# 指定配置文件
node src/cli.js --config ./custom-config.json

# 指定输入/输出目录
node src/cli.js --input ./my-data --output ./my-output

# 禁用特定功能
node src/cli.js --no-deduplication    # 禁⽤去重
node src/cli.js --no-crossday         # 禁⽤跨天检测
node src/cli.js --no-retransmission   # 禁⽤补传检测

# 查看帮助
node src/cli.js --help
```

## 配置说明

复制 `config.example.json` 为自定义配置文件进行修改：

### 主要配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| input.directory | 输入目录 | ./data |
| input.filePattern | 文件匹配模式 | *.csv |
| output.directory | 输出目录 | ./output |
| rules.crossDay.enabled | 是否启用跨天检测 | true |
| rules.crossDay.maxDurationHours | 跨天检测最大时间差 | 24小时 |
| rules.retransmission.enabled | 是否启用补传检测 | true |
| rules.retransmission.timeWindowMinutes | 补传检测时间窗口 | 30分钟 |
| rules.deduplication.enabled | 是否启用去重 | true |

### 字段映射

支持多种字段名自动映射：
- 员工ID: 员工ID、工号、employee_id、EmployeeID
- 会议室ID: 会议室ID、会议室编号、room_id、RoomID
- 门禁时间: 刷卡时间、门禁时间、access_time、AccessTime
- ...

## 输入数据格式

CSV文件格式示例：

```csv
员工ID,员工姓名,会议室ID,会议室名称,刷卡时间,出入类型,设备ID
E001,张三,MR001,第一会议室,2024-05-18 08:30:00,进入,D001
```

支持的日期格式：
- yyyy-MM-dd HH:mm:ss
- yyyy/MM/dd HH:mm:ss
- MM/dd/yyyy HH:mm:ss
- 等等...

## 输出文件说明

| 文件名 | 说明 |
|--------|------|
| audit_result.csv | 核对后的最终记录 |
| cross_day_records.csv | 跨天记录（问题重点1） |
| retransmitted_records.csv | 补传记录（问题重点2） |
| deduplicated_records.csv | 去重记录（确保可复跑不重复） |
| error_report.json | 错误详情报告 |
| summary.txt | 汇总报告 |
| .processed_hashes.json | 已处理记录哈希（内部使用，用于去重） |

## 业务样例说明

工具已内置测试数据：
- `data/access_log_20240518_1.csv` - 包含跨天记录（赵六 22:00-00:30）、疑似补传记录（钱七 09:30和09:31两次进入）
- `data/access_log_20240518_2.csv` - 包含重复记录，用于测试去重功能
- `data/invalid_file.csv` - 无效文件，测试错误容错机制

## 项目结构

```
.
├── src/
│   ├── cli.js        # CLI入口
│   ├── config.js     # 配置模块
│   ├── parser.js     # 日志解析器
│   ├── processor.js  # 核心业务逻辑
│   └── writer.js     # 结果输出
├── data/             # 输入数据目录
├── output/           # 输出目录
├── package.json
└── config.example.json
```
