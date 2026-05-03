# 夜市出餐手忙脚乱

一款夜市摊位节奏管理网页游戏，玩家需要同时处理炒粉、煎饼、饮料等订单，在限定时间内完成目标分数。

## 游戏特色

- **多关卡设计**：包含3个难度递增的关卡，每关订单节奏、可用工位和目标分数不同
- **订单步骤管理**：每个订单需要经历备菜、上锅、火候处理、装盒、出餐等多个步骤
- **节奏挑战**：步骤有倒计时，拖太久会糊或让客人等急，太早装盒也要扣分
- **本地存档**：分数、最高分、已解锁关卡自动保存到本地存储
- **关卡导入导出**：关卡数据存放在JSON中，支持自定义关卡和导入导出
- **结算报告**：游戏结束后生成详细的结算报告，支持导出JSON和Markdown格式
- **键盘快捷键**：支持鼠标点击和键盘快捷键操作，提升操作效率

## 项目结构

```
zy1054/
├── index.html              # 游戏主页面
├── README.md               # 项目说明文档
└── src/
    ├── css/
    │   └── style.css       # 游戏样式文件
    ├── data/
    │   └── levels.json     # 关卡配置数据
    └── js/
        ├── main.js         # 游戏入口文件
        ├── gameController.js # 游戏主控制器
        └── modules/
            ├── orderGenerator.js   # 订单生成系统
            ├── stationManager.js   # 工位状态管理
            ├── scoreSystem.js      # 计分结算系统
            ├── levelManager.js     # 关卡配置管理
            ├── saveSystem.js       # 本地存档系统
            └── uiRenderer.js       # UI渲染模块
```

## 安装与启动

### 方式一：使用 Python 内置服务器

```bash
# 进入项目目录
cd /path/to/zy1054

# 启动 Python 服务器（Python 3）
python3 -m http.server 8000

# 或 Python 2
python -m SimpleHTTPServer 8000
```

然后在浏览器中访问 `http://localhost:8000`

### 方式二：使用 Node.js 的 serve

```bash
# 全局安装 serve（如果没有）
npm install -g serve

# 进入项目目录
cd /path/to/zy1054

# 启动服务器
serve
```

然后在浏览器中访问显示的地址（通常是 `http://localhost:3000`）

### 方式三：使用 VS Code Live Server 插件

1. 在 VS Code 中安装 "Live Server" 插件
2. 右键点击 `index.html` 文件
3. 选择 "Open with Live Server"

## 游戏玩法

### 基本操作

1. **开始游戏**：点击"开始游戏"按钮，选择已解锁的关卡开始
2. **分配订单**：当订单出现在订单队列时，点击"分配到工位"按钮
3. **处理步骤**：当工位上的步骤进度条完成时，点击"完成当前步骤"按钮
4. **完美时机**：在进度条的完美时机完成步骤可以获得额外分数和满意度
5. **避免糊掉**：不要让步骤等待太久，否则订单会糊掉并扣分

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| 空格 | 暂停/继续游戏 |
| R | 重新开始当前关卡 |
| 1-9 | 快速选择对应工位（按工位编号） |
| Enter | 完成第一个待处理的工位 |

### 游戏规则

- **订单生成**：根据关卡设置，订单会定时生成
- **等待时间**：订单等待时间过长会降低满意度，超过最大等待时间会自动取消
- **步骤计时**：每个步骤都有规定时间，太早或太晚完成都会影响满意度
- **完美窗口**：在步骤完成前后的完美窗口内完成操作可获得额外奖励
- **糊掉惩罚**：步骤完成后太久不处理，订单会糊掉
- **目标分数**：在限定时间内达到目标分数即可通关
- **星级评价**：根据最终分数获得1-3星评价

### 关卡说明

#### 关卡1：新手入门（简单）
- **游戏时长**：120秒
- **目标分数**：300分
- **可用工位**：炒粉、饮料
- **可用菜品**：炒粉、可乐、雪碧
- **特点**：订单节奏较慢，适合熟悉基本操作

