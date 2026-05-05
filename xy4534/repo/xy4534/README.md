# 备份演练核对工具

一个专为小型 SRE 值班组设计的本地备份演练核对工具，用于验证 PostgreSQL 备份完整性、校验和一致性及还原演练结果。

## 功能特性

- **分片完整性检查**：验证对象存储中备份分片是否完整，是否有缺失
- **校验和一致性检查**：验证所有分片的校验和格式是否有效
- **还原版本验证**：检查还原后的数据库版本和表数量
- **关键表抽查**：验证抽查表的行数和校验和是否匹配
- **本地 Web 界面**：提供可视化界面用于复核风险、补充备注
- **多格式导出**：支持导出 Markdown 演练结论和 JSON 审计包

## 项目结构

```
xy4534/
├── requirements.txt          # 依赖文件
├── src/
│   ├── backup_checker/
│   │   ├── __init__.py       # 包初始化
│   │   ├── models.py         # 数据模型 (SQLite)
│   │   ├── checker.py        # 检查逻辑
│   │   └── exporter.py       # 导出功能
│   ├── cli.py                 # 命令行工具
│   ├── web.py                 # Web 服务 (Flask)
│   └── templates/
│       ├── base.html          # 基础模板
│       ├── index.html         # 首页 (任务列表)
│       └── task_detail.html   # 任务详情页
├── examples/                   # 样例数据
│   ├── pg_dump_normal.log              # 正常的 pg_dump 日志
│   ├── manifest_normal.json            # 正常的 manifest
│   ├── manifest_with_errors.json       # 有问题的 manifest
│   ├── restore_result_normal.json      # 正常的还原结果
│   └── restore_result_with_errors.json # 有问题的还原结果
└── backup_check.db           # SQLite 数据库 (运行时生成)
```

## 安装

1. 确保已安装 Python 3.8+
2. 安装依赖：

```bash
pip install -r requirements.txt
```

## 使用流程

### 方式一：命令行工具

#### 1. 创建备份演练任务

```bash
python src/cli.py create "2026-05-05 发布前演练"
```

输出：
```
创建任务成功: ID = 1, 名称 = '2026-05-05 发布前演练'
```

#### 2. 导入数据

导入 pg_dump 日志：

```bash
python src/cli.py import 1 --pg-dump-log examples/pg_dump_normal.log
```

导入对象存储 manifest：

```bash
# 导入正常的 manifest
python src/cli.py import 1 --manifest examples/manifest_normal.json

# 或导入有问题的 manifest（用于测试）
python src/cli.py import 1 --manifest examples/manifest_with_errors.json
```

导入还原演练结果：

```bash
# 导入正常的还原结果
python src/cli.py import 1 --restore-result examples/restore_result_normal.json

# 或导入有问题的还原结果（用于测试）
python src/cli.py import 1 --restore-result examples/restore_result_with_errors.json
```

添加值班备注：

```bash
python src/cli.py import 1 \
  --duty-note "这是一个测试演练" \
  --duty-note "注意检查 users 表的数据完整性" \
  --created-by "值班员A"
```

一次性导入所有数据：

```bash
python src/cli.py import 1 \
  --pg-dump-log examples/pg_dump_normal.log \
  --manifest examples/manifest_normal.json \
  --restore-result examples/restore_result_normal.json \
  --duty-note "发布前备份演练" \
  --created-by "SRE 值班组"
```

#### 3. 执行检查

```bash
python src/cli.py check 1
```

输出示例（正常情况）：
```
开始执行检查: 任务 ID 1 (2026-05-05 发布前演练)
------------------------------------------------------------

检查结果:
------------------------------------------------------------
总计: 12 项检查
  - 通过: 10 项
  - 警告: 2 项
  - 失败: 0 项

✓ [LOW]    分片完整性检查
    分片数量正常，共 8 个

✓ [LOW]    校验和一致性检查
    所有 8 个分片的校验和有效

✓ [LOW]    还原版本检查
    还原版本有效: 14.5

✓ [LOW]    还原表数量检查
    成功还原 8 个表

✓ [LOW]    关键表抽查检查
    成功抽查 6 个关键表

...
```

输出示例（有问题情况）：
```
开始执行检查: 任务 ID 1 (2026-05-05 发布前演练)
------------------------------------------------------------

检查结果:
------------------------------------------------------------
总计: 12 项检查
  - 通过: 5 项
  - 警告: 3 项
  - 失败: 4 项

✗ [HIGH]   分片完整性检查
    分片缺失！期望 8 个分片，实际 6 个，缺少 2 个

✗ [HIGH]   校验和一致性检查
    有 1 个分片的校验和格式无效

⚠ [MEDIUM] 校验和一致性检查
    有 1 个分片缺少校验和

✗ [HIGH]   关键表行数检查
    表 users 行数不匹配：期望 15234，实际 15200

✗ [HIGH]   关键表校验和检查
    表 orders 校验和不匹配

✗ [HIGH]   关键表行数检查
    表 products 行数不匹配：期望 8923，实际 8500

✗ [HIGH]   关键表校验和检查
    表 products 校验和不匹配

...
```

