# Sitemap 链接巡检 CLI

一个功能完整的 Sitemap XML 链接有效性检查工具。

## 功能特性

- ✅ **XML Sitemap 解析** - 支持标准 sitemap.xml 格式，自动处理目录中的多个文件
- 🌐 **HTTP 链接检查** - 检查链接是否可访问，获取 HTTP 状态码
- 🔄 **跳转跟踪** - 自动跟踪 301/302 等重定向，显示完整跳转链
- 📄 **页面标题提取** - 自动提取正常页面的标题
- ❌ **错误样本保留** - 记录坏行的原始位置和原因，包括解析错误和链接错误
- 📊 **多种报告输出**
  - 终端彩色摘要输出
  - 机器可读 JSON 报告
  - 适合同事查看的美观 HTML 报告
- ⚡ **并发控制** - 可配置并发请求数，提高检查效率

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基本用法

```bash
# 检查单个 sitemap 文件
node dist/index.js ./test-sitemap.xml

# 检查整个目录中的所有 sitemap XML 文件
node dist/index.js ./sitemaps/
```

### 高级选项

```bash
# 指定并发数 (默认 5)
node dist/index.js ./sitemap.xml -c 10

# 指定输出目录 (默认 ./audit-results)
node dist/index.js ./sitemap.xml -o ./my-reports

# 只输出终端摘要，不导出报告
node dist/index.js ./sitemap.xml --no-json --no-html
```

### 退出码

- `0` - 所有链接正常，无解析错误
- `1` - 发现异常链接或解析错误

## 报告示例

### 终端输出

```
🚀 Sitemap 链接巡检开始
📁 输入路径: ./test-sitemap.xml
⚡ 并发数: 5

📄 解析 sitemap 文件...
✅ 解析完成，共发现 7 个链接

🌐 开始检查链接...
   进度 |████████████████████████████████████████| 100% | 7/7 链接 | 5.2s

============================================================
           SITEMAP 链接巡检报告
============================================================

📅 巡检时间:
   开始: 2024/1/1 12:00:00
   结束: 2024/1/1 12:00:05
   总耗时: 5.20 秒

📁 源文件:
   - ./test-sitemap.xml

📊 统计摘要:
   总链接数: 7
   平均响应时间: 450 ms

✅ 正常链接:
   4 个 (57.1%)

❌ 异常链接:
   总计: 3 个 (42.9%)
   - 404 不存在: 1 个
   - 跳转链接: 1 个
   - 服务端错误 (5xx): 1 个
   - 客户端错误 (4xx): 0 个

📋 问题链接详情:
   1. [404] https://httpstat.us/404
   2. [301] https://httpstat.us/301
       跳转 1 次 → https://httpstat.us/
   3. [500] https://httpstat.us/500

============================================================

✅ JSON 报告已导出: ./audit-results/sitemap-audit-2024-01-01T12-00-00.json
✅ HTML 报告已导出: ./audit-results/sitemap-audit-2024-01-01T12-00-00.html
```

## 项目结构

```
.
├── src/
│   ├── index.ts           # CLI 入口
│   ├── types.ts           # 类型定义
│   ├── sitemap-parser.ts  # XML Sitemap 解析器
│   ├── http-checker.ts    # HTTP 链接检查器
│   └── report-generator.ts # 报告生成器
├── dist/                  # 编译输出
├── test-sitemap.xml       # 测试用 sitemap
├── test-dirty-sitemap.xml # 脏输入测试文件
├── package.json
└── tsconfig.json
```

## 核心机制

### 1. XML 解析

- 使用 `fast-xml-parser` 解析 XML 文件
- 支持标准的 `<urlset>` 格式
- 检测并报告空的 `<loc>` 标签
- 保留原始行号用于错误定位

### 2. HTTP 检查

- 使用 `node-fetch` 发送请求
- 手动处理重定向 (`redirect: 'manual'`)
- 最大重定向次数: 10 次
- 默认超时: 30 秒
- 自定义 User-Agent 避免被拦截

### 3. 错误处理

- 解析错误: XML 格式错误、空链接、无效标签
- 网络错误: 域名不存在、连接超时、连接被拒绝
- HTTP 错误: 404、4xx、5xx 状态码
- 跳转链过长: 超过最大重定向次数

## 测试

```bash
# 正常输入测试
node dist/index.js ./test-sitemap.xml

# 脏输入测试 (包含格式错误和空链接)
node dist/index.js ./test-dirty-sitemap.xml

# 查看退出码
echo $?
```
