# 前端资源404扫描工具 - asset-scan

静态网站发布后发现图片、字体等资源404？构建日志里没有明显提示？用这个工具在发布前扫描一下，把问题消灭在萌芽状态！

## ✨ 功能特点

- 🕵️‍♂️ **深度扫描**：递归扫描构建目录，分析所有HTML文件
- 🎯 **精准检测**：支持HTML和CSS中的资源引用检测
- 📍 **精确定位**：显示缺失资源在源文件中的具体行列位置
- 📊 **多种报告**：终端摘要、JSON机器可读、HTML友好报告
- 🔗 **路径解析**：自动处理相对路径、绝对路径、`../` 等路径归一化
- 🚫 **智能过滤**：自动忽略外部URL、data URI等无需检测的资源

## 🔍 支持检测的资源类型

| 类型 | HTML中的来源 | CSS中的来源 |
|------|-------------|------------|
| 🖼️ 图片 | `<img src>`、`<img srcset>`、`<source srcset>`、`favicon`、`og:image` | `background-image`、`url()` |
| 🔤 字体 | - | `@font-face` 中的 `src: url()` |
| 🎨 样式表 | `<link href>` | `@import` |
| 📜 脚本 | `<script src>` | - |
| 🎬 媒体 | `<video src>`、`<video poster>`、`<audio src>` | - |

## 🚀 快速开始

### 首次使用前

先运行自测，确保工具功能正常：

```bash
npm run self-test
# 或者
node bin/asset-scan.js --self-test
```

### 基本使用

```bash
# 扫描构建目录
node bin/asset-scan.js --dir ./dist

# 扫描单个HTML文件
node bin/asset-scan.js --file ./dist/index.html

# 扫描并导出报告
node bin/asset-scan.js --dir ./dist --report ./reports --html --json
```

## 📖 命令行参数

```bash
asset-scan [选项]

选项:
  -d, --dir <目录>      指定要扫描的构建目录
  -f, --file <文件>     扫描单个HTML文件
  -r, --report <目录>   指定报告输出目录
  --json                导出JSON格式报告
  --html                导出HTML格式报告
  -q, --quiet           静默模式，不输出终端摘要
  --self-test           运行自测程序
  -h, --help            显示帮助信息
```

## 💡 使用示例

### 1. 快速扫描（仅终端输出）

```bash
node bin/asset-scan.js --dir ./dist
```

终端会输出类似这样的摘要：

```
======================================================================
  🔍 前端资源404扫描报告
======================================================================

  📁 扫描目录: /your-project/dist
  📄 扫描文件数: 5
  🔗 发现资源数: 42
  ⏱️  扫描耗时: 45ms

  📊 缺失资源统计:
     🖼️  图片: 3
     🔤 字体: 1
     🎨 样式: 1
     📜 脚本: 0
     🎬 媒体: 0
     📦 其他: 0
     ───────────────
     📝 总计: 5

  ❌ 缺失资源详情:

    ┌─────────────────────────────────────────────────────────────
    │  🔗 URL: images/missing-logo.png
    │  📍 类型: image
    │  📂 解析路径: images/missing-logo.png
    │  🔢 引用次数: 2
    │
    │  📍 引用位置:
    │     📄 index.html:15:9
    │        <img src="images/missing-logo.png" alt="Logo">
    │     🎨 css/style.css:23:5
    │        background: url('../images/missing-logo.png')
    └─────────────────────────────────────────────────────────────

======================================================================
  ⚠️  发现 5 个缺失资源，请检查修复！
======================================================================
```

### 2. 生成完整报告

```bash
node bin/asset-scan.js --dir ./dist --report ./reports --html --json
```

执行后会在 `./reports` 目录生成：
- `asset-report.html` - 美观的HTML报告，可以直接发给同事查看
- `asset-report.json` - 机器可读的JSON数据，可用于CI/CD集成

### 3. 在CI/CD中使用

```bash
# 静默模式，只通过退出码表示结果
node bin/asset-scan.js --dir ./dist --quiet --json

# 如果有缺失资源，脚本会以非0状态码退出
if [ $? -ne 0 ]; then
  echo "发现缺失资源，发布中止！"
  exit 1
fi
```

## 📁 项目结构

