# HAR 性能预算体检工具

一个本地运行的前端性能分析工具，用于在发布前检查网页性能是否符合预算要求。

## 功能特性

- 📊 **HAR 文件解析** - 支持导入和解析 Chrome 浏览器导出的 HAR 文件
- 💰 **性能预算检查** - 自定义性能预算阈值，检查各项指标是否符合要求
- 📈 **可视化分析** - 交互式请求瀑布图、资源类型分布图表
- 🚨 **问题检测** - 自动识别性能问题，包括：
  - 超预算请求和大小
  - 缓存命中率低
  - 第三方资源过多
  - 大资源和慢速资源
  - 重复请求
- 📋 **报告导出** - 支持导出 Markdown 和 HTML 格式的体检报告
- ⚡ **边界处理** - 支持 HTTP/2 多路复用、缺失 Timing 数据等特殊情况

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 使用说明

### 1. 获取 HAR 文件

1. 在 Chrome 浏览器中打开要分析的网页
2. 打开开发者工具（F12 或右键 → 检查）
3. 切换到 Network（网络）面板
4. 刷新页面（Ctrl+R 或 F5）
5. 等待页面加载完成
6. 在网络请求列表上右键 → 选择 "Save all as HAR with content"（保存所有内容为 HAR）
7. 保存文件

### 2. 使用工具

1. 启动应用后，点击或拖拽上传 HAR 文件
2. （可选）上传性能预算 JSON 文件
3. 点击 "开始分析"
4. 查看分析结果、瀑布图和问题列表
5. 点击 "导出 Markdown" 或 "导出 HTML" 保存报告

## 性能预算配置

创建一个 JSON 文件，示例配置：

```json
{
  "page": "首页性能预算",
  "thresholds": {
    "totalRequests": 50,
    "totalSize": 5242880,
    "resourceTypes": {
      "script": {
        "count": 15,
        "size": 2097152
      },
      "image": {
        "count": 20,
        "size": 2097152
      },
      "stylesheet": {
        "count": 8,
        "size": 524288
      },
      "font": {
        "count": 5,
        "size": 262144
      }
    },
    "timing": {
      "domContentLoaded": 2000,
      "onLoad": 3000,
      "firstContentfulPaint": 1500,
      "timeToInteractive": 3500
    },
    "thirdParty": {
      "count": 10,
      "size": 1048576,
      "domains": ["google-analytics.com", "doubleclick.net", "facebook.net"]
    },
    "cache": {
      "missRate": 20
    }
  }
}
```

### 配置说明

- `totalRequests`: 总请求数上限
- `totalSize`: 总资源大小上限（字节）
- `resourceTypes`: 各资源类型的数量和大小限制
- `timing`: 关键时间点限制（毫秒）
- `thirdParty`: 第三方资源限制
- `cache`: 缓存未命中率上限（百分比）

## 示例文件

项目包含以下示例文件：

- `examples/sample.har` - 示例 HAR 文件
- `examples/sample-budget.json` - 示例性能预算配置

你可以直接使用这些文件测试工具。

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Recharts** - 图表库
- **Lucide React** - 图标库

## 项目结构

```
├── src/
│   ├── components/       # React 组件
│   │   ├── FileUploader.tsx
│   │   ├── IssueList.tsx
│   │   ├── StatsOverview.tsx
│   │   └── WaterfallChart.tsx
│   ├── utils/            # 工具函数
│   │   ├── budgetAnalyzer.ts
│   │   ├── harParser.ts
│   │   └── reportExporter.ts
│   ├── types/            # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx           # 主应用组件
│   ├── main.tsx          # 入口文件
│   └── index.css         # 全局样式
├── examples/             # 示例文件
│   ├── sample.har
│   └── sample-budget.json
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## 许可证

MIT
