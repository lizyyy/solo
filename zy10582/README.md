# 📦 前端包体来源分析CLI工具

一个简单易用的前端构建产物分析工具，帮助你识别包体积的来源，优化应用性能。

## ✨ 功能特性

- **产物扫描**: 自动发现构建产物（JS文件、SourceMap等）
- **模块归因**: 将模块归属到对应的依赖包
- **依赖聚合**: 按依赖包聚合统计体积
- **历史对比**: 与上次分析结果对比，发现体积变化
- **多格式报告**: 终端摘要、JSON机器可读格式、HTML可视化报告

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 运行分析

```bash
# 分析当前目录
node bin/bundle-analyze.js

# 指定输入目录（构建产物所在目录）
node bin/bundle-analyze.js -i ./dist

# 指定输出目录（报告保存位置）
node bin/bundle-analyze.js -o ./my-report

# 不保存历史记录
node bin/bundle-analyze.js --no-history

# 自定义文件匹配模式
node bin/bundle-analyze.js --pattern "**/*.js" --exclude "**/vendor.js"
```

## 📁 目录结构

```
.
├── bin/
│   └── bundle-analyze.js     # CLI入口文件
├── src/
│   ├── config.js             # 配置文件
│   ├── utils.js              # 工具函数
│   ├── scanner.js            # 产物扫描器
│   ├── analyzer.js           # 分析器
│   ├── history.js            # 历史记录管理
│   ├── reporter.js           # 报告生成器
│   └── index.js              # 主入口
├── package.json
└── README.md
```

## 📊 报告说明

### 终端报告

运行命令后会在终端显示：
- 总体统计（Chunks数、模块数、总大小等）
- 最大Chunks排名
- 依赖包体积排名
- 历史对比（新增/移除/变化的依赖）
- 异常记录（如有）

### JSON报告

保存在 `bundle-report/*.json`，包含完整的分析数据，便于后续处理和集成到CI/CD流程。

### HTML报告

保存在 `bundle-report/*.html`，提供可视化的分析报告，方便分享给团队成员查看。

## 🔧 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input <dir>` | 输入目录（构建产物所在目录） | 当前目录 |
| `-o, --output <dir>` | 输出目录（报告保存位置） | `./bundle-report` |
| `--no-gzip` | 不计算Gzip大小 | - |
| `--no-history` | 不保存历史记录 | - |
| `--history-limit <number>` | 历史记录保留数量 | 10 |
| `--pattern <patterns...>` | 自定义文件匹配模式 | `["**/dist/**/*.js","**/build/**/*.js","**/*.js.map"]` |
| `--exclude <patterns...>` | 排除文件模式 | - |

## 🎯 使用场景

1. **发现体积膨胀**: 定期运行分析，及时发现意外增大的依赖
2. **优化决策**: 根据体积排名，决定优先优化哪些依赖
3. **CI集成**: 集成到CI流程，防止代码提交导致体积异常增长
4. **团队协作**: 生成HTML报告分享给团队，共同关注包体积问题

## 📝 License

MIT