#### 4. 查看任务列表

```bash
python src/cli.py list
```

输出：
```
ID     名称                            状态       创建时间
---------------------------------------------------------------------------
1      2026-05-05 发布前演练           failed     2026-05-05 10:30:00
2      2026-05-04 演练 (正常数据)      passed     2026-05-05 10:25:00
```

#### 5. 查看任务详情

```bash
python src/cli.py show 1
```

输出：
```
============================================================
任务详情: 2026-05-05 发布前演练 (ID: 1)
============================================================
状态: failed
创建时间: 2026-05-05 10:30:00
摘要: 通过: 5, 警告: 3, 失败: 4

pg_dump 日志 (1 个):
  - ID: 1, 数据库: prod_db
    表数量: 8, 大小: 268435456 字节

对象存储 Manifest (1 个):
  - ID: 1, Bucket: prod-backup-bucket
    分片数: 8, 实际分片: 6
    总大小: 268435456 字节

还原演练结果 (1 个):
  - ID: 1, 数据库: prod_db_restore_test
    版本: 14.4
    表数: 7, 行数: 145234
    抽查表: 4 个

检查结果 (12 项):
  ✗ [HIGH] 分片完整性检查 (待复核)
      分片缺失！期望 8 个分片，实际 6 个，缺少 2 个
  ✗ [HIGH] 校验和一致性检查 (待复核)
      有 1 个分片的校验和格式无效
  ...

值班备注 (2 条):
  - 2026-05-05 10:30:00 (by SRE 值班组):
    发布前备份演练
  - 2026-05-05 10:35:00 (by 值班员A):
    注意检查 users 表的数据完整性
```

#### 6. 导出结果

导出所有格式（Markdown + JSON）：

```bash
python src/cli.py export 1
```

只导出 Markdown：

```bash
python src/cli.py export 1 --format markdown -o 演练报告.md
```

只导出 JSON 审计包：

```bash
python src/cli.py export 1 --format json -o 审计报告.json
```

### 方式二：Web 界面

#### 启动 Web 服务

```bash
python src/web.py
```

输出：
```
备份演练核对工具 - Web 服务
数据库: backup_check.db
服务地址: http://127.0.0.1:5000
--------------------------------------------------
 * Serving Flask app 'web'
 * Debug mode: off
 * Running on http://127.0.0.1:5000
```

#### 使用 Web 界面

1. 打开浏览器访问 http://127.0.0.1:5000
2. 在首页查看所有任务列表
3. 点击"查看详情"进入任务详情页
4. 在任务详情页可以：
   - 查看检查结果统计
   - 按风险等级查看详细检查项
   - 复核检查结果（标记已复核，添加复核备注）
   - 添加值班备注
   - 重新执行检查
   - 导出 Markdown 报告或 JSON 审计包

### 完整演练流程示例

#### 场景一：正常演练（所有检查通过）

```bash
# 1. 创建任务
python src/cli.py create "2026-05-05 正常演练"

# 2. 导入正常数据
python src/cli.py import 1 \
  --pg-dump-log examples/pg_dump_normal.log \
  --manifest examples/manifest_normal.json \
  --restore-result examples/restore_result_normal.json

# 3. 执行检查（应该全部通过）
python src/cli.py check 1

# 4. 导出报告
python src/cli.py export 1

# 5. 启动 Web 服务复核
python src/web.py
```

#### 场景二：问题演练（发现多个问题）

```bash
# 1. 创建任务
python src/cli.py create "2026-05-05 问题演练"

# 2. 导入有问题的数据
python src/cli.py import 2 \
  --pg-dump-log examples/pg_dump_normal.log \
  --manifest examples/manifest_with_errors.json \
  --restore-result examples/restore_result_with_errors.json

# 3. 执行检查（会发现多个问题）
python src/cli.py check 2

# 4. 启动 Web 服务进行复核和添加备注
python src/web.py

# 5. 在 Web 界面：
#    - 查看高风险问题
#    - 标记已复核的问题
#    - 添加复核备注
#    - 导出带复核信息的报告
```

## 检查项说明

### 1. 分片完整性检查

- **检查内容**：验证对象存储 manifest 中期望的分片数量与实际存在的分片数量是否一致
- **风险等级**：
  - 高风险：分片缺失（实际 < 期望）
  - 中风险：分片数量超过期望、未指定期望分片数
