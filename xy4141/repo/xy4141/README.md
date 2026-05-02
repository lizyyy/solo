# 考场异常标记夹

一个给线上考试监考老师用的本地浏览器扩展 + 小服务，帮助监考老师在监考时高效记录考生异常情况。

## 功能特性

### 浏览器扩展
- **侧边栏记录**: 在任意页面打开侧边栏，录入考生、异常类型、截图备注
- **一键时间戳**: 自动添加时间戳，确保记录准确
- **截图功能**: 支持截取当前页面或上传图片作为证据
- **快捷操作**: Popup 提供快速截图、查看待处理等快捷功能
- **右键菜单**: 右键菜单快捷打开标记夹或快速截图

### 本地 API 服务
- **SQLite 持久化**: 本地存储所有异常记录，数据安全可控
- **智能去重**: 同一考生 5 分钟内连续相同类型异常自动合并补充
- **状态管理**: 支持待处理/已复核/已确认违规/已驳回四种状态
- **导出功能**: 支持导出 Markdown 复盘文档和 CSV 数据清单
- **统计功能**: 按异常类型、状态等维度统计分析

## 项目结构

```
xy4141/
├── extension/              # 浏览器扩展
│   ├── manifest.json       # 扩展配置文件 (Manifest V3)
│   ├── icons/              # 扩展图标 (SVG格式)
│   │   ├── icon16.svg
│   │   ├── icon32.svg
│   │   ├── icon48.svg
│   │   └── icon128.svg
│   ├── sidebar/            # 侧边栏页面
│   │   ├── sidebar.html
│   │   ├── sidebar.css
│   │   └── sidebar.js
│   ├── popup/              # 弹出窗口
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── background/         # Service Worker
│       └── service-worker.js
│
├── server/                 # 本地 API 服务
│   ├── package.json        # Node.js 依赖配置
│   ├── src/
│   │   ├── index.js        # 服务入口
│   │   ├── app.js          # Express 应用配置
│   │   ├── database.js     # SQLite 数据库初始化
│   │   ├── models/         # 数据模型
│   │   │   └── index.js    # Anomaly 和 Exam 模型
│   │   └── services/       # 业务服务
│   │       └── export.js   # 导出服务 (Markdown/CSV)
│   ├── test/
│   │   └── api.test.js     # API 测试用例
│   └── data/               # 数据存储目录 (运行时自动创建)
│       ├── exam-anomalies.db
│       ├── screenshots/
│       └── exports/
│
└── README.md               # 本文档
```

## 快速开始

### 环境要求

- Node.js 16.x 或更高版本
- Chrome / Edge 浏览器 (支持 Manifest V3)

### 步骤 1: 安装服务端依赖

```bash
cd server
npm install
```

### 步骤 2: 启动本地 API 服务

```bash
# 开发模式 (自动重启)
npm run dev

# 或普通启动
npm start
```

服务启动后会显示:

```
========================================
  考场异常标记夹 - 本地API服务
========================================

  服务地址: http://localhost:3000
  健康检查: http://localhost:3000/api/health

  API 端点:
    - GET    /api/exams              - 获取考试列表
    - POST   /api/exams              - 创建考试
    - GET    /api/anomalies          - 获取异常列表
    - POST   /api/anomalies          - 创建异常记录
    - PUT    /api/anomalies/:id      - 更新异常记录
    - DELETE /api/anomalies/:id      - 删除异常记录
    - GET    /api/stats               - 获取统计信息
    - GET    /api/export/markdown    - 导出Markdown复盘
    - GET    /api/export/csv         - 导出CSV清单

========================================
```

### 步骤 3: 准备扩展图标 (重要)

Chrome 扩展需要 PNG 格式的图标。项目中提供的是 SVG 格式，需要转换为 PNG。

**方法一: 使用在线转换工具**
1. 打开 https://svgtopng.com/
2. 逐个上传 `extension/icons/` 目录下的 SVG 文件
3. 下载对应的 PNG 文件，保存到 `extension/icons/` 目录，命名为:
   - icon16.png (16x16)
   - icon32.png (32x32)
   - icon48.png (48x48)
   - icon128.png (128x128)

**方法二: 使用 Node.js 脚本转换**
```bash
cd server
npm install sharp -D
```

然后创建转换脚本 (可选)。

### 步骤 4: 加载浏览器扩展

1. 打开 Chrome / Edge 浏览器
2. 访问扩展管理页面:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 开启右上角「开发者模式」开关
4. 点击「加载已解压的扩展程序」
5. 选择项目中的 `extension` 文件夹
6. 扩展加载成功！你会在工具栏看到扩展图标

### 步骤 5: 验证全流程

#### 验证服务连接

1. 点击扩展图标打开 Popup
2. 检查底部状态显示「服务已连接」(绿色圆点)

#### 创建第一条异常记录

1. 点击扩展图标，选择「打开侧边栏」
2. 在「记录异常」标签页填写:
   - **考试代码**: `MATH2024`
   - **学号**: `2024001`
   - **姓名**: `张三`
   - **异常类型**: 选择「可疑行为」
   - **描述**: `考生频繁看向桌面，疑似查看小抄`
