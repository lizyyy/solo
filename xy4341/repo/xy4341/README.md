# 消防疏散三维演练台

一个给学校总务处和保安队使用的消防疏散模拟演练平台，支持在本地设置起火点后实时观察各楼层人流、拥堵点和不可用出口的变化。

## 功能特性

### 核心功能
- **3D/俯视视图展示**：使用 Three.js 渲染楼层平面图，支持多楼层查看
- **拖拽设置起火点**：在楼层平面图上点击设置起火点位置
- **实时疏散模拟**：人员寻路算法，实时显示人员移动状态
- **风险评估系统**：加权评分（拥堵35%、火势30%、出口20%、进度15%）
- **事件时间线**：记录演练过程中的所有事件
- **暂停改判**：支持演练过程中暂停、恢复、单步推进
- **数据持久化**：前端 Zustand + localStorage，后端 SQLite 数据库
- **导出功能**：Markdown 演练报告、JSON 审计包

### 数据模型
- **楼层 (Floor)**：教学楼各楼层配置
- **出口 (Exit)**：消防门状态（可用/阻塞/不可用）
- **人员 (Person)**：人员分布和状态
- **演练会话 (DrillSession)**：演练过程控制
- **起火点 (FirePoint)**：可拖拽设置的火情位置
- **演练事件 (DrillEvent)**：时间线事件记录
- **风险评估 (RiskAssessment)**：各维度评分
- **模拟快照 (SimulationSnapshot)**：模拟状态持久化
- **广播时间表 (BroadcastSchedule)**：演练广播安排

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动项目

**方式一：分别启动后端和前端**

```bash
# 启动后端 (端口 3001)
cd server
npm start

# 另开终端启动前端 (端口 3000)
cd client
npm run dev
```

**方式二：开发模式**

