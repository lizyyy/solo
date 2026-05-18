# 蛋糕预订台取货核验API

## 项目简介
蛋糕预订台取货核验系统API，支持订单管理、取货核验、修改历史追溯、人工审核等功能。

## 技术栈
- Node.js + Express
- Jest + Supertest (测试)
- 内存存储（无外部依赖）

## 安装运行

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式
npm run dev

# 运行测试
npm test
```

服务启动后访问: http://localhost:3000

## API接口

### 订单管理
- `GET /api/orders` - 获取订单列表，支持status、storeLocation筛选
- `GET /api/orders/:id` - 获取订单详情
- `GET /api/orders/:id/history` - 获取订单修改历史
- `PATCH /api/orders/:id` - 更新订单信息

### 取货核验
- `POST /api/verifications` - 提交取货核验
- `GET /api/verifications` - 获取核验记录
- `POST /api/verifications/:orderId/resubmit` - 人工审核后提交
- `POST /api/verifications/:orderId/withdraw` - 撤回已完成的订单
- `GET /api/verifications/log-consistency/:orderId` - 检查日志一致性

## 核心功能

1. **订单列表 → 详情 → 修改历史** 完整链路
2. **代取人身份验证**：身份证格式校验，失败进入人工审核
3. **订单核销防重**：已完成订单拒绝重复核验
4. **日志一致性检查**：核验记录与状态变更历史一致性校验
5. **撤回后再次提交**：支持订单撤回并重新核验
6. **人工审核留痕**：所有人工操作完整记录历史

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| ORDER_NOT_FOUND | 订单不存在 |
| ORDER_ALREADY_VERIFIED | 订单已被核销 |
| VERIFICATION_CODE_INVALID | 验证码错误 |
| PROXY_IDCARD_INVALID | 代取人身份证无效 |
| BALANCE_NOT_PAID | 尾款未付清 |

## 人工判定说明
详见 [MANUAL_JUDGEMENT_GUIDE.md](./MANUAL_JUDGEMENT_GUIDE.md)
