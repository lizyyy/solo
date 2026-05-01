# Photo Listing Desk

一个本地桌面小工具，用于整理二手闲置商品的照片，轻松分组、标注瑕疵、管理上架状态。

## 功能特性

### 📷 照片管理
- 选择文件夹自动扫描 jpg/png/webp 格式图片
- 显示缩略图和详细信息（文件名、大小、尺寸、格式）
- 拖拽或点击分配照片到商品

### 🔄 重复检测
- 基于文件哈希精确识别完全重复图片
- 基于文件大小和尺寸检测疑似重复图片
- 按相似度评分标记可疑照片

### 📦 商品分组
- 创建商品卡片，填写标题、价格、成色
- 标记瑕疵照片并添加说明
- 设置主图，管理上架状态

### ⚠️ 待处理清单
- 自动检测未分组照片
- 提醒缺少主图、价格的商品
- 标记缺少瑕疵说明的照片

### 💾 数据持久化
- 所有数据保存为本地 JSON 文件
- 下次打开自动恢复
- 支持保存/打开项目文件

### 📤 一键导出
- 按商品编号重命名图片（如 `p001_main_01.jpg`）
- 复制图片到 output 文件夹
- 生成 CSV 清单（可导入 Excel/WPS）
- 生成 HTML 预览页（方便复制到闲鱼/小红书）

## 项目结构

```
photo-listing-desk/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本（安全 IPC）
├── package.json         # 项目配置
├── src/                 # 核心模块
│   ├── fileScanner.js   # 文件扫描与缩略图生成
│   ├── duplicateChecker.js  # 重复图片检测
│   ├── dataManager.js   # 数据管理与验证
│   └── exporter.js      # 导出功能（CSV/HTML/图片）
├── renderer/            # 渲染进程
│   ├── index.html       # 主界面
│   ├── style.css        # 样式文件
│   └── app.js           # 前端逻辑
├── samples/             # 示例数据
│   └── sample-project.json
└── scripts/
    └── self-check.js    # 自检脚本
```

## 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 运行应用

```bash
npm start
```

### 运行自检

```bash
npm test
```

### 打包应用

```bash
# 打包当前平台
npm run pack

# 构建安装包
npm run dist
```

## 使用流程

### 1. 开始使用

启动应用后，可以选择：
- **选择照片文件夹**：扫描你存放闲置照片的文件夹
- **加载示例数据**：体验软件功能（预置示例商品）

### 2. 扫描照片

选择文件夹后，应用会自动：
- 扫描所有 jpg/png/webp 图片
- 计算文件哈希用于重复检测
- 生成缩略图
- 检测重复图片并显示在侧边栏

### 3. 创建商品

点击"创建新商品"按钮，填写：
- **商品标题**：如 "iPhone 13 Pro 256G 远峰蓝"
- **价格**：数字格式
- **成色**：全新/良好/一般/较差
- **瑕疵说明**：整体瑕疵描述
- **上架状态**：草稿/已上架/已售出
- **备注**：其他信息

### 4. 分配照片

点击未分组照片或商品卡片中的照片，可以：
- **分配到商品**：选择要归属的商品
- **设为主图**：标记为商品封面图
- **标记为瑕疵图**：标注有瑕疵的照片
- **添加瑕疵说明**：描述具体瑕疵位置和程度

### 5. 查看待处理问题

左侧边栏会显示：
- **待处理问题**：未分组照片、缺主图、缺价格、缺瑕疵说明
- **重复检测**：完全重复或疑似重复的图片

点击问题项可以快速定位处理。

### 6. 保存项目

点击顶部"保存项目"按钮，选择保存位置。
项目数据会保存为 JSON 文件，下次可以通过"打开项目"恢复。

### 7. 导出数据

准备上架时，点击"导出"按钮：

**导出内容包括：**
- `images/` 文件夹：重命名后的图片
  - 命名格式：`p{商品编号}_{类型}_{序号}.{扩展名}`
  - 类型：main（主图）、defect（瑕疵）、detail（详情）
  - 示例：`p001_main_01.jpg`、`p001_defect_02.jpg`

- `products.csv`：商品清单表格
  - 包含编号、标题、价格、成色、状态、照片数量等
  - 可直接导入 Excel/WPS 编辑

