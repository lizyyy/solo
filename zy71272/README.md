# 乐队排练站位声像系统

专业的 3D 可视化乐队排练室声像分析系统，用于评审会展示和乐队排练优化。

## 功能特性

### 🎯 核心功能

1. **3D 站位可视化**
   - 基于 Three.js + React Three Fiber 的专业 3D 场景
   - 支持鼓、贝斯、人声、吉他、键盘等多乐器 3D 对象展示
   - 每个乐手有独特的颜色和图标标识
   - 可拖拽调整位置，自动吸附房间边界

2. **麦克风管理**
   - 动圈/电容麦克风类型配置
   - 位置和增益调节
   - 目标乐器关联

3. **方案管理与持久化**
   - **双端持久化**：IndexedDB 本地存储 + Express 后端文件存储
   - 支持新建、保存、另存为、加载、删除方案
   - 换浏览器或重启服务后数据不丢失
   - 方案列表显示乐手数量、监听点数量、问题数量

4. **报告导出**
   - 支持 PDF 和 PNG 图片格式导出
   - 包含总体评分、音量平衡评分、问题检测
   - 显示乐手配置、监听点声压级、房间信息
   - 导出时自动保存报告到方案历史

5. **侧边数据面板**
   - **乐手**：位置、朝向、声源强度、指向性调整
   - **麦克风**：类型、位置、增益、目标乐器
   - **监听点**：位置、实时声压级显示
   - **房间**：尺寸、墙面材质、混响时间、环境噪声
   - **检测**：三大检测规则说明和状态

### 🔍 场景检测引擎

| 场景 | 检测规则 | 可视化反馈 |
|------|---------|-----------|
| **声源重叠** | 乐手间距 < 0.5m | 红色闪烁 + 错误列表 |
| **监听点缺失** | 声压级 < 60dB | 黄色高亮 + 位置提示 |
| **音量比例错误** | 单乐器占比 >60% 或 <10% | 警告标识 + 优化建议 |

### 🔗 模块校验闭环

```
拖拽/面板输入 → Store 更新
    ↳ 3D 视图更新（位置、颜色）
    ↳ 热力图重算（顶点着色）
    ↳ 场景检测（三大规则）
    ↳ 侧边面板同步（数据联动）
    ↳ 未保存标记（自动触发）
```

## 技术栈

### 前端

- **框架**：React 18 + TypeScript + Vite
- **3D 渲染**：Three.js + @react-three/fiber + @react-three/drei
- **后处理**：@react-three/postprocessing
- **状态管理**：Zustand（业务对象聚合）
- **本地存储**：idb（IndexedDB 封装）
- **报告导出**：html2canvas + jsPDF
- **UI 图标**：Lucide React

### 后端

- **框架**：Express + TypeScript
- **数据存储**：文件系统（JSON 格式）
- **跨域**：CORS

### 核心算法

- 反平方定律声压级计算
- 心形指向性模型
- 多声源声压级叠加
- 场景检测引擎

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
# 同时启动前端和后端
npm run dev

# 或分别启动
npm run client:dev    # 前端：http://localhost:5173
npm run server:dev    # 后端：http://localhost:3001
```

### 代码检查

```bash
npm run lint     # ESLint 检查
npm run check    # TypeScript 类型检查
npm run build    # 构建项目
```

## 项目结构

```
.
├── api/                      # 后端代码
│   ├── routes/
│   │   ├── auth.ts          # 认证路由（预留）
│   │   └── plans.ts         # 方案管理 API
│   ├── app.ts               # Express 应用配置
│   └── server.ts            # 服务器入口
├── src/
│   ├── components/
│   │   ├── three/           # 3D 组件
│   │   │   ├── Scene3D.tsx      # 3D 场景主容器
│   │   │   ├── Room.tsx         # 房间模型
│   │   │   ├── MusicianObject.tsx   # 乐手对象
│   │   │   ├── MicrophoneObject.tsx # 麦克风对象
│   │   │   ├── MonitorPointObject.tsx # 监听点对象
│   │   │   └── Heatmap.tsx        # 声像热力图
│   │   └── ui/              # UI 组件
│   │       ├── Toolbar.tsx       # 顶部工具栏
│   │       ├── Sidebar.tsx       # 侧边数据面板
│   │       ├── IssuePanel.tsx    # 场景检测浮窗
│   │       ├── ReportModal.tsx   # 报告弹窗
│   │       └── LoadModal.tsx     # 方案加载弹窗
│   ├── pages/
│   │   └── Home.tsx         # 主页面
│   ├── store/
│   │   └── useStore.ts      # Zustand 状态管理
│   ├── services/
│   │   └── db.ts            # IndexedDB 数据服务
│   ├── utils/
│   │   ├── constants.ts     # 常量定义
│   │   ├── helpers.ts       # 工具函数
│   │   ├── soundField.ts    # 声场计算
│   │   └── sceneDetection.ts # 场景检测引擎
│   ├── types/
│   │   └── index.ts         # 类型定义
│   └── main.tsx             # 应用入口
├── data/                     # 后端数据存储目录
├── package.json
├── vite.config.ts           # Vite 配置
├── eslint.config.js         # ESLint 配置
└── tsconfig.json            # TypeScript 配置
```

## 使用说明

### 基本操作

1. **调整站位**：直接拖拽 3D 场景中的乐手对象
2. **查看数据**：点击 3D 对象或使用侧边面板
3. **查看声场**：点击「声像热力图」按钮
4. **生成报告**：点击「报告」按钮，可导出 PDF/图片
5. **保存方案**：点击「保存」按钮，数据自动双端持久化

### 验证闭环

系统确保以下模块形成可验证闭环：

1. **3D 站位** → 拖拽更新 → 侧边面板数据同步
2. **麦克风** → 增益调节 → 声像热力图实时更新
3. **方案保存** → 点击保存 → IndexedDB + 后端双写
4. **报告导出** → 生成报告 → 自动保存到方案历史
5. **侧边面板** → 参数修改 → 3D 视图 + 场景检测联动

## API 接口

### 方案管理

- `GET /api/plans` - 获取所有方案列表
- `GET /api/plans/:id` - 获取单个方案详情
- `POST /api/plans` - 保存/更新方案
- `DELETE /api/plans/:id` - 删除方案

### 健康检查

- `GET /api/health` - 服务健康检查

## 开发说明

### 数据模型

核心业务对象为 `RehearsalPlan`（排练方案），聚合了：

- `Musician[]` - 乐手列表
- `Microphone[]` - 麦克风列表
- `MonitorPoint[]` - 监听点列表
- `RoomConfig` - 房间配置
- `RehearsalReport[]` - 报告历史

### 状态管理

使用 Zustand 进行状态管理，实现：

- 业务对象聚合
- 自动校验联动
- shallow 比较优化性能

## License

MIT
