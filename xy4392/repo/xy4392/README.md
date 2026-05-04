# 小型摄影棚布光预演工具

一个用于摄影棚布光设计和预演的 3D 可视化工具，支持方案管理、风险检测和导出功能。

## 功能特性

- **3D 可视化场景**：使用 Three.js 渲染摄影棚 3D 场景
- **交互式布光**：拖拽灯位、旋转角度、调整高度
- **数据导入**：
  - 灯具清单 CSV 导入
  - 机位/演员走位 JSON 导入
  - 拍摄日程 JSON 导入
- **方案持久化**：所有数据保存到 SQLite 数据库，刷新不丢失
- **智能风险检测**：
  - 功率超载检测
  - 灯架挡镜头检测
  - 演员靠近高温灯具检测
  - 场次资源冲突检测
- **人工改判**：支持对自动检测的风险进行人工改判
- **导出功能**：
  - Markdown 格式布光交接单
  - JSON 格式审计包

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建工具
- Three.js + @react-three/fiber (3D 渲染)
- Ant Design (UI 组件)
- Zustand (状态管理)
- Axios (HTTP 客户端)

### 后端
- Node.js + Express + TypeScript
- better-sqlite3 (SQLite 数据库)
- Joi (数据验证)
- Papaparse (CSV 解析)

## 项目结构

```
xy4392/
├── backend/                # 后端项目
│   ├── src/
│   │   ├── database/      # 数据库配置和模型
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑服务
│   │   ├── types/         # TypeScript 类型定义
│   │   └── server.ts      # 服务器入口
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 服务
│   │   ├── store/         # Zustand 状态管理
│   │   ├── types/         # TypeScript 类型定义
│   │   └── App.tsx        # 应用入口
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── examples/               # 示例数据文件
│   ├── lights.csv         # 灯具清单示例
│   ├── camera_actor.json  # 机位和演员示例
│   └── schedule.json      # 拍摄日程示例
└── README.md
```

## 安装和运行

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 1. 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 2. 启动后端服务

```bash
cd backend
npm run dev
```

后端服务将在 `http://localhost:3001` 启动

### 3. 启动前端开发服务器

打开新终端窗口：

```bash
cd frontend
npm run dev
```

前端应用将在 `http://localhost:5173` 启动

### 4. 访问应用

在浏览器中打开 `http://localhost:5173`

## 使用说明

### 1. 创建新方案

1. 进入方案列表页面
2. 点击"新建方案"按钮
3. 填写方案名称、描述和摄影棚尺寸（宽、深、高，单位：米）
4. 设置最大总功率限制（单位：瓦特）
5. 点击"创建"

### 2. 导入数据

在编辑器页面的右侧面板，切换到"导入"标签页：

#### 导入灯具清单 CSV
- 选择 `examples/lights.csv` 文件
- CSV 格式说明：
  ```csv
  name,type,power,colorTemp,dmxChannel,isHighTemp
  主光 ARRI 1.2K HMI,聚光灯,1200,5600,1,true
  ```
  - `name`: 灯具名称（必填）
  - `type`: 灯具类型
  - `power`: 功率（瓦特）
  - `colorTemp`: 色温（开尔文）
  - `dmxChannel`: DMX 通道号
  - `isHighTemp`: 是否高温灯具（true/false）

#### 导入机位和演员 JSON
- 选择 `examples/camera_actor.json` 文件
- 支持中英文混合列名

#### 导入拍摄日程 JSON
- 选择 `examples/schedule.json` 文件

### 3. 3D 场景交互

#### 视角控制
- **鼠标左键拖动**：旋转视角
- **鼠标右键拖动**：平移视角
- **鼠标滚轮**：缩放视角

#### 灯具操作
1. **放置灯具**：在灯具清单中选择灯具，点击场景中的位置放置
2. **选中灯具**：点击场景中的灯具模型
3. **拖拽移动**：选中灯具后，使用坐标轴控制器拖动
4. **调整参数**：在右侧"布光"标签页中调整强度、高度等参数
5. **删除灯具**：选中后按 Delete 键或点击删除按钮

#### 场景区点
- 右下角有坐标轴指示器，帮助判断方向
- 网格地板显示坐标参考

### 4. 风险检测

1. 点击右侧面板的"风险"标签
2. 点击"重新计算风险"按钮
3. 系统将自动检测以下风险：

#### 检测类型

| 风险类型 | 检测逻辑 | 安全阈值 |
|---------|---------|---------|
| 功率超载 | 总功率 > 最大限制 | 可在方案设置中配置 |
| 灯架挡镜头 | 相机视线与灯架圆柱相交 | - |
| 演员高温风险 | 演员位置与高温灯具距离过近 | 1.5 米 |
| 场次冲突 | 同一资源在重叠时间被多次分配 | 时间范围重叠即冲突 |

