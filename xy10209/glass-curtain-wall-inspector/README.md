# 玻璃幕墙巡检缺陷标注器

Glass Curtain Wall Inspection Tool - 专业的物业巡检缺陷管理工具

## 项目概述

本系统是一个基于 Vue 3 + TypeScript + Pinia 的纯前端玻璃幕墙巡检缺陷标注工具，专为物业巡检人员设计。系统以建筑立面网格为核心，支持裂纹、松动两类缺陷的标注与追踪，并提供完整的状态流转和本地导出功能。

## 核心功能

### 🏢 立面网格可视化
- 按建筑楼层和列数动态生成网格
- 彩色标注显示缺陷位置（红色=裂纹，橙色=松动）
- 点击网格单元快速创建或查看缺陷
- 实时显示缺陷数量统计

### 📍 缺陷标注
- **缺陷类型**：裂纹 (Crack)、松动 (Looseness)
- **位置追踪**：精确定位到具体楼层和列
- **照片附件**：支持上传缺陷照片（本地预览）
- **巡检备注**：详细的缺陷描述和备注

### 🔄 状态流转（完整业务闭环）
```
待处理 (Pending)
    ↓
处理中 (In Progress)
    ↓
已复检 (Reinspected)
    ↓
已关闭 (Closed)
```
- 每次流转必须填写备注
- 完整的流转历史记录
- 支持返工和重新打开

### 🔍 多维度筛选
- 按建筑筛选
- 按状态筛选
- 按缺陷类型筛选
- 实时统计显示

### 📊 本地导出
- **JSON 格式**：完整数据导出，包含建筑、缺陷、统计信息
- **CSV 格式**：表格形式，便于 Excel 处理
- 支持全局导出和单建筑导出

## 启动方式

### 前置要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖
```bash
cd glass-curtain-wall-inspector
npm install
```

### 开发模式
```bash
npm run dev
```

启动后访问: http://localhost:5173

### 构建生产版本
```bash
npm run build
```

### 预览构建结果
```bash
npm run preview
```

## 样例数据位置

样例数据包含 2 个建筑和 5 条缺陷记录：

- **文件路径**：`src/data/sampleData.ts`
- **建筑 1**：金融中心A座 (8层 × 10列) - 3条缺陷
- **建筑 2**：科技园B栋 (6层 × 8列) - 2条缺陷

数据结构：
```typescript
interface Building {
  id: string;
  name: string;
  floors: number;      // 楼层数
  columns: number;     // 列数
  description?: string;
}

interface Defect {
  id: string;
  buildingId: string;
  floor: number;       // 楼层
  column: number;      // 列
  type: DefectType;    // crack | looseness
  status: DefectStatus;
  description: string;
  photos: Photo[];
  createdAt: number;
  updatedAt: number;
}
```

## 主流程演示

### 流程 1：新建缺陷标注
1. 打开页面，点击「开始演示」
2. 在顶部选择「金融中心A座」
3. 在立面网格中点击任意蓝色（正常）单元格
4. 填写缺陷表单：
   - 类型：选择「裂纹」或「松动」
   - 描述：必填，详细说明缺陷情况
   - 可选：上传照片
5. 点击「创建缺陷」
6. 观察：网格单元格变色，控制台输出 `[创建] 缺陷成功`

**关键判断**：
- 表单验证失败时，控制台会输出 `[表单] 验证失败`
- 创建成功后，网格单元变为对应颜色

### 流程 2：状态流转演示
1. 点击网格中任意红色/橙色单元格（已有缺陷）
2. 右侧打开详情面板
3. 在「状态流转」区域填写备注（必填）
4. 根据当前状态点击可用按钮：
   - 待处理 → 开始处理 / 直接关闭
   - 处理中 → 申请复检 / 关闭工单
   - 已复检 → 返工处理 / 验收通过
   - 已关闭 → 重新打开
5. 观察：状态徽章变化，流转历史新增记录

**关键判断**：
- 未填写备注时，会弹出「请填写流转备注」
- 非法状态流转（如待处理→已复检）控制台输出 `[错误] 非法状态流转`

### 流程 3：筛选与导出
1. 在筛选面板选择条件：
   - 状态：选择「待处理」
   - 类型：选择「裂纹」
