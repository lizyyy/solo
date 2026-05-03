# 冷链仓库3D货架巡检可视化器

一个本地运行的3D可视化工具，帮助冷链仓库主管快速发现货架超温、漏检区域和临期被堵货品。

## 功能特性

### 🎯 核心功能

1. **3D货架可视化**
   - 可旋转、缩放、平移的立体货架视图
   - 多层货架结构清晰展示
   - 支持多区域（A区、B区、C区等）

2. **温度热图展示**
   - 按时间轴播放温度变化
   - 颜色编码显示温度分布
   - 高亮超温区域

3. **叉车轨迹追踪**
   - 回放叉车巡检路线
   - 实时显示叉车位置
   - 检测绕行和漏检区域

4. **风险智能检测**
   - **温度风险**: 检测超温区域，识别连续高温货位
   - **漏检风险**: 分析叉车轨迹，标记未巡检区域
   - **临期风险**: 检测临期货品，识别被堵无法出库的货品

5. **交互功能**
   - 点击货位查看详细信息
   - 多维度筛选（风险等级、类型、区域、SKU）
   - 人工标记处理状态

6. **报告导出**
   - Markdown格式报告
   - CSV格式数据导出
   - JSON格式完整报告

## 项目结构

```
xy4294/
├── index.html              # 主页面
├── README.md              # 本文档
├── data/                  # 示例数据目录
│   ├── sample_racks.json     # 货架坐标数据
│   ├── sample_temperature.csv # 温度记录
│   └── sample_expiring.json  # 临期货品清单
└── js/                    # JavaScript模块
    ├── app.js             # 主应用入口
    ├── dataParser.js      # 数据解析模块
    ├── riskRules.js       # 风险规则引擎
    ├── stateManager.js    # 状态管理模块
    ├── renderer3D.js      # 3D渲染模块
    ├── exporter.js        # 导出模块
    └── testRunner.js      # 测试模块
```

## 快速开始

### 环境要求

- 现代浏览器（Chrome、Firefox、Safari、Edge）
- 本地HTTP服务器（可选，推荐）

### 验证流程

#### 方法一：直接在浏览器打开（简单）

1. **获取项目**
   ```
   确保项目文件完整在本地目录
   ```

2. **打开应用**
   - 双击 `index.html` 文件
   - 或在浏览器中拖放 `index.html`

3. **加载示例数据**
   - 点击页面顶部 **"加载示例数据"** 按钮
   - 等待数据加载完成（约2-3秒）

4. **验证功能**
   - **旋转视图**: 鼠标左键拖动3D场景
   - **缩放**: 鼠标滚轮
   - **平移**: 鼠标右键拖动
   - **点击货位**: 点击任意货架查看详情

#### 方法二：使用本地HTTP服务器（推荐，更稳定）

1. **启动本地服务器**

   **使用Python 3:**
   ```bash
   cd /path/to/xy4294
   python3 -m http.server 8080
   ```

   **使用Python 2:**
   ```bash
   cd /path/to/xy4294
   python -m SimpleHTTPServer 8080
   ```

   **使用Node.js (http-server):**
   ```bash
   npm install -g http-server
   cd /path/to/xy4294
   http-server -p 8080
   ```

   **使用PHP:**
   ```bash
   cd /path/to/xy4294
   php -S localhost:8080
   ```

2. **访问应用**
   - 打开浏览器访问 `http://localhost:8080`

3. **按上述步骤验证功能**

## 使用指南

### 1. 数据加载

#### 方式一：加载示例数据
点击 **"加载示例数据"** 按钮，系统会自动生成包含以下内容的演示数据：
- 3个区域（A区、B区、C区）
- 12个货架，每个货架4层、5个货位
- 预设的超温区域（A1、A2货架2-3层部分货位、C1/C2货架3-4层）
- 预设的被堵临期货品（C区货架深处）

#### 方式二：加载自定义数据
使用 **"上传数据文件"** 按钮，支持以下格式：

**支持的数据格式：**

| 文件类型 | 扩展名 | 说明 |
|---------|-------|------|
| 货架坐标 | `.json` | 货架结构和位置定义 |
| 温度记录 | `.csv` | 历史温度记录 |
| 叉车轨迹 | `.jsonl` | JSON Lines格式的轨迹点 |
| 临期货品 | `.json` 或 `.csv` | 临期库存清单 |

### 2. 界面操作

#### 左侧控制面板

- **筛选条件**
  - 风险等级：全部 / 高风险 / 中风险 / 低风险
  - 风险类型：全部 / 温度异常 / 漏检区域 / 临期货品
  - 区域筛选：按仓库区域筛选
  - SKU搜索：按货品SKU搜索

- **显示选项**
  - 显示热图：温度颜色编码
  - 显示轨迹：叉车巡检路线
  - 显示叉车：叉车位置标记

#### 时间轴控制

- **播放/暂停**: 动画播放温度和轨迹变化
- **速度控制**: 调整播放速度
- **时间滑块**: 跳转到特定时间点

#### 货位详情面板

