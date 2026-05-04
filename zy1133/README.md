# Band Rehearsal Review - 乐队排练复盘工具

🎸 一个给业余乐队排练后复盘用的本地 Web 工具，帮助乐队分析排练数据，发现问题，提升效率。

## 项目简介

每次排练完，乐队成员只会在群里说"副歌又快了""贝斯那段有点跑""鼓进早了"，下次还是凭感觉从头练，挺浪费时间。

这个工具可以：
- 导入结构化排练数据（sessions、setlist、takes、pitch-beat）
- 按排练场次、歌曲、段落、乐器筛选分析
- 展示哪些段落最容易出错，哪些成员经常抢拍/拖拍/跑调
- 对比两次排练，看哪些段落改善了，哪些问题反复出现
- 自动生成"下次排练练习清单"，按优先级列出需要重点练习的内容
- 导出 Markdown、HTML、CSV 或 JSON 格式的复盘报告

## 功能特性

### 1. 数据导入与校验
- 支持 CSV 和 JSON 格式导入
- 完整的字段校验（缺列、格式错误、数据范围异常）
- 关联校验（未知歌曲、未知成员提示警告）
- 内置示例数据，方便直接体验

### 2. 排练复盘看板
- **摘要卡片**：总错误数、音准问题、节奏问题、严重问题统计
- **段落热力图**：可视化哪些段落问题最多
- **成员问题排行**：按问题数量排序，显示音准/节奏细分
- **趋势图**：多次排练的音准/节奏变化趋势（Chart.js）
- **错误类型分布**：音准问题 vs 节奏问题占比（饼图）
- **详细数据表格**：可搜索、可分页、支持标记和备注

### 3. 手动标记与备注
- 支持标记为"误检"、"需要重点练"、"已修正"
- 可添加备注说明
- 标记和备注持久化存储，刷新不丢失

### 4. 排练对比
- 选择两次排练进行对比
- 显示总错误数、音准问题、节奏问题的变化
- 段落层面的改善/恶化分析
- 成员层面的改善/恶化分析
- 识别反复出现的问题

### 5. 练习清单生成
- 按优先级（紧急/高/中/低）排序
- 包含歌曲、段落、主要问题、主要成员
- 智能生成建议练习方法
- 优先级计算基于：严重错误占比、问题次数

### 6. 报告导出
- **JSON**：完整数据结构，便于二次开发
- **CSV**：表格格式，可用 Excel 打开
- **Markdown**：文档格式，便于分享
- **HTML**：网页报告，带样式，便于打印

## 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript + Chart.js
- **数据解析**：papaparse（CSV 解析）
- **文件上传**：multer
- **数据存储**：本地 JSON 文件（无需数据库）

## 安装与启动

### 环境要求
- Node.js 14+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```

服务启动后，访问 http://localhost:3000

### 开发模式
```bash
npm run dev
```

## 数据导入格式

需要准备以下 4 个数据文件（支持 CSV 或 JSON 格式）：

### 1. sessions.csv - 排练场次

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| session_id | string | 排练场次唯一标识 | S001 |
| date | string | 排练日期，格式 YYYY-MM-DD | 2026-04-20 |
| location | string | 排练地点 | 星巢排练室 |
| notes | string | 排练备注 | 第一次完整排练 |

**示例：**
```csv
session_id,date,location,notes
S001,2026-04-20,星巢排练室,第一次完整排练，整体速度有点不稳
S002,2026-04-27,星巢排练室,重点练了《夜空中最亮的星》的副歌部分
```

### 2. setlist.json - 歌曲列表

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| session_id | string | 关联的排练场次ID | S001 |
| song_id | string | 歌曲唯一标识 | SONG001 |
| song_name | string | 歌曲名称 | 夜空中最亮的星 |
| order | number | 演出顺序 | 1 |

**示例：**
```json
[
  {
    "session_id": "S001",
    "song_id": "SONG001",
    "song_name": "夜空中最亮的星",
    "order": 1
  }
]
```

### 3. takes.json - Take 记录

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| session_id | string | 关联的排练场次ID | S001 |
| song_id | string | 关联的歌曲ID | SONG001 |
| take_id | string | Take 唯一标识 | T001 |
| start_time | number | Take 开始时间戳（秒） | 0 |
| end_time | number | Take 结束时间戳（秒） | 240 |
| musician | string | 演奏者/演唱者姓名 | 小明 |
| instrument | string | 乐器或声部 | vocal, guitar, bass, drums |

**示例：**
```json
[
  {
    "session_id": "S001",
    "song_id": "SONG001",
    "take_id": "T001",
    "start_time": 0,
    "end_time": 240,
    "musician": "小明",
    "instrument": "vocal"
  }
]
```

### 4. pitch-beat.csv - 音高节拍偏差数据

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| session_id | string | 关联的排练场次ID | S001 |
| song_id | string | 关联的歌曲ID | SONG001 |
| take_id | string | 关联的 Take ID | T001 |
| time | number | 时间点（秒，相对于 Take 开始） | 15.5 |
| pitch_cents | number | 音高偏差（cent，正负值，0为完美） | 25 |
| beat_ms | number | 节拍偏移（毫秒，正为拖拍，负为抢拍） | -80 |
| error_type | string | 错误类型 | 见下方说明 |
| musician | string | 演奏者/演唱者姓名 | 小明 |
| instrument | string | 乐器或声部 | vocal |
| section | string | 歌曲段落 | intro, verse, chorus, bridge |

**error_type 有效值：**
- `pitch_high` - 音偏高
- `pitch_low` - 音偏低
- `beat_early` - 抢拍
- `beat_late` - 拖拍
- `timing` - 节奏问题
- `other` - 其他

**示例：**
```csv
session_id,song_id,take_id,time,pitch_cents,beat_ms,error_type,musician,instrument,section
S001,SONG001,T001,15.5,25,-80,pitch_high,小明,vocal,verse
S001,SONG001,T001,32.2,-15,120,beat_late,小红,guitar,chorus
```

## 阈值设置

在 `src/server/models/index.js` 中可以调整阈值：

```javascript
// 音高偏差阈值（cents）
PITCH_CENTS_THRESHOLD = {
  warning: 20,   // 警告：>= 20 cents
  error: 50,     // 错误：>= 50 cents
  extreme: 100   // 离谱：>= 100 cents（可能误检）
}

