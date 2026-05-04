# 🎵 乐理和声练习台

一个本地运行的全栈 Web 应用，专为学习乐理、钢琴伴奏或编曲入门的用户设计。帮助学生系统化地练习乐理知识，帮助老师快速判断学生的薄弱环节。

## ✨ 功能特性

### 📚 题库覆盖
- **音阶音级识别**：识别大/小调音阶中的各级音
- **三和弦/七和弦构成**：掌握大三、小三、属七等和弦结构
- **转位判断**：识别六和弦、四六和弦等转位形式
- **罗马数字和弦功能**：理解和弦的功能标记（I, IV, V 等）
- **终止式判断**：识别正格终止、半终止、欺骗终止等

### 🎯 智能错因分析
学生作答后，系统自动分析错误原因，生成错因标签：
- 看错调性
- 漏看临时记号
- 级数换算错
- 和弦音漏音
- 转位判断错
- 终止式类型错

### 📊 进度追踪与报告
- **错题本**：自动沉淀错题，支持状态管理和教师批注
- **进度看板**：按知识点、题型统计正确率趋势
- **报告导出**：支持 Markdown/HTML/CSV 三种格式报告

## 🛠️ 技术栈

### 后端
- **Node.js** + **Express** - 服务端框架
- **SQLite (better-sqlite3)** - 本地数据库
- **express-validator** - 数据验证
- **csv-parser** - CSV 数据导入

### 前端
- **React 18** - UI 框架
- **React Router v6** - 路由管理
- **Tailwind CSS** - 样式框架
- **Recharts** - 数据可视化
- **Lucide React** - 图标库
- **Axios** - HTTP 客户端

## 📁 项目结构

```
music-theory-practice/
├── client/                    # 前端应用
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   │   ├── HomePage.js          # 首页
│   │   │   ├── PracticePage.js      # 练习页面
│   │   │   ├── WrongNotesPage.js    # 错题本页面
│   │   │   ├── ProgressPage.js      # 进度看板页面
│   │   │   └── ReportsPage.js       # 报告导出页面
│   │   ├── services/         # API 服务
│   │   │   └── api.js
│   │   ├── App.js            # 主应用组件
│   │   ├── index.js          # 入口文件
│   │   └── index.css         # 全局样式
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                    # 后端服务
│   ├── data/                  # 数据文件
│   │   ├── theory-pack.json   # 完整题库数据（推荐）
│   │   └── questions.csv      # CSV 格式题库
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js    # 数据库配置
│   │   ├── routes/
│   │   │   ├── questions.js   # 题库 API
│   │   │   ├── practice.js    # 练习 API
│   │   │   ├── wrongNotes.js  # 错题本 API
│   │   │   ├── progress.js    # 进度统计 API
│   │   │   └── reports.js     # 报告导出 API
│   │   ├── scripts/
│   │   │   └── importData.js  # 数据导入脚本
│   │   ├── utils/
│   │   │   └── musicTheory.js # 乐理计算工具
│   │   └── index.js           # 服务入口
│   └── package.json
│
├── package.json               # 根目录配置
└── README.md
```

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装步骤

1. **克隆项目**（如果需要）
```bash
# 直接在项目目录中操作
cd zy1134
```

2. **安装依赖**

```bash
# 安装根目录依赖（用于 concurrently）
npm install

# 安装后端依赖
cd server && npm install

# 安装前端依赖
cd ../client && npm install
```

3. **导入样例数据**

```bash
# 回到 server 目录
cd ../server

# 运行数据导入脚本
npm run import
```

这会导入 `server/data/` 目录下的样例数据：
- `theory-pack.json` - 包含 12 个知识点、22 道题目（完整题库）
- `questions.csv` - 包含 10 道题目（CSV 格式）

4. **启动应用**

**方式一：同时启动前后端（推荐开发时使用）**
```bash
# 回到项目根目录
cd ..

# 启动前后端（后端端口 3001，前端端口 3000）
npm run dev
```

**方式二：单独启动**

```bash
# 终端 1 - 启动后端
cd server
npm run dev  # 开发模式（带热重载）
# 或 npm start  # 生产模式

# 终端 2 - 启动前端
cd client
npm start
```

5. **访问应用**

打开浏览器访问：
- 前端地址: http://localhost:3000
- 后端 API: http://localhost:3001/api

## 📖 使用指南

### 1. 开始练习

1. 点击侧边栏「练习」进入练习页面
2. 选择题型（可选）
3. 选择知识点（可选）
4. 选择题目数量（5/10/15/20 题）
5. 点击「开始练习」

### 2. 答题流程

1. 阅读题目和选项
2. 选择答案
3. 点击「提交答案」
4. 查看结果反馈（对错、错因标签、解析）
5. 点击「下一题」继续

### 3. 查看错题本

1. 点击侧边栏「错题本」
2. 可以按状态筛选：全部、待复习、已复习、已掌握
3. 点击「查看」查看完整题目和解析
4. 可以更新错题状态

### 4. 查看进度看板

1. 点击侧边栏「进度看板」
2. 查看总体统计：总答题数、正确率、待复习错题等
3. 查看近 7 天练习趋势图表
4. 查看各知识点和题型的正确率
5. 查看薄弱知识点推荐和错因分布

### 5. 导出报告

1. 点击侧边栏「练习报告」
2. 可选择报告周期（最近 7 天、最近 30 天、全部数据）
3. 点击导出按钮：
   - **导出 Markdown** - 适合编辑和分享
   - **导出 HTML** - 适合浏览器查看
   - **导出 CSV** - 适合表格软件处理

