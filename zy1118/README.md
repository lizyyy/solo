# 布展预演工具 (Exhibition Planner)

一个 3D/交互可视化的布展预演工具，专为小型展会、学校市集或公司开放日设计。告别 Excel 和手绘图，提前发现展架挡出口、人流对冲、通道太窄、用电超容等问题。

## 功能特性

### 可视化
- **3D 展厅视图**：使用 Three.js 渲染可旋转的 3D 场景
- **俯视平面图**：Canvas 2D 渲染，支持拖拽、缩放、平移
- **视图切换**：一键切换视图模式

### 数据导入
支持导入以下格式文件：
- `hall.json` - 展厅配置（尺寸、入口、出口、柱子）
- `booths.csv` - 展位列表（位置、大小、类型、功率需求）
- `flow.csv` - 人流区域
- `power-zones.json` - 供电分区配置

### 交互功能
- **展位拖拽**：在俯视图中拖动展位
- **网格吸附**：拖拽时自动对齐到网格
- **多方案管理**：创建、保存、加载多个方案版本

### 规则校验引擎
自动检测以下风险并在图上高亮显示：

| 规则 | 描述 | 风险等级 |
|------|------|----------|
| 展位重叠 | 两个或多个展位位置重叠 | 严重 |
| 出口被遮挡 | 展位或道具挡住消防出口 | 严重 |
| 入口缓冲区域 | 入口 3 米内布置展位造成拥堵 | 高 |
| 通道宽度不足 | 通道宽度小于消防要求（默认 1.5 米） | 高 |
| 功率超限 | 同一供电区域总功率超过容量 | 高 |
| 热门摊位拥挤 | 热门展位间距过近造成人流对冲 | 中 |
| 关键设施路径 | 入口到舞台/服务台路径有明显障碍 | 中 |

### 方案对比
- 对比两个方案的风险数量
- 预计拥堵热区对比
- 用电余量对比
- 智能推荐较优方案

### 报告导出
支持导出三种格式的布展核对报告：
- **JSON**：结构化数据
- **Markdown**：可读文档
- **HTML**：格式化网页报告

## 项目结构

```
zy1118/
├── package.json              # 根配置（npm workspaces）
├── server/                   # 后端 API
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts          # Express 入口
│   │   ├── types/            # 类型定义
│   │   ├── database/         # SQLite 初始化
│   │   ├── repositories/     # 数据访问层
│   │   ├── services/         # 业务逻辑
│   │   │   ├── validationService.ts   # 规则引擎
│   │   │   ├── reportService.ts       # 报告生成
│   │   │   ├── comparisonService.ts   # 方案对比
│   │   │   └── importService.ts       # 数据导入
│   │   └── routes/           # API 路由
│   │       ├── plans.ts      # 方案管理
│   │       └── import.ts     # 数据导入
│   └── test/
│       └── index.ts          # 后端测试脚本
├── client/                   # 前端应用
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.tsx          # React 入口
│   │   ├── index.css         # Tailwind 样式
│   │   ├── types.ts          # 前端类型
│   │   ├── services/
│   │   │   └── api.ts        # API 封装
│   │   ├── utils/
│   │   │   └── geometry.ts   # 几何计算
│   │   └── components/
│   │       ├── App.tsx               # 主应用
│   │       ├── ThreeDView.tsx        # 3D 视图
│   │       ├── TopDownView.tsx       # 俯视图
│   │       ├── ValidationPanel.tsx   # 校验面板
│   │       └── ImportModal.tsx       # 导入对话框
│   └── index.html
└── examples/                 # 示例数据文件
    ├── hall.json
    ├── booths.csv
    ├── flow.csv
    └── power-zones.json
```

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
# 在项目根目录
npm install
```

### 运行开发模式

```bash
# 终端 1：启动后端（端口 3001）
cd server
npm run dev

# 终端 2：启动前端（端口 5173）
cd client
npm run dev
```

然后在浏览器打开 http://localhost:5173

### 运行测试

```bash
cd server
npm run test
```

## API 文档

### 方案管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/plans` | 获取所有方案 |
| POST | `/api/plans` | 创建新方案 |
| GET | `/api/plans/:id` | 获取单个方案 |
| PUT | `/api/plans/:id` | 更新方案 |
| DELETE | `/api/plans/:id` | 删除方案 |