3. 点击「📷 截取当前页面」或上传一张图片
4. 点击「⏰ 一键记录 (带时间戳)」
5. 看到「记录成功」提示

#### 查看异常列表

1. 切换到「异常列表」标签页
2. 应该能看到刚创建的记录
3. 状态显示「待处理」(橙色标签)

#### 更新状态

1. 点击记录中的「标记已复核」按钮
2. 状态变为「已复核」

#### 导出数据

1. 在「异常列表」标签页
2. 点击「📄 导出 Markdown」- 会下载一份复盘报告
3. 点击「📊 导出 CSV」- 会下载一份数据清单

#### 查看统计

1. 切换到「统计」标签页
2. 查看总异常数、待处理数、已复核数、异常类型分布

## API 文档

### 健康检查

```
GET /api/health
```

响应:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 考试管理

```
GET    /api/exams              # 获取所有考试
POST   /api/exams              # 创建考试
```

创建考试请求体:
```json
{
  "exam_code": "MATH2024",
  "exam_name": "高等数学期末考试",
  "start_time": "2024-01-15T09:00:00Z",
  "end_time": "2024-01-15T11:00:00Z"
}
```

### 异常记录管理

```
GET    /api/anomalies          # 获取异常列表 (支持过滤)
GET    /api/anomalies/:id      # 获取单个异常
POST   /api/anomalies          # 创建异常 (multipart/form-data)
PUT    /api/anomalies/:id      # 更新异常
DELETE /api/anomalies/:id      # 删除异常
```

**过滤参数** (GET /api/anomalies):
- `exam_code`: 按考试代码过滤
- `status`: 按状态过滤 (pending/reviewed/confirmed/dismissed)
- `student_id`: 按学号过滤
- `start_date`: 开始日期 (YYYY-MM-DD)
- `end_date`: 结束日期 (YYYY-MM-DD)

**异常类型**:
- `suspicious_behavior`: 可疑行为
- `screen_sharing`: 屏幕共享
- `multiple_faces`: 多人出镜
- `no_face`: 无人出镜
- `look_away`: 视线偏离
- `phone_usage`: 使用手机
- `id_verification`: 身份验证异常
- `other`: 其他异常

**状态**:
- `pending`: 待处理
- `reviewed`: 已复核
- `confirmed`: 已确认违规
- `dismissed`: 已驳回

### 统计

```
GET /api/stats?exam_code=MATH2024
```

响应:
```json
[
  {
    "status": "pending",
    "count": 5,
    "anomaly_type": "suspicious_behavior",
    "unique_students": 3
  }
]
```

### 导出

```
GET /api/export/markdown  # 导出 Markdown 复盘报告
GET /api/export/csv       # 导出 CSV 数据清单
```

同样支持过滤参数: `exam_code`, `status`, `start_date`, `end_date`

## 运行测试

```bash
cd server
npm test
```

测试覆盖:
- 健康检查
- 考试 CRUD
- 异常记录 CRUD
- 智能去重功能
- 状态更新
- 导出功能

## 智能去重说明

系统会自动去重**同一考生、同一异常类型、5分钟内**的连续记录。

**去重逻辑**:
1. 创建新记录时，检查是否存在相同 `student_id` + `anomaly_type` + `exam_code` 的记录
2. 该记录的 `created_at` 必须在过去 5 分钟内
3. 状态必须是 `pending` 或 `reviewed`
4. 如果匹配，**不创建新记录**，而是将新描述追加到原有记录中
5. 原有记录状态重置为 `pending`

**示例场景**:
- 10:00:00 记录「张三 - 视线偏离 - 看向窗外」
- 10:02:00 又记录「张三 - 视线偏离 - 看手机」
- 结果: 合并为一条记录，描述包含两条信息，状态重置为待处理

这避免了同一考生短时间内多次相同操作产生大量重复记录。

## 注意事项

1. **图标问题**: Chrome 扩展需要 PNG 格式图标，请务必转换 SVG 为 PNG
2. **端口占用**: 服务默认使用 3000 端口，如需修改可设置 `PORT` 环境变量
3. **CORS**: 扩展只允许访问 `http://localhost:3000/*`，如需修改请更新 `manifest.json` 中的 `host_permissions`
4. **数据存储**: SQLite 数据库和截图都存储在 `server/data/` 目录，备份此目录即可备份所有数据

## 故障排查

### 扩展显示「服务未连接」

1. 确认服务已启动: `cd server && npm start`
2. 访问 http://localhost:3000/api/health 检查
3. 检查端口是否被占用

### 扩展加载失败

1. 确认已开启「开发者模式」
2. 检查 `extension/manifest.json` 语法
3. 确认图标文件存在 (PNG 格式)

### 截图功能不可用

1. 确认当前页面不是 Chrome 内部页面 (chrome://...)
2. 检查扩展权限是否正确授予

## 许可证

MIT License
