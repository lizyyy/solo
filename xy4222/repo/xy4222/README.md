# 修复照片拼版批注台

一个专为文物修复师设计的本地桌面应用，用于管理修复前后的照片批注和拼版对比。

## 功能特性

### 📸 图片管理
- **批量导入图片**：支持一次导入多张文物照片
- **建档管理**：按器物编号、部位、拍摄阶段（修复前/中/后）分类管理
- **图片筛选**：可按部位和拍摄阶段快速筛选图片

### ✏️ 图片批注
- **框选标注**：在图片上框选裂纹、补色、缺损等区域
- **多种批注类型**：裂纹、补色、缺损、污渍、孔洞、其他
- **风险等级**：为每个批注设置风险等级（低/中/高/极高）
- **详细记录**：支持添加批注内容和处理建议

### 🖼️ 对比与拼版
- **左右对比**：并排对比修复前后的照片
- **自动拼版**：按部位、拍摄阶段或器物编号自动生成拼版预览
- **网格布局**：清晰的缩略图网格展示

### 💾 数据持久化
- **本地存储**：项目数据自动保存到本地，重启不丢失
- **支持浏览器降级**：开发环境可在浏览器中运行，使用 localStorage

### 📤 导出功能
- **Markdown 报告**：导出包含项目信息、统计、详细批注列表的完整报告
- **JSON 归档**：导出完整项目数据结构，便于备份和迁移

## 技术栈

- **前端框架**：Vue 3
- **状态管理**：Pinia
- **路由管理**：Vue Router
- **桌面框架**：Electron
- **构建工具**：Vite
- **本地存储**：electron-store

## 项目结构

