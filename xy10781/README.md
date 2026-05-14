# 视频转码任务编排系统

一个本地可运行的视频转码任务管理系统，支持视频录入、码率模板管理、转码任务编排、失败重试、播放地址生成等功能。

## 功能特性

- 📹 **视频录入**: 客服主管可录入源视频信息
- 🎨 **码率模板**: 支持配置不同分辨率和码率，可指定字幕要求
- 📋 **任务管理**: 创建、开始、完成转码任务
- 🔄 **失败重试**: 失败任务可重试，并记录重试原因用于复盘
- 🎥 **播放地址**: 任务完成后自动生成播放地址
- 📊 **统计看板**: 统计卡片 + 图表可视化展示任务状态
- 🚫 **规则阻止**: 字幕不满足要求时自动阻止任务推进

## 技术栈

- **后端**: Python Flask + Flask-CORS
- **前端**: 原生 HTML + JavaScript + Chart.js
- **存储**: JSON 文件（无需数据库）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 初始化数据

在浏览器中打开 `http://localhost:5000`，点击顶部的"初始化数据"按钮，即可加载示例数据。

## API 接口文档

### 视频管理

#### 获取所有视频
```
GET /api/videos
```

#### 录入新视频
```
POST /api/videos
Content-Type: application/json

{
    "name": "产品介绍视频.mp4",
    "size": 1024000000,
    "duration": 300,
    "format": "mp4",
    "has_subtitle": false,
    "subtitle_languages": [],
    "created_by": "客服主管"
}
```

#### 获取单个视频
```
GET /api/videos/{video_id}
```

### 码率模板管理

#### 获取所有模板
```
GET /api/templates
```

#### 创建新模板
```
POST /api/templates
Content-Type: application/json

{
    "name": "高清模板",
    "bitrate": 2000,
    "resolution": "1920x1080",
    "require_subtitle": true,
    "subtitle_languages": ["zh-CN", "en"]
}
```

**注意**: 当码率模板变更时，系统会自动重新计算相关转码任务的字幕要求，不满足的任务状态会变为 blocked。

#### 更新模板
```
PUT /api/templates/{template_id}
Content-Type: application/json

{
    "name": "更新后的名称",
    "bitrate": 2500
}
```

#### 检查字幕要求
```
POST /api/templates/{template_id}/check-subtitle
Content-Type: application/json

{
    "video_id": "vid_001"
}
```

### 转码任务管理

#### 获取所有任务
```
GET /api/tasks
```

#### 创建转码任务
```
POST /api/tasks
Content-Type: application/json

{
    "video_id": "vid_001",
    "template_id": "tpl_001"
}
```

**被规则阻止的情况**:
- 选择需要字幕的模板，但视频缺少对应字幕语言时，接口会返回错误并阻止任务创建。

#### 获取单个任务
```
GET /api/tasks/{task_id}
```

#### 开始任务
```
POST /api/tasks/{task_id}/start
```

#### 完成任务
```
POST /api/tasks/{task_id}/complete
```

任务完成后会自动生成播放地址。

#### 标记任务失败
```
POST /api/tasks/{task_id}/fail
Content-Type: application/json

{
    "error_message": "码率不匹配：源视频码率低于目标码率"
}
```

#### 重试失败任务
```
POST /api/tasks/{task_id}/retry
Content-Type: application/json

{
    "reason": "调整码率参数后重试",
    "operator": "技术支持"
}
```

重试记录会被保存，用于后续复盘分析。

#### 获取所有失败任务
```
GET /api/tasks/failed
```

### 播放地址管理

#### 获取所有播放地址
```
GET /api/playback-urls
```

#### 获取指定任务的播放地址
```
GET /api/playback-urls/{task_id}
```

### 字幕管理

#### 获取所有字幕
```
GET /api/subtitles
```

#### 创建字幕
```
POST /api/subtitles
Content-Type: application/json

{
    "video_id": "vid_001",
    "language": "zh-CN",
    "name": "中文字幕.srt"
}
```

#### 批准字幕
```
POST /api/subtitles/{subtitle_id}/approve
```

### 统计接口

#### 获取统计数据
```
GET /api/statistics
```

返回数据包含：
- 总任务数
- 各状态任务数量
- 总重试次数
- 播放地址数量
- 成功率

#### 获取每日统计
```
GET /api/statistics/daily
```

### 数据初始化

#### 初始化示例数据
```
POST /api/init
Content-Type: application/json

{
    "clear_first": true
}
```

## 项目结构

```
.
├── app.py                 # Flask 应用主入口
├── services.py            # 业务逻辑服务层
├── storage.py             # JSON 文件存储层
├── requirements.txt       # Python 依赖
├── data/
│   └── init_data.json    # 初始化示例数据
│   └── *.json            # 运行时数据文件
├── templates/
│   └── index.html         # 前端页面
└── static/                # 静态资源
```

## 使用说明

### 被规则阻止的操作示例

1. **场景**: 创建需要字幕的转码任务
2. **条件**: 选择的码率模板要求中文字幕，但视频没有字幕
3. **结果**: 任务创建失败，返回错误信息："缺少字幕语言: zh-CN"

### 失败任务修正路径

1. 在"失败任务"标签页中查看失败任务
2. 点击"重试"按钮
3. 填写重试原因（如：调整码率参数后重试）
4. 填写操作人
5. 确认重试，任务重新进入队列
6. 重试记录保存在 `data/retry_records.json` 中，可用于复盘分析

### 码率模板变更后的重新计算

当码率模板的字幕要求变更后：
1. 系统自动遍历所有使用该模板的任务
2. 检查视频是否满足新的字幕要求
3. 不满足要求且处于排队状态的任务会被标记为 blocked
4. 状态更新后会反映在前端页面上

## 数据文件说明

所有数据以 JSON 格式存储在 `data/` 目录下：
- `videos.json` - 视频信息
- `bitrate_templates.json` - 码率模板
- `transcode_tasks.json` - 转码任务
- `retry_records.json` - 重试记录（用于复盘）
- `playback_urls.json` - 播放地址
- `subtitle_files.json` - 字幕文件