- `preview.html`：可视化预览页
  - 商品卡片展示，包含主图、价格、标签
  - 瑕疵照片标记和说明
  - 方便截图或复制到闲鱼/小红书

- `export-summary.json`：导出元数据

## 核心模块说明

### FileScanner (`src/fileScanner.js`)
```javascript
// 扫描文件夹获取照片信息
const photos = await FileScanner.scanFolder('/path/to/photos');

// 获取单张照片信息
const info = await FileScanner.getPhotoInfo('/path/to/photo.jpg');

// 生成缩略图（base64）
const thumbnail = await FileScanner.generateThumbnail(filePath, 200, 200);
```

### DuplicateChecker (`src/duplicateChecker.js`)
```javascript
// 检测重复图片
const duplicates = await DuplicateChecker.check(photos);
// 返回: [{ type: 'exact'|'suspected', confidence: 60-100, photos: [...], reason: '...' }]
```

### DataManager (`src/dataManager.js`)
```javascript
// 创建空项目
const project = DataManager.createEmptyProject();

// 验证项目，返回待处理问题
const issues = DataManager.validateProject(project);

// 获取统计信息
const stats = DataManager.getStatistics(project);
```

### Exporter (`src/exporter.js`)
```javascript
// 导出项目
const result = await Exporter.export('/output/path', projectData);
// 自动创建 images 文件夹、CSV、HTML 预览
```

## 数据格式

### 项目文件 (JSON)
```json
{
  "version": "1.0",
  "created": 1746144000000,
  "updated": 1746230400000,
  "folderPath": "/path/to/photos",
  "photos": [
    {
      "id": "photo_xxx",
      "filePath": "/path/to/photo.jpg",
      "fileName": "photo.jpg",
      "fileSize": 1234567,
      "fileSizeFormatted": "1.18 MB",
      "hash": "md5_hash",
      "width": 4032,
      "height": 3024,
      "format": "jpg",
      "groupId": "prod_xxx",
      "isDefect": false,
      "isMain": true,
      "defectDescription": ""
    }
  ],
  "products": [
    {
      "id": "prod_xxx",
      "title": "商品标题",
      "price": 999,
      "condition": "good",
      "defectDescription": "整体描述",
      "status": "draft",
      "photoIds": ["photo_xxx"],
      "mainPhotoId": "photo_xxx",
      "notes": "备注"
    }
  ],
  "duplicates": [],
  "issues": []
}
```

## 开发说明

### 技术栈
- **框架**: Electron 28
- **图片处理**: sharp
- **数据格式**: JSON
- **CSV 生成**: csv-writer
- **文件操作**: fs-extra

### 调试模式

```bash
npm run dev
```

### 模块职责

| 模块 | 职责 |
|------|------|
| `main.js` | Electron 主进程、IPC 路由 |
| `preload.js` | 安全上下文桥接 |
| `fileScanner.js` | 文件扫描、元数据读取、缩略图 |
| `duplicateChecker.js` | 重复检测算法 |
| `dataManager.js` | 项目数据管理、验证、统计 |
| `exporter.js` | 导出 CSV、HTML、图片重命名 |
| `renderer/app.js` | 前端 UI 交互逻辑 |

## 常见问题

### Q: 支持哪些图片格式？
A: 目前支持 JPG、PNG、WebP 三种常见格式。

### Q: 数据保存在哪里？
A: 项目数据需要手动保存为 JSON 文件，你可以选择任意位置。照片本身不会被移动，导出时才会复制。

### Q: 如何添加更多商品？
A: 点击"创建新商品"按钮，然后将照片分配给它。

### Q: 导出的照片会修改原图吗？
A: 不会。导出时会**复制**图片到 output 文件夹，原图保持不变。

### Q: 可以在多台电脑间同步吗？
A: 可以。保存项目文件后，复制 JSON 文件和照片文件夹到另一台电脑即可。注意保持照片的相对路径。

## 更新日志

### v1.0.0
- 初始版本
- 照片扫描与管理
- 商品分组与编辑
- 重复图片检测
- 待处理问题清单
- JSON 项目保存/加载
- CSV/HTML 导出功能

## 许可证

MIT License

---

**使用愉快！** 📦✨

如有问题或建议，欢迎提 Issue。