- **常见问题**：
  - 上传过程中断导致部分分片未上传
  - manifest 文件生成错误

### 2. 校验和一致性检查

- **检查内容**：验证每个分片的校验和格式是否有效（支持 MD5、SHA1、SHA256、AWS ETag 等）
- **风险等级**：
  - 高风险：校验和格式无效
  - 中风险：缺少校验和
- **常见问题**：
  - 传输过程中数据损坏
  - 校验和计算错误
  - 文件上传时未计算校验和

### 3. 还原版本检查

- **检查内容**：验证还原后的数据库版本格式是否有效
- **风险等级**：中风险
- **常见问题**：
  - 版本格式异常
  - 未记录版本信息

### 4. 还原表数量检查

- **检查内容**：验证还原后的表数量是否大于 0
- **风险等级**：高风险
- **常见问题**：
  - 还原失败，没有表被恢复
  - 还原过程中出错

### 5. 关键表抽查检查

- **检查内容**：验证抽查的关键表的行数和校验和是否匹配
- **风险等级**：高风险
- **检查项**：
  - 行数匹配检查：期望行数 vs 实际行数
  - 校验和匹配检查：期望校验和 vs 实际校验和
- **常见问题**：
  - 数据丢失（行数不一致）
  - 数据损坏（校验和不一致）
  - 表未完全恢复

### 6. 备份大小检查

- **检查内容**：验证 pg_dump 日志中的备份大小是否正常
- **风险等级**：中风险
- **常见问题**：
  - 备份大小为 0（备份失败）
  - 大小异常（远小于预期）

### 7. 对象存储大小检查

- **检查内容**：验证对象存储中分片大小总和与 manifest 记录的总大小是否一致
- **风险等级**：中风险
- **常见问题**：
  - 分片大小统计错误
  - manifest 记录错误

### 8. 备份时间检查

- **检查内容**：验证 pg_dump 的开始时间和结束时间是否合理
- **风险等级**：中风险
- **常见问题**：
  - 结束时间早于开始时间（时间记录错误）

### 9. 还原时间检查

- **检查内容**：验证还原的开始时间和结束时间是否合理
- **风险等级**：中风险
- **常见问题**：
  - 结束时间早于开始时间（时间记录错误）

## API 文档

Web 服务同时提供 REST API 接口：

### 获取任务列表

```
GET /api/tasks
```

响应：
```json
{
  "tasks": [
    {
      "id": 1,
      "task_name": "2026-05-05 发布前演练",
      "status": "failed",
      "created_at": "2026-05-05 10:30:00",
      "passed": 5,
      "failed": 4,
      "warnings": 3,
      "reviewed": 0,
      "total_checks": 12
    }
  ]
}
```

### 获取任务详情

```
GET /api/tasks/<task_id>
```

### 创建任务

```
POST /api/tasks
Content-Type: application/json

{
  "name": "新演练任务"
}
```

### 复核检查结果

```
POST /api/checks/<check_id>/review
Content-Type: application/json

{
  "reviewed": true,
  "review_note": "已确认该问题，需要在下一次备份前修复"
}
```

### 添加值班备注

```
POST /api/tasks/<task_id>/notes
Content-Type: application/json

{
  "note": "这是一条值班备注",
  "created_by": "值班员A"
}
```

### 执行检查

```
POST /api/tasks/<task_id>/run-check
```

### 导出 Markdown

```
GET /api/tasks/<task_id>/export/markdown
```

### 导出 JSON 审计包

```
GET /api/tasks/<task_id>/export/json
```

## 数据格式说明

### pg_dump 日志格式

工具支持标准的 PostgreSQL pg_dump 输出格式，会自动解析以下信息：

- 数据库名称
- 表数量
- 总大小
- 备份开始/结束时间（从日志摘要中解析）

### 对象存储 Manifest 格式

支持以下 JSON 字段（字段名有多个别名，便于兼容不同系统）：

```json
{
  "bucket": "bucket名称",
  "bucket_name": "bucket名称 (别名)",
  "date": "manifest日期",
  "manifest_date": "manifest日期 (别名)",
  "total_shards": 8,
  "shard_count": 8,
  "total_size": 268435456,
  "total_size_bytes": 268435456,
  "shards": [
    {
      "name": "分片文件名",
      "shard_name": "分片文件名 (别名)",
      "key": "分片文件名 (别名)",
      "size": 33554432,
      "size_bytes": 33554432,
      "checksum": "校验和",
      "etag": "校验和 (别名)",
      "md5": "校验和 (别名)",
      "upload_time": "上传时间",
      "last_modified": "上传时间 (别名)"
    }
  ]
}
```

### 还原演练结果格式

