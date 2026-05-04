# BTC 充值确认和归集风控后端服务 - 异常场景示例

## 1. 0 确认入账限制

**场景**：用户发起 0 确认充值，但系统配置禁用了 0 确认入账。

**错误码**：`2001`

**请求示例**：
```bash
curl -X POST "http://localhost:8080/api/v1/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_zero_conf_test",
    "inputs": [{"tx_id": "prev_tx", "output_index": 0}],
    "outputs": [{
      "address": "bc1quser001address00000000000000000000000",
      "amount": 100000000,
      "index": 0
    }],
    "is_rbf": false,
    "fee": 2000
  }'
```

**响应示例**：
```json
{
  "code": "0000",
  "message": "成功",
  "data": {
    "tx_id": "tx_zero_conf_test",
    "status": "pending",
    "confirmations": 0,
    "is_confirmed": false,
    "is_suspicious": false
  }
}
```

**风险评估**：
```bash
# 查询交易状态
curl "http://localhost:8080/api/v1/transactions/tx_zero_conf_test/status"
```

**注意**：在当前配置 `ENABLE_ZERO_CONF=false` 下，0 确认交易不会自动入账，需要等待达到确认数阈值。

---

## 2. RBF (Replace-By-Fee) 风险

**场景**：检测到交易带有 RBF 标志，存在被替换的风险。

**错误码**：`2002`

**请求示例**：
```bash
curl -X POST "http://localhost:8080/api/v1/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_rbf_risk_test",
    "inputs": [{"tx_id": "prev_tx_rbf", "output_index": 0}],
    "outputs": [{
      "address": "bc1quser002address00000000000000000000000",
      "amount": 50000000,
      "index": 0
    }],
    "is_rbf": true,
    "fee": 3000
  }'
```

**响应示例**：
```json
{
  "code": "0000",
  "message": "成功",
  "data": {
    "tx_id": "tx_rbf_risk_test",
    "status": "suspicious",
    "confirmations": 0,
    "is_confirmed": false,
    "is_suspicious": true,
    "suspicious_reason": "RBF 风险"
  }
}
```

**后续处理**：
- 交易和对应的 UTXO 会被标记为 `suspicious` 状态
- 风控人员可以进一步审核
- 可以手动标记为可疑或正常

---

## 3. 双花风险

**场景**：检测到同一笔输入被多笔交易使用。

**错误码**：`2003`

**请求示例**：
```bash
# 第一笔交易（正常）
curl -X POST "http://localhost:8080/api/v1/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_double_spend_1",
    "inputs": [{"tx_id": "prev_tx_double_spend", "output_index": 0}],
    "outputs": [{
      "address": "bc1quser001address00000000000000000000000",
      "amount": 100000000,
      "index": 0
    }],
    "is_rbf": false,
    "fee": 2000
  }'

# 假设第一笔交易的输出已被花费
# 第二笔交易使用相同输入（双花）
curl -X POST "http://localhost:8080/api/v1/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_double_spend_2",
    "inputs": [{"tx_id": "prev_tx_double_spend", "output_index": 0}],
    "outputs": [{
      "address": "bc1quser003address00000000000000000000000",
      "amount": 100000000,
      "index": 0
    }],
    "is_rbf": false,
    "fee": 2000
  }'
```

**响应示例**（如果检测到双花）：
```json
{
  "code": "0000",
  "message": "成功",
  "data": {
    "tx_id": "tx_double_spend_2",
    "status": "suspicious",
    "confirmations": 0,
    "is_confirmed": false,
    "is_suspicious": true,
    "suspicious_reason": "双花风险"
  }
}
```

---

## 4. 确认数不足

**场景**：交易确认数未达到阈值，不能入账。

**错误码**：`2004`

**请求示例**：
```bash
# 查询交易状态（确认数为 3，阈值为 6）
curl "http://localhost:8080/api/v1/transactions/tx_002_confirmed_3_blocks/status"
```

**响应示例**：
```json
{
  "code": "0000",
  "message": "成功",
  "data": {
    "tx_id": "tx_002_confirmed_3_blocks",
    "status": "pending",
    "confirmations": 3,
    "is_confirmed": false,
    "is_suspicious": false
  }
}
```

**说明**：
- 配置的确认数阈值：`CONFIRMED_BLOCKS=6`
- 交易需要达到 6 个确认才能入账
- 可以通过导入更多区块来增加确认数

---

## 5. 链重组回滚

**场景**：区块链发生重组，之前确认的交易被回滚。

**错误码**：`2005`

**请求示例**：
```bash
# 首先导入一个区块
curl -X POST "http://localhost:8080/api/v1/transactions/import-block" \
  -H "Content-Type: application/json" \
  -d '{
    "height": 800020,
    "hash": "0000000000000000000000000000000000000000000000000000000000000a",
    "prev_hash": "00000000000000000000000000000000000000000000000000000000000009",
    "timestamp": "2024-01-01T12:00:00Z",
    "transactions": []
  }'

# 然后导入同一高度但不同哈希的区块（触发重组）
curl -X POST "http://localhost:8080/api/v1/transactions/import-block" \
  -H "Content-Type: application/json" \
  -d '{
    "height": 800020,
    "hash": "0000000000000000000000000000000000000000000000000000000000000b",
    "prev_hash": "00000000000000000000000000000000000000000000000000000000000009",
    "timestamp": "2024-01-01T12:00:00Z",
    "transactions": []
  }'
```

