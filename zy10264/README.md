# 旅行社签证材料 API

一个专为旅行社设计的签证材料管理系统，支持游客信息管理、材料上传、审核、补件、送签、退回等全流程。

## 核心特性

- ✅ **游客信息管理**: 游客档案，护照去重
- ✅ **签证国家配置**: 每个国家可自定义材料要求
- ✅ **材料版本管理**: 补件自动创建新版本，保留历史记录
- ✅ **过期检测**: 自动识别过期材料，防止送签
- ✅ **状态机控制**: 严格的申请状态流转，防止非法操作
- ✅ **缺失材料查询**: 随时查看每个游客缺什么材料
- ✅ **补件请求追踪**: 记录每次补件要求和处理状态
- ✅ **操作历史**: 完整的状态变更日志可追溯

## 技术栈

- Node.js + TypeScript
- Express.js
- SQLite (better-sqlite3)
- UUID

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm run build && npm start
```

服务默认运行在 `http://localhost:3000`

## 申请状态流转

```
DRAFT (草稿)
   ↓
SUBMITTED (已提交)
   ↓
REVIEWING (审核中) ←→ SUPPLEMENT (补件中)
   ↓
SENT (已送签)
   ↓
RETURNED (已退回) → SUPPLEMENT (补件中)
   ↓
APPROVED (已出签) 或 CLOSED (已关闭)
```

## 材料状态

- `PENDING`: 待上传
- `UPLOADED`: 已上传
- `REVIEWING`: 审核中
- `APPROVED`: 已通过
- `REJECTED`: 已拒绝
- `EXPIRED`: 已过期

## API 端点

### 基础数据

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/countries | 创建国家 |
| GET | /api/countries | 获取国家列表 |
| POST | /api/material-types | 创建材料类型 |
| GET | /api/material-types | 获取材料类型列表 |
| POST | /api/tourists | 创建游客（护照去重） |
| GET | /api/tourists | 获取游客列表 |

### 申请管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/applications | 创建签证申请 |
| GET | /api/applications | 获取申请列表 |
| GET | /api/applications/:id | 获取申请详情 |
| POST | /api/applications/:id/submit | 提交申请 |
| POST | /api/applications/:id/start-review | 开始审核 |
| POST | /api/applications/:id/send | 送签 |
| POST | /api/applications/:id/return | 退回 |
| POST | /api/applications/:id/supplement | 要求补件 |
| POST | /api/applications/:id/close | 关闭申请 |

### 材料管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/applications/:id/materials | 获取申请材料 |
| GET | /api/applications/:id/missing-materials | 查询缺失材料 |
| POST | /api/applications/:id/materials | 上传材料（自动创建版本） |
| POST | /api/applications/materials/:id/review | 审核材料 |
| GET | /api/applications/:id/materials/:type_id/versions | 查看材料版本历史 |
| GET | /api/applications/:id/history | 状态变更历史 |
| GET | /api/applications/supplement-requests | 补件请求列表 |

## 关键业务规则

1. **重复导入**: 相同护照号的游客不会重复创建，直接返回已有记录
2. **材料过期**: 提交时会检测材料有效期，过期材料不允许提交
3. **补件版本**: 重新上传同一类型材料时自动递增版本号，保留历史
4. **未齐材料**: 必填材料缺失时不允许提交和送签
5. **退回后状态**: 退回后可以要求补件，补件完成后重新提交审核
6. **重复补件请求**: 同一材料已有待处理补件请求时不允许重复创建
7. **状态锁**: 严格限制各状态下可执行的操作，防止非法状态变更

## 使用示例

### 完整流程：从收件到送签再到退回补件

运行示例脚本：

```bash
# 启动服务后，另开终端运行
./example-flow.sh
```

或手动执行以下步骤：

#### 1. 初始化基础数据

```bash
# 创建国家
curl -X POST http://localhost:3000/api/countries \
  -H "Content-Type: application/json" \
  -d '{"name":"日本","code":"JP"}'

# 创建材料类型
curl -X POST http://localhost:3000/api/material-types \
  -H "Content-Type: application/json" \
  -d '{"country_id":"<国家ID>","name":"护照原件","required":true,"validity_days":180}'

curl -X POST http://localhost:3000/api/material-types \
  -H "Content-Type: application/json" \
  -d '{"country_id":"<国家ID>","name":"2寸白底照片","required":true}'

curl -X POST http://localhost:3000/api/material-types \
  -H "Content-Type: application/json" \
  -d '{"country_id":"<国家ID>","name":"在职证明","required":true}'

# 创建游客
curl -X POST http://localhost:3000/api/tourists \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","passport_number":"E12345678","phone":"13800138000"}'
```

#### 2. 创建申请并上传材料

```bash
# 创建签证申请
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"tourist_id":"<游客ID>","country_id":"<国家ID>"}'

# 查看缺失材料
curl http://localhost:3000/api/applications/<申请ID>/missing-materials

# 上传材料
curl -X POST http://localhost:3000/api/applications/<申请ID>/materials \
  -H "Content-Type: application/json" \
  -d '{"type_id":"<材料类型ID>","file_url":"/files/1.pdf","remark":"护照扫描件"}'
```

#### 3. 提交审核与送签

```bash
# 提交申请
curl -X POST http://localhost:3000/api/applications/<申请ID>/submit

# 开始审核
curl -X POST http://localhost:3000/api/applications/<申请ID>/start-review

# 审核材料
curl -X POST http://localhost:3000/api/applications/materials/<材料ID>/review \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","reviewer_note":"材料合格"}'

# 送签
curl -X POST http://localhost:3000/api/applications/<申请ID>/send
```

#### 4. 退回补件流程

```bash
# 领馆退回
curl -X POST http://localhost:3000/api/applications/<申请ID>/return \
  -H "Content-Type: application/json" \
  -d '{"reason":"照片规格不符合要求","operator":"签证专员"}'

# 要求补件
curl -X POST http://localhost:3000/api/applications/<申请ID>/supplement \
  -H "Content-Type: application/json" \
  -d '{"material_id":"<材料ID>","reason":"照片尺寸不对，请重新提供","operator":"签证专员"}'

# 查看缺失材料
curl http://localhost:3000/api/applications/<申请ID>/missing-materials

# 重新上传材料（创建新版本）
curl -X POST http://localhost:3000/api/applications/<申请ID>/materials \
  -H "Content-Type: application/json" \
  -d '{"type_id":"<材料类型ID>","file_url":"/files/1-v2.pdf","remark":"重新提交的照片"}'

# 查看材料版本
curl http://localhost:3000/api/applications/<申请ID>/materials/<类型ID>/versions

# 重新提交审核
curl -X POST http://localhost:3000/api/applications/<申请ID>/submit
```

#### 5. 查看历史记录

```bash
# 查看状态变更历史
curl http://localhost:3000/api/applications/<申请ID>/history

# 查看补件请求
curl "http://localhost:3000/api/applications/supplement-requests?application_id=<申请ID>"
```

## 项目结构

```
.
├── src/
│   ├── db/
│   │   └── index.ts          # 数据库连接
│   ├── scripts/
│   │   └── init-db.ts        # 数据库初始化脚本
│   ├── services/
│   │   ├── master.service.ts # 基础数据服务
│   │   ├── application.service.ts # 申请服务
│   │   └── material.service.ts    # 材料服务
│   ├── routes/
│   │   ├── master.ts
│   │   └── application.ts
│   └── index.ts              # 应用入口
├── package.json
├── tsconfig.json
└── README.md
```