```
asset-404-scanner/
├── bin/
│   └── asset-scan.js          # CLI入口文件
├── src/
│   ├── core/
│   │   ├── path-resolver.js   # 路径解析与归一化
│   │   └── scanner.js         # 核心扫描逻辑
│   ├── parsers/
│   │   ├── html-parser.js     # HTML资源解析
│   │   └── css-parser.js      # CSS资源解析
│   ├── reporters/
│   │   ├── terminal-reporter.js  # 终端输出
│   │   ├── json-reporter.js      # JSON导出
│   │   └── html-reporter.js      # HTML报告生成
│   └── self-test.js           # 自测程序
├── test/
│   ├── fixtures/
│   │   └── build/             # 测试用的模拟构建目录
│   └── reports/               # 测试报告输出目录
├── package.json
└── README.md
```

## 🔧 核心机制说明

### 1. 资源解析

扫描器会：
1. 递归查找目录中所有HTML文件
2. 对每个HTML文件，用正则匹配所有资源引用
3. 对发现的CSS文件，进行递归解析
4. 收集所有资源引用信息，包括原始位置

### 2. 路径归一化

对收集到的URL进行规范化处理：
- 将 `\` 转换为 `/`（Windows兼容）
- 合并连续的 `/`
- 解析并移除 `./` 和 `../`
- 根据引用文件的位置，计算真实路径

### 3. 缺失检测

对归一化后的路径：
- 检查文件系统中是否真实存在
- 区分"文件不存在"和"是个目录"
- 统计每个缺失资源的引用次数和位置

### 4. 报告导出

- **终端摘要**：色彩化输出，方便快速查看
- **JSON报告**：包含完整的扫描结果和位置信息，便于程序处理
- **HTML报告**：美观的可视化报告，包含统计图表，适合分享给团队

## 🧪 运行测试

```bash
# 运行完整自测
npm run self-test

# 或者直接运行
node src/self-test.js

# 运行演示扫描
npm run demo
```

自测程序会验证：
- ✅ 路径归一化功能
- ✅ HTML资源解析
- ✅ CSS资源解析
- ✅ 文件存在检测
- ✅ 完整扫描流程
- ✅ 报告导出功能
- ✅ 边界情况处理
- ✅ 位置信息完整性

## 📋 JSON报告格式

```json
{
  "summary": {
    "totalFilesScanned": 5,
    "totalAssetsFound": 42,
    "missingAssetsCount": 5,
    "missingByType": {
      "image": 3,
      "font": 1,
      "css": 1,
      "script": 0,
      "media": 0,
      "other": 0
    },
    "scanDuration": 45,
    "baseDir": "/path/to/dist"
  },
  "files": ["index.html", "about.html"],
  "missingAssets": [
    {
      "url": "images/missing.png",
      "normalizedUrl": "images/missing.png",
      "resolvedPath": "images/missing.png",
      "absolutePath": "/path/to/dist/images/missing.png",
      "type": "image",
      "occurrenceCount": 2,
      "exists": false,
      "occurrences": [
        {
          "source": "html",
          "filePath": "index.html",
          "line": 15,
          "column": 9,
          "pattern": "imgSrc",
          "rawValue": "images/missing.png",
          "context": "<img src=\"images/missing.png\" alt=\"Logo\">"
        }
      ],
      "fileInfo": {
        "exists": false,
        "error": "ENOENT"
      }
    }
  ],
  "validAssets": [...],
  "errors": []
}
```

## 🎯 典型使用场景

1. **发布前检查**：在 `npm run build` 之后运行，避免带着404上线
2. **重构验证**：重构资源目录结构后，验证所有引用是否正确
3. **CI集成**：作为CI流水线的一环，有缺失资源自动中止发布
4. **代码审查**：生成HTML报告，附在PR中供团队成员查看

## 📝 注意事项

- 本工具仅检测**本地文件**，不会发起真实网络请求
- 外部URL（http://、https://、//）会被自动跳过
- data URI 会被自动跳过
- 对于动态生成的资源路径（JS拼接的URL）无法检测

## 🤝 贡献

发现问题或有改进建议？欢迎提交Issue或PR！

---

**再也不用等上线后才发现图片404了！** 🎉
