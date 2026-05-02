# 应急频段调度员

一款本地浏览器小游戏，玩家需将救援队、医院、临时基站三种类型的通信任务拖拽至有限的频道和时隙中，通过合理调度获得高分。

## 游戏简介

在突发事件中，合理调度通信频率资源至关重要。玩家需要扮演应急频段调度员，将各种通信任务分配到不同的频道和时隙中，同时避免同频干扰、优先处理高优先级任务、考虑信号覆盖距离和设备电量消耗。

### 游戏特色

- **拖拽式操作**：直观的任务卡片拖拽调度
- **实时规则引擎**：动态检测同频干扰、优先级排序、信号覆盖、电量消耗
- **撤销/重做**：完整的操作历史记录，支持50步撤销
- **本地存档**：自动保存游戏进度，支持损坏检测与恢复
- **排行榜系统**：记录各关卡最高评分，支持总排名
- **调度复盘报告**：关卡完成后生成详细的优化建议

## 快速开始

### 环境要求

- 现代浏览器（Chrome、Firefox、Safari、Edge）
- Node.js 16+（用于开发环境）

### 安装与运行

1. **安装依赖**
```bash
npm install
```

2. **启动开发服务器**
```bash
npm run dev
```

3. **访问游戏**

浏览器自动打开 `http://localhost:3000`（或其他可用端口）

### 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录，可直接部署到任何静态Web服务器。

## 游戏玩法

### 基本操作

1. **拖拽任务**：将左侧任务面板中的任务卡片拖拽到右侧频率网格中
2. **移动任务**：已调度的任务可以拖拽到其他位置
3. **移除任务**：点击已调度的任务卡片可将其移除
4. **撤销/重做**：使用顶部按钮或键盘快捷键（Ctrl+Z / Ctrl+Y）
5. **保存/加载**：随时保存当前进度，或读取之前的存档

### 任务类型

| 类型 | 图标 | 优先级 | 功耗 | 覆盖半径 | 说明 |
|------|------|--------|------|----------|------|
| 救援队 | 🚒 | 最高 | 15% | 3 | 火灾、坍塌等紧急救援 |
| 医院 | 🏥 | 高 | 10% | 5 | 伤员救治中心 |
| 临时基站 | 📡 | 中 | 20% | 8 | 信号覆盖增强 |

### 评分规则

**加分项**：
- 任务调度成功：+100分/任务
- 高优先级任务处理：+50分/任务
- 无同频干扰：+200分
- 电量效率高：+50分（剩余>50%）
- 覆盖良好：+100分

**扣分项**：
- 同频干扰：-150分/处
- 频道冲突：-100分/处
- 未调度任务：-100分/任务
- 电量不足：-50分
- 覆盖不足：-75分/任务

## 项目结构

```
├── index.html              # 主页面
├── package.json            # 项目配置
├── vite.config.js          # Vite配置
├── README.md              # 本文档
└── src/
    ├── css/
    │   └── style.css      # 游戏样式
    ├── js/
    │   ├── main.js        # 主入口
    │   ├── constants.js   # 常量定义
    │   ├── utils.js       # 工具函数
    │   ├── levelLoader.js # 关卡加载模块
    │   ├── stateMachine.js# 调度状态机
    │   ├── rulesEngine.js # 干扰/评分规则
    │   ├── saveManager.js # 存档管理
    │   ├── leaderboard.js # 排行榜
    │   └── ui.js          # UI模块
    └── levels/
        ├── level-1.json   # 关卡1配置
        ├── level-2.json   # 关卡2配置
        └── level-3.json   # 关卡3配置
```

## 模块说明

### 1. 关卡加载模块 (levelLoader.js)

负责解析JSON格式的关卡配置文件，初始化游戏场景和任务数据。

**主要功能**：
- 从本地JSON文件或内置数据加载关卡
- 验证关卡配置有效性
- 规范化任务数据格式

**接口说明**：
```javascript
// 加载关卡
const level = await levelLoader.loadLevel('level-1');

// 获取当前关卡
const current = levelLoader.getCurrentLevel();

// 获取可用关卡列表
const levels = levelLoader.getAvailableLevels();
```

### 2. 调度状态机 (stateMachine.js)

管理游戏状态流转，实现完整的撤销/重做功能，维护操作历史记录。

**主要功能**：
- 初始化游戏状态
- 任务调度/取消调度/移动
- 撤销/重做（最多50步）
- 状态变更事件通知

**接口说明**：
```javascript
// 初始化状态机
stateMachine.init(level);

// 调度任务
stateMachine.scheduleTask(taskId, channel, slot);

// 取消调度
stateMachine.unscheduleTask(taskId);

// 移动任务
stateMachine.moveTask(taskId, newChannel, newSlot);

// 撤销
stateMachine.undo();

// 重做
stateMachine.redo();

// 清空所有调度
stateMachine.clearAll();

// 获取当前状态
const state = stateMachine.getState();
```

### 3. 干扰/评分规则模块 (rulesEngine.js)

实现同频干扰检测算法，建立基于多因素的评分系统。

**主要功能**：
- 同频道同时隙冲突检测
- 邻近任务干扰检测
- 电量消耗计算
- 信号覆盖验证
- 综合评分计算
- 调度复盘报告生成

**接口说明**：
```javascript
// 设置当前状态
rulesEngine.setState(state);

// 验证调度方案
const validation = rulesEngine.validateScheduling();

// 计算得分
const score = rulesEngine.calculateScore();

// 生成复盘报告
const report = rulesEngine.generateReport();
```

