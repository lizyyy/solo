# 美容院疗程核销API

一个完整的美容院疗程核销管理系统后端API服务，基于 Node.js + Express + SQLite 构建。

## 功能特性

### 核心数据模型
- **顾客管理**: 顾客基本信息CRUD
- **门店管理**: 门店信息管理
- **疗程包管理**: 套餐创建、查询、状态管理
- **赠送记录**: 赠送次数跟踪
- **核销记录**: 每次核销详细记录
- **转店申请**: 跨门店转店审批流程
- **延期申请**: 套餐延期审批流程
- **异常日志**: 所有异常操作记录
- **人工修正**: 数据修正记录跟踪

### 核心业务规则
- **套餐拆分**: 支持将大套餐拆分为多个子套餐，购买次数和赠送次数可分别拆分
- **转店确认**: 申请-审批-执行的完整流程
- **赠送扣减**: 赠送次数有独立余额（gift_count字段），与购买套餐完全分离，核销时可指定使用赠送次数
- **延期状态机**: 待审核 → 已批准/已驳回 → 已补偿
- **报告导出**: 支持CSV格式导出

### 赠送次数独立管理规则
- 套餐有独立的 `gift_count`（赠送余额）和 `used_gift_count`（已用赠送）字段
- 添加赠送时，只增加 `gift_count`，不影响购买的 `total_count`
- 核销时，`use_gift_count` 指定使用多少赠送次数
- 赠送次数不足时单独报错，不影响购买的套餐次数

### 接口响应状态
- `completed`: 操作成功完成
- `pending_review`: 待审核
- `approved`: 已批准
- `rejected`: 已驳回
- `compensated`: 已补偿
- `failed`: 操作失败
- `not_found`: 资源不存在

### 异常处理
- 所有异常路径保存原始输入数据
- 记录处理结果和操作人
- 重启服务历史数据不丢失

## 项目结构

```
beauty-clinic-api/
├── package.json
├── README.md
├── API_USAGE.md
├── data/                  # SQLite数据库目录
│   └── clinic.db
└── src/
    ├── server.js         # 服务入口
    ├── db/
    │   └── index.js      # 数据库连接
    ├── services/         # 业务逻辑层
    │   ├── CustomerStoreService.js
    │   ├── TreatmentPackageService.js
    │   ├── TransferExtensionService.js
    │   └── ReportExceptionService.js
    ├── routes/           # API路由层
    │   ├── customers.js
    │   ├── stores.js
    │   ├── packages.js
    │   ├── transfers.js
    │   ├── extensions.js
    │   └── reports.js
    └── scripts/          # 脚本工具
        ├── initDB.js     # 数据库初始化
        └── sampleData.js # 样例数据
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
node src/scripts/initDB.js
```

### 3. 导入样例数据
```bash
node src/scripts/sampleData.js
```

### 4. 启动服务
```bash
npm start
```

服务运行在: http://localhost:3000

## API接口清单

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 健康检查 | GET | /api/health | 服务健康检查 |
| 顾客 | POST | /api/customers | 创建顾客 |
| 顾客 | GET | /api/customers | 查询所有顾客 |
| 顾客 | GET | /api/customers/:id | 查询单个顾客 |
| 顾客 | PUT | /api/customers/:id | 更新顾客信息 |
| 门店 | POST | /api/stores | 创建门店 |
| 门店 | GET | /api/stores | 查询所有门店 |
| 门店 | GET | /api/stores/:id | 查询单个门店 |
| 套餐 | POST | /api/packages | 创建套餐 |
| 套餐 | GET | /api/packages | 查询所有套餐 |
| 套餐 | GET | /api/packages/:id | 查询单个套餐 |
| 套餐 | POST | /api/packages/:id/split | 拆分套餐 |
| 套餐 | POST | /api/packages/:id/gift | 添加赠送次数 |
| 套餐 | POST | /api/packages/:id/verify | 核销 |
| 套餐 | POST | /api/packages/:id/correct | 人工修正 |
| 转店 | POST | /api/transfers | 创建转店申请 |
| 转店 | GET | /api/transfers | 查询所有转店申请 |
| 转店 | POST | /api/transfers/:id/approve | 批准转店 |
| 转店 | POST | /api/transfers/:id/reject | 驳回转店 |
| 延期 | POST | /api/extensions | 创建延期申请 |
| 延期 | GET | /api/extensions | 查询所有延期申请 |
| 延期 | POST | /api/extensions/:id/approve | 批准延期 |
| 延期 | POST | /api/extensions/:id/reject | 驳回延期 |
| 延期 | POST | /api/extensions/:id/compensate | 补偿 |
| 报告 | GET | /api/reports/verifications | 核销记录报告 |
| 报告 | GET | /api/reports/packages | 套餐报告 |
| 报告 | GET | /api/reports/customer/:id | 顾客完整信息 |
| 报告 | GET | /api/reports/exceptions | 异常日志 |
| 报告 | GET | /api/reports/corrections | 人工修正记录 |
| 导出 | POST | /api/reports/export/csv | CSV导出 |

## 数据持久化

所有数据存储在 `data/clinic.db` SQLite 数据库文件中，重启服务数据不会丢失。

## 技术栈

- **Node.js**: 运行时环境
- **Express.js**: Web框架
- **SQLite3**: 本地数据库
- **UUID**: 主键生成
- **json2csv**: CSV导出

详细API使用示例请查看 [API_USAGE.md](./API_USAGE.md)
