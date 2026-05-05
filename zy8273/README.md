# 采购立项申请系统

一个面向中小企业行政团队的本地全栈 Web 应用，用于处理采购立项申请的 5 步向导式流程。

## 功能特性

### 📝 5 步向导流程
1. **申请信息** - 申请人、部门、项目名称、总金额等基本信息
2. **供应商比价** - 支持添加多家供应商进行价格对比
3. **预算科目** - 选择或输入预算科目信息
4. **附件清单** - 支持拖拽上传附件
5. **审批预览** - 汇总所有信息供确认提交

### 💾 数据持久化
- **SQLite 数据库** - 本地存储，无需额外数据库服务
- **草稿管理** - 支持草稿的创建、编辑、删除
- **版本历史** - 每次手动保存都会记录版本
- **提交记录** - 提交后生成永久记录

### 🔄 自动保存与断点恢复
- **自动保存** - 每 30 秒自动保存到服务器
- **手动保存** - 随时点击按钮手动保存
- **断点恢复** - 刷新页面或关闭浏览器后，重新打开时提示恢复中断的草稿
- **本地缓存** - 网络故障时先保存到 localStorage

### ⚠️ 边界情况处理

#### 版本冲突检测
- 两个标签页同时编辑同一草稿时，后保存的会检测到冲突
- 弹出冲突处理对话框，提供两种选择：
  - **保留本页** - 用当前页面数据覆盖服务器版本
  - **加载服务器版** - 放弃本页修改，加载最新服务器数据

#### Schema 过时检测
- 当数据库 schema 版本更新后，旧数据会标记为"格式较旧"
- 在草稿列表和编辑时都有明确提示
- 保存时自动迁移到最新格式

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JavaScript（无需构建工具） |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 其他 | UUID (v4), CORS |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（含示例数据）

```bash
npm run init-db
```

这会创建 SQLite 数据库并添加 3 条示例草稿：
- **办公电脑采购申请**（进度 50%，已填到第 3 步）
- **打印机采购申请**（进度 75%，已填到第 4 步）
- **会议系统设备采购**（进度 25%，已填到第 2 步）

### 3. 启动服务器

```bash
npm start
```

服务器默认运行在 `http://localhost:3000`

### 4. 访问应用

打开浏览器访问：`http://localhost:3000`

## 项目结构

```
procurement-app/
├── data/                    # SQLite 数据库文件目录
│   └── procurement.db       # 运行时自动创建
├── public/                  # 前端静态文件
│   ├── css/
│   │   └── style.css        # 样式文件
│   ├── js/
│   │   ├── api.js           # API 客户端封装
│   │   ├── storage.js       # 本地存储和自动保存管理
│   │   ├── wizard.js        # 5 步向导核心逻辑
│   │   └── app.js           # 主应用入口
│   └── index.html           # 单页面应用入口
├── server/                  # 后端代码
│   ├── routes/
│   │   ├── drafts.js        # 草稿 API 路由
│   │   └── submissions.js   # 提交记录 API 路由
│   ├── database.js          # 数据库连接和初始化
│   ├── init-db.js           # 数据库初始化脚本（含示例数据）
│   └── index.js             # Express 服务器入口
├── package.json
└── README.md
```

## API 文档

### 草稿相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/drafts` | 获取草稿列表 |
| GET | `/api/drafts/:id` | 获取单个草稿详情 |
| POST | `/api/drafts` | 创建新草稿 |
| PUT | `/api/drafts/:id` | 更新草稿（带版本冲突检测） |
| DELETE | `/api/drafts/:id` | 删除草稿 |
| POST | `/api/drafts/:id/submit` | 提交申请 |

### 提交记录相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/submissions` | 获取提交记录列表 |
| GET | `/api/submissions/:id` | 获取单个提交记录 |

### 其他

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查，返回 schema 版本 |

## 数据库 Schema