### 4. UI模块 (ui.js)

开发直观的拖拽界面，显示频道时隙网格、任务卡片和实时状态信息。

**主要功能**：
- 任务卡片渲染与拖拽
- 频率网格渲染
- 实时状态面板更新
- 弹窗管理
- 用户交互事件绑定

**接口说明**：
```javascript
// 初始化UI
ui.init();

// 渲染游戏界面
ui.renderTaskList(tasks);
ui.renderSchedulerGrid(state);
ui.updateHeader(state, level);

// 显示弹窗
ui.showModal('levels');
ui.hideModal('report');

// 显示消息
ui.showMessage('操作成功', 'success');
```

### 5. 存档模块 (saveManager.js)

实现本地存储功能，支持游戏进度保存与读取，包含存档损坏检测与恢复机制。

**主要功能**：
- 游戏状态保存
- 存档列表管理
- 存档损坏检测
- 自动恢复机制
- 存档导入/导出

**接口说明**：
```javascript
// 保存游戏
const result = saveManager.saveGame(state, levelId, metadata);

// 加载存档
const result = saveManager.loadGame(saveId);

// 获取所有存档
const saves = saveManager.getAllSaves();

// 删除存档
saveManager.deleteSave(saveId);

// 导入存档
saveManager.importSave(jsonData);
```

### 6. 排行榜模块 (leaderboard.js)

实现本地排行榜系统，记录玩家在各关卡的最高评分。

**主要功能**：
- 记录关卡分数
- 按分数排名
- 总排行榜计算
- 数据导入/导出

**接口说明**：
```javascript
// 添加分数
const result = leaderboard.addScore(levelId, score, playerName);

// 获取关卡排名
const scores = leaderboard.getLevelScores(levelId);

// 获取总排名
const ranking = leaderboard.getOverallRanking();

// 获取最高分
const highScore = leaderboard.getHighestScore(levelId);
```

## 关卡配置格式

关卡使用JSON格式配置，可在 `src/levels/` 目录下添加新关卡。

```json
{
  "id": "level-1",
  "name": "关卡名称",
  "description": "关卡描述",
  "channels": 4,
  "slots": 4,
  "initialBattery": 100,
  "tasks": [
    {
      "id": "task-1",
      "type": "rescue",
      "name": "任务名称",
      "description": "任务描述",
      "priority": "high",
      "powerConsumption": 15,
      "coverageRadius": 3,
      "position": { "x": 5, "y": 5 }
    }
  ]
}
```

### 任务类型

- `rescue` - 救援队
- `hospital` - 医院
- `station` - 临时基站

### 优先级

- `high` - 高
- `medium` - 中
- `low` - 低

## 技术难点解决方案

### 1. 频道重复占用的冲突解决机制

**问题描述**：
同一频道的相同时隙只能放置一个任务，同时需要检测相邻位置的同频干扰。

**解决方案**：
1. **实时占用检测**：在 `stateMachine.scheduleTask()` 中检查目标位置是否已有任务
2. **冲突可视反馈**：UI模块将冲突位置高亮显示为红色脉冲动画
3. **智能交换**：移动任务时，如果目标位置已有任务，自动交换两个任务的位置
4. **规则引擎实时分析**：`rulesEngine.validateScheduling()` 实时检测冲突并提供反馈

**关键代码位置**：
- `src/js/stateMachine.js:55-98` - 调度任务时的冲突检测
- `src/js/rulesEngine.js:65-170` - 同频干扰检测算法
- `src/js/ui.js:632-652` - 冲突可视化

### 2. 存档损坏的自动恢复方案

**问题描述**：
由于浏览器本地存储可能被用户修改或损坏，需要健壮的存档恢复机制。

**解决方案**：
1. **多层验证**：
   - 结构验证：检查必需字段是否存在
   - 数据类型验证：验证字段类型正确性
   - 逻辑验证：确保数据逻辑自洽

2. **渐进式恢复**：
   - 能恢复则恢复，不能恢复则跳过
   - 标记已恢复的存档，提醒用户

3. **异常处理**：
   - JSON解析异常捕获
   - 存储访问异常处理

4. **内置关卡备份**：
   - 所有关卡配置内置在代码中
   - 文件加载失败时自动使用内置数据

**关键代码位置**：
- `src/js/saveManager.js:40-66` - 存档加载与验证
- `src/js/saveManager.js:116-144` - 存档恢复算法
- `src/js/levelLoader.js:40-245` - 内置关卡数据

## 快捷键

| 按键 | 功能 |
|------|------|
| Ctrl + Z | 撤销 |
| Ctrl + Y | 重做 |
| Ctrl + Shift + Z | 重做 |
| Ctrl + S | 保存 |

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

游戏使用ES6+模块系统，无需转译即可在现代浏览器运行。

## 开发指南

### 添加新关卡

1. 在 `src/levels/` 目录下创建新的JSON文件
2. 参考现有关卡格式配置
3. 在 `src/js/levelLoader.js` 的 `getBuiltinLevel()` 方法中添加内置备份（可选）

### 修改游戏规则

编辑 `src/js/constants.js` 中的 `SCORING_RULES` 对象调整评分权重，或修改 `src/js/rulesEngine.js` 中的检测逻辑。

### 扩展功能

所有模块采用单例模式导出，可直接在新模块中导入使用。主入口在 `src/js/main.js`，可在此添加新的游戏逻辑。

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。
