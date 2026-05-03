# 温室授粉机器人调度员

一个本地浏览器小游戏，玩家扮演温室授粉机器人调度员，在时间轴上编排机器人的动作，完成授粉任务。

## 游戏介绍

作为温室授粉机器人调度员，你需要合理安排机器人在不同棚区的授粉、充电、消毒和绕行动作，确保：
- 赶上开花窗口完成授粉
- 避免同棚交叉病害
- 防止低电量滞留
- 避开湿度禁入区
- 防止路径相撞

## 本地预览

### 方法一：使用 Python 内置服务器

```bash
# Python 3
python3 -m http.server 8080

# 然后在浏览器中打开: http://localhost:8080
```

```bash
# Python 2
python -m SimpleHTTPServer 8080

# 然后在浏览器中打开: http://localhost:8080
```

### 方法二：使用 Node.js http-server

```bash
# 安装（如果需要）
npm install -g http-server

# 启动服务器
http-server -p 8080

# 然后在浏览器中打开: http://localhost:8080
```

### 方法三：使用 VS Code Live Server 插件

1. 在 VS Code 中安装 "Live Server" 插件
2. 右键点击 `index.html` 文件
3. 选择 "Open with Live Server"

## 游戏玩法

### 1. 加载关卡

- 从顶部下拉菜单选择一个关卡
- 点击 "加载关卡" 按钮

### 2. 编排动作

使用时间轴编排器添加动作：

1. **选择动作类型**：授粉、充电、消毒、移动
2. **选择机器人**：指定执行动作的机器人
3. **选择目标棚区**：动作执行的区域
4. **设置开始时间**：动作何时开始
5. **设置时长**：动作持续多久
6. **点击 "添加动作"**：将动作加入时间轴

### 3. 检查冲突

- 红色冲突警告：严重问题，必须解决才能运行
- 橙色/黄色冲突：一般问题，会影响评分

冲突类型包括：
- **低电量**：机器人电量耗尽
- **湿度禁入**：机器人进入高湿禁入区
- **路径相撞**：多个机器人在同一位置
- **交叉污染**：同一机器人在同一棚区连续授粉未消毒
- **花期窗口**：授粉时间不在开花窗口内

### 4. 运行模拟

- 点击 "运行" 按钮开始模拟
- 观察机器人在温室中的移动和电量变化
- 模拟结束后查看结算结果

### 5. 结算与评分

- 完成所有目标且无机器人电量耗尽 = 关卡完成
- 得分 = 完成目标的分数 - 冲突惩罚
- 最佳成绩保存在浏览器 localStorage 中

### 6. 导出复盘

- 点击 "导出复盘" 按钮
- 下载包含当前动作配置的 JSON 文件
- 可用于分享或后续分析

## 关卡数据格式

关卡数据位于 `levels/` 目录下，JSON 格式：

```json
{
    "id": "level_1",
    "name": "关卡名称",
    "description": "关卡描述",
    "timeLimit": 480,
    "grid": [
        [
            {"type": "pollination", "zoneId": "p1", "zoneName": "番茄棚", "requiresDisinfection": false},
            {"type": "charging", "zoneId": "c1", "zoneName": "充电站"},
            {"type": "disinfection", "zoneId": "d1", "zoneName": "消毒站"},
            {"type": "humidity", "zoneId": "h1", "zoneName": "高湿区"},
            {"type": "path", "zoneId": null}
        ]
    ],
    "robots": [
        {
            "id": "R1",
            "name": "机器人1号",
            "startPosition": {"row": 0, "col": 1},
            "battery": 100,
            "maxBattery": 100,
            "chargeRate": 5.0
        }
    ],
    "objectives": [
        {
            "id": "obj1",
            "description": "完成番茄棚授粉",
            "zoneId": "p1",
            "minPollinationTime": 30,
            "floweringWindow": {
                "start": "08:00",
                "end": "12:00"
            },
            "points": 100
        }
    ]
}
```

### 数据验证

游戏会验证以下错误并给出清晰提示：

1. **跨午夜花期**：开花窗口的开始时间晚于结束时间
2. **重复机器人编号**：多个机器人使用相同 ID
3. **时间限制超过24小时**：timeLimit > 1440 分钟
4. **缺少必要字段**：关卡缺少名称、网格、机器人或目标

## 区域类型说明

| 类型 | 颜色 | 说明 |
|------|------|------|
| pollination | 绿色 | 授粉区，执行授粉动作 |
| charging | 黄色 | 充电区，执行充电动作 |
| disinfection | 蓝色 | 消毒区，执行消毒动作 |
| humidity | 紫色 | 高湿禁入区，不可进入 |
| path | 浅灰 | 通行路径 |

## 动作类型说明

| 动作 | 功耗 | 说明 |
|------|------|------|
| 授粉 | 高 | 在授粉区执行，完成目标所需 |
| 充电 | 负（回血） | 在充电区执行，恢复电量 |
| 消毒 | 中 | 在消毒区执行，防止交叉污染 |
| 移动 | 低 | 移动/绕行，规划路径 |

## 项目结构

```
.
├── index.html          # 主页面
├── styles.css          # 样式文件
├── app.js              # 游戏逻辑
├── levels/             # 关卡数据
│   ├── levels.json     # 关卡列表
│   ├── level1.json     # 关卡1：新手教学
│   ├── level2.json     # 关卡2：双机协作
│   └── level3.json     # 关卡3：复杂调度
└── README.md           # 本文档
```

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

需要 JavaScript 启用，支持 localStorage 和 fetch API。

## 许可证

MIT License
