# 夜市炒粉摊出餐小游戏

一款本地可直接游玩的 2D 模拟经营小游戏。你是夜市炒粉摊的摊主，晚高峰来了很多顾客，需要一边接单、一边备料、一边炒锅、一边打包。做慢了顾客会生气走人哦！

## 游戏特性

- 🎮 **完整的游戏流程**：主菜单 → 关卡选择 → 游戏中 → 暂停 → 结算
- 👥 **顾客系统**：顾客按关卡配置不断到来，每个顾客有不同菜品、可等待时间和小费规则
- 🍜 **真实操作**：补米粉/配菜、把订单下锅、等待炒制完成、打包出餐
- 🏆 **评分系统**：做对订单加分、连续准时出餐有连击奖励、做错/超时/库存耗尽影响结算
- 📦 **关卡管理**：关卡数据存放在 JSON 中，支持导入/导出关卡
- 💾 **本地存档**：保存玩家进度（已解锁关卡、每关最高分、最近一次局后摘要）
- 📱 **响应式设计**：支持不同屏幕尺寸

## 安装与启动

### 环境要求

- 现代浏览器（Chrome、Firefox、Safari、Edge 等）
- 本地 HTTP 服务器（推荐使用 Python、Node.js 或 VS Code Live Server）

### 方式一：使用 VS Code Live Server（推荐）

1. 安装 VS Code
2. 安装 "Live Server" 扩展
3. 用 VS Code 打开项目文件夹
4. 右键点击 `index.html`，选择 "Open with Live Server"
5. 浏览器自动打开游戏页面

### 方式二：使用 Python 内置服务器

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

然后在浏览器中访问 `http://localhost:8000`

### 方式三：使用 Node.js http-server

```bash
# 全局安装 http-server
npm install -g http-server

# 在项目目录下运行
http-server -p 8000
```

然后在浏览器中访问 `http://localhost:8000`

> ⚠️ **注意**：由于使用了 ES6 模块 (`type="module"`)，直接双击打开 `index.html` 可能会遇到跨域问题。请使用上述任意一种本地服务器方式运行游戏。

## 游戏玩法

### 基本操作

1. **点击顾客**：开始炒制该顾客的订单（需要有空闲炒锅和足够食材）
2. **移至打包台**：炒锅完成后，点击"移至打包台"按钮
3. **出餐**：先点击打包台的"选择出餐"按钮，再点击对应的顾客完成出餐
4. **补食材**：点击"补米粉"或"补配菜"按钮补充库存
5. **倒掉**：可以倒掉炒锅中或打包台上的订单（会浪费食材）

### 游戏流程

```
顾客来店 → 点击顾客开始炒制 → 等待炒制完成 → 移至打包台 → 选择打包台并点击顾客出餐
                                 ↓
                            食材不足 → 点击补食材
                                 ↓
                            炒锅不够 → 等待其他炒锅完成
```

### 计分规则

- **基础分数**：每道菜有固定基础分数
- **连击奖励**：连续准时出餐（在顾客等待时间的70%以内）会累积连击，每增加一个连击奖励额外10%分数
- **小费奖励**：准时且顾客未生气时，根据等待时间给予额外小费
- **差评**：顾客超时离开会记差评，影响结算评价

## 关卡 JSON 格式

关卡数据使用 JSON 格式存储，包含以下字段：

### 完整示例