// 节拍偏移阈值（毫秒）
BEAT_MS_THRESHOLD = {
  warning: 50,    // 警告：>= 50 ms
  error: 100,     // 错误：>= 100 ms
  extreme: 200    // 离谱：>= 200 ms（可能误检）
}
```

## 项目结构

```
band-rehearsal-review/
├── data/
│   ├── sample/                    # 示例数据
│   │   ├── sessions.csv
│   │   ├── setlist.json
│   │   ├── takes.json
│   │   └── pitch-beat.csv
│   ├── annotations/                # 用户标记和备注（自动生成）
│   └── sessions/                   # 用户项目数据（自动生成）
├── src/
│   ├── public/                     # 前端静态资源
│   │   ├── css/
│   │   │   └── styles.css          # 样式文件
│   │   ├── js/
│   │   │   └── app.js              # 前端主应用
│   │   └── index.html              # 主页面
│   └── server/
│       ├── models/
│       │   └── index.js            # 数据模型和常量
│       ├── routes/
│       │   └── api.js              # API 路由
│       └── services/
│           ├── dataAnalyzer.js     # 数据分析服务
│           ├── dataValidator.js    # 数据校验服务
│           ├── localStorage.js     # 本地存储服务
│           └── reportExporter.js   # 报告导出服务
├── package.json
├── server.js                       # 服务器入口
└── README.md
```

## API 接口

### 项目管理
- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建新项目
- `GET /api/projects/:id` - 加载项目
- `DELETE /api/projects/:id` - 删除项目

### 数据校验
- `POST /api/validate` - 校验上传的数据文件

### 数据分析
- `GET /api/projects/:id/analysis` - 获取分析数据（支持筛选参数）
- `GET /api/projects/:id/filters` - 获取可用筛选选项
- `GET /api/projects/:id/compare` - 两次排练对比

### 标记和备注
- `POST /api/projects/:id/annotations/marker` - 保存标记
- `POST /api/projects/:id/annotations/note` - 保存备注
- `GET /api/projects/:id/annotations` - 获取所有标记和备注

### 报告导出
- `GET /api/projects/:id/export/json` - 导出 JSON
- `GET /api/projects/:id/export/csv` - 导出 CSV
- `GET /api/projects/:id/export/md` - 导出 Markdown
- `GET /api/projects/:id/export/html` - 导出 HTML

## 自检与测试

### 健康检查
启动服务后访问：
```bash
curl http://localhost:3000/api/health
```

预期返回：
```json
{
  "status": "ok",
  "timestamp": "2026-04-20T12:00:00.000Z"
}
```

### 测试数据导入
1. 启动服务后访问 http://localhost:3000
2. 点击"项目列表"页面的"使用示例数据"
3. 或在"导入数据"页面上传你自己的数据文件
4. 点击"先校验"查看校验结果
5. 校验通过后点击"创建项目"

### 测试功能
1. **复盘看板**：切换到"复盘看板"页面，查看摘要卡片、热力图、排行、趋势图
2. **筛选联动**：在筛选面板选择不同条件，点击"应用筛选"，观察图表变化
3. **标记功能**：在详细数据表格中点击"编辑"，选择标记类型，添加备注，保存后刷新页面确认持久化
4. **排练对比**：切换到"排练对比"页面，选择两个场次，点击"开始对比"
5. **练习清单**：切换到"练习清单"页面，查看按优先级排序的练习建议
6. **报告导出**：切换到"导出报告"页面，选择不同格式，确认导出内容

## 常见问题

### Q: 数据文件可以只上传一部分吗？
A: 是的，系统会尝试校验已上传的文件。但为了获得完整的分析能力，建议上传所有 4 个文件。

### Q: 标记和备注存在哪里？
A: 存储在 `data/annotations/` 目录下的 JSON 文件中，每个项目对应一个文件。

### Q: 如何备份我的数据？
A: 备份 `data/sessions/` 和 `data/annotations/` 目录即可。

### Q: 支持多用户吗？
A: 目前是单用户本地工具，所有项目都存储在本地文件系统中。

## 扩展建议

如果需要进一步扩展，可以考虑：
1. 添加音频播放功能，结合时间点定位问题
2. 实现数据可视化的更多图表类型
3. 添加团队协作功能（需要后端鉴权）
4. 实现与录音软件的集成，自动采集数据
5. 添加机器学习模型，自动识别错误模式

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**享受排练复盘，让乐队更专业！** 🎵