#### 人工改判
- 对于系统误判的风险，可以进行人工改判
- 点击风险项的"人工改判"按钮
- 填写改判原因
- 改判后风险项状态变为"已改判"，不再影响评估

### 5. 导出功能

在编辑器页面点击右上角的"导出"按钮：

#### 导出 Markdown 布光交接单
包含内容：
- 方案基本信息（名称、描述、尺寸）
- 已放置灯具清单（位置、功率、参数）
- 机位和演员信息
- 拍摄日程安排
- 风险检测报告（含人工改判信息）

#### 导出 JSON 审计包
包含所有方案数据的完整 JSON，可用于：
- 数据备份
- 方案迁移
- 第三方系统集成

### 6. 方案管理

- **保存方案**：自动实时保存，也可手动点击保存
- **加载方案**：从方案列表选择方案打开
- **删除方案**：在方案列表删除（注意：删除不可恢复）
- **复制方案**：创建现有方案的副本

## 示例数据说明

### `examples/lights.csv` - 灯具清单示例
包含 8 种常见摄影棚灯具：
- 主光 ARRI 1.2K HMI（高温）
- 辅光 Aputure 300D（LED，非高温）
- 轮廓光 Kino Flo 4尺
- 背景光 Dedolight 150W（高温）
- 顶灯 Chimera 软箱
- 效果灯 LED 面板
- 钨丝灯 1K Fresnel（高温）
- HMItween 2.5K（高温）

### `examples/camera_actor.json` - 机位和演员示例
- **演员**：男主角、女主角（含走位路径）
- **机位**：A 机主机位、B 机侧机位

### `examples/schedule.json` - 拍摄日程示例
包含 4 个场次，其中：
- 场次 S01 (09:00-11:00) 和 S02 (10:30-12:00) 时间重叠
- 两场均使用同一灯具，会触发"灯具场次冲突"检测

## API 接口文档

### 方案管理
- `GET /api/plans` - 获取方案列表
- `POST /api/plans` - 创建新方案
- `GET /api/plans/:id` - 获取方案详情
- `PUT /api/plans/:id` - 更新方案
- `DELETE /api/plans/:id` - 删除方案

### 灯具管理
- `GET /api/plans/:id/lights` - 获取方案灯具
- `POST /api/plans/:id/lights` - 添加灯具
- `PUT /api/plans/:id/lights/:lightId` - 更新灯具
- `DELETE /api/plans/:id/lights/:lightId` - 删除灯具

### 演员和机位
- `GET /api/plans/:id/actors` - 获取演员列表
- `POST /api/plans/:id/actors` - 添加演员
- `PUT /api/plans/:id/actors/:actorId` - 更新演员
- `DELETE /api/plans/:id/actors/:actorId` - 删除演员

（机位接口类似）

### 风险检测
- `POST /api/plans/:id/calculate-risks` - 重新计算风险
- `PUT /api/plans/:id/risks/:riskId/override` - 人工改判风险
- `PUT /api/plans/:id/risks/:riskId/restore` - 恢复风险

### 导入导出
- `POST /api/plans/:id/import/lights` - 导入灯具 CSV
- `POST /api/plans/:id/import/camera-actor` - 导入机位/演员 JSON
- `POST /api/plans/:id/import/schedule` - 导入日程 JSON
- `GET /api/plans/:id/export/markdown` - 导出 Markdown
- `GET /api/plans/:id/export/json` - 导出 JSON 审计包

## 注意事项

1. **数据库**：使用 SQLite，数据文件默认存储在 `backend/data/lighting-studio.db`
2. **3D 性能**：如果场景中灯具过多，可能会影响性能，建议限制在 20 个以内
3. **单位**：所有 3D 坐标单位为米，功率单位为瓦特
4. **高温灯具**：HMI、钨丝灯等传统灯具标记为高温，LED 灯具通常为非高温
5. **安全距离**：高温灯具与演员的默认安全距离为 1.5 米

## 故障排查

### 后端启动失败
- 检查端口 3001 是否被占用
- 检查 Node.js 版本是否 >= 16.0.0
- 删除 `node_modules` 重新 `npm install`

### 前端无法连接后端
- 确认后端服务已启动在端口 3001
- 检查防火墙设置
- 检查 `frontend/vite.config.ts` 中的代理配置

### 3D 场景无法显示
- 检查浏览器是否支持 WebGL
- 更新显卡驱动
- 尝试使用 Chrome 或 Firefox 浏览器

### 导入失败
- 检查 CSV/JSON 格式是否正确
- 查看浏览器控制台的错误信息
- 确保文件编码为 UTF-8

## 构建生产版本

### 构建后端
```bash
cd backend
npm run build
npm start
```

### 构建前端
```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist` 目录，可以部署到静态文件服务器。

## 许可证

本项目仅供学习和内部使用。
