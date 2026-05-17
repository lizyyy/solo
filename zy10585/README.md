# PermGuard - 目录权限模板CLI

一个用于目录权限扫描、模板匹配和批量修复的命令行工具。

## 功能特性

- **目录扫描**: 递归扫描目录及其文件的权限
- **模板匹配**: 基于权限模板对比实际权限
- **权限对比**: 检测权限模式、属主、属组不匹配
- **修复预览**: 预览将要进行的修改再应用
- **多格式输出**: 终端摘要、机器可读JSON、人类可读报告
- **坏输入处理**: 保留坏记录的原始位置和原因，不中断执行

## 退出码说明

- `0`: 全部通过，无问题
- `1`: 执行错误
- `2`: 存在权限问题或坏输入记录

## 编译

```bash
cargo build --release
```

## 使用方法

### 1. 扫描目录权限

```bash
# 使用内置模板扫描
./target/release/permguard scan --path /path/to/dir --template default

# 使用CSV模板文件
./target/release/permguard scan --path /path/to/dir --template webroot --template-csv templates.csv

# 输出JSON和报告
./target/release/permguard scan --path /path/to/dir --template default \
  --json-output result.json --report-output report.txt
```

### 2. 修复权限

```bash
# 预览修复
./target/release/permguard repair --path /path/to/dir --template default

# 应用修复
./target/release/permguard repair --path /path/to/dir --template default --apply
```

### 3. 查看模板信息

```bash
./target/release/permguard template --list
```

## 内置模板

| 模板名    | 目录权限 | 文件权限 | 说明                          |
|----------|---------|---------|-------------------------------|
| default  | 0o755   | 0o644   | 默认权限，用户可读写，其他可读 |
| strict   | 0o700   | 0o600   | 严格权限，仅用户可读写        |
| shared   | 0o775   | 0o664   | 共享权限，用户组可读写        |

## CSV模板格式

```csv
name,dir_mode,owner,group,file_mode,recursive
webroot,755,www-data,www-data,644,true
appdata,750,appuser,appgroup,640,true
```

## 测试

```bash
# 测试正常输入和脏输入
cargo test
```
