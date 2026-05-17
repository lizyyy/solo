# CI Cache Analyzer

CI 缓存命中分析 CLI 工具，帮助团队快速定位构建缓存失效问题。

## 功能特性

- 📊 **多格式输出**: 终端摘要、机器可读 JSON、美观的 Markdown 报告
- 🔍 **智能解析**: 自动识别 GitHub Actions, GitLab CI, CircleCI 等日志格式
- 📈 **阶段聚合**: 按构建阶段统计缓存命中情况
- ⏱️ **耗时归因**: 分析缓存未命中带来的额外时间开销
- 🔑 **缓存键对比**: 检测缓存键变化，找出失效原因
- ⚠️ **异常保留**: 坏行保留原始位置和原因，便于排查
- 💡 **优化建议**: 智能提供缓存优化建议
- 🎯 **清晰退出码**: 便于 CI 流程集成

## 退出码说明

| 码值 | 含义 |
|------|------|
| 0 | 成功，缓存命中率高 |
| 1 | 解析错误，存在无法解析的日志行 |
| 2 | 分析警告，缓存命中率低于 50% |
| 3 | 输出错误，写入文件失败 |

## 安装

```bash
npm install
npm run build
npm link
```

## 使用方法

### 基础用法

```bash
# 分析构建日志并在终端显示结果
ci-cache-analyzer ./examples/sample-build.log
```

### 生成报告

```bash
# 同时生成 JSON 和 Markdown 报告
ci-cache-analyzer ./examples/sample-build.log --json --markdown

# 指定输出目录
ci-cache-analyzer ./examples/sample-build.log -j -m -o ./reports
```

### 高级选项

```bash
# 指定日志格式
ci-cache-analyzer build.log --format github-actions

# 静默模式（只输出结果文件，不显示终端摘要）
ci-cache-analyzer build.log --quiet --json

# 详细输出模式
ci-cache-analyzer build.log --verbose

# 查看帮助
ci-cache-analyzer --help
```

## 支持的 CI 平台

- GitHub Actions
- GitLab CI
- CircleCI
- 自动检测模式 (auto)

## 开发

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 运行测试
npm test

# 开发模式运行
npm run dev -- examples/sample-build.log
```

## 项目结构

```
.
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── index.ts            # 模块导出
│   ├── types.ts            # 类型定义
│   ├── constants.ts        # 常量配置
│   ├── parser.ts           # 日志解析器
│   ├── aggregator.ts       # 阶段聚合和缓存键对比
│   ├── analyzer.ts         # 分析引擎和耗时归因
│   └── output/
│       ├── terminal.ts     # 终端摘要输出
│       ├── json.ts         # JSON 输出
│       └── markdown.ts     # Markdown 报告输出
├── examples/
│   └── sample-build.log    # 示例日志文件
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 许可证

MIT
