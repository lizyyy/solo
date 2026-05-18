# 权限审计日志临权到期巡检 - 样例目录

本目录包含各种测试场景的样例数据。

## 目录结构

```
examples/
├── normal/          # 正常数据样例
│   ├── audit-log-1.csv
│   └── audit-log-2.csv
├── empty/           # 空目录（无CSV文件）
├── missing-column/  # 缺少必需列的文件
│   └── incomplete.csv
├── duplicate-rows/  # 包含重复行的文件
│   └── duplicates.csv
└── corrupted-file/  # 部分损坏的文件
    └── corrupted.csv
```

## CSV字段说明

| 字段名 | 说明 | 必填 |
|--------|------|------|
| 用户ID | 用户唯一标识 | 是 |
| 用户名 | 用户姓名 | 是 |
| 部门 | 用户所属部门 | 否 |
| 权限令牌 | 权限访问令牌 | 是 |
| 权限到期时间 | 权限有效期截止日期 (YYYY-MM-DD) | 是 |
| 最后访问时间 | 用户最后访问系统时间 | 是 |
| 访问资源 | 用户访问的资源名称 | 否 |
| 权限来源 | 权限获取方式 (直接分配/部门继承/令牌刷新) | 否 |

## 使用示例

```bash
# 扫描正常数据
perm-scan scan examples/normal -d 2026-05-18

# 输出JSON格式
perm-scan scan examples/normal -d 2026-05-18 -f json -o report.json

# 验证单个文件
perm-scan validate examples/normal/audit-log-1.csv

# 对比两次报告差异
perm-scan diff old-report.json new-report.json
```
