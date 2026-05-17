# Nginx 证书引用扫描工具

一个用于扫描 Nginx 配置中的证书引用、检查证书过期状态的命令行工具。

## 功能特性

- 🔍 **配置解析**: 递归扫描 Nginx 配置目录，解析所有 server 块
- 📦 **域名归并**: 自动合并相同域名的多个配置引用
- 📜 **证书读取**: 解析 SSL 证书内容，提取有效期和域名信息
- ⏰ **过期检查**: 检查证书是否即将过期（7天/30天预警）
- 📋 **缺失检测**: 检测缺少证书或密钥引用的配置
- 📊 **多格式报告**: 生成终端摘要、JSON、Markdown 报告
- 📁 **可重复运行**: 每次运行生成独立时间戳的报告，不覆盖旧结果

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基本使用

```bash
# 使用默认配置
npm run start

# 或编译后直接运行
node dist/cli.js
```

### 指定输入输出目录

```bash
node dist/cli.js -i /path/to/nginx -o /path/to/reports
```

### 选项说明

```
-i, --input <dir>    Nginx 配置目录路径 (默认: /etc/nginx)
-o, --output <dir>   报告输出目录 (默认: ./nginx-cert-reports)
--no-console        不输出控制台摘要
--no-json           不生成 JSON 报告
--no-markdown       不生成 Markdown 报告
-V, --version       输出版本号
-h, --help          显示帮助信息
```

### 示例

```bash
# 完整扫描，生成所有报告
node dist/cli.js -i /etc/nginx -o ~/cert-reports

# 只生成 JSON 报告，不输出控制台
node dist/cli.js --no-console --no-markdown

# 只输出控制台摘要，不生成文件
node dist/cli.js --no-json --no-markdown
```

## 输出文件

每次扫描会在输出目录生成以下文件（带时间戳）：

- `cert-report-YYYY-MM-DDTHH-MM-SS.json` - 机器可读的完整数据
- `cert-report-YYYY-MM-DDTHH-MM-SS.md` - 适合同事查看的 Markdown 报告

## 报告内容

### 扫描统计
- Server 块数量
- 域名数量
- 证书数量
- 已过期/即将过期证书数量
- 缺失证书引用数量
- 解析错误数量

### 缺失证书引用
列出所有缺少证书或密钥引用的域名和配置位置。

### 解析错误
记录所有解析失败的配置文件、行号和错误原因。

### 域名证书详情
按过期时间排序显示每个域名的：
- 证书路径
- 密钥路径
- 过期时间
- 剩余天数（带状态标记）
- 所有引用位置

## 依赖要求

- Node.js >= 14.0.0
- OpenSSL (用于解析证书内容)

## 项目结构

```
├── src/
│   ├── types.ts          # 类型定义
│   ├── nginx-parser.ts   # Nginx 配置解析器
│   ├── cert-checker.ts   # 证书读取和检查
│   ├── domain-merger.ts  # 域名归并和缺失检测
│   ├── report-generator.ts # 报告生成
│   └── cli.ts            # CLI 入口
├── dist/                 # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 监听模式编译
npm run dev

# 编译
npm run build

# 运行
npm run start
```

## 注意事项

1. 本工具仅读取配置文件和证书文件，**不会修改任何文件**
2. 需要读取 Nginx 配置目录的权限
3. 需要读取证书文件的权限
4. 建议定期运行检查，提前发现即将过期的证书

## License

MIT
