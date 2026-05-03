# 展线拥堵预演台

一个专为展馆布展团队设计的本地 3D 交互可视化工具，用于提前预演高峰时段观众流动情况，识别潜在拥堵风险。

## 功能特性

### 核心功能
- **3D 展厅可视化**：在浏览器中展示可旋转/缩放的 3D 展厅模型
- **人流仿真**：模拟不同时段观众在展厅内的移动行为
- **风险检测**：自动识别拥堵区域、视线遮挡、消防通道占用和无障碍绕行过长
- **数据导入**：支持导入展厅平面图 JSON、展品清单 CSV、客流时段表和无障碍通道规则
- **导出功能**：保存方案、导出 Markdown 评审报告、CSV 风险点和 JSON 场景包

### 风险类型
- 🟥 **拥堵**：检测区域内人数超过阈值
- 🟧 **消防通道占用**：检测消防通道禁停区域被占用
- 🟨 **视线遮挡**：检测展品被其他观众遮挡
- 🟩 **无障碍绕行**：检测无障碍观众绕行距离过长

## 项目结构

```
xy4232/
├── index.html              # 主页面
├── package.json            # 项目配置
├── css/
│   └── style.css           # 样式文件
├── js/
│   ├── dataParser.js       # 数据解析模块
│   ├── spaceModel.js       # 空间模型模块
│   ├── simulationEngine.js # 仿真引擎模块
│   ├── renderer3D.js       # 3D渲染模块
│   ├── stateStore.js       # 状态存储模块
│   ├── importExport.js     # 导入导出模块
│   └── main.js             # 主入口文件
└── data/
    ├── floorplan.json      # 示例展厅平面图
    ├── exhibits.csv        # 示例展品清单
    ├── crowd_schedule.csv  # 示例客流时段表
    └── accessibility_rules.json  # 示例无障碍规则
```

## 模块说明

### 1. dataParser.js (数据解析)
负责解析各种格式的输入数据：
- `parseFloorplan()` - 解析展厅平面图 JSON
- `parseExhibits()` - 解析展品清单 CSV
- `parseCrowdSchedule()` - 解析客流时段表 CSV
- `parseAccessibilityRules()` - 解析无障碍规则 JSON

### 2. spaceModel.js (空间模型)
管理展厅、展品、通道等空间数据：
- 展品增删改查
- 空间碰撞检测
- 距离和角度计算

### 3. simulationEngine.js (仿真引擎)
负责人流模拟和风险检测：
- 观众路径生成
- 实时人流模拟
- 拥堵检测
- 消防通道占用检测
- 视线遮挡检测
- 无障碍绕行检测

### 4. renderer3D.js (3D渲染)
使用 Three.js 渲染 3D 场景：
- 场景构建
- 相机控制（旋转、缩放、平移）
- 灯光和阴影
- 鼠标悬停检测
- 风险区域可视化

### 5. stateStore.js (状态存储)
管理应用状态和本地存储：
- 状态持久化
- 自动保存
- 状态恢复

### 6. importExport.js (导入导出)
处理数据的导入和导出：
- 导入各种数据文件
- 导出 Markdown 评审报告
- 导出 CSV 风险点
- 导出 JSON 场景包

### 7. main.js (主入口)
应用初始化和事件绑定：
- 模块初始化
- UI 事件绑定
- 示例数据加载

## 快速开始

### 1. 启动服务

使用 Python 启动本地服务器：

```bash
python3 -m http.server 8080
```

或者使用 Node.js：

```bash
npm install
npm run dev
```

### 2. 访问应用

在浏览器中打开：
```
http://localhost:8080
```

### 3. 开始使用

应用启动后会自动加载示例数据。

#### 基本操作
- **旋转视角**：按住鼠标左键拖动
- **缩放**：使用鼠标滚轮
- **悬停查看**：将鼠标悬停在物体上查看详情

#### 仿真流程
1. 在左侧"仿真控制"区域选择时段
2. 点击"开始模拟"按钮
3. 观察观众移动和风险区域（红色区域为拥堵）
4. 可调整仿真速度（0.1x - 5x）
5. 点击"暂停"或"重置"控制仿真

#### 数据导入
1. 展厅平面图 (JSON) - 定义展厅结构、墙体、入口、出口
2. 展品清单 (CSV) - 定义展品位置、尺寸、热度
3. 客流时段表 (CSV) - 定义各时段观众数量
4. 无障碍规则 (JSON) - 定义无障碍相关规则

#### 导出功能
- **保存方案**：保存到浏览器本地存储
- **导出报告**：生成 Markdown 格式的评审报告
- **导出风险点**：生成 CSV 格式的风险点列表
- **导出场景**：导出完整场景包（可重新导入）

## 数据格式说明

### 展厅平面图 (JSON)
```json
{
    "id": "hall_001",
    "name": "主展厅",
    "width": 40,
    "height": 30,
    "walls": [
        {
            "id": "wall_1",
            "start": { "x": -20, "y": -15 },
            "end": { "x": 20, "y": -15 },
            "height": 3,
            "thickness": 0.2
        }
    ],
    "entrances": [
        {
            "id": "entrance_1",
            "name": "主入口",
            "position": { "x": 0, "y": -14 },
            "width": 3
        }
    ],
    "exits": [...],
    "fireExits": [...],
    "accessibilityPaths": [...]
}
```

### 展品清单 (CSV)
```csv
id,展品名称,x坐标,y坐标,宽度,深度,高度,热度,观展时间,类别,描述
exhibit_1,镇馆之宝,0,0,3,3,2.5,0.95,60,国宝级,最受欢迎的展品
```

### 客流时段表 (CSV)
```csv
id,时段名称,开始时间,结束时间,观众数量,入口,描述
slot_1,早高峰,09:00,10:00,80,entrance_1,开馆第一小时
```

### 无障碍规则 (JSON)
```json
{
    "maxDetourDistance": 50,
    "preferredPathWidth": 1.5,
    "maxSlope": 0.083,
    "requiredClearZone": 1.5
}
```

## 技术栈

- **前端框架**：原生 JavaScript
- **3D 引擎**：Three.js r128
- **样式**：原生 CSS
- **存储**：LocalStorage

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 开发说明

### 项目运行
该项目是纯前端项目，不需要构建工具，只需启动一个静态文件服务器即可运行。

### 模块依赖关系
```
main.js
├── dataParser.js
├── spaceModel.js
├── simulationEngine.js
│   └── spaceModel.js
├── renderer3D.js
│   ├── spaceModel.js
│   └── simulationEngine.js
├── stateStore.js
│   └── spaceModel.js
└── importExport.js
    ├── dataParser.js
    ├── spaceModel.js
    ├── simulationEngine.js
    └── stateStore.js
```

## 许可协议

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者