```
xy4222/
├── electron/                    # Electron 主进程
│   ├── main.js                 # 主进程入口，窗口管理、IPC 通信
│   └── preload.js              # 预加载脚本，安全暴露 API
├── src/
│   ├── components/             # 可复用组件
│   │   ├── ImageViewer.vue     # 图片查看器（缩放、绘制批注）
│   │   └── AnnotationPanel.vue # 批注面板（列表、编辑）
│   ├── models/                 # 数据模型
│   │   ├── index.js            # 统一导出
│   │   ├── Project.js          # 项目模型
│   │   ├── ArtifactImage.js    # 文物图片模型
│   │   ├── Annotation.js       # 批注模型
│   │   ├── AnnotationType.js   # 批注类型枚举
│   │   ├── RiskLevel.js        # 风险等级枚举
│   │   └── ShootingStage.js    # 拍摄阶段枚举
│   ├── router/
│   │   └── index.js            # 路由配置
│   ├── stores/                 # Pinia 状态管理
│   │   ├── index.js            # 统一导出
│   │   ├── projects.js         # 项目列表 Store
│   │   ├── currentProject.js   # 当前项目 Store
│   │   ├── annotations.js      # 批注 Store
│   │   └── export.js           # 导出 Store
│   ├── utils/                  # 工具函数
│   │   ├── storage.js          # 存储工具（Electron + localStorage）
│   │   ├── markdownGenerator.js # Markdown 报告生成
│   │   ├── jsonExporter.js     # JSON 归档导出/导入
│   │   ├── collageGenerator.js # 拼版布局生成
│   │   └── sampleData.js       # 示例数据生成
│   ├── views/                  # 页面视图
│   │   ├── App.vue             # 根组件
│   │   ├── HomeView.vue        # 首页（项目列表）
│   │   ├── ProjectView.vue     # 项目详情（图片查看+批注）
│   │   ├── CompareView.vue     # 对比视图
│   │   ├── CollageView.vue     # 拼版预览视图
│   │   └── ExportView.vue      # 导出视图
│   └── main.js                 # Vue 应用入口
├── index.html                  # HTML 入口
├── package.json                # 项目配置
├── vite.config.js              # Vite 配置
└── README.md                   # 本文档
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式运行

#### 方式一：Electron 桌面应用（推荐）

```bash
npm run electron:dev
```

这会同时启动 Vite 开发服务器和 Electron 窗口。

#### 方式二：浏览器开发模式

```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:5173`

> 注意：浏览器模式下，文件对话框和本地存储会使用降级方案，建议使用 Electron 模式获得完整功能。

### 构建打包

#### 构建 Electron 应用

```bash
npm run electron:build
```

构建产物会输出到 `dist-electron/` 目录。

#### 仅构建 Web 版本

```bash
npm run build
```

## 使用指南

### 1. 创建项目
1. 启动应用后，点击「新建项目」
2. 填写项目名称、器物编号和描述
3. 点击「创建项目」

### 2. 导入图片
1. 进入项目详情页
2. 点击左侧边栏的「+ 导入图片」按钮
3. 选择图片文件（支持多选）
4. 设置器物编号、部位和拍摄阶段
5. 点击「导入图片」

### 3. 添加批注
1. 在左侧图片列表选择一张图片
2. 在图片查看器中，用鼠标拖动框选需要标注的区域
3. 在右侧批注面板中：
   - 选择批注类型（裂纹/补色/缺损等）
   - 设置风险等级
   - 填写批注内容
   - 添加处理建议

### 4. 对比视图
1. 点击底部导航栏的「对比视图」
2. 选择左右两侧要对比的图片
3. 可以按部位和拍摄阶段筛选

### 5. 拼版预览
1. 点击底部导航栏的「拼版预览」
2. 选择分组方式（按部位/阶段/器物编号）
3. 查看自动生成的拼版布局

### 6. 导出报告
1. 点击底部导航栏的「导出报告」
2. 查看项目统计和风险分布
3. 选择导出格式：
   - **导出 Markdown 报告**：生成完整的修复报告
   - **导出 JSON 归档**：备份项目数据
   - **导入 JSON 归档**：恢复之前备份的项目

### 7. 加载示例数据
在首页点击「加载示例数据」按钮，可以快速体验应用功能，示例包含：
- 一个完整的青铜鼎修复项目
- 5 张示例图片（修复前后对比）
- 多种类型的批注示例
- 不同风险等级的标注

## 数据模型

### Project（项目）
```javascript
{
  id: string,           // 唯一标识
  name: string,         // 项目名称
  artifactCode: string, // 器物编号
  description: string,  // 项目描述
  images: [],           // 图片列表
  createdAt: Date,
  updatedAt: Date
}
```

### ArtifactImage（文物图片）
```javascript
{
  id: string,
  filePath: string,     // 文件路径
  fileName: string,     // 文件名
  artifactCode: string, // 器物编号
  part: string,         // 部位（正面、底部、耳部等）
  stage: string,        // 拍摄阶段：before/during/after
  description: string,  // 描述
  annotations: [],      // 批注列表
  uploadedAt: Date
}
```

### Annotation（批注）
```javascript
{
  id: string,
  imageId: string,      // 所属图片 ID
  type: string,         // 类型：crack/color_restoration/damage/stain/hole/other
  riskLevel: string,    // 风险等级：low/medium/high/critical
  position: {           // 框选位置（相对坐标 0-1）
    x: number,
    y: number,
    width: number,
    height: number
  },
  comment: string,      // 批注内容
  suggestion: string,   // 处理建议
  createdAt: Date
}
```

## 导出格式

### Markdown 报告
包含以下内容：
- 项目基本信息表格
- 批注统计（按风险等级、按类型）
- 详细批注列表（按风险等级排序）
- 风险等级和批注类型说明附录

### JSON 归档
完整的项目数据结构，可用于备份和迁移。

## 开发说明

### 状态管理（Pinia）
- `projectsStore`：管理所有项目的增删改查
- `currentProjectStore`：管理当前选中的项目和图片
- `annotationsStore`：管理批注的创建、编辑、删除
- `exportStore`：管理导出功能

### IPC 通信（Electron）
主进程暴露的 API：
- `openFileDialog()`：打开文件选择对话框
- `openFolderDialog()`：打开文件夹选择对话框
- `storeGet(key)` / `storeSet(key, value)`：数据存储
- `storeDelete(key)` / `storeClear()`：数据删除

## 注意事项

1. **图片路径**：当前版本使用文件路径引用图片，移动图片文件可能导致图片无法显示
2. **数据存储**：Electron 模式使用 `electron-store`，浏览器模式使用 `localStorage`
3. **开发模式**：建议使用 `npm run electron:dev` 获得完整功能体验

## 后续优化建议

- [ ] 支持图片文件复制到项目目录，避免路径问题
- [ ] 添加图片缩放和拖拽功能
- [ ] 支持批注的撤销/重做
- [ ] 添加更多批注形状（圆形、多边形等）
- [ ] 支持拼版自定义布局
- [ ] 添加打印功能
- [ ] 支持多项目对比

## 许可证

MIT License