点击任意货位后显示：
- 货位基本信息（位置、区域、状态）
- 货品信息（名称、SKU、数量、临期状态）
- 温度数据（当前温度、历史记录）
- 风险信息（风险类型、等级、描述）
- 处理标记（状态选择、备注）

### 3. 风险说明

#### 温度风险等级

| 等级 | 温度范围 | 颜色 | 说明 |
|-----|---------|------|------|
| 高风险 | > -12°C | 🔴 红色 | 严重超温，需立即处理 |
| 中风险 | -15°C ~ -12°C | 🟠 橙色 | 温度偏高，需要关注 |
| 正常 | -18°C ~ -15°C | 🟢 绿色 | 温度正常 |
| 偏低 | < -18°C | 🔵 蓝色 | 温度偏低，可能浪费能源 |

**特别警示**: 连续高温（同一货位多次记录超温）会升级风险等级。

#### 漏检风险

基于叉车轨迹分析，以下情况标记为漏检：
- 货位区域未被叉车接近
- 巡检路线明显绕行
- 巡检时间间隔异常

#### 临期风险

| 优先级 | 临期天数 | 说明 |
|-------|---------|------|
| 高 | ≤ 2天 | 需立即处理出库 |
| 中 | 3-5天 | 需要安排出库计划 |
| 低 | ≥ 6天 | 正常监控即可 |

**被堵货品**: 若临期货品被其他货品堵住无法直接出库，风险等级自动升级为高风险。

### 4. 报告导出

点击 **"导出报告"** 按钮，选择导出格式：

#### Markdown格式
- 完整的风险分析报告
- 风险统计概览
- 高风险详情列表
- 人工处理记录
- 可直接用于汇报

#### CSV格式
- 风险数据表格
- 包含所有风险字段
- 适合Excel分析

#### JSON格式
- 完整数据导出
- 包含元数据、风险分析、处理记录
- 适合程序处理

## 数据格式规范

### 1. 货架坐标JSON

```json
{
  "metadata": {
    "warehouse": "冷链仓库A区",
    "date": "2026-05-03"
  },
  "racks": [
    {
      "id": "A1",
      "name": "货架A1",
      "area": "A区",
      "position": { "x": 0, "y": 0, "z": 0 },
      "dimensions": { "width": 2, "height": 4, "depth": 1 },
      "levels": 4,
      "slotsPerLevel": 5,
      "slots": [
        {
          "id": "A1-L1-P1",
          "level": 1,
          "position": 1,
          "occupied": true,
          "product": {
            "name": "进口牛排",
            "sku": "SKU001",
            "quantity": 50
          }
        }
      ]
    }
  ]
}
```

### 2. 温度记录CSV

```csv
货位ID,货架ID,层级,位置,温度(°C),记录时间,区域
A1-L1-P1,A1,1,1,-16.2,2026-05-03T08:00:00,A区
A1-L1-P2,A1,1,2,-15.8,2026-05-03T08:00:00,A区
A1-L2-P5,A1,2,5,-8.5,2026-05-03T08:00:00,A区
```

**字段说明**:
- `货位ID`: 唯一标识货位
- `温度(°C)`: 记录的温度值
- `记录时间`: ISO格式时间戳
- 支持同一货位多条记录（时序数据）

### 3. 叉车轨迹JSONL

```jsonl
{"forkliftId": "叉车01", "timestamp": "2026-05-03T08:00:00", "x": 0, "y": 0, "z": 0, "action": "start"}
{"forkliftId": "叉车01", "timestamp": "2026-05-03T08:05:00", "x": 2, "y": 0, "z": 0, "action": "move"}
{"forkliftId": "叉车01", "timestamp": "2026-05-03T08:10:00", "x": 4, "y": 0, "z": 0, "action": "inspect"}
```

**字段说明**:
- `forkliftId`: 叉车标识
- `timestamp`: 时间戳
- `x, y, z`: 三维坐标
- `action`: 动作类型（可选）

### 4. 临期货品JSON

```json
{
  "products": [
    {
      "productId": "PRD-001",
      "name": "进口牛排",
      "sku": "SKU001",
      "slotId": "C1-L4-P3",
      "quantity": 45,
      "expiryDate": "2026-05-04",
      "daysUntilExpiry": 1,
      "priority": "high",
      "isBlocked": true,
      "notes": "被前方货品堵住，无法直接出库"
    }
  ]
}
```

## 测试说明

### 运行测试

1. 在浏览器中打开 `index.html`
2. 按 `F12` 打开开发者工具
3. 切换到 `Console` (控制台) 标签
4. 输入以下命令运行测试：

```javascript
TestRunner.runInBrowser()
```

### 测试内容

