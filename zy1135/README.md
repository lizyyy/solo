# 🏝️ 鲁滨逊漂流记 - 生存策略游戏

一款基于《鲁滨逊漂流记》的本地生存策略游戏。你扮演刚漂到荒岛上的鲁滨逊，每天只有有限的行动点，需要在探索、找水、采集食物、搭棚、取火、种粮、驯养山羊、修工具、写航海日志和发救援信号之间做出艰难的取舍。

## 🎮 游戏特色

- **资源管理系统**：管理食物、水、体力、精神、工具耐久、安全值六种关键资源
- **行动系统**：每天 5 个行动点，合理分配各种生存活动
- **地点探索**：海滩、森林、洞穴、悬崖、溪流等多个地点待发现
- **营地建设**：搭建庇护所、生火、建储物区、种菜园、建信号塔
- **事件系统**：暴风雨、疾病、沉船补给、神秘脚印、星期五、救援机会等剧情事件
- **航海日志**：自动记录每天的行动、资源变化和事件经历
- **多格式导出**：支持导出 Markdown、HTML、JSON 三种格式的航海日志

## 🛠️ 技术栈

### 后端
- **Node.js + Express**：Web 框架
- **TypeScript**：类型安全
- **UUID**：生成唯一 ID

### 前端
- **React 18**：UI 框架
- **TypeScript**：类型安全
- **Tailwind CSS**：样式框架
- **Zustand**：状态管理
- **Axios**：HTTP 客户端
- **React Router**：路由管理

## 📦 安装

### 前置要求
- Node.js 18+
- npm 或 yarn

### 安装步骤

1. 安装根目录依赖：
```bash
npm install
```

这会同时安装后端和前端的所有依赖（使用 npm workspaces）。

## 🚀 启动

### 开发模式

同时启动后端和前端：
```bash
npm run dev
```

或者分别启动：

后端（端口 8080）：
```bash
npm run dev:backend
```

前端（端口 3000）：
```bash
npm run dev:frontend
```

### 生产模式

先构建：
```bash
npm run build
```

然后启动：
```bash
npm run start
```

## 🎯 游戏玩法

### 开始游戏
1. 打开浏览器访问 http://localhost:3000
2. 输入游戏名称，点击"开始冒险"
3. 你将作为鲁滨逊在荒岛上开始生存

### 每日流程
1. 查看当前资源状态（食物、水、体力、精神、工具耐久、安全值）
2. 选择地点并执行行动（消耗行动点和体力）
3. 行动点用完或完成计划后，点击"结束今天"
4. 处理可能触发的事件
5. 进入新的一天

### 资源说明
| 资源 | 说明 |
|------|------|
| 🍖 食物 | 维持生命的必需品，每天消耗 5 点 |
| 💧 水 | 维持生命的必需品，每天消耗 8 点 |
| ⚡ 体力 | 执行行动需要消耗体力 |
| 🧠 精神 | 孤独和绝望会降低精神，精神归零游戏结束 |
| 🔧 工具耐久 | 许多行动需要工具，工具可以修复 |
| 🛡️ 安全值 | 应对危险时的保障，越低越危险 |

### 地点说明
| 地点 | 说明 |
|------|------|
| 🏖️ 海滩 | 初始地点，有沉船残骸 |
| 🌲 森林 | 可探索，可获取木材和食物 |
| 🕳️ 洞穴 | 黑暗但可能有淡水 |
| 🏔️ 悬崖 | 可发救援信号的高地 |
| 💧 溪流 | 稳定的淡水源 |

### 事件系统
游戏包含多种剧情事件：
- **第 3 天**：暴风雨来袭
- **第 5 天**：发现新的沉船残骸
- **第 7 天**：疾病侵袭
- **第 10 天**：发现神秘脚印
- **第 14 天**：遇到星期五
- **第 21 天**：救援机会

此外还有资源低时触发的随机事件。

### 结局条件
- **成功获救**：在第 21 天成功触发救援信号
- **游戏结束**：
  - 饥饿 + 体力耗尽
  - 缺水 + 体力耗尽
  - 精神崩溃（精神 ≤ 0）
  - 遭遇致命危险（安全值 ≤ -20）
  - 在岛上坚持 100 天未获救

## 📤 导出航海日志

游戏结束后，你可以在结局页面选择导出格式：

1. **Markdown (.md)**：纯文本格式，适合查看和编辑
2. **HTML (.html)**：带样式的网页格式，适合分享
3. **JSON (.json)**：结构化数据，适合程序处理

导出文件会自动下载到你的本地。

## 🧪 测试

（测试框架已配置，可自行编写测试用例）

后端测试：
```bash
npm run test
```

前端测试：
```bash
npm run test --workspace=frontend
```

## 📁 项目结构

```
zy1135/
├── backend/                    # 后端
│   ├── src/
│   │   ├── config/            # 游戏数据配置
│   │   │   └── gameData.ts   # 行动、事件、地点、设施数据
│   │   ├── routes/            # API 路由
│   │   │   └── gameRoutes.ts # 游戏相关接口
│   │   ├── services/          # 业务逻辑
│   │   │   ├── GameService.ts # 游戏核心逻辑
│   │   │   └── ExportService.ts # 导出服务
│   │   ├── types/             # 类型定义
│   │   │   └── index.ts
│   │   ├── utils/             # 工具函数
│   │   │   └── helpers.ts
│   │   └── index.ts           # 入口文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # 前端
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/        # 组件
│   │   │   ├── ResourceDisplay.tsx
│   │   │   ├── LocationList.tsx
│   │   │   ├── FacilityPanel.tsx
│   │   │   ├── InventoryDisplay.tsx
│   │   │   ├── ActionPanel.tsx
│   │   │   ├── EventModal.tsx
│   │   │   ├── LogView.tsx
│   │   │   └── Toast.tsx
│   │   ├── config/            # 前端配置
│   │   │   └── gameData.ts
│   │   ├── pages/             # 页面
│   │   │   ├── StartScreen.tsx
│   │   │   ├── GameScreen.tsx
│   │   │   └── GameOverScreen.tsx
│   │   ├── services/          # API 服务
│   │   │   └── api.ts
│   │   ├── store/             # 状态管理
│   │   │   └── gameStore.ts
│   │   ├── types/             # 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── package.json                # 根配置
└── README.md
```

## 🔌 API 接口

### 游戏管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/games` | 创建新游戏 |
| GET | `/api/games/:id` | 获取游戏状态 |

### 游戏操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/games/:id/action` | 执行行动 |
| POST | `/api/games/:id/end-turn` | 结束当天 |
| POST | `/api/games/:id/event-choice` | 处理事件选择 |
| GET | `/api/games/:id/available-actions` | 获取可用行动 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/games/:id/export/markdown` | 导出 Markdown 格式 |
| GET | `/api/games/:id/export/html` | 导出 HTML 格式 |
| GET | `/api/games/:id/export/json` | 导出 JSON 格式 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 检查服务状态 |

## ⚠️ 异常处理

游戏包含完善的异常处理：

- **行动点不足**：提示当前行动点和需要的行动点
- **资源不足**：提示缺少的资源类型和数量
- **物品不足**：提示缺少的物品和数量
- **工具耐久不足**：提示当前和需要的工具耐久
- **设施等级不足**：提示需要的设施等级
- **存档不存在**：提示存档 ID 无效
- **游戏已结束**：无法在游戏结束后执行操作

所有错误都会以友好的方式在前端显示。

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

祝你在荒岛上生存愉快！🏝️
