# 短视频选题复盘分析台

一个专为单人运营小红书、抖音、视频号账号设计的本地数据分析工具。帮你从冰冷的数据中找出爆款密码和扑街原因。

## 功能特性

### 📥 数据导入
- 支持导入 `posts.csv`（作品数据）、`comments.csv`（评论数据）、`topics.json`（选题数据）
- 内置正常样例和问题样例数据，一键加载体验
- 字段校验和归一化处理
- 支持导入/导出阈值规则配置

### 📊 核心分析
- **漏斗分析**: 曝光→播放→完播→互动→收藏→转化全链路追踪
- **多维度对比**: 按平台、发布时段、选题标签、标题承诺、封面类型拆分
- **智能问题检测**:
  - 🔥 标题党风险检测（夸张词汇 + 完播率骤降 + 负面评论）
  - 😡 负面评论集中检测
  - 📅 同题材连续发布太密检测
  - 🕐 低峰时段发布检测
  - 📉 扑街作品检测

### 📈 可视化图表
- 爆款 vs 扑街 占比饼图
- 发布时段效果分析（双Y轴）
- 选题标签表现横向柱状图
- 平台对比雷达图
- 评论情感分布饼图
- 封面类型效果对比

### 📋 智能推荐
- 基于历史数据计算下周选题优先级
- 可自定义权重配置
- 考虑标签匹配、历史表现、互动质量、平台适配

### 💾 本地功能
- 本地草稿保存（localStorage）
- 导出三种格式报告：
  - Markdown：适合笔记、邮件
  - HTML：适合浏览器查看
  - JSON：适合存档、二次处理

## 快速开始

### 1. 直接打开
```bash
# 用浏览器直接打开 index.html 文件
open index.html
```

### 2. 本地服务器（推荐）
```bash
# 使用 Python 启动简单服务器
python3 -m http.server 8080

# 或者使用 Node.js
npx serve .

# 然后访问 http://localhost:8080
```

## 数据格式

### posts.csv - 作品数据

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| post_id | string | 作品ID | "P001" |
| platform | enum | 平台 | xiaohongshu/douyin/shipinhao |
| publish_date | date | 发布日期 | "2026-04-24" |
| publish_hour | number | 发布小时 | 19 |
| title | string | 作品标题 | "Python入门：3分钟学会变量" |
| title_promise_type | enum | 标题承诺类型 | 知识承诺/效率承诺/情绪价值/干货合集 |
| cover_type | enum | 封面类型 | 文字图文/真人出镜/截图演示/对比图 |
| tags | string | 选题标签（竖线分隔） | "编程\|Python\|入门" |
| exposure | number | 曝光量 | 50000 |
| plays | number | 播放量 | 42000 |
| completions | number | 完播量 | 35000 |
| likes | number | 点赞数 | 3200 |
| comments | number | 评论数 | 850 |
| shares | number | 分享数 | 420 |
| favorites | number | 收藏数 | 1500 |
| clicks | number | 点击数 | 280 |
| conversions | number | 转化数 | 45 |
| status | string | 状态 | "published" |

### comments.csv - 评论数据

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| comment_id | string | 评论ID | "C001" |
| post_id | string | 关联作品ID | "P001" |
| user_name | string | 用户名 | "学习者小明" |
| content | string | 评论内容 | "讲得太清楚了！" |
| sentiment | enum | 情感倾向 | positive/negative/neutral |
| likes | number | 点赞数 | 25 |
| created_at | datetime | 创建时间 | "2026-04-24 20:15" |

### topics.json - 选题数据

```json
{
  "topics": [
    {
      "id": "t1",
      "name": "Python入门教程",
      "tags": ["Python", "入门"],
      "planned_posts": 3,
      "actual_posts": 2,
      "status": "active",
      "priority": "high"
    }
  ],
  "next_week_plans": [
    {
      "id": "p1",
      "topic_id": "t1",
      "title": "Python列表操作技巧",
      "planned_date": "2026-05-01",
      "planned_hour": 19,
      "status": "draft"
    }
  ]
}
```

### thresholds.json - 阈值配置

```json
{
  "funnel_thresholds": {
    "play_rate": {"excellent": 0.85, "good": 0.7, "warning": 0.5},
    "completion_rate": {"excellent": 0.7, "good": 0.5, "warning": 0.3},
    "engagement_rate": {"excellent": 0.08, "good": 0.05, "warning": 0.02}
  },
  "clickbait_words": ["震惊", "不敢相信", "月入10万", "必看", "绝密"],
  "negative_words": ["标题党", "骗人", "垃圾", "没用", "失望"],
  "topic_density_rules": {
    "max_per_day": 2,
    "max_consecutive_days": 2,
    "min_hours_between": 4
  },
  "priority_rules": {
    "tag_weight": 2,
    "historical_performance_weight": 3,
    "engagement_weight": 2,
    "platform_fit_weight": 1
  }
}
```

## 目录结构

```
短视频选题复盘分析台/
├── index.html              # 主页面
├── css/
│   └── style.css           # 样式文件
├── js/
│   ├── app.js              # 主应用入口
│   ├── data-import.js      # 数据导入与校验
│   ├── funnel.js           # 漏斗分析
│   ├── issues.js           # 问题检测
│   ├── charts.js           # 图表渲染
│   ├── filters.js          # 筛选排序
│   ├── priority.js         # 优先级计算
│   └── export.js           # 报告导出
├── data/
│   ├── thresholds.json     # 默认阈值配置
│   ├── normal/             # 正常样例数据
│   │   ├── posts.csv
│   │   ├── comments.csv
│   │   └── topics.json
│   └── problem/            # 问题样例数据
│       ├── posts.csv       # 包含标题党、连续发布等问题
│       ├── comments.csv    # 包含负面评论
│       └── topics.json
└── README.md               # 本文档
```

## 使用流程

1. **打开应用**: 用浏览器打开 `index.html`
2. **导入数据**:
   - 点击「加载示例数据」快速体验
   - 或上传自己的 `posts.csv`、`comments.csv`、`topics.json`
3. **查看分析**: 切换各标签页查看分析结果
4. **导出报告**: 在「导出报告」页面下载 Markdown/HTML/JSON

## 技术栈

- **纯前端**: HTML5 + CSS3 + JavaScript
- **图表库**: Chart.js (CDN)
- **数据存储**: localStorage（本地草稿）
- **无需后端**: 所有数据本地处理，保护隐私

## 问题样例说明

`data/problem/` 目录下的数据用于测试问题检测功能：

- **标题党检测**: 作品 P001、P002 标题包含「震惊」「月入10万」，完播率骤降
- **负面评论**: 作品 P001、P002 收到大量「标题党」「骗人」评论
- **题材密度**: 同一天发布 5 条 Python 入门教程
- **低峰时段**: 在凌晨 2 点、3 点发布作品

## 自定义配置

1. 修改 `data/thresholds.json` 中的规则
2. 在应用的「数据导入」页面导入新的阈值配置
3. 或直接修改代码中的 `DEFAULT_THRESHOLDS` 常量

## 隐私说明

本工具所有数据处理均在浏览器本地完成，不会上传到任何服务器。你的数据完全安全。

## 更新日志

### v1.0.0
- 初始版本发布
- 支持数据导入、校验、归一化
- 漏斗分析与多维度对比
- 智能问题检测
- 8种可视化图表
- 选题优先级计算
- 三种格式报告导出
