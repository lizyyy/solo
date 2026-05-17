# OAuth回调地址校验CLI工具

一个用于检查OAuth应用回调地址配置是否正确的命令行工具，适合放入CI/CD流程或本地巡检使用。

## 功能特性

- ✅ **URL归一化检查** - 自动处理协议、主机、端口、路径、参数的标准化比较
- 🔄 **多环境对比** - 自动发现不同环境之间的回调地址差异
- 🔍 **参数校验** - 检查授权链接的必需参数是否完整
- 🎯 **错误归因** - 自动分析redirect_uri_mismatch等错误并给出具体建议
- 📊 **多种报告** - 终端摘要、机器可读JSON、适合分享的HTML报告
- 📁 **异常追踪** - 保留坏行或异常样本的原始位置和原因

## 安装

```bash
npm install
```

## 使用方法

### 1. 校验配置文件

```bash
# 基本用法
node src/cli.js validate -c examples/oauth-config.json

# 生成HTML报告
node src/cli.js validate -c examples/oauth-config.json --report

# 指定错误样本文件进行匹配
node src/cli.js validate -c examples/oauth-config.json -s examples/error-samples.json

# 只校验特定环境
node src/cli.js validate -c examples/oauth-config.json -e production

# 输出JSON格式结果
node src/cli.js validate -c examples/oauth-config.json --json

# 指定输出目录
node src/cli.js validate -c examples/oauth-config.json -o ./my-reports
```

### 2. URL归一化工具

```bash
# 归一化单个URL
node src/cli.js normalize "https://Example.com:443/callback?b=2&a=1"

# 对比两个URL是否等价
node src/cli.js normalize "http://example.com/callback/" "https://example.com/callback"
```

## 配置文件格式

```json
{
  "applications": [
    {
      "appId": "web-app-001",
      "name": "用户中心Web应用",
      "environments": [
        {
          "name": "production",
          "authorizedRedirectUris": [
            "https://example.com/auth/callback",
            "https://example.com/callback"
          ],
          "authUrl": "https://auth.example.com/authorize?client_id=xxx&redirect_uri=..."
        }
      ]
    }
  ]
}
```

## 报告输出

### 终端摘要
- 概览统计（应用总数、通过、失败、错误数、警告数）
- 错误分类统计
- 每个应用每个环境的问题摘要
- 错误样本匹配结果

### JSON报告
- 完整的校验结果数据
- 包含所有问题详情和建议
- 适合机器处理或进一步分析

### HTML报告
- 美观的可视化报告
- 详细的问题描述和修复建议
- 环境差异对比
- 错误样本匹配详情
- 适合发送给团队成员

## 在CI/CD中使用

```yaml
# GitHub Actions 示例
- name: 校验OAuth回调配置
  run: |
    npm install
    node src/cli.js validate -c config/oauth-config.json --report
  continue-on-error: false
```

## 常见问题

### Q: 什么是URL归一化？
A: URL归一化会处理以下情况：
- 协议标准化（HTTP → http）
- 主机名小写
- 移除默认端口（http的80，https的443）
- 规范化路径（移除末尾斜杠、处理重复斜杠）
- 查询参数排序

### Q: 工具能检测哪些问题？
A: 可以检测：
- 无效的URL格式
- 生产环境使用HTTP而非HTTPS
- 授权链接缺少必需参数
- 授权链接中的redirect_uri不在白名单中
- URL包含不必要的hash片段
- 不同环境的配置差异

### Q: 错误样本如何匹配？
A: 工具会将错误样本中的URL与配置的回调地址进行归一化对比，找出最相似的配置并计算匹配置信度，帮助快速定位问题。

## 项目结构

```
.
├── src/
│   ├── cli.js           # CLI入口文件
│   ├── urlNormalizer.js # URL归一化核心逻辑
│   ├── validator.js     # 配置校验和错误归因
│   └── reporter.js      # 报告生成器
├── examples/
│   ├── oauth-config.json   # 示例配置文件
│   └── error-samples.json  # 示例错误样本
├── reports/             # 报告输出目录（自动创建）
└── package.json
```
