# 客服质检系统

自动检测客服转写文本中的道歉、退款承诺、敏感词，以及说话人缺失和时间戳重叠等问题。

## 功能特点

### 核心检测功能
1. **道歉检测**：自动检测文本中的道歉用语
2. **退款承诺检测**：检测是否有退款相关承诺
3. **敏感词检测**：检测投诉、举报等敏感词汇
4. **说话人缺失检测**：检测对话段中缺少说话人标识的情况
5. **时间戳重叠检测**：检测对话段时间重叠的问题

### 数据安全
- **敏感字段脱敏**：手机号、邮箱、身份证号等自动脱敏
- **日志脱敏**：系统日志自动处理敏感信息
- **导出文件脱敏**：CSV导出文件自动处理敏感字段

### 审计与历史
- **操作审计**：所有操作记录审计日志
- **持久化存储**：SQLite本地存储，重启不丢失数据
- **规则版本控制**：规则更新后可追溯历史版本
- **规则更新重跑**：支持规则更新后重新质检历史记录

### 导出功能
- 质检记录导出CSV
- 审计日志导出CSV

## 技术栈

- **后端**：Node.js + Express
- **数据库**：SQLite3 (better-sqlite3)
- **前端**：原生JavaScript + Bootstrap 5
- **日志**：Winston

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
node scripts/init-db.js
```

### 3. 启动服务

```bash
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

### 4. 访问系统

打开浏览器访问：http://localhost:3000

## API接口

### 质检记录
- `POST /api/records` - 提交质检
- `GET /api/records` - 获取质检记录列表
- `GET /api/records/:id` - 获取单个记录详情
- `PUT /api/records/:id/status` - 更新记录状态
- `POST /api/records/:id/rerun` - 重新质检单个记录
- `POST /api/records/rerun-all` - 重新质检所有记录
- `GET /api/records/statistics` - 获取统计数据

### 规则管理
- `GET /api/rules` - 获取规则列表
- `POST /api/rules` - 创建规则
- `PUT /api/rules/:id` - 更新规则
- `DELETE /api/rules/:id` - 删除规则

### 审计日志
- `GET /api/audit` - 获取审计日志列表

### 导出
- `POST /api/exports/records` - 导出质检记录
- `POST /api/exports/audit-logs` - 导出审计日志
- `GET /api/exports/download/:filename` - 下载导出文件

## 默认规则

系统预置以下质检规则：

| 规则类型 | 规则名称 | 关键词 | 严重程度 |
|---------|---------|--------|---------|
| apology | 道歉检测 | 对不起,抱歉,不好意思,道歉,致歉 | 高 |
| refund | 退款承诺检测 | 退款,退货,退费,退钱,全额退款,部分退款 | 高 |
| sensitive | 敏感词检测 | 投诉,举报,315,投诉电话,监管,维权,曝光,媒体,法律,起诉 | 高 |
| polite | 礼貌用语检测 | 您好,请,谢谢,不客气,麻烦 | 低 |

## 目录结构

```
.
├── src/
│   ├── server.js          # 服务入口
│   ├── database/
│   │   ├── db.js          # 数据库连接
│   │   └── init.js        # 数据库初始化
│   ├── services/
│   │   ├── inspectionEngine.js  # 质检引擎
│   │   ├── recordService.js     # 记录服务
│   │   ├── ruleService.js       # 规则服务
│   │   ├── auditService.js      # 审计服务
│   │   └── exportService.js     # 导出服务
│   ├── routes/
│   │   ├── records.js      # 记录路由
│   │   ├── rules.js        # 规则路由
│   │   ├── audit.js        # 审计路由
│   │   └── exports.js      # 导出路由
│   ├── utils/
│   │   ├── masking.js      # 脱敏工具
│   │   └── logger.js       # 日志工具
│   └── ...
├── public/
│   ├── index.html          # 前端页面
│   └── app.js              # 前端脚本
├── data/                   # 数据库文件目录
├── logs/                   # 日志目录
├── exports/                # 导出文件目录
└── package.json
```

## 使用说明

### 1. 提交质检
在"提交质检"页面输入转写文本，系统会自动检测并返回质检结果。

### 2. 查看质检记录
在"质检记录"页面可以查看所有历史质检记录，支持按状态和风险等级筛选。

### 3. 管理规则
在"规则配置"页面可以查看当前规则，支持添加新规则。

### 4. 查看审计日志
在"审计日志"页面可以查看所有操作记录，包括创建记录、更新状态、修改规则等操作。

### 5. 重新质检
- 单个记录：在记录详情页面点击"重新质检"
- 批量重新质检：在记录列表页面点击"规则更新后重新质检所有记录"

## 注意事项

1. 系统数据存储在 `data/quality.db` 文件中，请定期备份
2. 日志文件存储在 `logs/` 目录下
3. 导出文件存储在 `exports/` 目录下
4. 敏感字段脱敏在后端处理，前端展示的数据已经过脱敏
