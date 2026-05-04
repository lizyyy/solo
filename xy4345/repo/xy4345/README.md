# 🎧 播客素材授权核验台

一个小型播客工作室的本地"素材授权核验台"，用于管理和核验播客节目的素材授权信息，自动检测风险并支持导出报告。

## ✨ 功能特性

### 📥 导入功能
- **嘉宾授权书**：导入嘉宾授权信息 JSON
- **背景音乐许可 CSV**：导入音乐授权信息
- **素材引用 JSON**：导入节目素材引用记录
- **广告口播时间表**：导入广告安排信息

### ⚠️ 风险检测
- **音乐过期检测**：自动检测已过期和即将过期的音乐授权
- **缺少授权检测**：检测没有对应授权的素材
- **广告时长超标**：检测超过 30 秒的广告
- **重复声明检测**：检测同一素材被不同节目重复声明

### ✅ 复核流程
- 风险队列按状态筛选（待处理、处理中、已解决、已忽略）
- 逐条添加复核意见
- 支持更改风险状态
- 保留完整复核历史记录

### 📤 导出功能
- **Markdown 授权清单**：导出可读的授权记录列表
- **CSV 风险表**：导出风险记录表格，可导入 Excel
- **JSON 审计包**：导出完整数据用于备份或审计

## 🛠️ 技术栈

- **后端**: Node.js + Express + SQLite (better-sqlite3)
- **前端**: React + Vite + Tailwind CSS
- **数据持久化**: SQLite 数据库，刷新不丢失

## 📦 安装步骤

### 1. 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 2. 安装依赖

```bash
# 在项目根目录执行
npm run install:all
```

或者分别安装：

```bash
# 根目录
npm install

# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 3. 启动项目

```bash
# 开发模式（同时启动前后端）
npm start

# 或者分别启动
# 后端端口 3001
cd backend && npm run dev

