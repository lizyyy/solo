# 公益书库志愿者图书管理 CLI

一个轻量级的 CLI 工具，用于公益书库志愿者管理图书入库流程。

## 功能特点

- 📦 扫码 CSV 导入
- 📝 人工备注 Markdown 导入
- ✅ 数据校验与异常记录
- 🔍 多维度筛选（负责人、时间、状态、异常类型）
- 📊 导出报告
- 💾 持久化存储

## 快速开始

### 1. 安装依赖

```bash
npm install
npm run build
npm link
```

### 2. 导入扫码数据

```bash
# 导入 CSV 扫码数据
booklib csv examples/sample_scan.csv --volunteer 张三

# 导入 Markdown 人工备注
booklib md examples/sample_manual.md --volunteer 李四

# 查看导入结果
booklib list
```

### 3. 复核数据

```bash
# 查看待复核记录
booklib list --status pending

# 复核通过
booklib approve 1

# 复核拒绝并备注
booklib reject 2 --reason "ISBN 格式错误"
```

### 4. 导出报告

```bash
# 导出所有书籍记录
booklib export report.csv

# 导出异常记录
booklib export errors.csv --errors

# 按负责人筛选导出
booklib export report.csv --volunteer 张三

# 按状态筛选导出
booklib export report.csv --status pending
```

## 数据格式

### CSV 扫码数据格式

| 字段 | 说明 | 示例 |
|------|------|------|
| isbn | ISBN 编码 | 9787111544937 |
| title | 书名 | 深入理解计算机系统 |
| condition | 品相（全新/九成新/八成新/七成新/其他） | 九成新 |
| grade | 适用年级 | 高中 |
| donor | 捐赠人 | 李四 |
| scanned_at | 扫码时间 | 2024-01-15 10:30:00 |

### Markdown 人工备注格式

```markdown
## 2024-01-15 张三

### 新增图书
- ISBN: 9787111544937
- 书名: 深入理解计算机系统
- 品相: 九成新
- 年级: 高中
- 备注: 封面略有折痕
```

## 样例数据

项目包含以下样例数据：
- `examples/sample_scan.csv` - 正常扫码数据
- `examples/sample_scan_with_errors.csv` - 包含异常的扫码数据
- `examples/sample_manual.md` - 人工备注数据

## 常用命令

```bash
# 查看帮助
booklib --help

# 查看所有书籍记录
booklib list

# 按状态筛选
booklib list --status pending

# 按负责人筛选
booklib list --volunteer 张三

# 查看异常记录
booklib errors

# 按异常类型筛选
booklib errors --type invalid_isbn

# 查看统计信息
booklib stats
```
