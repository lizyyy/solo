# 博物馆夜间安保训练系统

一个用于博物馆夜间安保新人训练的本地小游戏，模拟真实巡查场景，帮助新人快速掌握巡查路线和检查要点。

## 功能特性

### 🎮 游戏玩法
- **2D 平面图视角**：在展厅平面图中控制巡查员移动
- **三类检查点**：
  - 🚪 门禁检查
  - 🌡️ 温湿度报警检查
  - 🖼️ 重点展柜检查
- **时间限制**：在规定时间内完成所有巡查任务
- **评分系统**：
  - 漏检惩罚：每个漏检扣 20 分
  - 绕路惩罚：超过最优距离 50% 的部分扣分
  - 超时惩罚：每超时 10 秒扣 1 分

### 📦 数据管理
- **关卡导入**：通过 JSON 文件导入展厅平面图和检查点
- **持久化存储**：使用 SQLite 数据库保存所有数据
- **回放记录**：自动记录每次巡查的完整轨迹
- **历史查询**：查看所有历史巡查记录和评分

### 📊 导出功能
- **Markdown 复盘报告**：生成详细的巡查复盘报告
- **JSON 审计包**：导出完整的审计数据，包含所有巡查信息

## 项目结构

```
museum-security-trainer/
├── package.json              # 项目配置
├── README.md                # 本文档
├── server/                  # 后端服务
│   ├── server.js           # Express 服务器入口
│   ├── database.js         # SQLite 数据库连接
│   └── routes/             # API 路由
│       ├── levels.js       # 关卡管理
│       ├── sessions.js     # 会话管理
│       └── exports.js      # 导出功能
├── client/                  # 前端页面
│   ├── index.html          # 主页面
│   ├── css/
│   │   └── style.css       # 样式文件
│   └── js/
│       ├── main.js         # 入口文件
│       ├── api.js          # API 封装
│       ├── game.js         # 游戏核心逻辑
│       └── ui.js           # UI 交互逻辑
├── data/                    # 数据存储（运行时生成）
│   ├── museum.db          # SQLite 数据库
│   ├── levels/            # 关卡数据
│   ├── replays/           # 回放数据
│   └── exports/           # 导出文件
└── examples/               # 示例数据
    ├── simple-floor-plan.json    # 简单示例
    └── sample-floor-plan.json    # 完整示例
```

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装步骤

1. **安装依赖**
```bash
npm install
```

2. **启动服务器**
```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

### 试玩流程

1. **导入关卡**
   - 点击主菜单的「导入关卡」按钮
   - 选择 `examples/` 目录下的任一 JSON 文件
   - 填写关卡名称和时间限制
   - 点击「导入关卡」

2. **开始游戏**
   - 点击「开始训练」
   - 选择已导入的关卡
   - 进入游戏界面

3. **游戏操作**
   - 使用 `↑↓←→` 方向键或 `WASD` 键移动巡查员
   - 到达检查点附近自动完成检查
   - 在时间限制内完成所有检查点

4. **查看结果**
   - 游戏结束后显示详细评分
   - 可导出 Markdown 复盘报告
   - 可导出 JSON 审计包

## 展厅 JSON 格式说明

要创建自定义关卡，需要准备一个 JSON 文件，格式如下：

```json
{
  "floor_plan": {
    "width": 800,           // 平面图宽度（像素）
    "height": 600,          // 平面图高度（像素）
    "start": {              // 玩家起始位置
      "x": 50,
      "y": 550
    },
    "walls": [              // 墙壁列表（可选）
      {
        "x": 0,
        "y": 0,
        "width": 800,
        "height": 20
      }
    ]
  },
  "checkpoints": [          // 检查点列表
    {
      "id": "door_main",    // 唯一标识
      "name": "主入口门禁", // 显示名称
      "type": "door",       // 类型：door | temperature | exhibit
      "position": {         // 位置
        "x": 400,
        "y": 50
      }
    }
  ]
}
```

### 检查点类型

| 类型 | 说明 | 图标 |
|------|------|------|
| `door` | 门禁检查 | 🚪 |
| `temperature` | 温湿度报警检查 | 🌡️ |
| `exhibit` | 重点展柜检查 | 🖼️ |

## API 接口

### 关卡管理
- `GET /api/levels` - 获取所有关卡
- `GET /api/levels/:id` - 获取单个关卡详情
- `POST /api/levels` - 创建新关卡
- `DELETE /api/levels/:id` - 删除关卡

### 会话管理
- `POST /api/sessions` - 创建新会话
- `GET /api/sessions/:id` - 获取会话详情
- `PUT /api/sessions/:id` - 更新会话
- `POST /api/sessions/:id/finish` - 结束会话并计算评分
- `GET /api/sessions` - 获取所有历史会话

### 导出功能
- `GET /api/exports/markdown/:sessionId` - 导出 Markdown 复盘报告
- `GET /api/exports/json/:sessionId` - 导出 JSON 审计包

## 评分规则

### 总分
- 基础分：100 分

### 扣分规则

1. **漏检惩罚**
   - 每个未检查的检查点扣 20 分
   - 例如：漏检 2 个检查点 → 扣 40 分

2. **绕路惩罚**
   - 实际移动距离超过最优距离 50% 的部分
   - 每超过 10 个单位扣 1 分
   - 例如：最优距离 100，实际距离 200 → 超过 50 单位 → 扣 5 分

3. **超时惩罚**
   - 每超过时间限制 10 秒扣 1 分
   - 例如：超时 35 秒 → 扣 3 分

### 评分等级
- 90 分及以上：优秀
- 70-89 分：良好
- 50-69 分：及格
- 50 分以下：需要改进

## 开发说明

### 目录说明

- `server/`：后端代码，使用 Express + SQLite
- `client/`：前端代码，纯原生 HTML/CSS/JavaScript
- `data/`：运行时数据目录，包含数据库和导出文件
- `examples/`：示例数据，用于测试和演示

### 运行开发模式
```bash
npm run dev
```

使用 nodemon 自动重启服务器。

### 数据存储位置

- SQLite 数据库：`data/museum.db`
- 关卡数据：`data/levels/`
- 回放数据：`data/replays/`
- 导出文件：`data/exports/`

## 常见问题

**Q: 如何创建自定义关卡？**
> A: 参考 `examples/` 目录下的 JSON 格式，创建包含 `floor_plan` 和 `checkpoints` 的 JSON 文件，然后通过「导入关卡」功能上传。

**Q: 游戏支持触摸屏吗？**
> A: 目前只支持键盘操作（方向键或 WASD），触摸屏设备需要外接键盘或使用虚拟键盘。

**Q: 数据会丢失吗？**
> A: 所有数据保存在 `data/` 目录下，只要不删除该目录，数据就不会丢失。

**Q: 如何重置所有数据？**
> A: 删除 `data/` 目录即可，下次启动服务器时会自动重新初始化。

## 许可证

MIT License
