# 旧书交换站 AI 初筛系统

一个用于社区旧书交换站的轻量级 AI 初筛工具，帮助志愿者快速分类处理捐赠书籍。

## 功能特性

### 数据导入
- **ISBN/书名 CSV 导入**：批量导入书籍基本信息
- **捐书照片清单**：上传书籍照片，自动提取文件名中的 ISBN 和书名
- **破损备注**：导入书籍破损情况说明
- **预约领取表**：导入预约领书人信息，自动关联到对应书籍

### AI 初筛分类
系统基于以下规则自动分类书籍：

| 分类 | 说明 | 触发条件 |
|------|------|----------|
| 可上架 | 状态良好，可直接上架 | 未检测到任何风险项 |
| 需消毒 | 需要消毒处理 | 检测到水渍、霉味、异味、泛黄等 |
| 破损待处理 | 需要修复或处理 | 检测到破损、撕裂、划痕、缺页、脱胶等 |
| 疑似盗版/缺页 | 需要进一步核查 | ISBN 异常、无ISBN、盗版关键词、缺页等 |

### 复核改判
- 查看 AI 分类详情和置信度
- 人工改判分类并添加理由
- 风险原因明细展示
- 操作日志追踪
- **刷新不丢失的备注**：自动保存工作备注

### 数据导出
- **Markdown 上架清单**：导出可上架书籍清单，适合打印或分享
- **JSON 审计明细**：导出完整审计数据，包括所有分类、备注和操作日志

## 快速开始

### 环境要求
- Node.js 14.x 或更高版本
- npm 或 yarn

### 安装步骤

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

3. 打开浏览器访问：
```
http://localhost:3000
```

## 使用流程

### 1. 创建/选择批次
点击页面右上角的「管理批次」按钮：
- 输入批次号（建议格式：`YYYY-MM-DD-序号`，如 `2026-05-05-01`）
- 可选添加描述
- 点击「创建」按钮
- 在列表中选择刚创建的批次

### 2. 导入数据

按顺序导入以下数据（示例数据在 `examples/` 目录中）：

#### ISBN/书名 CSV
```csv
ISBN,书名,作者,出版社,出版年份
9787111213826,JavaScript高级程序设计（第3版）,Nicholas C. Zakas,机械工业出版社,2012
...
```

#### 破损备注 CSV
```csv
ISBN,破损备注
9787111213826,封面有轻微划痕，边角略有磨损
...
```

#### 预约领取表 CSV
```csv
ISBN,书名,领书人,联系方式,预约日期,备注
9787111213826,JavaScript高级程序设计（第3版）,张三,13800138001,2026-05-10,希望尽快领取
...
```

#### 捐书照片
- 支持批量上传图片
- 系统会尝试从文件名中提取 ISBN（10位或13位数字）
- 文件名格式建议：`9787111213826_JavaScript高级程序设计.jpg`

### 3. 运行 AI 初筛
点击「运行 AI 初筛」按钮，系统会自动：
- 分析破损备注中的关键词
- 校验 ISBN 的有效性
- 综合判断给出分类结果和置信度

### 4. 复核改判
切换到「复核改判」页面：
1. 左侧显示待复核书籍列表
2. 点击书籍查看详情
3. 查看 AI 分类理由和置信度
4. 如需改判，选择新分类并输入理由
5. 点击「确认复核」
6. 工作备注会自动保存（刷新不丢失）

### 5. 导出数据
切换到「导出数据」页面：
- 点击「导出 Markdown」下载上架清单
- 点击「导出 JSON」下载审计明细

## 项目结构

```
xy4488/
├── client/                 # 前端页面
│   ├── index.html          # 主页面
│   ├── style.css           # 样式文件
│   └── app.js              # 前端逻辑
├── server/                 # 后端服务
│   ├── index.js            # 服务器入口
│   ├── database.js         # 数据库操作
│   ├── routes.js           # API 路由
│   └── screening.js        # AI 初筛逻辑
├── data/                   # 数据存储（运行时生成）
│   └── books.db            # SQLite 数据库
├── uploads/                # 上传文件存储（运行时生成）
├── examples/               # 示例数据
│   ├── books.csv           # 书籍信息示例
│   ├── damage_notes.csv    # 破损备注示例
│   └── appointments.csv    # 预约表示例
└── package.json            # 项目配置
```

## API 接口

### 批次管理
- `GET /api/batches` - 获取所有批次
- `POST /api/batches` - 创建新批次

### 数据导入
- `POST /api/import/isbn-csv` - 导入 ISBN CSV
- `POST /api/import/images` - 上传书籍图片
- `POST /api/import/damage-notes` - 导入破损备注
- `POST /api/import/appointments` - 导入预约表

### 书籍查询
- `GET /api/batches/:batch_id/books` - 获取批次下所有书籍
- `GET /api/books/:id` - 获取单本书详情

### 复核操作
- `PUT /api/books/:id/category` - 更新书籍分类
- `PUT /api/books/:id/notes` - 更新书籍备注

### AI 初筛
- `POST /api/screening/batch/:batch_id` - 运行批次初筛

### 数据导出
- `GET /api/export/markdown/:batch_id` - 导出 Markdown
- `GET /api/export/json/:batch_id` - 导出 JSON

## 数据库设计

### 主要表结构

| 表名 | 说明 |
|------|------|
| batches | 批次表 |
| books | 书籍表 |
| appointments | 预约表 |
| risk_reasons | 风险原因表 |
| audit_logs | 审计日志表 |

### 书籍分类字段
- `ai_category` - AI 初筛分类
- `ai_reason` - AI 分类理由
- `ai_confidence` - AI 置信度
- `final_category` - 最终人工分类
- `manual_reason` - 人工分类理由
- `is_reviewed` - 是否已复核
- `notes` - 工作备注

## 技术栈

### 后端
- **Node.js + Express** - Web 服务框架
- **SQLite3** - 轻量级数据库
- **multer** - 文件上传处理
- **csv-parser** - CSV 解析

### 前端
- **原生 HTML/CSS/JavaScript** - 无需构建工具
- **响应式设计** - 支持移动端访问

## 注意事项

1. **数据安全**：本工具仅供本地使用，请勿在公网环境部署
2. **图片存储**：上传的图片存储在 `uploads/` 目录，数据库只保存路径
3. **数据备份**：定期备份 `data/books.db` 文件
4. **AI 初筛**：当前使用基于规则的分类，如需更智能的识别，可集成图像识别模型

## 故障排除

### 依赖安装失败
```bash
# 清理缓存后重试
npm cache clean --force
rm -rf node_modules
npm install
```

### 端口被占用
修改 `server/index.js` 中的端口号：
```javascript
const PORT = process.env.PORT || 3000;
```

### 数据库权限问题
确保 `data/` 和 `uploads/` 目录有写入权限。

## 许可证

MIT License