| 测试模块 | 测试项 | 说明 |
|---------|-------|------|
| DataParser | 货架坐标解析 | 验证JSON解析正确性 |
| DataParser | CSV行解析 | 验证CSV字段提取 |
| DataParser | JSONL轨迹解析 | 验证JSON Lines格式处理 |
| DataParser | 临期货品解析 | 验证JSON/CSV格式支持 |
| RiskRules | 高温检测 | 验证温度阈值判断 |
| RiskRules | 连续高温检测 | 验证时序高温识别 |
| RiskRules | 漏检检测 | 验证轨迹分析逻辑 |
| RiskRules | 临期检测 | 验证优先级和被堵识别 |
| RiskRules | 温度颜色 | 验证颜色映射正确性 |
| StateManager | 状态初始化 | 验证初始状态值 |
| StateManager | 事件订阅发布 | 验证发布-订阅模式 |
| StateManager | 筛选管理 | 验证筛选条件存取 |
| StateManager | 显示选项 | 验证显示状态管理 |
| StateManager | 标记管理 | 验证人工标记存取 |
| Exporter | Markdown生成 | 验证报告内容完整性 |
| Exporter | CSV生成 | 验证表格格式正确性 |
| Exporter | JSON生成 | 验证数据结构完整性 |

## 技术架构

### 模块说明

#### 1. dataParser.js (数据解析)
- 职责：解析各种格式的输入数据
- 核心函数：
  - `parseRackCoordinates()`: 解析货架JSON
  - `parseTemperatureCSV()`: 解析温度CSV
  - `parseForkliftTrajectory()`: 解析轨迹JSONL
  - `parseExpiringProducts()`: 解析临期数据

#### 2. riskRules.js (风险规则)
- 职责：定义和执行风险检测规则
- 核心函数：
  - `detectTemperatureRisks()`: 温度异常检测
  - `detectMissedAreas()`: 漏检区域检测
  - `detectExpiringRisks()`: 临期货品检测
  - `analyzeAllRisks()`: 综合风险分析
  - `getTemperatureColor()`: 温度颜色映射

#### 3. stateManager.js (状态管理)
- 职责：管理应用全局状态
- 设计模式：发布-订阅 (Pub/Sub)
- 核心函数：
  - `subscribe()`: 订阅状态变化
  - `publish()`: 发布状态事件
  - `selectSlot()`: 选择货位
  - `addMark()`: 添加处理标记
  - `playTimeline()`: 控制时间轴

#### 4. renderer3D.js (3D渲染)
- 依赖：Three.js, OrbitControls
- 职责：3D场景渲染和交互
- 核心函数：
  - `init()`: 初始化Three.js场景
  - `renderRacks()`: 渲染货架模型
  - `updateHeatmap()`: 更新温度热图
  - `renderTrajectories()`: 渲染轨迹线
  - `updateForkliftPosition()`: 更新叉车位置
  - `raycast()`: 射线检测（点击交互）
  - `applyFilters()`: 应用筛选高亮

#### 5. exporter.js (导出模块)
- 职责：生成各种格式的报告
- 核心函数：
  - `generateMarkdownReport()`: 生成MD报告
  - `generateCSVReport()`: 生成CSV报告
  - `generateJSONReport()`: 生成JSON报告

#### 6. app.js (主应用)
- 职责：整合所有模块，处理UI交互
- 核心函数：
  - `loadSampleData()`: 生成并加载示例数据
  - `handleCanvasClick()`: 处理3D场景点击
  - `showSlotInfo()`: 显示货位详情
  - `applyFilters()`: 应用筛选条件
  - `togglePlay()`: 切换播放状态

### 数据流

```
用户操作 → UI事件 → app.js → 状态更新 → 事件发布
                                              ↓
                        ┌─────────────────────┼─────────────────────┐
                        ↓                     ↓                     ↓
                   renderer3D            riskRules            exporter
                        ↓                     ↓                     ↓
                   3D渲染更新            风险重新分析           报告生成
```

## 常见问题

### Q1: 页面显示空白或3D场景不加载
**解决方案**:
1. 检查浏览器控制台是否有JavaScript错误
2. 确认网络连接（Three.js使用CDN）
3. 尝试使用本地HTTP服务器而非直接打开文件

### Q2: 示例数据加载失败
**解决方案**:
1. 检查浏览器控制台错误信息
2. 确认所有JavaScript文件正确加载
3. 刷新页面后重试

### Q3: 3D操作不流畅
**解决方案**:
1. 减少同时显示的货位数量
2. 关闭不必要的显示选项
3. 使用性能更好的浏览器

### Q4: 导出的文件乱码
**解决方案**:
1. CSV文件使用UTF-8编码，Excel打开时选择正确编码
2. Markdown文件使用任意文本编辑器打开
3. JSON文件使用支持UTF-8的编辑器

## 扩展开发

### 添加新的风险类型

1. 在 `riskRules.js` 中添加新的检测函数
2. 在 `analyzeAllRisks()` 中调用新函数
3. 在 `app.js` 中更新筛选选项
4. 在 `exporter.js` 中更新报告内容

### 自定义数据格式

1. 在 `dataParser.js` 中添加新的解析函数
2. 更新 `parseFile()` 中的文件类型识别逻辑
3. 确保与现有数据结构兼容

### 添加新的可视化效果

1. 在 `renderer3D.js` 中添加新的渲染函数
2. 使用Three.js API创建新的3D对象
3. 在 `app.js` 中绑定UI控制

## 版本历史

### v1.0.0 (2026-05-03)
- 初始版本发布
- 3D货架可视化功能
- 温度热图和叉车轨迹动画
- 风险检测引擎
- 多格式报告导出
- 测试模块

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发团队。
