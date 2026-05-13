# 证书到期批量盘点 CLI (cert-audit)

一个功能完善的命令行工具，用于管理和监控 SSL 证书、域名、供应商资质和员工证书的到期状态，帮助企业避免因证书过期而导致的服务中断。

## ✨ 功能特性

- **多源清单导入**：支持 CSV、Excel、JSON 格式文件导入
- **到期窗口管理**：支持自定义到期预警窗口（7天、14天、30天、90天等）
- **责任人映射**：为每个证书关联责任人和部门信息
- **重复证书合并**：智能检测并合并重复证书（基于指纹、序列号、名称+域名）
- **提醒导出**：生成美观的 HTML 报告，支持 CSV、JSON 格式
- **操作历史**：完整的操作审计日志
- **异常输入处理**：详细的错误信息和提示
- **重复执行保护**：智能检测重复操作并给出建议

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 全局安装（可选）

```bash
npm install -g .
```

### 4. 初始化系统

```bash
# 首次使用需要初始化
cert-audit init

# 如果已有数据，强制重新初始化
cert-audit init --force
```

### 5. 导入数据

```bash
# 导入 CSV 文件
cert-audit import examples/sample-certificates.csv --source "示例数据"

# 导入 JSON 文件
cert-audit import examples/sample-certificates.json

# 试运行，检查数据有效性
cert-audit import examples/sample-certificates.csv --dry-run

# 使用自定义字段映射
cert-audit import data.csv --mapping '{"name":"证书名称","expiryDate":"到期时间"}'
```

### 6. 检查状态

```bash
# 基本检查
cert-audit check

# 自动合并重复证书
cert-audit check --merge

# 自动修复状态
cert-audit check --fix

# 检查并修复所有问题
cert-audit check --merge --fix
```

### 7. 生成报告

```bash
# 生成默认 HTML 报告
cert-audit report

# 生成 CSV 报告
cert-audit report --format csv

# 生成 JSON 报告
cert-audit report --format json

# 指定到期窗口
cert-audit report --windows 7,14,30,90

# 包含已过期证书
cert-audit report --include-expired

# 指定输出路径
cert-audit report --output ./my-reports/
```

### 8. 查看历史

```bash
# 查看最近100条记录
cert-audit history

# 查看特定证书的历史
cert-audit history --certificate-id <cert-id>

# 查看最近7天的操作
cert-audit history --days 7

# 查看导入操作历史
cert-audit history --action IMPORT
```

## 📦 证书类型

| 类型 | 描述 |
|------|------|
| SSL | SSL/TLS 证书 |
| DOMAIN | 域名 |
| VENDOR | 供应商资质 |
| EMPLOYEE | 员工证书 |

## 📁 数据目录

默认数据目录：`~/.cert-audit/`

可以通过环境变量自定义：
```bash
export CERT_AUDIT_DATA_DIR=/path/to/custom/dir
```

目录结构：
```
~/.cert-audit/
├── certificates.db      # SQLite 数据库
├── reports/             # 生成的报告
│   └── certificate_report_20260509_120000.html
└── history.log          # 操作日志
```

## 🔧 配置说明

### 导入字段映射

导入时可以通过 `--mapping` 参数自定义字段映射：

```json
{
  "name": "证书名称",
  "type": "证书类型",
  "domain": "域名",
  "issuer": "颁发者",
  "issueDate": "颁发日期",
  "expiryDate": "到期日期",
  "serialNumber": "序列号",
  "fingerprint": "指纹",
  "description": "描述",
  "ownerName": "责任人",
  "ownerEmail": "责任人邮箱",
  "department": "部门"
}
```

### 状态定义

- **ACTIVE**：正常状态（超过30天到期）
- **EXPIRING**：即将到期（30天内）
- **EXPIRED**：已过期
- **MERGED**：已合并（重复证书）

## 🚨 问题检查

`check` 命令会检查以下问题：

1. **已过期证书**（严重）- 需要立即处理
2. **即将到期证书**（高危/中危）- 30天内到期
3. **重复证书**（中危/低危）- 基于指纹、序列号或名称检测
4. **缺少责任人**（低危）- 未分配责任人的证书

## 📊 报告格式

### HTML 报告
- 美观的统计概览
- 分类的到期提醒
- 完整的证书明细表格
- 支持浏览器直接打开

### CSV 报告
- 适合导入 Excel 或其他工具
- 包含所有字段信息

### JSON 报告
- 适合程序化处理
- 包含详细的统计和证书信息

## 🛠️ 开发

```bash
# 开发模式运行
npm run dev -- --help

# 类型检查
npm run typecheck

# 构建
npm run build

# 运行构建版本
npm start -- --help
```

## 💡 使用示例

### 日常工作流

```bash
# 1. 初始化（首次）
cert-audit init

# 2. 从各供应商导入证书
cert-audit import ssl-provider.csv --source "SSL供应商"
cert-audit import domain-registrar.csv --source "域名注册商"
cert-audit import vendor-qualification.xlsx --source "供应商资质"

# 3. 检查问题
cert-audit check

# 4. 合并重复证书
cert-audit check --merge

# 5. 生成报告
cert-audit report

# 6. 每周重复检查
cert-audit check --fix
cert-audit report
```

### 多源数据管理

```bash
# 分别导入不同来源的数据
cert-audit import aws-certificates.csv --source "AWS"
cert-audit import azure-certificates.json --source "Azure"
cert-audit import self-managed.xlsx --source "自行管理"

# 检查时会自动识别跨来源的重复证书
cert-audit check --merge
```

## 🔒 安全

- 所有数据存储在本地 SQLite 数据库
- 不涉及任何外部网络通信
- 支持自定义数据目录，便于加密保护

## 📝 许可证

MIT License
