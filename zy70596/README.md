# SQLite备份一致性检查工具 (sqlite-backup-checker)

一个工程团队专用的SQLite数据库备份验证工具，确保备份文件可以安全恢复。

## 功能特性

- ✅ **SQLite文件完整性检查** - 验证文件头和页面级校验和
- ✅ **WAL文件配对检查** - 自动检测并验证Write-Ahead Log文件
- ✅ **页面级哈希校验** - 逐页验证确保数据一致性
- ✅ **恢复预检** - 尝试打开数据库并执行完整性检查
- ✅ **多格式报告输出** - 终端摘要、JSON/YAML机器可读、Markdown友好格式
- ✅ **目录批量扫描** - 一键检查整个备份目录
- ✅ **友好错误处理** - 坏数据不抛traceback，只显示有用信息

## 安装方式

### 方式一：直接安装（推荐）
```bash
cd sqlite-backup-checker
pip install -e .
```

### 方式二：安装依赖后直接运行
```bash
pip install click pyyaml
python -m sqlite_backup_checker.cli --help
```

验证安装：
```bash
sqlite-backup-check --version
```

## 命令使用示例

### 1. 检查单个备份文件
```bash
# 基本检查
sqlite-backup-check check backup/mydb.db

# 指定WAL文件
sqlite-backup-check check backup/mydb.db --wal backup/mydb.db-wal

# 生成报告
sqlite-backup-check check backup/mydb.db -o reports/

# 检查并尝试恢复
sqlite-backup-check check backup/mydb.db -o reports/ --try-restore
```

### 2. 扫描备份目录
```bash
# 扫描整个备份目录
sqlite-backup-check scandir /data/backups/

# 扫描并生成汇总报告
sqlite-backup-check scandir /data/backups/ -o backup_reports/
```

### 3. 尝试恢复数据库
```bash
sqlite-backup-check restore corrupted.db recovered.db
```

## 输入目录结构建议

```
backups/
├── 2024-01-15/
│   ├── app.db          # 主数据库文件
│   └── app.db-wal      # WAL文件（必须一起备份！）
├── 2024-01-16/
│   ├── user.db
│   └── user.db-wal
└── archive/
    └── old_backup/
        └── ...
```

⚠️ **重要提醒**：SQLite在WAL模式下运行时，事务会先写入WAL文件。恢复时必须同时提供 `.db` 和 `.db-wal` 两个文件才能保证数据完整！

## 报告输出位置

当使用 `-o reports/` 参数时，会在指定目录生成以下文件：

```
reports/
├── mydb_summary.txt     # 终端格式摘要（快速查看）
├── mydb_result.json     # JSON机器可读格式（自动化集成）
├── mydb_result.yaml     # YAML机器可读格式（人工易读）
└── mydb_report.md       # Markdown格式报告（发给同事看）
```

## 报告内容说明

### Markdown报告包含：
1. **概述** - 整体状态和基本信息
2. **文件信息** - 主数据库和WAL文件的详细信息
3. **错误信息** - 致命错误详情（如有）
4. **警告信息** - 潜在问题提示（如有）
5. **损坏页面详情** - 具体哪个页面损坏，损坏原因
6. **处理建议** - 根据检查结果给出的操作建议

## 常见问题

### Q: 为什么检查通过了但打开时还是报错？
A: 本工具执行的是静态校验。SQLite还有多种损坏方式。建议使用 `--try-restore` 参数进行真实的恢复预检。

### Q: WAL文件缺失会有什么影响？
A: 如果数据库在备份时处于活跃状态，最近的事务可能只存在于WAL文件中。缺少WAL文件可能导致：
- 数据丢失（最近的修改不见了）
- 数据库无法正常打开
- 页面校验不匹配

### Q: 页面校验不匹配怎么办？
A: 
1. 首先确认是否备份了完整的WAL文件
2. 尝试用 `sqlite-backup-check restore` 命令恢复
3. 可以使用SQLite官方的 `.dump` 命令提取可读数据
4. 参考: https://www.sqlite.org/howtocorrupt.html

## 实际使用场景

### 场景一：每日备份验证
```bash
# 在备份脚本末尾添加
sqlite-backup-check check /backup/$(date +%Y%m%d)/app.db -o /backup/reports/

# 如果检查失败，发送告警
if [ $? -ne 0 ]; then
    cat /backup/reports/appdb_summary.txt | mail -s "备份检查失败" eng@company.com
fi
```

### 场景二：故障排查
```bash
# 用户报告恢复失败，先检查文件
sqlite-backup-check check customer_backup/data.db -o debug_report/

# 检查报告中的损坏页面，定位问题
cat debug_report/data_db_report.md
```

## 依赖说明

- Python 3.8+
- click - 命令行参数处理
- pyyaml - YAML格式输出

## License

MIT