#### 关卡2：忙碌夜市（中等）
- **游戏时长**：180秒
- **目标分数**：800分
- **可用工位**：炒粉、煎饼、饮料
- **可用菜品**：炒粉、煎饼、可乐、雪碧、奶茶
- **特点**：订单增多，节奏加快，新增煎饼工位

#### 关卡3：夜市巅峰（困难）
- **游戏时长**：240秒
- **目标分数**：1500分
- **可用工位**：炒粉、煎饼、饮料、烧烤
- **可用菜品**：炒粉、煎饼、可乐、雪碧、奶茶、烤串、烤鸡翅
- **特点**：订单汹涌，考验多任务处理能力

## 关卡配置

### 关卡数据结构

关卡数据存储在 `src/data/levels.json` 文件中，格式如下：

```json
{
  "levels": [
    {
      "id": 1,
      "name": "关卡名称",
      "description": "关卡描述",
      "difficulty": "easy",
      "targetScore": 300,
      "gameDuration": 120,
      "orderSpawnRate": 15,
      "maxOrders": 4,
      "availableStations": ["炒粉", "饮料"],
      "stationCount": 2,
      "availableDishes": ["炒粉", "可乐", "雪碧"],
      "orderSteps": {
        "炒粉": ["备菜", "上锅", "火候处理", "装盒"],
        "可乐": ["备料", "装杯"]
      },
      "stepDurations": {
        "备菜": 5,
        "上锅": 3,
        "火候处理": 8,
        "装盒": 3,
        "备料": 2,
        "装杯": 2
      },
      "basePrices": {
        "炒粉": 15,
        "可乐": 8,
        "雪碧": 8
      },
      "perfectWindow": 0.8,
      "maxWaitTime": 60
    }
  ]
}
```

### 配置字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 关卡唯一ID |
| name | string | 关卡名称 |
| description | string | 关卡描述 |
| difficulty | string | 难度（easy/medium/hard） |
| targetScore | number | 通关目标分数 |
| gameDuration | number | 游戏时长（秒） |
| orderSpawnRate | number | 订单生成间隔（秒） |
| maxOrders | number | 最大同时订单数 |
| availableStations | array | 可用工位类型列表 |
| stationCount | number | 工位数量 |
| availableDishes | array | 可用菜品列表 |
| orderSteps | object | 每个菜品的制作步骤 |
| stepDurations | object | 每个步骤的时长（秒） |
| basePrices | object | 每个菜品的基础价格 |
| perfectWindow | number | 完美时机窗口比例（0-1） |
| maxWaitTime | number | 订单最大等待时间（秒） |

### 自定义关卡

1. 复制 `src/data/levels.json` 中的现有关卡结构
2. 修改相应字段创建新关卡
3. 确保ID唯一
4. 在游戏主菜单使用"导入关卡"功能导入

### 工位类型与菜品映射

当前游戏中工位类型与菜品的映射关系：

| 工位类型 | 支持菜品 |
|----------|----------|
| 炒粉 | 炒粉 |
| 煎饼 | 煎饼 |
| 饮料 | 可乐、雪碧、奶茶 |
| 烧烤 | 烤串、烤鸡翅 |

如需添加新的菜品-工位映射，请修改 `gameController.js` 中的 `_assignOrder` 方法。

## 存档系统

游戏进度会自动保存到浏览器的 localStorage 中，包括：

- **已解锁关卡**：通关当前关卡后自动解锁下一关
- **关卡最高分**：每个关卡的历史最高得分
- **游戏统计**：总游戏时长、游戏次数

存档数据存储在 `night_market_game_save` 键下，可通过浏览器开发者工具的 Application 面板查看。

## 结算报告

游戏结束后会显示详细的结算报告，包括：

- 最终分数与目标分数对比
- 星级评价（1-3星）
- 总收入与总浪费
- 平均满意度
- 完成订单数、糊掉订单数、完美订单数
- 订单完成率

