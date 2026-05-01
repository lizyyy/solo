# 消防演练复盘可视化工具

一个基于 Three.js 的 3D 交互式消防演练复盘可视化工具，帮助商场物业分析演练数据，发现疏散过程中的问题。

## 功能特性

- **3D 可视化**：多层楼面、楼梯/电梯井、出口、封闭通道和人员轨迹的 3D 展示
- **时间轴控制**：支持播放/暂停/拖动时间轴查看疏散过程
- **数据导入**：支持导入 CSV/JSON 格式的演练数据
- **智能分析**：
  - 计算实际用时与最优路径
  - 检测绕行距离
  - 识别经过封闭通道的人员
  - 判断是否选择最近安全出口
  - 检测通道拥堵、异常停留等异常情况
- **筛选功能**：按楼层、人群、异常类型筛选人员
- **人员详情**：点击人员显示轨迹摘要和观察员备注
- **报告导出**：支持导出 Markdown 复盘报告和 JSON 分析结果

## 项目结构

```
src/
├── main.js                 # 主入口文件
├── models/
│   ├── types.js            # 类型枚举定义
│   └── interfaces.js       # 数据模型接口
├── parsers/
│   ├── CSVParser.js        # CSV 数据解析器
│   └── DataLoader.js       # 数据加载器
├── analysis/
│   ├── PathFinder.js       # 路径寻路算法 (Dijkstra)
│   ├── AnomalyDetector.js  # 异常检测器
│   └── AnalysisEngine.js   # 分析引擎
├── renderer/
│   ├── SceneManager.js     # Three.js 场景管理
│   ├── FloorRenderer.js    # 楼层/通道/出口渲染
│   └── PersonRenderer.js   # 人员/轨迹/异常渲染
├── core/
│   └── TimelineController.js  # 时间轴控制器
├── ui/
│   └── UIManager.js        # UI 界面管理器
├── export/
│   └── ReportExporter.js   # 报告导出器
└── data/
    └── SampleDataGenerator.js  # 示例数据生成器
```

## 安装

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

1. 安装依赖：

```bash
npm install
```

2. 启动开发服务器：

```bash
npm run dev
```