### drafts 表（草稿）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键，UUID |
| title | TEXT | 草稿标题 |
| current_step | INTEGER | 当前步骤（0-4） |
| data | TEXT | JSON 格式的表单数据 |
| schema_version | INTEGER | 数据格式版本 |
| version | INTEGER | 乐观锁版本号 |
| last_edited_by | TEXT | 最后编辑的会话 ID |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### draft_versions 表（版本历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| draft_id | TEXT | 关联的草稿 ID |
| data | TEXT | 快照数据 |
| schema_version | INTEGER | 数据格式版本 |
| version | INTEGER | 对应草稿的版本号 |
| session_id | TEXT | 保存者会话 ID |
| created_at | DATETIME | 创建时间 |

### submissions 表（提交记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| draft_id | TEXT | 来源草稿 ID（可空） |
| title | TEXT | 申请标题 |
| data | TEXT | 完整申请数据 |
| schema_version | INTEGER | 数据格式版本 |
| submitted_at | DATETIME | 提交时间 |
| submitter | TEXT | 提交人 |

## 功能演示指南

### 演示 1：新建申请并提交

1. 点击首页的 **"新建申请"** 按钮
2. 输入项目名称，如："季度办公用品采购"
3. 填写 **申请信息** 页面（申请人、部门、项目名称必填）
4. 点击 **"下一步"** 进入供应商比价
5. 点击 **"添加供应商"**，填写供应商信息
6. 继续填写预算科目、添加附件
7. 在审批预览页面确认所有信息
8. 点击 **"提交申请"** 按钮
9. 确认提交后，会跳转到提交成功页面

### 演示 2：断点恢复

1. 打开任意草稿进行编辑
2. 在填写过程中，**直接刷新页面** 或 **关闭浏览器再重新打开**
3. 重新访问 `http://localhost:3000`
4. 系统会弹出提示：**"检测到未完成的草稿，是否继续编辑？"**
5. 选择 **"确定"** 即可恢复到中断的步骤

### 演示 3：版本冲突

1. 打开两个浏览器标签页，都访问 `http://localhost:3000`
2. 在两个标签页中都打开 **同一个草稿** 进行编辑
3. 在标签页 A 中修改一些内容，点击 **"手动保存"**
4. 在标签页 B 中修改不同内容，然后点击 **"手动保存"**
5. 标签页 B 会弹出 **"版本冲突"** 对话框
6. 选择：
   - **保留本页**：用标签页 B 的数据覆盖
   - **加载服务器版**：加载标签页 A 保存的数据

### 演示 4：Schema 过时（模拟）

1. 可以通过修改 `server/database.js` 中的 `SCHEMA_VERSION` 常量（从 1 改为 2）
2. 重新启动服务器
3. 刷新页面，草稿列表中的旧草稿会显示 **"⚠️ 格式较旧"** 标记
4. 编辑时顶部会显示橙色警告条
5. 保存后 schema 版本自动更新，警告消失

## 配置说明

### 端口配置

默认端口是 3000，可以通过环境变量修改：

```bash
PORT=8080 npm start
```

### 自动保存间隔

默认 30 秒，可以在 `public/js/storage.js` 中修改：

```javascript
const AUTO_SAVE_INTERVAL = 30000; // 毫秒
```

## 开发说明

### 数据结构（前端）

草稿数据的 JSON 结构：

```javascript
{
  applicationInfo: {
    applicant: '张三',
    department: '行政部',
    applicationDate: '2026-04-15',
    projectName: 'Q2季度办公设备更新',
    projectDescription: '为新入职员工更新办公电脑',
    totalAmount: 80000
  },
  supplierComparison: [
    {
      supplierName: '联想科技',
      contactPerson: '李经理',
      contactPhone: '13800138001',
      productName: 'ThinkPad X1 Carbon',
      unitPrice: 10000,
      quantity: 8,
      totalPrice: 80000,
      deliveryDays: 7,
      warranty: '3年'
    }
  ],
  budgetItems: [
    {
      subjectCode: '660201',
      subjectName: '办公设备购置费',
      amount: 80000,
      remark: '8台电脑'
    }
  ],
  attachments: [
    { name: '报价单.pdf', size: 1024000, type: 'application/pdf' }
  ]
}
```

## License

MIT
