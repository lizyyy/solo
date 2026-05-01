# 🤖 线路巡检机器人训练场

一款专为青少年宫机器人课设计的本地 2D 训练小游戏，帮助孩子们理解机器人编程的基本概念。

## 🎯 项目简介

孩子们常把前进、转向、取样、避障这些指令写乱。这款游戏通过关卡式训练，让老师能够快速演示哪里出错，并给出星级评分反馈。

### 核心功能

- **网格地图与关卡编辑器**：支持放置起点、障碍、充电点、检查点和危险格
- **双模式指令编辑**：支持拖拽编排或文本输入指令
- **分步回放**：运行后逐步回放机器人路径，可视化教学
- **智能校验**：检测撞墙、漏检、能量耗尽、重复取样等问题
- **星级评分**：根据完成度和效率给出1-3星评价
- **本地存储**：关卡、最佳记录和回放自动保存在浏览器本地
- **导入/导出**：支持 JSON 格式关卡包的分享和备份

## 📁 项目结构

```
xy4060/
├── index.html                 # 主页面
├── css/
│   └── style.css              # 样式文件
├── js/
│   ├── main.js                # 程序入口
│   ├── utils/
│   │   └── constants.js       # 全局常量定义
│   ├── models/
│   │   ├── Level.js           # 关卡模型
│   │   ├── Command.js         # 指令和指令队列模型
│   │   ├── RobotState.js      # 机器人状态模型
│   │   └── Replay.js          # 回放和最佳记录模型
│   ├── core/
│   │   ├── CommandInterpreter.js  # 指令解释器
│   │   ├── Validator.js           # 校验器
│   │   └── Scorer.js              # 评分系统
│   ├── storage/
│   │   ├── Storage.js         # 本地存储管理
│   │   └── ImportExport.js    # 导入导出功能
│   ├── render/
│   │   └── GameRenderer.js    # Canvas 渲染器
│   ├── ui/
│   │   ├── LevelEditor.js     # 关卡编辑器UI
│   │   ├── CommandEditor.js   # 指令编辑器UI
│   │   └── GameController.js  # 主控制器
│   ├── data/
│   │   └── SampleLevels.js    # 示例关卡数据
│   └── test/
│       └── TestRunner.js      # 测试和自检模块
└── README.md
```

## 🚀 快速开始

### 运行方式

本项目是纯前端应用，无需安装任何环境，直接在浏览器中打开即可使用：

1. **直接打开**：双击 `index.html` 文件在浏览器中打开
2. **本地服务器（推荐）**：
   ```bash
   # 使用 Python
   python3 -m http.server 8080
   
   # 或使用 Node.js
   npx serve .
   
   # 然后访问 http://localhost:8080
   ```

### 自检步骤

首次使用时，可以在浏览器控制台运行自检：

```javascript
// 打开浏览器开发者工具 (F12)，在 Console 中输入：
runSelfTests()
```

预期输出：
```
========================================
🤖 开始运行测试套件
========================================
✅ PASS: Level: 创建新关卡
✅ PASS: Level: 设置和获取格子
✅ PASS: Level: 设置起点
...
========================================
测试完成: 26/26 通过
========================================
```

## 📖 使用指南

### 训练模式

1. **选择关卡**：从左侧下拉菜单选择一个示例关卡
2. **编排指令**：
   - 拖拽方式：从右侧"指令系统"拖拽指令到"指令队列"
   - 文本方式：点击"文本编辑"，每行输入一个指令（forward/turnLeft/turnRight/sample/charge）
3. **运行指令**：
   - 点击"运行"自动执行所有指令
   - 点击"单步"逐条执行
   - 拖动滑块调整运行速度
4. **查看结果**：运行结束后显示星级评分和详细分析

### 编辑模式

1. **切换模式**：点击顶部"切换模式"按钮
2. **选择工具**：从左侧选择要放置的格子类型
3. **绘制地图**：点击网格放置或擦除元素
4. **设置属性**：在下方修改关卡名称、地图大小、初始能量
5. **保存关卡**：点击"保存关卡"按钮

### 指令说明

| 指令 | 英文 | 能量消耗 | 说明 |
|------|------|----------|------|
| 前进 | forward | 1 | 向当前方向移动一格 |
| 左转 | turnLeft | 0.5 | 原地逆时针旋转90度 |
| 右转 | turnRight | 0.5 | 原地顺时针旋转90度 |
| 取样 | sample | 2 | 在取样点采集样本 |
| 充电 | charge | 0 | 在充电点补充20点能量 |

### 地图元素