```json
{
    "id": "level_1",
    "name": "新手入门",
    "description": "学习基本操作，熟悉游戏流程",
    "difficulty": 1,
    "duration": 120,
    "initialIngredients": {
        "noodles": 10,
        "toppings": 10
    },
    "maxIngredients": {
        "noodles": 20,
        "toppings": 20
    },
    "restockAmount": 5,
    "wokCount": 1,
    "packingCount": 1,
    "customerSpawnRate": 15,
    "maxCustomers": 3,
    "dishes": [
        {
            "name": "蛋炒粉",
            "description": "经典蛋炒粉",
            "ingredients": {
                "noodles": 1,
                "toppings": 1
            },
            "cookTime": 8,
            "score": 100,
            "tip": 20
        }
    ],
    "customerPool": [
        {
            "name": "小明",
            "patience": 45,
            "dishes": ["蛋炒粉"],
            "tipMultiplier": 1.0
        }
    ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 关卡唯一标识符 |
| `name` | string | 是 | 关卡名称 |
| `description` | string | 是 | 关卡描述 |
| `difficulty` | number | 是 | 难度等级（1-10） |
| `duration` | number | 是 | 关卡持续时间（秒，60-600） |
| `initialIngredients` | object | 是 | 初始食材库存 |
| `initialIngredients.noodles` | number | 是 | 初始米粉数量 |
| `initialIngredients.toppings` | number | 是 | 初始配菜数量 |
| `maxIngredients` | object | 是 | 最大食材库存 |
| `maxIngredients.noodles` | number | 是 | 最大米粉库存 |
| `maxIngredients.toppings` | number | 是 | 最大配菜库存 |
| `restockAmount` | number | 是 | 每次补充食材的数量 |
| `wokCount` | number | 是 | 炒锅数量（1-5） |
| `packingCount` | number | 是 | 打包台数量（1-5） |
| `customerSpawnRate` | number | 是 | 顾客生成间隔（秒，5-60） |
| `maxCustomers` | number | 是 | 最多同时等待的顾客数（1-20） |
| `dishes` | array | 是 | 菜品列表 |
| `customerPool` | array | 是 | 顾客模板列表 |

#### 菜品字段（dishes 数组元素）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 菜品名称 |
| `description` | string | 菜品描述 |
| `ingredients` | object | 所需食材（noodles 和 toppings） |
| `cookTime` | number | 炒制时间（秒，3-30） |
| `score` | number | 基础分数（10-1000） |
| `tip` | number | 基础小费（0-500） |

#### 顾客模板字段（customerPool 数组元素）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 顾客名称 |
| `patience` | number | 最大等待时间（秒，10-120） |
| `dishes` | array | 可能点的菜品名称列表 |
| `tipMultiplier` | number | 小费倍率（0.1-5.0） |

### 导入/导出关卡

1. **导入关卡**：
   - 在主菜单点击"关卡管理"
   - 在左侧"导入关卡"区域粘贴关卡 JSON 数据
   - 点击"导入关卡"按钮
   - 如果数据格式有误，会显示具体的错误类型和位置

2. **导出关卡**：
   - 在主菜单点击"关卡管理"
   - 在右侧"导出关卡"区域选择要导出的关卡
   - 点击"导出关卡"按钮
   - 点击"复制到剪贴板"复制 JSON 数据

### 验证错误类型

导入关卡时可能遇到的错误类型：

| 错误类型 | 说明 |
|---------|------|
| `invalid_json` | JSON 格式语法错误 |
| `missing_field` | 缺少必填字段 |
| `invalid_type` | 字段类型错误 |
| `invalid_value` | 字段值超出有效范围 |
| `empty_array` | 数组不能为空 |
| `duplicate_id` | 关卡ID或菜品名称重复 |

## 项目文件结构

```
zy1028/
├── index.html           # 主页面文件
├── css/
│   └── style.css        # 样式文件
├── js/
│   ├── main.js          # 入口文件
│   ├── gameState.js     # 状态管理模块
│   ├── levelParser.js   # 关卡解析与校验模块
│   ├── gameLogic.js     # 游戏核心逻辑模块
│   └── ui.js            # UI组件与渲染模块
└── README.md            # 本文档
```

### 模块说明

#### 1. gameState.js - 状态管理

负责管理游戏的所有状态数据：

- `GameStates`：游戏状态枚举（菜单、关卡选择、游戏中、暂停、结算）
- `CustomerState`：顾客状态枚举（等待、生气、离开、已服务）
- `WokState`：炒锅状态枚举（空闲、炒制中、已完成）
- `PackingState`：打包台状态枚举（空闲、等待出餐）
- `GameState` 类：
  - 顾客管理（添加、更新等待时间）
  - 食材管理（使用、补充）
  - 炒锅操作（开始炒制、更新进度、移至打包台）
  - 打包台操作（选择、出餐、丢弃）
  - 分数计算（基础分、连击奖励、小费）
  - 订阅/通知机制

#### 2. levelParser.js - 关卡解析与校验

负责关卡数据的解析和验证：

- `ValidationErrorTypes`：验证错误类型枚举
- `ValidationError`：自定义错误类（包含类型、消息、字段）
- `defaultLevels`：3个内置默认关卡
- `LevelParser` 类：
  - `parse()`：解析单个关卡 JSON
  - `validateLevel()`：完整的关卡数据验证
  - `validateString/Number/Ingredients/Dishes/CustomerPool()`：各类型字段验证
  - `parseMultiple()`：解析多个关卡（数组格式）
  - `toJSON()`：将关卡对象转为格式化 JSON 字符串

#### 3. gameLogic.js - 游戏核心逻辑

游戏的"大脑"，协调各个模块：

- `GameLogic` 类：
  - 关卡管理（加载、保存、导入、导出、重置）
  - 游戏控制（开始、暂停、继续、结束、退出）
  - 游戏主循环（update 方法）
  - 顾客生成逻辑
  - 玩家动作处理（备料、炒锅、打包、出餐）
  - 进度保存与解锁
  - 消息提示系统

#### 4. ui.js - UI组件与渲染

负责用户界面的渲染和交互：

- `UI` 类：
  - 事件绑定（菜单按钮、游戏操作）
  - 屏幕切换（菜单/关卡选择/关卡管理/游戏/暂停/结算）
  - 顾客交互处理（点击开始炒制、点击出餐）
  - 炒锅交互处理（移至打包台、丢弃）
  - 打包台交互处理（选择出餐、丢弃）
  - 关卡导入导出处理
  - 各界面渲染方法

#### 5. main.js - 入口文件

页面加载完成后初始化 UI 模块。

## 本地持久化

游戏使用浏览器的 `localStorage` 进行本地数据存储：

### 存储的键

| 键名 | 说明 |
|------|------|
| `nightMarket_levels` | 自定义关卡数据 |
| `nightMarket_progress_{levelId}` | 对应关卡的玩家进度 |

### 进度数据结构

```json
{
    "unlocked": true,
    "highScore": 1500,
    "bestCombo": 8,
    "plays": 5,
    "lastPlayed": "2026-05-03T10:30:00.000Z",
    "lastSummary": {
        "score": 1200,
        "maxCombo": 5,
        "badReviews": 1,
        "completedOrders": 10,
        "lostCustomers": 1,
        "wastedNoodles": 2,
        "wastedToppings": 1,
        "badReasons": [...]
    }
}
```

### 关卡解锁规则

- 第1关默认解锁
- 完成当前关卡后，自动解锁下一关
- 刷新页面后进度仍然保留

## 内置关卡

游戏内置3个关卡：

| 关卡ID | 名称 | 难度 | 时长 | 炒锅数 | 打包台数 | 特点 |
|--------|------|------|------|--------|----------|------|
| `level_1` | 新手入门 | ⭐ | 120秒 | 1 | 1 | 学习基本操作 |
| `level_2` | 忙碌夜市 | ⭐⭐ | 180秒 | 2 | 2 | 顾客增多，需要多线程操作 |
| `level_3` | 晚高峰 | ⭐⭐⭐ | 240秒 | 3 | 2 | 最忙碌的时段，考验协调能力 |

## 技术栈

- **HTML5**：页面结构
- **CSS3**：样式与动画（CSS变量、Flexbox、Grid、媒体查询）
- **JavaScript ES6+**：
  - 模块化（`import/export`）
  - 类与继承
  - 箭头函数
  - 模板字符串
  - 解构赋值
- **localStorage**：本地数据持久化
- **requestAnimationFrame**：游戏主循环

## 浏览器兼容性

- Chrome 61+
- Firefox 60+
- Safari 11.1+
- Edge 16+

（支持 ES6 模块的现代浏览器）

## 常见问题

### Q1: 为什么双击打开 index.html 无法运行？

A: 因为游戏使用了 ES6 模块 (`type="module"`)，浏览器出于安全考虑不允许直接从文件系统加载模块。请使用本地 HTTP 服务器运行（参考"安装与启动"章节）。

### Q2: 游戏进度保存在哪里？

A: 保存在浏览器的 localStorage 中。清除浏览器数据会丢失进度。

### Q3: 如何创建自定义关卡？

A: 参考"关卡 JSON 格式"章节，创建符合格式的 JSON 数据，然后在"关卡管理"页面导入。

### Q4: 为什么导入关卡失败？

A: 可能的原因：
- JSON 格式有语法错误（检查括号、引号、逗号）
- 缺少必填字段
- 字段类型或值超出范围
- 菜品名称在顾客的 dishes 列表中不存在

页面会显示具体的错误信息，根据提示修正即可。

### Q5: 如何重置所有关卡为默认值？

A: 在"关卡管理"页面点击"重置为默认关卡"按钮即可。

## 开发说明

### 想要添加新功能？

1. **状态管理**：在 `gameState.js` 中添加新的状态或方法
2. **游戏逻辑**：在 `gameLogic.js` 中添加新的业务逻辑
3. **UI渲染**：在 `ui.js` 中添加新的渲染方法和事件处理
4. **样式**：在 `css/style.css` 中添加新样式

### 代码规范

- 使用 ES6+ 语法
- 模块化导入导出
- 清晰的职责分离（状态、逻辑、UI分离）
- 有意义的变量和函数命名
- 避免全局变量污染

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

享受你的夜市炒粉摊经营之旅！🍜✨