报告内容包含：
- 练习概览（总题数、正确率等）
- 知识点掌握情况
- 题型掌握情况
- 错因分析
- 需要优先复习的知识点
- 代表性错题

## 🗄️ 数据库设计

### 核心表结构

| 表名 | 说明 |
|------|------|
| users | 用户表（学生、教师） |
| knowledge_points | 知识点表 |
| questions | 题库表 |
| practice_sessions | 练习会话表 |
| answers | 答题记录表 |
| wrong_notes | 错题本表 |
| annotations | 教师批注表 |

### 默认用户

数据库初始化时会自动创建两个测试用户：

| 用户名 | 邮箱 | 角色 |
|--------|------|------|
| student | student@example.com | 学生 |
| teacher | teacher@example.com | 教师 |

## 🔧 API 接口

### 题库相关
- `GET /api/questions` - 获取题目列表（支持筛选、分页）
- `GET /api/questions/:id` - 获取单个题目详情
- `GET /api/questions/knowledge-points/list` - 获取知识点列表

### 练习相关
- `POST /api/practice/start` - 开始练习会话
- `GET /api/practice/question/:id` - 获取练习题目（隐藏答案）
- `POST /api/practice/submit` - 提交答案并评分
- `POST /api/practice/end/:sessionId` - 结束练习会话

### 进度统计
- `GET /api/progress/overview` - 获取总体进度概览
- `GET /api/progress/by-knowledge-point` - 按知识点统计
- `GET /api/progress/by-question-type` - 按题目类型统计
- `GET /api/progress/history` - 获取练习历史
- `GET /api/progress/weak-points` - 获取薄弱知识点

### 报告导出
- `GET /api/reports/data` - 获取报告数据
- `GET /api/reports/export/markdown` - 导出 Markdown 报告
- `GET /api/reports/export/html` - 导出 HTML 报告
- `GET /api/reports/export/csv` - 导出 CSV 报告

## 📝 数据导入

### 支持的数据格式

#### 1. JSON 格式（推荐）

文件位置: `server/data/theory-pack.json`

格式示例:
```json
{
  "version": "1.0.0",
  "knowledgePoints": [
    {
      "id": 1,
      "name": "大调音阶音级",
      "category": "音阶",
      "description": "识别大调音阶中的各级音"
    }
  ],
  "questions": [
    {
      "knowledge_point_id": 1,
      "type": "scale_identification",
      "difficulty": 1,
      "content": {
        "question": "在 C 大调中，第 III 级音是什么？",
        "key": "C",
        "scaleType": "major",
        "degree": 3
      },
      "options": ["A", "B", "C", "D"],
      "correct_answer": {
        "note": "E",
        "degree": 3,
        "key": "C"
      },
      "explanation": "C 大调音阶为 C-D-E-F-G-A-B，第 III 级音是 E。",
      "tags": ["C大调", "音级识别", "基础"]
    }
  ]
}
```

#### 2. CSV 格式

文件位置: `server/data/questions.csv`

格式说明:
- `id`: 题目 ID
- `knowledge_point_id`: 知识点 ID
- `type`: 题目类型
- `difficulty`: 难度（1-5）
- `content`: JSON 格式的题目内容
- `options`: JSON 数组格式的选项
- `correct_answer`: JSON 格式的正确答案
- `explanation`: 解析说明
- `tags`: JSON 数组格式的标签

### 导入命令

```bash
cd server
npm run import
```

脚本会自动检测并导入 `server/data/` 目录下的所有可用数据文件。

## 🎯 题目类型说明

| 类型标识 | 说明 | 示例 |
|----------|------|------|
| scale_identification | 音阶音级识别 | "C 大调中第 III 级音是什么？" |
| chord_construction | 和弦构成 | "以 C 为根音的大三和弦由哪些音构成？" |
| inversion | 转位判断 | "C 大三和弦的第一转位的低音是什么？" |
| roman_numeral | 罗马数字功能 | "C 大调中 G-B-D 的罗马数字标记是什么？" |
| cadence | 终止式判断 | "V -> I 是什么类型的终止？" |

## 🏷️ 错因标签说明

系统支持以下错因标签：

| 标签 | 说明 |
|------|------|
| 看错调性 | 错误判断了题目中的调号 |
| 漏看临时记号 | 忽略了题目中的临时升降号 |
| 级数换算错 | 音级与级数的对应关系搞错 |
| 和弦音漏音 | 漏写或多写了和弦音 |
| 转位判断错 | 错误判断了和弦的转位形式 |
| 终止式类型错 | 错误判断了终止式的类型 |
| 和弦类型错 | 错误判断了和弦的性质（大小增减） |
| 根音判断错 | 错误判断了和弦的根音 |

## 🔍 常见问题

### Q1: 数据库文件在哪里？
答: 数据库文件位于 `server/data/music-theory.db`，第一次启动后端时会自动创建。

### Q2: 如何重置数据？
答: 删除 `server/data/music-theory.db` 文件，重启后端服务会重新创建数据库，然后重新运行 `npm run import` 导入样例数据。

### Q3: 前端访问后端 API 跨域问题？
答: 后端已经配置了 CORS 中间件，允许前端从 `http://localhost:3000` 访问。如果修改了端口，请在 `server/src/index.js` 中相应调整 CORS 配置。

### Q4: 如何添加新题目？
答: 有两种方式：
1. 编辑 `server/data/theory-pack.json` 添加题目，然后重新运行 `npm run import`
2. 直接调用后端 API 接口 `POST /api/questions` 添加

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
