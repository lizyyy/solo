# Cookie 域审计 CLI

浏览器Cookie域审计工具 - 专门用于排查多个子域共享登录时的Cookie设置问题，帮助检测登录串号等安全风险。

## 功能特性

- ✅ 支持多种Cookie格式解析（JSON、Netscape、HAR文件）
- ✅ 批量目录扫描
- ✅ Domain/Path 匹配冲突检测
- ✅ SameSite 属性安全审计
- ✅ Cookie 过期时间检查
- ✅ 登录串号风险预警
- ✅ 风险分级评估（Critical/High/Medium/Low/Info）
- ✅ 生成 JSON 和 Markdown 双格式报告
- ✅ 重复运行不覆盖旧报告（时间戳命名）

## 安装

```bash
npm install
```

全局安装（可选）：

```bash
npm install -g .
```

## 快速开始

### 审计单个Cookie文件

```bash
# JSON格式
node src/cli.js audit examples/cookies.json

# 或全局安装后
cookie-audit audit examples/cookies.json
```

### 审计整个目录

```bash
node src/cli.js audit examples/
```

### 指定目标域名进行冲突检测

```bash
node src/cli.js audit examples/cookies.json -d example.com app.example.com auth.example.com
```

### 指定报告输出目录

```bash
node src/cli.js audit examples/cookies.json -o ./my-reports
```

## 完整命令参考

### audit - 审计Cookie

```bash
cookie-audit audit <source> [options]
```

**参数:**
- `<source>`: Cookie文件路径或目录路径

**选项:**
- `-d, --domain <domains...>`: 指定目标域名用于冲突检测 (可指定多个)
- `-o, --output <directory>`: 报告输出目录 (默认: `./audit-reports`)
- `--no-color`: 禁用彩色输出

### parse - 仅解析Cookie

```bash
cookie-audit parse <file> [options]
```

**参数:**
- `<file>`: Cookie文件路径

**选项:**
- `-f, --format <format>`: 输出格式: `json`, `table` (默认: `json`)

### list-reports - 列出已生成的报告

```bash
cookie-audit list-reports [options]
```

**选项:**
- `-o, --output <directory>`: 报告目录 (默认: `./audit-reports`)

## 输入格式

### 1. JSON 格式

```json
[
  {
    "name": "session_id",
    "value": "abc123",
    "domain": ".example.com",
    "path": "/",
    "secure": true,
    "httpOnly": true,
    "sameSite": "Lax",
    "expires": 1893456000000
  }
]
```

### 2. Netscape 格式 (curl cookies.txt)

```
# Netscape HTTP Cookie File
.example.com	TRUE	/	TRUE	1893456000	session_id	abc123
app.example.com	FALSE	/	FALSE	1893456000	session_id	def456
```

### 3. HAR 格式

支持标准HAR文件中的Cookie数据提取。

## 风险等级说明

| 等级 | 颜色 | 说明 |
|------|------|------|
| 🔴 Critical | 红色 | 严重安全问题，必须立即修复 |
| 🟠 High | 橙色 | 高优先级，可能导致安全问题 |
| 🟡 Medium | 黄色 | 中优先级，建议修复 |
| 🟢 Low | 绿色 | 低优先级，最佳实践建议 |
| 🔵 Info | 蓝色 | 信息性提示，无需修复 |

## 检测项

1. **Domain 冲突检测** - 同名Cookie跨多个域存在
2. **Path 冲突检测** - 同名Cookie跨多个路径存在
3. **SameSite 审计** - SameSite=None 必须配合 Secure
4. **Secure 属性** - 建议HTTPS环境下启用
5. **HttpOnly 属性** - 防止XSS窃取
6. **过期时间检查** - 检测已过期的Cookie
7. **会话Cookie识别** - 识别无过期时间的会话Cookie

## 失败时的返回表现

- 解析错误: 显示具体错误信息和文件位置
- 文件不存在: 显示"文件不存在"错误
- 权限问题: 显示权限相关错误
- 存在 Critical/High 风险: 进程退出码为 `1`（可用于CI/CD集成）

## 报告输出

每次审计生成两个报告文件：

1. **JSON 报告** - `cookie-audit-YYYY-MM-DD_HH-MM-SS.json`
   - 完整的机器可读数据
   - 包含所有审计细节
   - 适合自动化处理

2. **Markdown 报告** - `cookie-audit-YYYY-MM-DD_HH-MM-SS.md`
   - 人类友好的格式化报告
   - 包含冲突分析表格
   - 适合文档归档

## 项目结构

```
cookie-audit/
├── src/
│   ├── cli.js          # 命令行入口
│   ├── parser.js       # Cookie解析器
│   ├── auditor.js      # 审计逻辑
│   └── reporter.js     # 报告生成
├── examples/
│   ├── cookies.json    # 示例JSON格式
│   └── cookies.txt     # 示例Netscape格式
├── audit-reports/      # 报告输出目录 (自动创建)
├── package.json
└── README.md
```

## 使用示例

### 基础审计

```bash
$ node src/cli.js audit examples/cookies.json

═══════════════════════════════════════════
           Cookie 域审计报告
═══════════════════════════════════════════

📊 统计摘要:

  总计 Cookie: 5
  正常 Cookie: 1
  异常 Cookie: 0

⚠️  风险统计:

  🔴 严重: 1
  🟠 高: 1
  🟡 中: 3
  🟢 低: 0
  🔵 信息: 3

📄 报告文件:

  JSON: ./audit-reports/cookie-audit-2024-01-15_10-30-45.json
  Markdown: ./audit-reports/cookie-audit-2024-01-15_10-30-45.md

═══════════════════════════════════════════
```

### 带域名检测的审计

```bash
$ node src/cli.js audit examples/ -d example.com app.example.com auth.example.com
```

### 仅解析查看

```bash
$ node src/cli.js parse examples/cookies.json -f table
```

## 常见问题

**Q: 如何从浏览器导出Cookie？**

A: 可以使用浏览器扩展如 "EditThisCookie" 或开发工具的Application面板导出，保存为JSON或Netscape格式。

**Q: 报告保存在哪里？**

A: 默认在 `./audit-reports` 目录，使用时间戳命名，不会覆盖旧报告。

**Q: 支持哪些Cookie格式？**

A: 支持 JSON 数组、Netscape cookies.txt (curl格式)、HAR 文件。

## License

MIT
