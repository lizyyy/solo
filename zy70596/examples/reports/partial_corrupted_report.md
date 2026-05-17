# SQLite备份一致性检查报告

> 生成时间: 2026年05月17日 13:55:15

## 一、概述

**整体状态**: ❌ 检查未通过

- 数据库文件: partial_corrupted.db
- 文件总页数: 6 页
- 有效页面数: 3 页
- WAL文件: 未提供

## 二、文件信息

### 数据库文件

- **路径**: `examples/partial_corrupted.db`
- **存在**: 是
- **大小**: 24.00 KB
- **SHA256**: `9bd160c5b21b4666a22f4dd737a8b9f7ba0eb16d4258f5de368ec081f2cd4715`
- **修改时间**: 2026-05-17 13:54:34

## 三、错误信息

### 1. Integrity Error

- **消息**: SQLite完整性检查失败: *** in database main ***
Tree 2 page 2: btreeInitPage() returns error code 11
Page 4: never used
Page 5: never used
- **位置**: `examples/partial_corrupted.db`

## 五、页面校验详情

- **页面大小**: 4096 字节
- **总页数**: 6 页
- **有效页数**: 3 页
- **校验合格率**: 50.0%

### 损坏页面列表 (共 3 页)

| 页面编号 | 文件偏移 | 位置 | 状态 | 原因 |
|---------|---------|------|------|------|
| 2 | 0x1000 | `examples/partial_corrupted.db:0x1000` | ❌ 损坏 | 无效的页面类型标记: 0xff |
| 4 | 0x3000 | `examples/partial_corrupted.db:0x3000` | ❌ 损坏 | 无效的页面类型标记: 0xff |
| 5 | 0x4000 | `examples/partial_corrupted.db:0x4000` | ❌ 损坏 | 无效的页面类型标记: 0xff |

## 六、检查说明

本工具执行以下检查:

1. **文件头验证** - 确认文件是有效的SQLite格式
2. **页级哈希校验** - 逐页验证校验和，记录损坏页面的位置和原因
3. **SQLite完整性检查** - 使用 `PRAGMA integrity_check` 执行深度检查
4. **WAL文件配对** - 检测并验证WAL文件是否存在

## 七、建议

- ⚠️ **重要**: 缺少WAL文件。SQLite在活跃时会将事务写入WAL文件，
  恢复时必须同时提供 `.db` 和 `.db-wal` 文件才能保证数据完整。

- ❌ 存在致命错误，数据库可能无法正常打开
- 请尝试寻找其他备份版本
- 可以尝试使用 `.dump` 命令恢复部分数据

- 参考SQLite官方文档: https://www.sqlite.org/howtocorrupt.html

---
*此报告由 sqlite-backup-checker 工具自动生成*