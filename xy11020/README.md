# 维修服务站上门维修报价 API

## 项目简介

这是一个完整的维修服务站上门维修报价管理系统API，支持报价创建、审批、客户接受、追加隐藏故障、报价一致性校验等功能。

## 功能特性

- ✅ 报价全生命周期管理（草稿→待审批→客户接受→补录待确认→完成/驳回）
- ✅ 报价一致性校验（配件价格范围、工时费/配件费/总金额计算一致性）
- ✅ 客户接受报价后追加隐藏故障处理流程
- ✅ 完整的报价变更记录追踪
- ✅ 可解释的错误消息和操作建议
- ✅ 种子数据（包含正常、驳回、补录、已完成四种状态）

## 技术栈

- Node.js
- Express
- TypeScript
- 内存数据库（演示用）

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API 接口文档

### 健康检查

```
GET /health
```

### 报价相关接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/quotes | 获取所有报价列表 |
| GET | /api/quotes/:id | 根据ID获取报价详情 |
| GET | /api/quotes/number/:number | 根据单号获取报价详情 |
| POST | /api/quotes | 创建报价 |
| POST | /api/quotes/:id/submit | 提交报价审批 |
| POST | /api/quotes/:id/accept | 客户接受报价 |
| POST | /api/quotes/:id/add-hidden-fault | 追加隐藏故障 |
| POST | /api/quotes/:id/review-supplement/:recordId | 审核追加报价 |
| POST | /api/quotes/:id/complete | 完成维修 |
| GET | /api/quotes/:id/change-records | 获取报价变更记录 |

## 种子数据

启动服务后自动加载4条报价演示数据：

1. **WX202605010001** - COMPLETED（已完成）- 大众帕萨特常规保养
2. **WX202605020002** - PENDING_SUPPLEMENT（补录待确认）- 丰田凯美瑞刹车维修+变速箱油封漏油追加
3. **WX202605030003** - REJECTED（驳回）- 奔驰E300L空调维修（因配件价格异常被拦截）
4. **WX202605040004** - CUSTOMER_ACCEPTED（客户已接受）- 本田雅阁常规保养

## 核心业务流程

### 正常报价流程

```
创建报价(DRAFT) → 提交审批(PENDING_APPROVAL) → 客户接受(CUSTOMER_ACCEPTED) → 完成维修(COMPLETED)
```

### 追加隐藏故障流程

```
客户接受报价(CUSTOMER_ACCEPTED) 
    ↓ 技师发现隐藏故障
追加隐藏故障 → 状态变更为(PENDING_SUPPLEMENT)
    ↓ 客户审核
客户接受 → 回到(CUSTOMER_ACCEPTED) 或 客户拒绝 → (REJECTED)
```

### 报价一致性校验规则

系统在提交审批时自动执行以下校验：

1. **配件价格范围校验** - 检查配件价格是否在市场价范围内
2. **工时费计算一致性** - 故障项目工时费总和与报价单总额是否匹配
3. **配件费计算一致性** - 配件项目费用总和与报价单总额是否匹配
4. **总金额计算一致性** - (工时费+配件费-折扣)与报价单总金额是否匹配

## 错误响应格式

所有错误响应统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "详细错误描述",
    "suggestedAction": "操作建议"
  }
}
```

### 常见错误码

- `QUOTE_NOT_FOUND` - 报价记录不存在
- `INVALID_STATUS` - 当前报价状态不支持此操作
- `QUOTE_REJECTED` - 报价被系统拦截（附详细原因）
- `CHANGE_RECORD_NOT_FOUND` - 变更记录不存在
- `ENDPOINT_NOT_FOUND` - 请求的接口不存在

## 项目结构

```
src/
├── types/           # 类型定义
├── database/        # 数据库访问层
├── services/        # 业务逻辑层
├── controllers/     # API控制器
├── routes/          # 路由定义
├── scripts/         # 脚本（种子数据）
└── server.ts        # 服务入口
```

## 使用示例

### 1. 获取所有报价

```bash
curl http://localhost:3000/api/quotes
```

### 2. 查看被驳回的报价详情

```bash
# 先获取所有报价找到REJECTED状态的报价ID
curl http://localhost:3000/api/quotes/number/WX202605030003
```

### 3. 测试追加隐藏故障

```bash
# 先找到CUSTOMER_ACCEPTED状态的报价ID
# 然后调用追加隐藏故障接口
curl -X POST http://localhost:3000/api/quotes/{报价ID}/add-hidden-fault \
  -H "Content-Type: application/json" \
  -d '{
    "faultItem": {
      "description": "发动机缸垫漏油",
      "category": "发动机",
      "laborCost": 800
    },
    "partItems": [
      {
        "name": "发动机缸垫",
        "partNumber": "ENG-GASKET-001",
        "quantity": 1,
        "unitPrice": 350,
        "isOriginal": true
      }
    ],
    "reason": "拆检过程中发现缸垫老化漏油，需要追加维修",
    "operator": "张师傅"
  }'
```
