# EPUB 无障碍巡检工具

本地运行的 Web 前端工具，用于检查 EPUB 文件的无障碍问题。

## 功能特性

- 拖放导入 EPUB 文件
- 解析 OPF、nav/toc、章节 HTML 和图片资源
- 检测无障碍问题：
  - 缺少 alt 属性 / alt 为空
  - 标题层级跳跃
  - 目录指向不存在文件
  - manifest 重复项
  - spine 引用不存在的 manifest 项
- 风险分级（严重/警告/信息）
- 章节/问题联动筛选
- 导出 issues.csv 和 summary.md

## 本地启动

```bash
# 安装依赖
npm install

# 生成示例 EPUB（可选）
npm run generate-sample

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

## 生产构建

```bash
npm run build
npm run preview
```

## 导出文件说明

- `issues.csv` - 所有问题的详细列表
- `summary.md` - 问题摘要报告

## 边界情况处理

- 加密 EPUB：提示需要解密
- 损坏 ZIP：提示文件可能已损坏
- nav 缺失但 toc.ncx 存在：自动回退到 toc.ncx

## 项目结构

```
src/
├── parsers/          # 解析器模块
│   ├── EPUBParser.js    # 核心解析器
│   ├── HTMLParser.js    # HTML 内容解析
│   └── XMLParser.js     # XML/OPF/NCX 解析
├── rules/           # 规则引擎
│   ├── index.js         # 规则注册表
│   ├── altRules.js      # alt 相关规则
│   ├── headingRules.js  # 标题层级规则
│   ├── manifestRules.js # manifest/spine 规则
│   └── tocRules.js      # 目录规则
├── store/           # 状态管理
│   └── inspector.js     # Vue 3 reactive store
├── exporters/       # 导出模块
│   ├── csvExporter.js   # CSV 导出
│   └── mdExporter.js    # Markdown 导出
└── components/      # UI 组件
    ├── FileDropZone.vue
    ├── ChapterList.vue
    ├── IssuePanel.vue
    ├── IssueDetail.vue
    ├── FilterBar.vue
    ├── RiskBadge.vue
    └── ExportBar.vue
```

## 运行测试

```bash
npm test
```