3. 浏览器访问：`http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

## 数据格式

### CSV 文件格式

#### 1. 楼层数据 (floors.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 楼层唯一标识 |
| name | string | 楼层名称 |
| level | number | 楼层编号（如 1 表示一层，2 表示二层） |
| height | number | 楼层高度（米）|

示例：
```csv
id,name,level,height
floor_1,一层,1,4
floor_2,二层,2,4
```

#### 2. 节点数据 (nodes.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点唯一标识 |
| floor | string | 所属楼层 ID |
| x | number | X 坐标 |
| y | number | Y 坐标 |
| type | string | 节点类型（corner, stair, shop 等）|

示例：
```csv
id,floor,x,y,type
f1_nw,floor_1,-40,-30,corner
f1_center,floor_1,0,0,corner
f1_ne,floor_1,40,-30,corner
```

#### 3. 边数据 (edges.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 边唯一标识 |
| floor | string | 所属楼层 ID |
| from | string | 起点节点 ID |
| to | string | 终点节点 ID |
| type | string | 边类型（corridor, staircase, elevator） |
| width | number | 通道宽度（米）|
| blocked | boolean | 是否封闭 |
| blockReason | string | 封闭原因 |

示例：
```csv
id,floor,from,to,type,width,blocked,blockReason
edge_1,floor_1,f1_nw,f1_center,corridor,3,false,
edge_2,floor_1,f1_center,f1_s,corridor,3,true,演练中临时封闭
```

#### 4. 出口数据 (exits.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 出口唯一标识 |
| floor | string | 所属楼层 ID |
| node | string | 关联节点 ID |
| type | string | 出口类型（emergency, main, staircase） |
| isSafe | boolean | 是否为安全出口 |

示例：
```csv
id,floor,node,type,isSafe
exit_nw,floor_1,f1_nw,emergency,true
exit_ne,floor_1,f1_ne,emergency,true
```

#### 5. 人员数据 (persons.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 人员唯一标识 |
| name | string | 人员名称 |
| group | string | 所属分组（员工、顾客、商铺人员等） |
| startX | number | 起始 X 坐标 |
| startY | number | 起始 Y 坐标 |
| startFloor | number | 起始楼层 |

示例：
```csv
id,name,group,startX,startY,startFloor
p1,张三,商铺人员,-20,-15,1
p2,李四,顾客,20,-15,1
```

#### 6. 轨迹数据 (trajectories.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| personId | string | 人员 ID |
| time | number | 时间（秒，从演练开始计算） |
| x | number | X 坐标 |
| y | number | Y 坐标 |
| floor | number | 所在楼层 |
| speed | number | 移动速度（米/秒） |

示例：
```csv
personId,time,x,y,floor,speed
p1,0,-20,-15,1,0
p1,30,0,0,1,1.2
p1,60,0,-30,1,1.5
p1,90,-40,-30,1,1.8
```

#### 7. 观察员备注 (observations.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| personId | string | 人员 ID |
| time | number | 时间（秒） |
| observer | string | 观察员名称 |
| note | string | 备注内容 |

示例：
```csv
personId,time,observer,note
p1,45,观察员A,在中心区域犹豫不决
p3,50,观察员B,引导其他人员
```

#### 8. 封闭通道 (blockedPaths.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| edgeId | string | 边 ID |
| reason | string | 封闭原因 |
| timeStart | number | 封闭开始时间（秒） |
| timeEnd | number | 封闭结束时间（秒，null 表示一直封闭） |

示例：
```csv
edgeId,reason,timeStart,timeEnd
edge_f1_center_f1_s,演练中临时封闭 - 模拟火灾区域,0,300
```

### JSON 数据格式

也可以通过单个 JSON 文件导入完整数据，格式如下：

```json
{
  "floors": [
    {
      "id": "floor_1",
      "name": "一层",
      "level": 1,
      "height": 4
    }
  ],
  "nodes": [...],
  "edges": [...],
  "exits": [...],
  "persons": [...],
  "trajectories": [...],
  "observations": [...],
  "blockedEdges": [...],
  "metadata": {
    "startTime": 0,
    "endTime": 300
  }
}
```

## 使用指南

### 1. 加载示例数据

1. 启动应用后，点击右侧面板的 **"加载示例数据"** 按钮
2. 系统将自动加载预设的 2 层商场演练数据
3. 3D 场景将显示楼层、通道、出口和 8 个模拟人员

### 2. 导入自定义数据

1. 点击 **"导入 CSV/JSON"** 按钮
2. 选择一个或多个 CSV/JSON 文件（支持批量选择）
3. 系统将自动解析并加载数据

**支持的文件命名约定**（自动识别）：
- `floors.csv` 或 `楼层*.csv` → 楼层数据
- `nodes.csv` 或 `节点*.csv` → 节点数据
- `edges.csv` 或 `边*.csv` 或 `连接*.csv` → 边数据
- `exits.csv` 或 `出口*.csv` → 出口数据
- `persons.csv` 或 `人员*.csv` → 人员数据
- `trajectories.csv` 或 `轨迹*.csv` 或 `移动*.csv` → 轨迹数据
- `observations.csv` 或 `观察*.csv` 或 `备注*.csv` → 观察记录
- `blockedPaths.csv` 或 `封闭*.csv` 或 `障碍物*.csv` → 封闭通道

### 3. 播放疏散过程

使用底部时间轴控制播放：

| 按钮 | 功能 |
|------|------|
| ⏹ | 停止并回到起点 |
| ⏮ | 后退 5 秒 |
| ▶/⏸ | 播放/暂停 |
| ⏭ | 前进 5 秒 |
| ⏩ | 跳转到结尾 |

**其他控制**：
- 拖动滑块可以直接跳转到任意时间点
- 速度选择：0.25x、0.5x、1x、2x、4x
- 循环播放：勾选"循环"复选框

### 4. 3D 场景交互

- **旋转视角**：按住鼠标左键拖动
- **平移视角**：按住鼠标中键或右键拖动
- **缩放**：鼠标滚轮
- **点击人员**：高亮选中人员并显示详细信息

### 5. 筛选人员

使用右侧面板的筛选条件：

1. **楼层筛选**：显示特定楼层的人员
2. **人群筛选**：按分组筛选（员工、顾客、商铺人员等）
3. **异常类型筛选**：
   - 全部人员
   - 有异常的人员
   - 走错出口的人员
   - 经过封闭通道的人员
   - 异常停留的人员
   - 方向错误的人员

点击 **"应用筛选"** 生效，**"重置筛选"** 恢复显示全部人员。

### 6. 查看人员详情

点击 3D 场景中的人员，右侧面板将显示：

- **基本信息**：姓名、分组
- **统计数据**：
  - 实际用时
  - 实际移动距离
  - 最优路径距离
  - 绕行距离和比例
  - 到达出口（是否为最近出口）
- **异常记录**：所有检测到的异常，包含时间和描述
- **观察员备注**：各观察员记录的备注信息

同时场景中会：
- 高亮选中人员（黄色）
- 显示完整的移动轨迹
- 相机自动聚焦到该人员的起始位置

### 7. 异常高亮显示

系统会自动高亮以下异常：

| 颜色/标识 | 含义 |
|-----------|------|
| 🔴 红色人员 | 有异常记录的人员 |
| 🟡 黄色人员 | 被选中的人员 |
| 🔵 蓝色人员 | 正常人员 |
| 🔴 红色通道 | 封闭通道 |
| 🟣 粉紫色区域 | 拥堵事件 |
| 🟠 橙色标记 | 异常事件位置 |
| 🟢 绿色锥形 | 安全出口 |

### 8. 导出报告

点击右侧面板底部的按钮：

- **"导出 Markdown"**：生成详细的复盘报告，包含：
  - 演练基本信息
  - 总体统计数据
  - 异常类型统计
  - 拥堵事件详情
  - 异常人员详情（含异常记录和观察员备注）
  - 改进建议

- **"导出 JSON"**：生成结构化的分析结果数据，包含：
  - 汇总统计
  - 所有人员的详细分析
  - 拥堵事件
  - 各楼层/分组的统计

## 示例数据说明

示例数据包含一个 2 层商场的模拟演练：

### 楼层布局
- **一层（L1）**：
  - 4 个主出口（四角）
  - 2 个楼梯间
  - 中央到南侧的通道临时封闭（模拟火灾区域）
  - 4 个商铺

- **二层（L2）**：
  - 餐厅、影院、办公区
  - 2 个楼梯间连接一层

### 模拟人员（8 人）

| ID | 姓名 | 分组 | 起始位置 | 异常情况 |
|----|------|------|----------|----------|
| p1 | 张三 | 商铺人员 | L1 商铺1 | 走错出口（选择西北出口而非最近的西南出口） |
| p2 | 李四 | 顾客 | L1 商铺2 | 经过封闭通道（试图穿过被封锁的区域） |
| p3 | 王五 | 员工 | L1 商铺3 | 正常疏散 |
| p4 | 赵六 | 顾客 | L1 商铺4 | 异常停留（在店铺门口等待 45 秒） |
| p5 | 孙七 | 商铺人员 | L1 中心 | 正常疏散 |
| p6 | 周八 | 顾客 | L1 西北出口 | 已在出口附近 |
| p7 | 吴九 | 顾客 | L2 餐厅 | 从二层下到一层 |
| p8 | 郑十 | 员工 | L2 影院 | 异常停留（组织疏散），走另一楼梯 |

## 技术栈

- **前端框架**：原生 JavaScript (ES6+)
- **3D 引擎**：Three.js 0.160+
- **构建工具**：Vite 5.0+
- **数据解析**：PapaParse (CSV 解析)
- **路径算法**：Dijkstra 最短路径

## 验证流程

按照以下步骤验证所有功能：

### 1. 验证数据导入
- [ ] 点击"加载示例数据"，确认 3D 场景显示
- [ ] 检查是否显示 2 层楼层、通道和出口
- [ ] 确认 8 个人员图标显示在正确位置

### 2. 验证播放功能
- [ ] 点击"播放"按钮，确认人员开始移动
- [ ] 拖动时间轴滑块，确认人员位置随时间变化
- [ ] 切换播放速度（如 2x），确认移动速度改变
- [ ] 测试"停止"、"前进"、"后退"按钮

### 3. 验证筛选功能
- [ ] 选择楼层筛选"一层"，确认二层人员隐藏
- [ ] 选择人群筛选"员工"，确认只显示员工
- [ ] 选择异常类型"有异常"，确认只显示红色异常人员
- [ ] 点击"重置筛选"，确认所有人员恢复显示

### 4. 验证人员点选
- [ ] 点击任意人员，确认：
  - 人员变为黄色高亮
  - 其他人员隐藏
  - 右侧显示人员详情面板
  - 显示该人员的异常记录（如有）
- [ ] 再次点击同一人员，确认取消选择

### 5. 验证异常高亮
- [ ] 确认红色通道显示（中心到南侧）
- [ ] 确认红色人员显示（有异常的 4 人）
- [ ] 点击"李四"（经过封闭通道的人员），查看异常详情

### 6. 验证报告导出
- [ ] 点击"导出 Markdown"，确认下载 `fire-drill-report.md`
- [ ] 打开下载的文件，确认包含完整的分析报告
- [ ] 点击"导出 JSON"，确认下载 `fire-drill-report.json`
- [ ] 打开 JSON 文件，确认包含结构化分析数据

## 常见问题

### Q: 人员不移动或时间轴无响应？
A: 确保已加载数据（示例数据或导入数据）。检查浏览器控制台是否有错误信息。

### Q: 3D 场景显示空白？
A: 检查：
- 是否使用支持 WebGL 的浏览器（Chrome、Firefox、Safari）
- 显卡驱动是否最新
- 尝试调整相机视角（鼠标滚轮缩放）

### Q: 导入的 CSV 数据不显示？
A: 检查：
- 文件名是否符合约定（或手动选择所有相关文件）
- CSV 格式是否正确（检查第一行表头）
- 编码是否为 UTF-8

### Q: 如何添加更多楼层？
A: 在 floors.csv 中添加新楼层记录，同时在 nodes.csv、edges.csv 等文件中添加对应数据，确保 `floor` 字段正确关联。

## 扩展开发

### 添加新的异常检测类型

在 `src/analysis/AnomalyDetector.js` 中：

1. 在 `AnomalyType` 枚举中添加新类型
2. 在 `analyzePerson` 或新增方法中实现检测逻辑
3. 在 `getAnomalyTypeName` 和 `getAnomalyDescription` 中添加描述

### 自定义渲染样式

在 `src/renderer/` 目录下的渲染器中修改：
- `FloorRenderer.js`: 楼层、通道、出口的颜色和样式
- `PersonRenderer.js`: 人员、轨迹、异常标记的外观

### 添加新的 UI 组件

在 `src/ui/UIManager.js` 中：
- `createRightPanelContent()`: 添加新的面板区域
- `bindEvents()`: 添加事件监听
- 新增方法处理用户交互

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。
