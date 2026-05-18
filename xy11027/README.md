# 职业培训班学员证书补办 API

## 项目简介

职业培训班学员证书补办管理系统API，支持证书补办申请提交、审核、多校区重复申请检测、一致性校验、数据导出等功能。

## 核心功能

### 1. 补办申请管理
- 提交补办申请
- 审核补办申请（通过/驳回/待处理）
- 查询申请列表
- 查询申请详情

### 2. 智能校验
- **同一证书重复申请检测
- **多校区同时申请检测
- **补办材料完整性校验
- **学员信息一致性校验

### 3. 异常处理
- 拦截异常时进入"待处理"状态
- 清晰的错误码和错误消息
- 提供建议操作指引

### 4. 数据导出
- 支持JSON格式导出
- 支持CSV表格格式导出
- 字段名全部使用业务语言

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入种子数据

```bash
npm run seed
```

### 3. 启动服务

```bash
npm run dev
```

服务启动后访问: http://localhost:3000

## API 接口文档

### 基础信息

```bash
# 查看服务信息
curl http://localhost:3000
```

### 补办申请管理

#### 1. 提交补办申请

```bash
curl -X POST http://localhost:3000/api/certificate-reissue/applications \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY004",
    "原始证书编号": "ZS00120230004",
    "申请校区编号": "XQ004",
    "补办原因": "遗失",
    "补办原因说明": "出差途中遗失",
    "遗失地点": "北京市海淀区",
    "登报声明编号": "CB202405001",
    "申请人联系电话": "13800138004",
    "申请人通讯地址": "深圳市南山区某某大厦",
    "收件方式": "邮寄"
  }'
```

**多校区重复申请测试示例:

```bash
# 先在XQ001校区提交申请
curl -X POST http://localhost:3000/api/certificate-reissue/applications \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY002",
    "原始证书编号": "ZS00220230002",
    "申请校区编号": "XQ001",
    "补办原因": "损毁",
    "申请人联系电话": "13800138002",
    "收件方式": "自取"
  }'

# 再在XQ002校区提交同一学员的申请 - 会进入待处理状态
curl -X POST http://localhost:3000/api/certificate-reissue/applications \
  -H "Content-Type: application/json" \
  -d '{
    "学员编号": "XY002",
    "原始证书编号": "ZS00220230002",
    "申请校区编号": "XQ002",
    "补办原因": "遗失",
    "申请人联系电话": "13800138002",
    "收件方式": "邮寄"
  }'
```

#### 2. 审核补办申请

```bash
# 审核通过
curl -X PUT http://localhost:3000/api/certificate-reissue/applications/review \
  -H "Content-Type: application/json" \
  -d '{
    "申请编号": "SQ20240002002",
    "审核结果": "通过",
    "审核人": "张审核员",
    "审核意见": "材料齐全，同意补办"
  }'

# 审核驳回
curl -X PUT http://localhost:3000/api/certificate-reissue/applications/review \
  -H "Content-Type: application/json" \
  -d '{
    "申请编号": "SQ20240003003",
    "审核结果": "驳回",
    "审核人": "李审核",
    "审核意见": "材料不完整",
    "驳回原因": "缺少身份证明文件缺失"
  }'

# 设置为待处理
curl -X PUT http://localhost:3000/api/certificate-reissue/applications/review \
  -H "Content-Type: application/json" \
  -d '{
    "申请编号": "SQ20240003003",
    "审核结果": "待处理",
    "审核人": "王审核",
    "审核意见": "需要进一步核实信息"
  }'
```

#### 3. 查询申请列表

```bash
# 查询所有申请
curl http://localhost:3000/api/certificate-reissue/applications

# 按学员编号查询
curl "http://localhost:3000/api/certificate-reissue/applications?学员编号XY001

# 按状态查询
curl "http://localhost:3000/api/certificate-reissue/applications?申请状态待审核"

# 按校区查询
curl "http://localhost:3000/api/certificate-reissue/applications?校区编号=XQ001"
```

#### 4. 查询申请详情

```bash
curl http://localhost:3000/api/certificate-reissue/applications/SQ20240001001
```

### 数据导出

#### 1. 导出补办申请数据

```bash
# JSON格式
curl http://localhost:3000/api/export/applications

# CSV表格格式（可直接用Excel打开）
curl "http://localhost:3000/api/export/applications?format=csv
```

#### 2. 导出学员证书记录

```bash
# JSON格式
curl http://localhost:3000/api/export/student/XY001/certificates

# CSV表格格式
curl "http://localhost:3000/api/export/student/XY001/certificates?format=csv
```

## 业务规则说明

### 申请状态说明

| 状态 | 说明 |
|------|------|
| 待审核 | 申请已提交，等待审核 |
| 待处理 | 存在异常情况，需要人工介入处理 |
| 已通过 | 审核通过，已生成新证书 |
| 已驳回 | 审核不通过，申请被驳回 |

### 触发"待处理"状态的场景

1. **多校区同时申请**: 同一学员在多个校区同时提交补办申请
2. **材料不完整**: 
   - 遗失补办未提供登报声明编号
   - 信息变更补办未提供变更说明
   - 联系电话格式不正确
3. **信息不一致**: 学员信息与证书信息不一致

### 错误码说明

| 错误码 | 说明 |
|--------|------|
| STUDENT_NOT_FOUND | 未找到学员信息 |
| CERTIFICATE_NOT_FOUND | 未找到原始证书信息 |
| CERTIFICATE_INVALID | 原始证书状态异常 |
| CAMPUS_NOT_FOUND | 申请校区不存在 |
| DUPLICATE_APPLICATION | 存在未完成的补办申请 |
| APPLICATION_NOT_FOUND | 申请不存在 |
| INVALID_STATUS | 申请状态不允许审核 |
| SYSTEM_ERROR | 系统异常 |
| EXPORT_ERROR | 导出失败 |
| NOT_FOUND | 接口不存在 |

## 种子数据说明

导入种子数据后，系统预置以下测试数据:

- **校区数据**: 4个校区（北京朝阳、上海浦东、广州天河、深圳南山）
- **培训项目**: 4个项目（高级育婴师、电子商务师、茶艺师、中式烹调师）
- **学员数据**: 5名学员（张明华、李秀英、王建国、陈美玲、刘志强）
- **原始证书**: 5本证书
- **补办申请**: 3份申请（1份已通过、1份待审核、1份待处理）

## 项目结构

```
├── src/
│   ├── config/
│   │   └── database.ts          # 数据库配置
│   ├── routes/
│   │   ├── certificate-reissue.routes.ts  # 补办申请路由
│   │   └── export.routes.ts              # 数据导出路由
│   ├── services/
│   │   ├── certificate-reissue.service.ts # 核心业务逻辑
│   │   └── export.service.ts             # 数据导出服务
│   ├── types/
│   │   └── index.ts        # 类型定义
│   ├── scripts/
│   │   ├── init-db.ts       # 数据库初始化
│   │   └── seed.ts          # 种子数据导入
│   └── index.ts              # 服务入口
├── data/                     # 数据库文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- Node.js
- TypeScript
- Express
- SQLite3
- UUID

## 开发命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式启动
npm run build        # 编译
npm start          # 生产模式启动
npm run seed         # 导入种子数据
```
