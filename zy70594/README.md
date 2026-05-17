# CDN 访问日志样本抽样工具

一个用于从大型 CDN 访问日志中抽取代表性样本的命令行工具，适合用于 CI/CD 流水线或本地巡检。

## 核心特性

- 🚀 **流式处理**: 支持 TB 级大文件，内存占用极低
- 🎯 **分层抽样**: 按状态码、地区、资源类型等维度分层，确保样本代表性
- 🔍 **去重保留**: 自动识别并标记重复请求
- 📊 **多格式输出**: 终端彩色摘要、JSON 机器可读、Markdown 报告
- 🐛 **异常追踪**: 记录坏行和异常样本的原始位置和原因
- 🔌 **灵活过滤**: 支持按状态码、地区、资源类型过滤

## 安装

```bash
npm install
npm link  # 全局安装命令
```

## 快速开始

### 基本用法

```bash
# 使用默认参数处理 nginx 日志
cdn-sampler access.log

# 只抽取 4xx/5xx 错误状态码
cdn-sampler access.log -c 404,500,502,503

# 指定地区和资源类型
cdn-sampler access.log -r CN,US,EU -t html,js,css,image
```

### 命令行选项

```
选项:
  -f, --format <format>     日志格式: nginx, aliyun, cloudfront, json (默认: "nginx")
  -s, --sample-size <number>  目标样本数量 (默认: "1000")
  -o, --output-dir <dir>    输出目录 (默认: 当前目录)
  -n, --output-name <name>   输出文件名前缀 (默认: "cdn-sample-report")
  -c, --status-codes <codes>  过滤状态码，逗号分隔
  -r, --regions <regions>    过滤地区，逗号分隔
  -t, --resource-types <types>  过滤资源类型，逗号分隔
  --min-per-stratum <number>  每层最小样本数 (默认: "5")
  --max-per-stratum <number>  每层最大样本数 (默认: "100")
  --strata-fields <fields>   分层字段，逗号分隔 (默认: "status,region,resourceType")
  --dedupe-fields <fields>   去重字段，逗号分隔 (默认: "url,status,ip")
  --seed <string>            随机种子
  --fields <fields>          自定义字段列表（自定义格式用）
  --pattern <regex>          自定义日志匹配正则表达式
  --no-progress              不显示进度条
  --no-terminal              不输出终端摘要
  --no-raw                   不包含原始日志行
```

### 查看支持的日志格式

```bash
cdn-sampler formats
```

## 输出文件

工具会生成以下文件：

1. **cdn-sample-report.json**: 完整的机器可读报告，包含所有样本和异常记录
2. **cdn-sample-report.md**: 适合发给同事查看的 Markdown 格式报告

## 输出示例

### 终端摘要

```
============================================================
CDN 访问日志抽样报告 - 摘要
============================================================

📊 处理统计:
  总行数: 150,000
  有效行数: 149,850
  抽样数量: 1,000
  抽样比例: 0.67%
  分层数量: 45
  异常行数: 150
  重复行数: 1,200

📈 状态码分布:
  200  ████████████████████████   850 (85.0%)
  404  ███                        100 (10.0%)
  500  █                           30 (3.0%)
  ...

🌍 地区分布:
  CN   ███████████████             500 (50.0%)
  US   ████████                    250 (25.0%)
  EU   █████                       150 (15.0%)
  ...

📄 报告文件已生成:
  JSON: /path/to/cdn-sample-report.json
  Markdown: /path/to/cdn-sample-report.md
```

## 使用场景

### CI/CD 流水线集成

```yaml
# .github/workflows/cdn-log-analysis.yml
name: CDN Log Analysis
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Download CDN logs
        run: aws s3 cp s3://my-cdn-logs/access.log .
      - name: Sample logs
        run: |
          cdn-sampler access.log \
            -c 404,500,502,503 \
            -s 2000 \
            --no-progress
      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: cdn-sample-reports
          path: cdn-sample-report.*
```

### 本地巡检

```bash
# 抽取错误样本快速排障
cdn-sampler /var/log/nginx/access.log \
  -c 403,404,500,502,503 \
  -s 500 \
  -o ./reports

# 分析特定地区的慢请求
cdn-sampler /var/log/nginx/access.log \
  -r CN,JP,KR \
  -s 1000
```

## API 编程接口

```javascript
const { CDNSampler, run } = require('cdn-log-sampler');

// 程序化调用
async function analyze() {
  const sampler = new CDNSampler({
    input: '/path/to/access.log',
    format: 'nginx',
    sampleSize: 1000,
    statusCodes: [404, 500]
  });
  
  const result = await sampler.processFile();
  console.log(`抽样数量: ${result.summary.totalSampled}`);
  
  // 导出报告
  await sampler.generateReports(result);
}
```

## 项目结构

```
.
├── bin/
│   └── cdn-sampler.js      # CLI 入口
├── src/
│   ├── index.js            # 主入口和 API
│   ├── log-parser.js       # 日志解析器
│   ├── sampling-engine.js  # 抽样引擎
│   └── report-generator.js # 报告生成器
├── data/
│   └── sample-nginx.log    # 示例数据
├── tests/
│   └── sampler.test.js     # 测试用例
├── package.json
└── README.md
```

## 运行测试

```bash
npm test
```

## 许可证

MIT