# 前端端口 3000（代理到后端）
cd frontend && npm run dev
```

启动后访问：http://localhost:3000

## 📖 使用指南

### 快速开始验证流程

1. **创建节目**
   - 进入仪表板，点击「新建节目」
   - 输入节目名称（如：科技播客）、期数（如：1）、标题（如：AI 发展趋势）
   - 点击创建

2. **导入示例数据**
   - 点击左侧导航「导入资料」
   - 选择刚创建的节目
   - 分别导入 `examples/` 目录下的 4 个示例文件：
     - `music-licenses.csv` → 音乐许可 CSV
     - `material-references.json` → 素材引用 JSON
     - `ad-schedule.json` → 广告时间表
     - `guest-authorization.json` → 嘉宾授权书

3. **执行风险扫描**
   - 返回仪表板
   - 点击「执行风险扫描」按钮
   - 系统会自动检测以下风险：
     - ✅ "News Break Theme" - 音乐已过期（2023-12-31）
     - ✅ "Sunset Melody" - 即将过期（30天内）
     - ✅ "品牌C中段广告" - 广告时长45秒，超过30秒标准
     - ✅ "专家观点 - 经济学分析" - 素材缺少授权信息

4. **查看风险队列**
   - 点击左侧导航「风险队列」
   - 可以看到所有检测到的风险
   - 点击某条风险查看详情

5. **处理风险**
   - 在右侧详情面板中
   - 输入复核意见（如：已联系版权方更新授权）
   - 选择状态变更（如：标记为处理中）
   - 点击「提交意见」
   - 可以看到复核历史记录

6. **导出报告**
   - 点击左侧导航「导出报告」
   - 导出 Markdown 授权清单：查看所有授权记录
   - 导出 CSV 风险表：用于数据分析
   - 导出 JSON 审计包：完整数据备份

### 风险类型说明

| 风险类型 | 说明 | 严重程度 |
|---------|------|---------|
| `expired_music` | 音乐授权已过期 | 高 |
| `expiring_soon` | 音乐授权即将过期（30天内） | 中 |
| `no_authorization` | 素材缺少授权 | 高 |
| `ad_too_long` | 广告时长超过 30 秒 | 中 |
| `duplicate_claim` | 同一素材被不同节目重复声明 | 高 |

### 状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 待处理 - 新检测到的风险 |
| `reviewing` | 处理中 - 正在核实或沟通 |
| `resolved` | 已解决 - 问题已修复 |
| `dismissed` | 已忽略 - 确认无问题或误报 |

## 📁 项目结构

```
xy4345/
├── backend/                 # 后端服务
│   ├── package.json
│   ├── data/               # SQLite 数据库目录
│   └── src/
│       ├── server.js       # 入口文件
│       ├── database.js     # 数据库初始化
│       ├── models/         # 数据模型
│       │   ├── programModel.js
│       │   ├── materialModel.js
│       │   ├── authorizationModel.js
│       │   ├── riskModel.js
│       │   └── reviewModel.js
│       ├── routes/         # API 路由
│       │   ├── programs.js
│       │   ├── materials.js
│       │   ├── authorizations.js
│       │   ├── risks.js
│       │   ├── reviews.js
│       │   ├── import.js
│       │   └── export.js
│       └── services/       # 业务服务
│           ├── riskDetector.js    # 风险检测
│           ├── importer.js        # 数据导入
│           └── exporter.js        # 数据导出
├── frontend/               # 前端应用
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       └── pages/
│           ├── Dashboard.jsx       # 仪表板
│           ├── RiskQueue.jsx       # 风险队列
│           ├── ImportPage.jsx      # 导入页面
│           ├── ExportPage.jsx      # 导出页面
│           └── ProgramDetail.jsx   # 节目详情
├── examples/               # 示例数据
│   ├── music-licenses.csv
│   ├── material-references.json
│   ├── ad-schedule.json
│   └── guest-authorization.json
└── package.json            # 根配置
```

## 🔧 API 接口

### 节目管理
- `GET /api/programs` - 获取节目列表
- `GET /api/programs/:id` - 获取节目详情（含素材、授权、风险）
- `POST /api/programs` - 创建节目
- `PUT /api/programs/:id` - 更新节目
- `DELETE /api/programs/:id` - 删除节目

### 素材管理
- `GET /api/materials` - 获取素材列表
- `GET /api/materials/duplicates` - 查找重复素材
- `POST /api/materials` - 创建素材
- `PUT /api/materials/:id` - 更新素材
- `DELETE /api/materials/:id` - 删除素材

### 授权管理
- `GET /api/authorizations` - 获取授权列表
- `GET /api/authorizations/expiring` - 获取即将过期授权
- `GET /api/authorizations/expired` - 获取已过期授权
- `POST /api/authorizations` - 创建授权
- `PUT /api/authorizations/:id` - 更新授权
- `DELETE /api/authorizations/:id` - 删除授权

### 风险管理
- `GET /api/risks` - 获取风险列表（支持 `?status=pending` 筛选）
- `GET /api/risks/stats` - 获取风险统计
- `GET /api/risks/:id` - 获取风险详情（含复核记录）
- `POST /api/risks` - 创建风险
- `PUT /api/risks/:id` - 更新风险
- `DELETE /api/risks/:id` - 删除风险

### 复核记录
- `GET /api/reviews` - 获取复核记录列表
- `POST /api/reviews` - 创建复核记录（同时可更新风险状态）
- `DELETE /api/reviews/:id` - 删除复核记录

### 导入接口
- `POST /api/import/music-licenses` - 导入音乐许可（CSV/文本）
- `POST /api/import/material-references` - 导入素材引用（JSON）
- `POST /api/import/ad-schedule` - 导入广告时间表（JSON）
- `POST /api/import/guest-authorization` - 导入嘉宾授权（JSON）
- `POST /api/import/scan` - 执行风险扫描

### 导出接口
- `GET /api/export/authorization-list?program_id=xxx` - 导出 Markdown 授权清单
- `GET /api/export/risk-table` - 导出 CSV 风险表
- `GET /api/export/audit-package` - 导出 JSON 审计包

### 其他接口
- `GET /api/health` - 健康检查
- `GET /api/stats` - 统计信息

## 📝 导入数据格式

### 音乐许可 CSV 格式
```csv
name,artist,duration,holder_name,license_type,valid_from,valid_until
"曲目名称","艺术家",时长(秒),"授权方","权限类型","生效日期","过期日期"
```

### 素材引用 JSON 格式
```json
{
  "materials": [
    {
      "name": "素材名称",
      "type": "clip",
      "source": "来源",
      "duration": 300,
      "authorization": {
        "holder_name": "授权方",
        "permission_type": "full_release",
        "sign_date": "2024-03-15"
      }
    }
  ]
}
```

### 广告时间表 JSON 格式
```json
{
  "ads": [
    {
      "name": "广告名称",
      "sponsor": "赞助商",
      "duration": 15,
      "timestamp": "00:05:30"
    }
  ]
}
```

### 嘉宾授权 JSON 格式
```json
{
  "guests": [
    {
      "name": "嘉宾姓名",
      "permission_type": "full_release",
      "sign_date": "2024-03-10",
      "terms": "授权条款说明"
    }
  ]
}
```

## 🔒 数据安全

- 所有数据存储在本地 SQLite 数据库中（`backend/data/podcast.db`）
- 无需网络连接即可运行
- 支持完整数据导出和导入（通过 JSON 审计包）
- 建议定期导出审计包进行备份

## 📋 未来扩展

- [ ] 支持更多授权类型检测
- [ ] 添加邮件提醒功能
- [ ] 支持批量操作
- [ ] 添加数据图表可视化
- [ ] 支持多用户权限管理

## 📄 开源协议

MIT License

---

**注意**: 这是一个本地运行的工具，所有数据存储在本地。首次使用时请确保已安装 Node.js 环境。