### 导出功能

结算报告支持两种导出格式：

1. **JSON格式**：包含完整的结算数据，便于程序处理
2. **Markdown格式**：格式化的报告文本，便于阅读和分享

点击对应按钮即可下载报告文件。

## 技术实现

### 前端技术栈

- **HTML5**：页面结构
- **CSS3**：样式与动画
- **原生JavaScript (ES6+)**：游戏逻辑
- **localStorage**：数据持久化
- **requestAnimationFrame**：游戏循环

### 模块设计

游戏采用模块化设计，各模块职责清晰：

1. **OrderGenerator**：根据关卡配置生成随机订单
2. **StationManager**：管理工位状态、分配订单、处理步骤
3. **ScoreSystem**：计算分数、收入、满意度，生成结算报告
4. **LevelManager**：加载、验证、管理关卡配置
5. **SaveSystem**：读写本地存档数据
6. **UIRenderer**：渲染游戏界面、处理用户交互
7. **GameController**：协调各模块，控制游戏流程

### 游戏循环

游戏使用 `requestAnimationFrame` 实现平滑的游戏循环：

1. 计算帧间时间差
2. 更新游戏时间
3. 检查是否生成新订单
4. 更新所有忙碌工位的进度
5. 更新订单等待时间和满意度
6. 检查游戏是否结束
7. 重新渲染界面

## 开发与调试

### 调试模式

游戏控制器已暴露到全局 `window.gameController`，可在浏览器控制台直接访问：

```javascript
// 查看当前游戏状态
console.log(gameController.gameState);

// 查看当前关卡配置
console.log(gameController.currentLevel);

// 手动触发游戏结束（测试用）
gameController._endGame();
```

### 添加新菜品

1. 在 `levels.json` 中添加菜品到 `availableDishes`
2. 在 `orderSteps` 中定义该菜品的制作步骤
3. 在 `stepDurations` 中定义每个步骤的时长
4. 在 `basePrices` 中定义菜品价格
5. 在 `gameController.js` 的 `_assignOrder` 方法中添加菜品-工位映射

### 添加新工位

1. 在 `levels.json` 中添加工位类型到 `availableStations`
2. 更新 `stationCount`
3. 在 `gameController.js` 的 `_assignOrder` 方法中添加对应的菜品映射

## 常见问题

### 1. 游戏无法启动

**症状**：打开 index.html 后显示空白或错误信息

**解决方案**：
- 确保使用本地服务器运行，不要直接双击打开 HTML 文件
- 检查浏览器控制台是否有 JavaScript 错误
- 确认所有文件路径正确

### 2. 关卡数据加载失败

**症状**：关卡选择界面为空

**解决方案**：
- 检查 `src/data/levels.json` 文件是否存在且格式正确
- 确认服务器能正确提供 JSON 文件
- 查看浏览器控制台的网络请求和错误信息

### 3. 存档丢失

**症状**：刷新页面后关卡进度丢失

**解决方案**：
- 检查浏览器是否禁用了 localStorage
- 确认使用的是相同的域名和端口
- 查看浏览器开发者工具中 Application > Local Storage

### 4. 游戏卡顿

**症状**：游戏运行不流畅，帧率低

**解决方案**：
- 关闭不必要的浏览器标签页
- 降低浏览器缩放比例
- 使用最新版本的现代浏览器（Chrome、Firefox、Safari、Edge）

## 浏览器兼容性

游戏支持以下现代浏览器：

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

游戏使用了以下 ES6+ 特性：
- 箭头函数
- 模板字符串
- 解构赋值
- 模块 (import/export)
- requestAnimationFrame

## 许可证

本项目仅供学习和娱乐使用。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进游戏！

## 更新日志

### v1.0.0 (2024-05-03)

- 初始版本发布
- 实现核心游戏玩法
- 添加3个示例关卡
- 实现关卡导入导出功能
- 实现本地存档系统
- 实现结算报告导出
- 支持键盘快捷键操作
