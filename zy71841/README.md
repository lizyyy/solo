# 展车动线预演系统

## 项目简介

展车动线预演系统用于处理展厅展车布置前的材料包核验，解决模型清单、巡检照片不同步，重复项难识别，人工更正无追溯的问题。

## 功能特性

### 1. 材料包导入
- 支持拖拽上传多种格式文件（zip、xlsx、xls、csv、jpg、png）
- 自动解析并标注异常（晚到附件、重复项、待处理）
- 导入前预览和逐条确认
- 基于车型+VIN后6位自动识别重复记录

### 2. 记录总览
- 卡片式列表展示所有记录
- 按状态、来源、修改人多维度筛选
- 每条记录显示来源、状态、修改人、待处理原因
- 点击查看完整修改历史，支持版本对比

### 3. 路线规划
- SVG展厅平面图，支持缩放和平移
- 点击画布绘制讲解路线
- 自动检测路线与展品的冲突
- 冲突位置红色高亮显示
- 路线历史版本管理和对比导出

### 4. 巡检单复核
- 左右分栏对比巡检单与明细
- 差异项自动高亮
- 一键修正功能
- 复核完成后支持导出PDF和Excel

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS 3
- **状态管理**: Zustand
- **图标**: lucide-react
- **文件解析**: xlsx、jszip、papaparse
- **导出**: jspdf、xlsx

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 类型检查

```bash
npm run check
```

## 使用说明

### 1. 放置模型清单样例

将模型清单整理成Excel格式，包含以下列（支持中文或英文列名）：
- 车型 / carModel
- VIN码 / vin
- 颜色 / color
- 位置 / position
- 型号 / modelNumber
- 到店日期 / arrivalDate

### 2. 查看路线被挡住

1. 进入「路线规划」页面
2. 查看红色高亮区域即为冲突位置
3. 冲突信息栏显示被哪件展品挡住
4. 拖拽路线点调整位置

### 3. 导出巡检单前复核

1. 进入「巡检单复核」页面
2. 确保所有记录标记为「已复核」
3. 差异数必须为0
4. 待处理记录必须处理完毕
5. 点击「导出巡检单PDF」按钮

## 项目结构

```
src/
├── components/          # 公共组件
│   ├── Layout.tsx       # 布局组件
│   ├── StatusBadge.tsx  # 状态标签
│   ├── SourceLabel.tsx  # 来源标签
│   └── HistoryDrawer.tsx # 历史记录抽屉
├── pages/               # 页面组件
│   ├── ImportPage.tsx   # 材料包导入页
│   ├── RecordsPage.tsx  # 记录总览页
│   ├── RoutePage.tsx    # 路线规划页
│   └── ReviewPage.tsx   # 巡检单复核页
├── store/               # 状态管理
│   └── index.ts         # Zustand store
├── types/               # 类型定义
│   └── index.ts
├── utils/               # 工具函数
│   ├── helpers.ts       # 通用辅助函数
│   ├── fileParser.ts    # 文件解析器
│   └── exporter.ts      # 导出功能
├── data/                # 模拟数据
│   └── mockData.ts
├── App.tsx              # 应用入口
├── main.tsx             # 渲染入口
└── index.css            # 全局样式
```

## 数据状态说明

- **正常 (normal)**: 记录完整，无异常
- **晚到 (late)**: 附件上传时间超过12小时阈值
- **重复 (duplicate)**: 车型+VIN后6位匹配到已有记录
- **待处理 (pending)**: 缺少关键字段或需要人工确认

## 数据来源说明

- **模型清单 (model_list)**: 从Excel/CSV导入的车型数据
- **巡检照片 (inspection_photo)**: 现场巡检拍摄的照片和记录
- **人工更正 (manual_correction)**: 项目经理手动修改的数据
