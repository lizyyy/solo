# 舞台吊点安全演示系统

一款针对展陈行业的专业工具，解决补录路线未重新计算长度导致的前后不一致问题。支持3D/图表展示、服务复核流程、智能报告导出，帮助展陈客户和设计师高效协作。

## ✨ 核心特性

- **🔍 自动路线检测** - 自动识别"补录路线没有重新计算长度"类问题
- **🎯 3D可视化展示** - 舞台吊点3D场景，可旋转缩放，问题点高亮标记
- **📊 图表分析** - 路线长度对比图表，直观展示差异
- **📝 服务复核流程** - 完整的问题处理工作流，支持补录楼层剖面草图
- **📸 智能报告导出** - 带完整上下文说明的报告截图，包含问题原因、缺失材料、责任人指引
- **💾 本地数据持久化** - 数据自动保存在浏览器LocalStorage
- **📱 多种入口** - 支持Web小看板、JSON导入、命令行接口

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 即可使用。

### 构建生产版本

```bash
npm run build
```

## 📖 新手三步快速体验

### 第一步：导入样例数据

1. 访问首页，点击右上角「导入新项目」
2. 选择「快速加载样例」标签页
3. 点击「新品发布会舞台」样例（含标准问题场景），直接跳转进入项目详情
4. 或点击「重置样例数据」恢复初始状态重新体验

### 第二步：查看检测问题

1. 在3D视图中观察：
   - 橙色脉冲标记的问题吊点
   - 红色虚线标记的问题路线
   - 右侧面板显示检测到的问题列表
2. 点击问题卡片展开查看详情：
   - 路线信息（记录长度 vs 实测长度）
   - 障碍物备注
   - 缺失材料清单
   - 下一步行动指引

### 第三步：完整复核流程

**场景：展陈设计师阿景补录楼层剖面草图**

1. 在问题卡片中点击「补录楼层剖面草图」按钮
2. 选择样图或输入图片URL，填写说明后提交
3. 问题状态变为「已补充待复核」，下一步行动变为「请联系展陈客户」

> **关键设计**：补录草图后问题不会自动标记为已解决，必须留给客户复核！

**场景：展陈客户复核确认**

1. 客户查看更新后的报告
2. 在问题卡片中输入复核意见
3. 点击「客户复核确认解决」
4. 问题状态变为「已解决」，路线标记恢复正常

### 第四步：导出智能报告

1. 点击顶部「报告导出」标签或「导出报告」按钮
2. 查看完整报告预览，包含：
   - 项目摘要和统计数据
   - 每个问题的详细说明
   - 「为什么这条被留下？」的原因解释
   - 「还缺什么材料？」清单
   - 「下一步该找谁？」责任人指引
   - 后续行动清单
3. 可添加自定义备注
4. 点击「导出报告截图」下载PNG格式报告

## 🏗️ 项目结构

```
src/
├── components/           # 可复用组件
│   ├── Stage3DScene.tsx    # 3D舞台场景
│   ├── RouteChart.tsx      # 路线长度对比图表
│   ├── IssuePanel.tsx      # 问题检测面板
│   ├── SketchUploadModal.tsx # 草图上传模态框
│   └── ReportExport.tsx    # 报告导出组件
├── pages/                # 页面组件
│   ├── Home.tsx            # 首页
│   ├── ProjectsPage.tsx    # 项目总览页
│   ├── ProjectDetailPage.tsx # 项目详情页
│   ├── ReportPage.tsx      # 报告导出页
│   └── ImportPage.tsx      # 数据导入页
├── services/             # 核心服务
│   └── RouteDetectionEngine.ts # 路线检测引擎
├── store/                # 状态管理
│   └── projectStore.ts     # Zustand store
├── data/                 # 前端样例数据
│   └── sampleData.ts       # 3个演示项目数据
├── types/                # TypeScript类型定义
│   └── index.ts
├── lib/                  # 工具函数
│   └── utils.ts
└── App.tsx               # 应用入口
data/                     # CLI样例数据（JSON格式）
├── demo-project-1.json    # 车展主舞台吊点系统
├── demo-project-2.json    # 新品发布会舞台
└── demo-project-3.json    # 颁奖典礼多楼层舞台
scripts/                  # CLI脚本
├── detect.js              # 路线检测脚本
└── export.js              # 报告导出脚本
```

## 🎯 核心数据模型

### 问题状态流转

```
open (待处理)
    ↓ 设计师补录楼层剖面草图
supplemented (已补充待复核)
    ↓ 客户复核确认
resolved (已解决)
```

### 关键约束