### 校验和报告

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/plans/:id/validate` | 运行规则校验 |
| GET | `/api/plans/:id/report?format=json` | 导出 JSON 报告 |
| GET | `/api/plans/:id/report?format=markdown` | 导出 Markdown 报告 |
| GET | `/api/plans/:id/report?format=html` | 导出 HTML 报告 |
| GET | `/api/plans/compare/:planAId/:planBId` | 对比两个方案 |

### 数据导入

| 方法 | 路径 | 内容类型 | 描述 |
|------|------|----------|------|
| POST | `/api/import/hall` | application/json | 导入展厅配置 |
| POST | `/api/import/booths` | text/csv | 导入展位列表 |
| POST | `/api/import/flow` | text/csv | 导入人流区域 |
| POST | `/api/import/power-zones` | application/json | 导入供电分区 |

## 数据格式说明

### hall.json（展厅配置）

```json
{
  "id": "hall-main",
  "name": "一号展厅",
  "dimensions": {
    "width": 40,
    "depth": 30,
    "height": 6
  },
  "gridSize": 1,
  "entrances": [
    {
      "id": "entrance-main",
      "name": "主入口",
      "position": { "x": 15, "y": 0 },
      "size": { "width": 10, "depth": 1 },
      "isMain": true
    }
  ],
  "exits": [...],
  "pillars": [...],
  "walls": [],
  "fixedObstacles": []
}
```

### booths.csv（展位列表）

```csv
id,name,type,x,y,width,depth,height,is_popular,power_demand,notes
booth-001,科技公司A,standard,2,3,3,3,2.5,false,800,智能产品展示
booth-002,食品展区,food,6,3,3,3,2.5,true,1500,试吃活动
```

**展位类型**: `standard`(标准), `premium`(特装), `food`(食品), `service`(服务), `stage`(舞台), `info_desk`(服务台), `sponsor`(赞助商)

### power-zones.json（供电分区）

```json
[
  {
    "id": "power-zone-1",
    "name": "A区供电",
    "position": { "x": 0, "y": 0 },
    "size": { "width": 20, "depth": 15 },
    "maxPower": 15000,
    "circuitBreakers": [
      { "id": "cb-1", "name": "A1路", "maxPower": 5000 }
    ]
  }
]
```

## 操作指南

### 1. 创建新方案

1. 打开应用，默认使用演示数据
2. 点击「新建方案」按钮
3. 或导入自己的数据文件

### 2. 导入数据

1. 点击「导入数据」按钮
2. 在标签页中选择要导入的数据类型
3. 拖拽文件或点击选择文件
4. 确认导入后数据会自动应用到当前方案

### 3. 调整布局

**俯视图操作**：
- **拖拽展位**：点击展位按住拖动
- **网格吸附**：释放时自动对齐到最近网格线
- **平移**：按住鼠标中键或空格 + 左键拖动
- **缩放**：鼠标滚轮

**3D 视图操作**：
- **旋转**：按住左键拖动
- **平移**：按住右键拖动
- **缩放**：鼠标滚轮

### 4. 运行规则校验

1. 点击「规则校验」按钮
2. 校验结果会显示在右侧面板
3. 点击任一问题项，会自动定位到对应位置
4. 红色球体表示风险点位置

### 5. 保存和管理方案

1. 点击「保存方案」
2. 输入方案名称（可选）
3. 刷新页面后可通过「加载方案」恢复
4. 支持创建多个版本进行对比

### 6. 对比方案

1. 保存至少两个方案版本
2. 调用 API 或通过 UI 选择对比
3. 查看风险数量、热区分布、用电余量的差异

### 7. 导出报告

1. 点击「导出报告」
2. 选择格式（JSON/Markdown/HTML）
3. 报告自动下载到本地

## 技术栈

**后端**：
- Node.js + Express
- TypeScript + tsx
- better-sqlite3 (SQLite 数据库)
- csv-parser (CSV 解析)
- multer (文件上传)
- uuid

**前端**：
- React 18
- Vite
- Three.js (3D 渲染)
- TailwindCSS (样式)
- Axios (HTTP 客户端)

## 测试验证

### 后端单元测试

```bash
cd server
npm run test
```

测试覆盖：
1. 规则引擎 - 展位重叠检测
2. 规则引擎 - 出口遮挡检测
3. 规则引擎 - 入口缓冲区域检测
4. 规则引擎 - 热门摊位拥挤检测
5. 报告生成 - Markdown 格式
6. 报告生成 - HTML 格式
7. 方案对比功能
8. CSV 解析 - 展位数据
9. JSON 解析 - 展厅配置
10. 无问题方案校验

### 手动验证流程

1. **数据导入验证**
   - 导入 `examples/` 下的示例文件
   - 检查展厅尺寸、展位数量是否正确

2. **拖拽保存验证**
   - 在俯视图拖动一个展位
   - 点击「保存方案」
   - 刷新页面，点击「加载方案」
   - 确认展位位置已恢复

3. **风险校验验证**
   - 故意将一个展位拖到另一个展位上
   - 点击「规则校验」
   - 确认检测到「展位重叠」问题
   - 确认图上显示红色风险点

4. **报告导出验证**
   - 点击「导出报告」→ 选择 Markdown
   - 打开下载的文件，检查内容格式

## 持久化说明

数据存储在 `server/data/` 目录下的 SQLite 数据库中：
- 表名：`plans`
- 字段：`id`, `name`, `description`, `created_at`, `updated_at`, `hall_data`, `booths_data`, `flow_zones_data`, `power_zones_data`

刷新页面后，通过「加载方案」按钮可以恢复之前保存的方案。

## 常见问题

**Q: 3D 视图加载缓慢？**
A: Three.js 的初始化可能需要几秒，首次加载请耐心等待。

**Q: 为什么拖拽展位时有时对齐不准？**
A: 网格吸附使用四舍五入，确保在拖动结束时再释放鼠标。

**Q: 规则校验结果怎么解读？**
A: 红色 = 严重（需立即处理），橙色 = 高，黄色 = 中，蓝色 = 低。建议优先处理严重和高等级问题。

**Q: 如何扩展自定义规则？**
A: 在 `server/src/services/validationService.ts` 中添加新的规则函数，然后在 `validationRules` 数组中注册。

## 许可证

MIT