2. 观察：列表和统计数字实时更新
3. 点击「全局导出」→「JSON」或「CSV」
4. 观察：浏览器自动下载文件，控制台输出导出信息

**关键判断**：
- 导出后检查文件内容包含筛选后的缺陷
- 控制台显示 `[导出] JSON报告: X 条缺陷记录`

### 流程 4：重置样例数据
1. 点击筛选面板中的 🔄 按钮
2. 确认重置
3. 观察：欢迎弹窗重新出现，控制台输出 `[系统] 数据已重置为样例数据`

## 异常操作示例

### 异常 1：未选择建筑创建缺陷
**操作**：不选择建筑，直接点击网格区域
**结果**：
- 弹出提示「请先在顶部选择一个建筑」
- 控制台输出 `[错误] 创建缺陷失败：建筑不存在`

### 异常 2：表单验证失败
**操作**：创建缺陷时不填写描述
**结果**：
- 表单显示红色错误提示「请填写缺陷描述」
- 控制台输出 `[表单] 验证失败: { description: '请填写缺陷描述' }`

### 异常 3：非法状态流转
**操作**：尝试将「待处理」直接流转为「已复检」
**结果**：
- 详情面板不显示该操作按钮（UI 层面拦截）
- 如果通过代码强行调用，控制台输出 `[错误] 非法状态流转: pending -> reinspected`
- 返回值为 `false`

### 异常 4：流转未填写备注
**操作**：点击流转按钮但不填写备注
**结果**：
- 弹出 alert 「请填写流转备注」
- 控制台输出 `[流转] 请填写流转备注`

### 异常 5：越界位置创建
**操作**：在代码中调用 `createDefect` 传入超出建筑范围的楼层/列
**结果**：
- 控制台输出 `[错误] 创建缺陷失败：楼层 99 超出范围 (1-8)`
- 返回值为 `null`

## 技术栈

- **框架**：Vue 3 (Composition API)
- **语言**：TypeScript
- **构建工具**：Vite
- **状态管理**：Pinia
- **图标库**：Lucide Vue Next
- **数据存储**：浏览器 localStorage

## 数据持久化

- 首次加载时使用样例数据
- 后续操作自动保存到 `localStorage`
- 存储键名：
  - `glass-curtain-wall-inspector-data-buildings`
  - `glass-curtain-wall-inspector-data-defects`
  - `glass-curtain-wall-reinspection`

## 调试建议

1. **打开控制台**：按 F12 或 Ctrl+Shift+I
2. **查看操作日志**：所有关键操作都会在 Console 输出
   - `[选择] 建筑/缺陷`
   - `[创建] 缺陷成功/失败`
   - `[流转] 状态: X -> Y`
   - `[导出] JSON/CSV报告`
   - `[错误] 具体错误信息`

3. **验证数据**：在 Console 执行
   ```javascript
   // 查看当前数据
   localStorage.getItem('glass-curtain-wall-inspector-data-defects')
   
   // 清空数据（恢复样例）
   localStorage.clear()
   location.reload()
   ```

## 目录结构

```
glass-curtain-wall-inspector/
├── src/
│   ├── components/
│   │   ├── FacadeGrid.vue      # 立面网格组件
│   │   ├── DefectForm.vue      # 缺陷表单
│   │   ├── DefectDetail.vue    # 缺陷详情&流转
│   │   ├── DefectList.vue      # 缺陷列表
│   │   └── FilterPanel.vue     # 筛选面板
│   ├── stores/
│   │   └── inspectorStore.ts   # Pinia 状态管理
│   ├── data/
│   │   └── sampleData.ts       # 样例数据
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   ├── App.vue                 # 主应用
│   ├── main.ts                 # 入口文件
│   └── style.css               # 全局样式
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 辨识度说明

本项目的核心辨识度来自：

1. **建筑立面网格**：
   - 不是普通的列表，而是可视化的网格布局
   - 网格单元的颜色直接反映缺陷状态
   - 支持不同建筑的不同网格规模

2. **缺陷位置追踪**：
   - 精确定位到「楼层-列」坐标
   - 同一位置可存在多条历史缺陷
   - 网格与列表双向联动

3. **完整业务闭环**：
   - 从标注到流转到导出
   - 状态机约束确保流程合规
   - 历史留痕可追溯