**说明**：
- 系统检测到同一高度有不同的区块哈希
- 会触发链重组回滚逻辑
- 原区块的交易会被回滚到未确认状态
- 原区块被标记为 `is_reorged = true`

---

## 6. Dust 输出过滤

**场景**：交易输出金额小于 dust 阈值，被忽略。

**错误码**：`2006`

**请求示例**：
```bash
curl -X POST "http://localhost:8080/api/v1/transactions/import-mempool" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "tx_dust_test",
    "inputs": [{"tx_id": "prev_tx_dust", "output_index": 0}],
    "outputs": [{
      "address": "bc1quser001address00000000000000000000001",
      "amount": 500,
      "index": 0
    }],
    "is_rbf": false,
    "fee": 2000
  }'
```

**说明**：
- 配置的 dust 阈值：`DUST_THRESHOLD=546` (satoshi)
- 输出金额 500 < 546，被视为 dust 输出
- 不会创建对应的 UTXO
- 交易本身会被记录，但输出被过滤

---

## 7. 归集手续费不足

**场景**：归集金额不足以支付手续费。

**错误码**：`2007`

**请求示例**：
```bash
# 创建归集计划（金额 < 手续费）
curl -X POST "http://localhost:8080/api/v1/collection" \
  -H "Content-Type: application/json" \
  -d '{
    "target_amount": 1000,
    "hot_wallet_address": "bc1qhotwalletaddress000000000000000000000000",
    "cold_wallet_address": "bc1qcoldwalletaddress00000000000000000000000",
    "user_id": "admin_001",
    "collect_all": false
  }'
```

**响应示例**：
```json
{
  "code": "2007",
  "message": "归集金额 1000 不足以支付手续费 5840"
}
```

**说明**：
- 手续费估算基于输入输出数量和费率
- 公式：`(10 + 148*input_count + 34*output_count) * fee_rate`
- 示例：1 输入 + 1 输出 = (10 + 148 + 34) * 20 = 192 * 20 = 3840 satoshi

---

## 8. 热钱包限额超限

**场景**：热钱包余额将超过配置的最大限额。

**错误码**：`2008`

**请求示例**：
```bash
# 风险检查：热钱包余额
# 配置：MAX_HOT_WALLET_BALANCE=1000000000 (10 BTC)

# 如果归集后热钱包余额将超过限额
# 系统会自动分配超出部分到冷钱包
```

**说明**：
- 当 `target_amount > MAX_HOT_WALLET_BALANCE` 时：
  - 超出部分自动分配到冷钱包
  - 归集计划需要人工审核（`needs_audit = true`）
  - 状态变为 `pending_audit`

---

## 9. 冷钱包限额不足

**场景**：冷钱包余额低于最低限额。

**错误码**：`2009`

**说明**：
- 配置：`MIN_COLD_WALLET_BALANCE=100000000` (1 BTC)
- 这是一个预警阈值，用于提醒需要将更多资金转入冷钱包
- 系统会在审计报告中提示

---

## 10. 幂等请求冲突

**场景**：相同的请求在短时间内重复发送。

**错误码**：`1002`

**请求示例**：
```bash
# 第一次请求（成功）
curl -X POST "http://localhost:8080/api/v1/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_005",
    "request_id": "req_idempotent_test_001"
  }'

# 第二次请求（相同 request_id，1 小时内）
curl -X POST "http://localhost:8080/api/v1/addresses" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_005",
    "request_id": "req_idempotent_test_001"
  }'
```

**响应示例**：
```json
{
  "code": "1002",
  "message": "幂等请求冲突",
  "data": {
    "id": 1,
    "user_id": "user_005",
    "address": "bc1q...",
    "index": 0,
    "status": "active",
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
}
```

**说明**：
- 幂等机制防止重复操作
- 返回已存在的资源，而不是创建新的
- 适用于创建地址、导入交易等操作

---

## 错误码汇总

| 错误码 | 类型 | 说明 |
|--------|------|------|
| 0000 | 成功 | 操作成功 |
| 1001 | 请求错误 | 请求参数无效 |
| 1002 | 请求错误 | 幂等请求冲突 |
| 1003 | 请求错误 | 资源不存在 |
| 1004 | 请求错误 | 资源冲突 |
| 2001 | 业务规则 | 0 确认入账已禁用 |
| 2002 | 业务规则 | 检测到 RBF 风险 |
| 2003 | 业务规则 | 检测到双花风险 |
| 2004 | 业务规则 | 确认数不足 |
| 2005 | 业务规则 | 链重组回滚 |
| 2006 | 业务规则 | Dust 输出被过滤 |
| 2007 | 业务规则 | 手续费不足 |
| 2008 | 业务规则 | 热钱包限额超限 |
| 2009 | 业务规则 | 冷钱包限额不足 |
| 2013 | 业务规则 | 需要人工审核 |
| 3001 | 系统错误 | 数据库错误 |
| 3002 | 系统错误 | 配置错误 |
| 3003 | 系统错误 | 内部错误 |