- ❌ 补录草图后 **不会自动** 将问题标记为正常
- ✅ 必须经过 **展陈客户复核** 确认后才能解决
- 📝 导出报告必须说明：原因、缺料、责任人

## 🔧 API 接口（前端状态）

### 路线检测引擎

```typescript
// 检测补录路线问题
RouteDetectionEngine.detectSupplementaryRoutes(routes: Route[]): DetectionIssue[]

// 获取状态标签
RouteDetectionEngine.getStatusLabel(status: string): string
RouteDetectionEngine.getNextActionLabel(action: string): string
```

### 状态管理操作

```typescript
// 项目操作
loadSampleData()                  // 加载样例数据
setCurrentProject(id: string)     // 切换当前项目
importProjectData(data)           // 导入新项目数据

// 问题处理
addFloorSketch(sketch)            // 补录楼层剖面草图
supplementIssue(issueId, sketchId?) // 标记问题为已补充（sketchId可选）
resolveIssue(issueId, notes)      // 客户复核解决问题
runDetection()                    // 重新运行检测

// 视图控制
setViewMode('3d' | 'chart')       // 切换3D/图表视图
setSelectedIssue(issueId)         // 选中问题高亮
```

## 💻 命令行接口（CLI）

可通过 Node.js 脚本在终端运行检测和报告导出：

```bash
# 检测样例项目问题（文本格式输出）
npm run detect:demo

# 检测任意项目问题
node scripts/detect.js --input ./data/demo-project-2.json

# 以 JSON 格式输出检测结果并保存到文件
node scripts/detect.js --input ./data/demo-project-2.json --output result.json --json

# 导出样例项目报告（文本格式输出）
npm run export-report:demo

# 导出任意项目报告为 JSON 格式
npm run export-report:demo-json

# 导出任意项目报告（支持 json 和 text 格式）
node scripts/export.js --input ./data/demo-project-2.json --format text
node scripts/export.js --input ./data/demo-project-2.json --output ./output/report.json --format json --notes "补充说明"
```

### CLI 命令一览

| 命令 | 说明 |
|------|------|
| `npm run detect:demo` | 检测新品发布会舞台样例 |
| `npm run export-report:demo` | 导出新品发布会舞台报告（文本格式） |
| `npm run export-report:demo-json` | 导出新品发布会舞台报告（JSON格式到 output/） |

### 报告包含内容

CLI 导出的报告与 Web 端一致，包含：
- 项目摘要和统计数据
- 每个问题的详细说明（路线名称、记录长度、实测长度）
- 「为什么这条被留下？」的原因解释
- 「还缺什么材料？」缺失材料清单
- 「下一步该找谁？」责任人指引
- 复核意见（如有）
- 后续行动清单

## 🎨 设计规范

- **主色调**：工业蓝 `#165DFF` - 专业、可信
- **警示色**：橙色 `#FF7D00` - 问题提醒
- **成功色**：绿色 `#00B42A` - 已解决
- **错误色**：红色 `#F53F3F` - 待处理
- **字体**：思源黑体（标题）+ JetBrains Mono（数据）

## 🧪 测试

### 类型检查

```bash
npm run check
```

### 代码规范检查

```bash
npm run lint
```

### 手动测试场景

1. ✅ 三步核心流程是否完整（导入→补录→复核→导出）
2. ✅ 问题状态是否不会自动归为正常
3. ✅ 报告导出是否包含完整说明（问题原因、缺失材料、责任人、复核意见）
4. ✅ 补录草图后3D视图是否更新
5. ✅ 客户复核后状态是否正确流转
6. ✅ 数据刷新后是否持久化保存
7. ✅ CLI检测命令 `npm run detect:demo` 是否正常输出
8. ✅ CLI报告导出 `npm run export-report:demo` 是否包含完整内容
9. ✅ Web端导出PNG报告内容与页面预览一致

## 📝 常见问题

**Q: 数据保存在哪里？**
A: 所有数据保存在浏览器 LocalStorage 中，清除浏览器数据会丢失。

**Q: 如何导入真实项目数据？**
A: 访问「导入新项目」页面，选择「JSON 数据导入」标签，按照模板格式粘贴数据。

**Q: 为什么补录草图后问题还显示待处理？**
A: 这是有意设计的！补录材料后必须由展陈客户复核确认，问题才能标记为已解决。

## 🤝 角色说明

| 角色 | 职责 | 关键操作 |
|------|------|----------|
| 展陈设计师阿景 | 导入数据、补录草图、导出报告 | 「补录楼层剖面草图」 |
| 展陈客户 | 查看报告、复核问题 | 「客户复核确认解决」 |
| 服务复核人员 | 批量审核、数据校验 | 「重新检测」 |

## 📄 许可证

MIT License