```bash
# 后端开发模式（自动重启）
cd server
npm run dev

# 前端开发模式
cd client
npm run dev
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 完整演练流程指南

### 第一步：配置环境数据

1. 点击左侧菜单「环境配置」
2. 点击「加载示例数据」按钮（推荐）
3. 或手动添加：
   - 楼层：设置楼层编号、名称、尺寸
   - 出口：设置出口位置、类型、容量
   - 人员：导入 CSV 或随机生成

### 第二步：创建演练

1. 点击顶部「创建演练」按钮
2. 输入演练名称，点击「创建」

### 第三步：开始演练

1. 点击顶部「开始演练」按钮
2. 系统会自动开始模拟疏散过程
3. 默认每 800ms 推进一个时间步

### 第四步：设置起火点（可选）

1. 点击顶部「设置起火点」按钮
2. 在楼层平面图上点击任意位置设置起火点
3. 起火点会阻断附近的出口，增加人员被困风险

### 第五步：控制演练

- **暂停/继续**：点击「暂停」按钮暂停演练，点击「继续」恢复
- **单步推进**：点击「单步」按钮手动推进一个时间步
- **查看状态**：右侧面板显示：
  - 风险评分（综合及各维度分数）
  - 人员状态统计（待疏散/疏散中/已疏散/被困/受伤）
  - 事件时间线

### 第六步：完成演练并导出

1. 点击「完成演练」按钮结束模拟
2. 点击「导出报告」按钮：
   - 预览 Markdown 报告
   - 下载 Markdown 演练报告
   - 下载 JSON 审计包

### 示例数据说明

加载示例数据后会创建：

**楼层配置 (3层教学楼):**
- 1层：80m × 60m，一楼大厅
- 2层：80m × 60m，二楼教室
- 3层：80m × 60m，三楼教室

**出口配置:**
- 1层：东门出口(主出口)、西门出口(主出口)、楼梯间A
- 2层：楼梯间A、走廊出口
- 3层：楼梯间A、紧急出口

**人员分布 (共135人):**
- 1层：40人
- 2层：50人
- 3层：45人

## 风险评分规则

风险评估采用加权评分系统：

| 维度 | 权重 | 说明 |
|------|------|------|
| 拥堵评分 | 35% | 人员聚集程度、疏散密度 |
| 火势评分 | 30% | 起火点数量、强度、影响范围 |
| 出口评分 | 20% | 可用出口比例、出口容量 |
| 进度评分 | 15% | 疏散完成率、被困受伤人员 |

**风险等级:**
- 极度危险 (≥80分)：红色预警
- 高风险 (≥60分)：橙色预警
- 中等风险 (≥40分)：黄色预警
- 低风险 (≥20分)：绿色预警
- 安全 (<20分)：安全状态

## 疏散模拟算法

### 人员寻路
1. 每个人员选择最近的可用出口
2. 按一定速度向出口移动
3. 遇到火情危险区时切换出口

### 拥堵检测
- 距离 < 2.5m 的 3 人以上视为拥堵簇
- 拥堵簇中心标记为拥堵点
- 拥堵影响人员移动速度

### 火情影响
- 起火点半径范围内视为危险区
- 危险区内人员可能被困或受伤
- 靠近起火点的出口会被阻断

### 出口状态
- 可用：人员可正常使用
- 阻塞：暂时不可用（被火情阻断）
- 不可用：永久不可用

## API 接口

### 楼层管理
- `GET /api/floors` - 获取所有楼层
- `POST /api/floors` - 创建楼层
- `PUT /api/floors/:id` - 更新楼层
- `DELETE /api/floors/:id` - 删除楼层

### 出口管理
- `GET /api/exits` - 获取所有出口
- `POST /api/exits` - 创建出口
- `PUT /api/exits/:id` - 更新出口
- `DELETE /api/exits/:id` - 删除出口

### 人员管理
- `GET /api/persons` - 获取所有人员
- `POST /api/persons/bulk` - 批量创建人员
- `POST /api/persons/import-csv` - 导入 CSV
- `DELETE /api/persons` - 清空所有人员

### 演练控制
- `GET /api/drills` - 获取所有演练会话
- `GET /api/drills/active` - 获取当前活跃演练
- `POST /api/drills` - 创建演练
- `POST /api/drills/:id/start` - 开始演练
- `POST /api/drills/:id/pause` - 暂停演练
- `POST /api/drills/:id/resume` - 恢复演练
- `POST /api/drills/:id/step` - 单步推进
- `POST /api/drills/:id/fire-point` - 添加起火点
- `POST /api/drills/:id/complete` - 完成演练
- `DELETE /api/drills/:id` - 删除演练

### 导出功能
- `GET /api/exports/:sessionId/report` - 下载 Markdown 报告
- `GET /api/exports/:sessionId/audit` - 下载 JSON 审计包
- `GET /api/exports/:sessionId/preview/report` - 预览报告
- `GET /api/exports/:sessionId/preview/audit` - 预览审计包

### 系统
- `GET /api/health` - 健康检查
- `GET /api/reset` - 重置数据库

## 项目结构

```
fire-evacuation-drill-platform/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── components/        # UI 组件
│   │   │   ├── FloorViewer.jsx       # 3D楼层视图
│   │   │   ├── ControlPanel.jsx      # 控制面板
│   │   │   ├── StatusPanel.jsx       # 人员状态面板
│   │   │   ├── TimelinePanel.jsx     # 事件时间线
│   │   │   ├── RiskIndicator.jsx     # 风险指示器
│   │   │   ├── SetupPanel.jsx        # 环境配置面板
│   │   │   └── ExportPanel.jsx       # 导出面板
│   │   ├── services/
│   │   │   └── api.js                # API 服务
│   │   ├── store/
│   │   │   └── index.js              # Zustand 状态管理
│   │   ├── App.jsx                   # 主应用
│   │   ├── App.css                   # 全局样式
│   │   └── main.jsx                  # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                    # 后端项目
│   ├── database/
│   │   └── db.js                     # SQLite 数据库封装
│   ├── models/
│   │   ├── Floor.js                  # 楼层模型
│   │   ├── Exit.js                   # 出口模型
│   │   ├── Person.js                 # 人员模型
│   │   ├── DrillSession.js           # 演练会话模型
│   │   ├── FirePoint.js              # 起火点模型
│   │   ├── DrillEvent.js             # 演练事件模型
│   │   ├── RiskAssessment.js         # 风险评估模型
│   │   ├── SimulationSnapshot.js     # 模拟快照模型
│   │   └── BroadcastSchedule.js      # 广播时间表模型
│   ├── routes/
│   │   ├── floors.js                 # 楼层路由
│   │   ├── exits.js                  # 出口路由
│   │   ├── persons.js                # 人员路由
│   │   ├── drills.js                 # 演练控制路由
│   │   └── exports.js                # 导出路由
│   ├── services/
│   │   ├── EvacuationSimulator.js    # 疏散模拟引擎
│   │   ├── RiskEvaluator.js          # 风险评估服务
│   │   └── ExportService.js          # 导出服务
│   ├── index.js                      # 服务器入口
│   └── package.json
│
└── README.md
```

## 技术栈

### 后端
- **Node.js** - 运行环境
- **Express** - Web 框架
- **sql.js** - SQLite 内存/文件数据库
- **uuid** - 唯一ID生成
- **multer** - 文件上传
- **papaparse** - CSV解析
- **archiver** - ZIP压缩

### 前端
- **React 18** - UI框架
- **Vite** - 构建工具
- **Three.js** - 3D渲染
- **@react-three/fiber** - React Three.js 绑定
- **@react-three/drei** - Three.js 辅助组件
- **Ant Design** - UI组件库
- **Zustand** - 状态管理
- **Axios** - HTTP客户端
- **dayjs** - 日期处理

## 常见问题

### 1. 启动后显示空白页面？
- 检查后端是否已启动 (端口 3001)
- 检查控制台是否有跨域错误
- 确认前后端都已安装依赖

### 2. 演练时没有人员移动？
- 确认已添加人员数据
- 确认已添加至少一个可用出口
- 人员需要从「待疏散」状态开始

### 3. 风险评分显示为0？
- 需要至少一个时间步的模拟
- 点击「开始演练」或「单步推进」

### 4. 如何导入自定义CSV人员数据？
CSV 格式示例：
```csv
floor_number,name,x,y,status,mobility
1,张三,10,10,idle,normal
1,李四,20,15,idle,slow
2,王五,15,20,idle,normal
```

## 开发说明

### 本地开发

```bash
# 后端开发模式 (支持热重载)
cd server
npm run dev

# 前端开发模式
cd client
npm run dev
```

### 构建生产版本

```bash
# 构建前端
cd client
npm run build

# 后端无需构建，直接运行
cd server
npm start
```

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或 PR。
