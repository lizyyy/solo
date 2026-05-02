# EPUB 无障碍巡检工具 - 技术规格文档

## 1. 项目概述

- **项目名称**: epub-a11y-inspector
- **项目类型**: 本地运行的 Web 前端工具（Vue 3 + Vite）
- **核心功能**: 将 EPUB 文件拖入浏览器，解包读取 OPF、nav/toc、章节 HTML 和图片资源，检测无障碍问题并导出报告
- **目标用户**: 数字出版同事

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ Header: 标题 + 文件导入区                                          │
├────────────────┬─────────────────────────────────────────────────┤
│                │                                                  │
│  左侧面板      │  主内容区                                        │
│  - 章节列表    │  - 问题概览/详情                                 │
│  - 筛选控件    │  - 风险分级                                      │
│  - 统计摘要    │                                                  │
│                │                                                  │
├────────────────┴─────────────────────────────────────────────────┤
│ Footer: 导出按钮 (issues.csv / summary.md)                        │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 功能列表

### 3.1 文件导入
- 拖放或点击选择 .epub 文件
- 前端 JSZip 解压
- 处理加密/损坏 ZIP 边界情况
- 显示解析进度

### 3.2 解析模块 (parsers/)
- **EPUBParser**: 核心解析器
  - 解析 container.xml 获取 OPF 路径
  - 解析 OPF 获取 manifest 和 spine
  - 解析 nav.xhtml（EPUB 3.0）
  - 解析 toc.ncx（EPUB 2.0 fallback）
  - 处理 nav 缺失但 toc.ncx 存在的边界情况
  - 提取章节 HTML 内容
  - 提取图片资源
- **HTMLParser**: 解析 HTML 中的 alt、标题层级、链接等
- **XMLParser**: 解析 OPF 和 NCX

### 3.3 规则引擎 (rules/)
| 规则ID | 规则名称 | 严重级别 | 说明 |
|--------|----------|----------|------|
| ALT_001 | 缺少 alt 属性 | critical | `<img>` 缺少 alt |
| ALT_002 | alt 为空 | warning | alt="" 可接受，但需确认是刻意为之 |
| HEADING_001 | 标题层级跳跃 | critical | 如 h1→h3 |
| HEADING_002 | 标题层级缺失 | warning | 缺少中间层级标题 |
| TOC_001 | 目录指向不存在文件 | critical | spine/manifest 中的文件缺失 |
| TOC_002 | spine 指向 manifest 不存在的项 | critical | spine itemref 指向缺失的 manifest id |
| MANIFEST_001 | manifest 重复项 | warning | 同一 id 出现多次 |
| MANIFEST_002 | manifest 缺失 item | warning | spine 引用但 manifest 无定义 |
| SPINE_001 | spine 章节缺失 | critical | spine 中有 itemref 但无内容 |
| IMAGE_001 | 图片资源缺失 | warning | manifest 引用图片但文件不存在 |

### 3.4 风险分级
- **Critical（严重）**: 红色标记，必须修复
- **Warning（警告）**: 橙色标记，建议修复
- **Info（信息）**: 蓝色标记，供参考

### 3.5 筛选与联动
- 按风险等级筛选
- 按规则类型筛选
- 按章节筛选
- 搜索问题描述
- 章节-问题联动（点击章节高亮相关问题）

### 3.6 导出功能 (exporters/)
- **issues.csv**: 所有问题的 CSV 表格
- **summary.md**: 问题摘要 Markdown 报告

## 4. 目录结构

```
epub-a11y-inspector/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── parsers/
│   │   ├── EPUBParser.js      # 核心解析器
│   │   ├── HTMLParser.js      # HTML 内容解析
│   │   └── XMLParser.js       # XML/OPF/NCX 解析
│   ├── rules/
│   │   ├── index.js           # 规则注册表
│   │   ├── altRules.js        # alt 相关规则
│   │   ├── headingRules.js    # 标题层级规则
│   │   ├── manifestRules.js   # manifest/spine 规则
│   │   └── tocRules.js        # 目录规则
│   ├── store/
│   │   └── inspector.js       # 状态管理 (Vue 3 reactive)
│   ├── exporters/
│   │   ├── csvExporter.js     # CSV 导出
│   │   └── mdExporter.js      # Markdown 导出
│   ├── components/
│   │   ├── FileDropZone.vue   # 文件拖放区
│   │   ├── ChapterList.vue    # 章节列表
│   │   ├── IssuePanel.vue     # 问题面板
│   │   ├── IssueDetail.vue    # 问题详情
│   │   ├── FilterBar.vue      # 筛选栏
│   │   ├── RiskBadge.vue      # 风险等级徽章
│   │   └── ExportBar.vue      # 导出栏
│   └── utils/
│       ├── zipHandler.js       # ZIP 处理工具
│       └── domPurify.js       # HTML 净化
├── scripts/
│   └── generate-sample-epub.js # 生成带问题的示例 EPUB
└── tests/
    ├── parser.test.js         # 解析器测试
    └── rules.test.js          # 规则引擎测试
```

## 5. 边界情况处理

1. **加密/损坏 ZIP**: try-catch 包裹，检测是否是加密 ZIP，给出友好错误提示
2. **nav 缺失但 toc.ncx 存在**: 当 nav.xhtml 不存在时，回退到 toc.ncx 解析
3. **无效 OPF XML**: 错误边界处理，显示具体解析错误位置
4. **大文件处理**: 分片读取，stream 解析

## 6. 测试用例

### 解析测试
1. 解析正常 EPUB
2. 解析 toc.ncx 回退情况
3. 解析 manifest 重复 id
4. 解析加密 EPUB（应报错）
5. 解析损坏 ZIP（应报错）

### 规则测试
1. 检测缺少 alt 的 img
2. 检测 h1→h3 层级跳跃
3. 检测 spine itemref 指向不存在的 manifest id
4. 检测 manifest 重复 id
5. 检测目录指向不存在的文件

## 7. 验收标准

- [ ] 可拖入 EPUB 文件并正确解析
- [ ] 正确处理 nav 缺失时的 toc.ncx 回退
- [ ] 正确处理加密/损坏 ZIP
- [ ] 所有 10 条规则正确检测问题
- [ ] 筛选功能正常工作
- [ ] CSV 和 Markdown 导出正常
- [ ] 页面布局美观，交互流畅
- [ ] 提供可运行的 sample epub
- [ ] 提供本地启动命令
- [ ] 至少 2 个解析测试 + 2 个规则测试
