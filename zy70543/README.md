# 回调契约验签API系统

用于供应商升级回调格式前提交样例并自动判断签名和字段是否合规的API服务。

## 技术栈

- Node.js + Express + TypeScript
- SQLite 数据库
- RSA 签名验签
- Jest 测试框架

## 核心功能

### 数据模型

1. **供应商 (Supplier)**: 供应商基本信息和公钥配置
2. **契约版本 (ContractVersion)**: 回调契约版本、期望字段、签名头配置
3. **回调样例 (CallbackSample)**: 供应商提交的原始回调请求
4. **签名头 (SignHeader)**: 提取的签名信息
5. **字段差异 (FieldDiff)**: 字段校验差异记录
6. **验收结论 (VerificationConclusion)**: 最终验签和校验结论
7. **审计日志 (AuditLog)**: 操作记录

### 关键规则

- **样例验签**: 使用RSA算法验证回调签名有效性
- **字段校验**: 对比契约定义的期望字段与实际提交字段
- **版本对比**: 支持多版本契约管理
- **状态管理**: pending(待处理) / confirmed(已确认) / blocked(被拦截) / revoked(已撤销) / compensated(已补偿)
- **异常追溯**: 保留原始输入、处理依据、最终结论和操作日志

### API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/contract/suppliers | 创建供应商 |
| GET | /api/contract/suppliers/:id | 查询供应商 |
| POST | /api/contract/contracts | 创建契约版本 |
| GET | /api/contract/contracts/:id | 查询契约版本 |
| POST | /api/contract/samples | 提交回调样例并自动验签 |
| GET | /api/contract/samples/:id | 查询样例详情 |
| GET | /api/contract/conclusions | 查询验收结论列表 |
| GET | /api/contract/conclusions/:id | 查询单个结论详情 |
| GET | /api/contract/conclusions/:id/trace | 获取异常追溯信息 |
| PUT | /api/contract/conclusions/:id/status | 推进状态 |
| POST | /api/contract/conclusions/:id/correct | 人工修正 |
| POST | /api/contract/export | 导出CSV |

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
npm start
```

### 运行测试

```bash
npm test
```

## 状态说明

| 状态 | 说明 | 触发条件 |
|------|------|----------|
| pending | 待处理 | 验签和字段校验全部通过 |
| blocked | 被拦截 | 验签失败或字段校验失败 |
| confirmed | 已确认 | 人工确认通过 |
| revoked | 已撤销 | 确认后撤销 |
| compensated | 已补偿 | 异常已完成补偿处理 |

## 校验结果说明

| 结果 | 说明 |
|------|------|
| success | 校验通过 |
| failed | 校验失败 |
| partial | 部分通过（有警告如额外字段） |

## 项目结构

```
.
├── src/
│   ├── __tests__/          # 测试文件
│   ├── database/           # 数据库配置和初始化
│   ├── routes/             # API路由
│   ├── services/           # 业务逻辑
│   ├── types/              # 类型定义
│   └── server.ts           # 服务入口
├── data/                   # SQLite数据库文件
├── exports/                # CSV导出目录
├── package.json
├── tsconfig.json
└── jest.config.js
```