支持以下 JSON 字段：

```json
{
  "restore_start_time": "还原开始时间",
  "restore_end_time": "还原结束时间",
  "database": "还原的数据库名",
  "restored_database": "还原的数据库名 (别名)",
  "version": "数据库版本",
  "restored_version": "数据库版本 (别名)",
  "tables_restored": 8,
  "table_count_restored": 8,
  "rows_restored": 156234,
  "row_count_restored": 156234,
  "spot_checks": [
    {
      "table": "表名",
      "table_name": "表名 (别名)",
      "expected_rows": 15234,
      "expected_row_count": 15234,
      "actual_rows": 15234,
      "actual_row_count": 15234,
      "checksum_match": true,
      "checksum_ok": true
    }
  ]
}
```

## 数据库表结构

工具使用 SQLite 数据库，包含以下表：

### backup_tasks（备份演练任务）
- id: 主键
- task_name: 任务名称
- created_at: 创建时间
- status: 状态 (pending/running/passed/failed)
- summary: 摘要
- conclusion: 结论

### pg_dump_logs（pg_dump 日志）
- id: 主键
- task_id: 关联任务 ID
- file_path: 文件路径
- database_name: 数据库名
- dump_start_time: 备份开始时间
- dump_end_time: 备份结束时间
- total_size_bytes: 总大小
- table_count: 表数量
- raw_content: 原始内容

### object_storage_manifests（对象存储 manifest）
- id: 主键
- task_id: 关联任务 ID
- file_path: 文件路径
- bucket_name: Bucket 名
- manifest_date: Manifest 日期
- total_shards: 期望分片数
- total_size_bytes: 总大小
- raw_content: 原始内容

### object_storage_shards（对象存储分片）
- id: 主键
- manifest_id: 关联 manifest ID
- shard_name: 分片名
- shard_size_bytes: 分片大小
- checksum: 校验和
- upload_time: 上传时间

### restore_results（还原演练结果）
- id: 主键
- task_id: 关联任务 ID
- file_path: 文件路径
- restore_start_time: 还原开始时间
- restore_end_time: 还原结束时间
- restored_database_name: 还原的数据库名
- restored_version: 还原的版本
- table_count_restored: 还原的表数量
- row_count_restored: 还原的行数
- raw_content: 原始内容

### spot_checked_tables（抽查的表）
- id: 主键
- restore_result_id: 关联还原结果 ID
- table_name: 表名
- expected_row_count: 期望行数
- actual_row_count: 实际行数
- checksum_match: 校验和是否匹配

### duty_notes（值班备注）
- id: 主键
- task_id: 关联任务 ID
- note_text: 备注内容
- created_at: 创建时间
- created_by: 创建者

### check_results（检查结果）
- id: 主键
- task_id: 关联任务 ID
- check_time: 检查时间
- check_type: 检查类型 (storage/dump/restore/error)
- check_name: 检查名称
- status: 状态 (pass/warn/fail)
- message: 消息
- details: 详细信息 (JSON)
- risk_level: 风险等级 (low/medium/high)
- reviewed: 是否已复核
- review_note: 复核备注

## 常见问题

### Q1: 如何添加自定义检查项？

可以修改 `src/backup_checker/checker.py` 文件中的 `BackupChecker` 类，添加新的检查方法，然后在 `run_all_checks` 方法中调用。

### Q2: 如何支持其他数据库的备份？

当前工具主要针对 PostgreSQL (pg_dump)，但可以通过扩展 `parse_pg_dump_log` 方法来支持其他数据库的备份日志格式。

### Q3: 数据存储在哪里？

所有数据存储在 SQLite 数据库文件 `backup_check.db` 中（默认位置），可以通过 `--db` 参数指定其他路径。

### Q4: 如何与现有的自动化系统集成？

可以使用 API 接口：
1. 创建任务
2. 导入数据（通过 API 或直接操作数据库）
3. 执行检查
4. 获取检查结果
5. 导出报告

### Q5: 检查结果中的"待复核"是什么意思？

"待复核"表示该检查项还没有经过值班人员的人工确认。在 Web 界面中，可以标记检查项为"已复核"，并添加复核备注，这样导出的报告会包含复核信息，便于审计追踪。

## 最佳实践

1. **每次发布前执行**：建议在每次发布前都执行备份演练核对
2. **使用样例数据测试**：先用 `examples/` 目录下的有问题数据测试工具是否正常工作
3. **及时复核问题**：发现问题后及时在 Web 界面中标记复核状态和添加备注
4. **导出完整报告**：导出包含复核信息的 Markdown 报告和 JSON 审计包存档
5. **定期清理数据库**：可以定期备份或清理旧的任务数据

## 许可证

本工具仅供内部使用。