| 图标 | 类型 | 说明 |
|------|------|------|
| 🚀 | 起点 | 机器人初始位置 |
| 🧱 | 障碍 | 不可通过，撞墙失败 |
| 🔋 | 充电点 | 可以补充能量 |
| ✅ | 检查点 | 必须经过才能完成任务 |
| ⚠️ | 危险格 | 进入即失败 |
| 📦 | 取样点 | 可以采集样本 |

### 评分规则

| 星级 | 条件 |
|------|------|
| ⭐⭐⭐ 三星 | 完美完成，无错误，指令数最优 |
| ⭐⭐ 二星 | 完成任务，但有优化空间 |
| ⭐ 一星 | 基本完成，存在小问题 |
| 0 星 | 任务失败（撞墙、漏检、能量耗尽等） |

### 导入/导出

1. **导出关卡包**：点击顶部"导出关卡"按钮，下载 JSON 文件
2. **导入关卡包**：点击顶部"导入关卡"按钮，选择之前导出的 JSON 文件

## 🔧 核心模块说明

### 指令解释器 (CommandInterpreter)

负责执行指令队列，支持单步执行和连续运行模式。

```javascript
var interpreter = new CommandInterpreter(robotState);
interpreter.run(commandQueue, { stepDelay: 500 });
```

### 校验器 (Validator)

检查执行结果是否符合关卡要求。

```javascript
var validator = new Validator();
var result = validator.validateExecution(robotState, commandQueue, level);
// result.success - 是否成功
// result.errors - 错误列表
// result.warnings - 警告列表
```

### 评分系统 (Scorer)

根据完成度和效率计算星级。

```javascript
var scorer = new Scorer();
var optimalCommands = scorer.estimateOptimalCommands(level);
var rating = scorer.calculateRating(executionResult, level, optimalCommands);
// rating.rating - 0-3星
// rating.details - 详细说明
```

### 本地存储 (Storage)

使用浏览器 localStorage 保存数据。

```javascript
storageInstance.saveLevel(level);
var loadedLevel = storageInstance.loadLevel(levelId);
```

## 🧪 测试说明

项目包含完整的测试套件，覆盖所有核心模块：

- **Level 模型测试**：11 个测试用例
- **Command 模型测试**：5 个测试用例
- **RobotState 状态机测试**：9 个测试用例
- **Validator 校验器测试**：1 个测试用例
- **Scorer 评分器测试**：1 个测试用例
- **Storage 存储测试**：1 个测试用例
- **ImportExport 导入导出测试**：1 个测试用例
- **SampleLevels 示例关卡测试**：1 个测试用例

总计 **26 个测试用例**。

## 📝 关卡包格式

导出的关卡包为 JSON 格式，结构如下：

```json
{
  "version": "1.0",
  "name": "关卡包",
  "exportedAt": "2026-05-01T...",
  "levels": [
    {
      "id": "sample_001",
      "name": "直线入门",
      "description": "学习基本的前进指令",
      "mapWidth": 8,
      "mapHeight": 5,
      "initialEnergy": 20,
      "map": [
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0],
        [0,1,0,0,0,0,4,0],
        [0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0]
      ],
      "startPosition": {"x": 1, "y": 2},
      "startDirection": 1
    }
  ],
  "records": []
}
```

地图格子类型编码：
- 0: 空地
- 1: 起点
- 2: 障碍
- 3: 充电点
- 4: 检查点
- 5: 危险格
- 6: 取样点

## 🤝 扩展开发

### 添加新指令

1. 在 `constants.js` 中添加新指令类型
2. 在 `RobotState.js` 中实现执行方法
3. 在 `CommandInterpreter.js` 中添加指令分发逻辑
4. 在 UI 中添加指令按钮

### 添加新地图元素

1. 在 `constants.js` 中添加新格子类型
2. 在 `Level.js` 中添加相关辅助方法
3. 在 `GameRenderer.js` 中添加渲染样式
4. 在 `LevelEditor.js` 中添加编辑工具

## 📄 许可证

MIT License

## 🆘 常见问题

**Q: 数据保存在哪里？会丢失吗？**

A: 数据保存在浏览器 localStorage 中，清除浏览器数据会导致丢失。建议定期导出关卡包备份。

**Q: 为什么不能直接打开 index.html 使用导入导出功能？**

A: 浏览器的同源策略限制了 file:// 协议的某些功能。建议使用本地服务器方式运行。

**Q: 支持移动端吗？**

A: 当前版本主要面向桌面端设计，但响应式布局可以在手机上使用。
