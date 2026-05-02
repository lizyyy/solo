# 埋点日志验证报告

**生成时间**: 2026-05-02T17:51:00.644319

## 一、整体概览

### 规则验证统计

| 指标 | 数值 |
|------|------|
| 总规则数 | 25 |
| 通过规则数 | 22 |
| 失败规则数 | 3 |
| **规则通过率** | **88.0%** |

### Session统计

| 指标 | 数值 |
|------|------|
| 总Session数 | 5 |
| 通过Session数 | 2 |
| 失败Session数 | 3 |
| **Session通过率** | **40.0%** |

### 解析错误: 0 个

## 二、失败规则排行

| 排名 | 规则 | 失败次数 |
|------|------|----------|
| 1 | R001: 支付成功前必须提交订单 | 2 |
| 2 | R002: 曝光事件不能连续重复超过3次 | 1 |

## 三、问题Session明细

### 1. Session: `sess_002`

**失败规则数**: 1

#### 1. 规则: 曝光事件不能连续重复超过3次 (ID: R002)

- **类型**: duplicate
- **详情**: {"message": "存在重复规则验证失败", "failures": [{"start_line": 14, "end_line": 17, "count": 4, "max_count": 3, "event": "product_impression", "page": null, "message": "连续重复 product_impression 事件 4 次，超过限制 3 次"}], "target_event": "product_impression", "max_count": 3}

**相关事件:**

| 事件 | 页面 | 时间戳 | 行号 |
|------|------|--------|------|
| product_impression | detail | 2024-01-15 11:00:16 | None |
| product_impression | detail | 2024-01-15 11:00:17 | None |
| product_impression | detail | 2024-01-15 11:00:18 | None |
| product_impression | detail | 2024-01-15 11:00:19 | None |

---

### 2. Session: `sess_003`

**失败规则数**: 1

#### 1. 规则: 支付成功前必须提交订单 (ID: R001)

- **类型**: sequence
- **详情**: {"message": "存在顺序规则验证失败", "failures": [{"after_line": 22, "after_event": "payment_success", "after_time": "2024-01-15 12:01:00", "message": "在 payment_success 之前未找到必需的事件 submit_order"}], "before_event": "submit_order", "after_event": "payment_success"}

**相关事件:**

| 事件 | 页面 | 时间戳 | 行号 |
|------|------|--------|------|
| payment_success | checkout | 2024-01-15 12:01:00 | None |

---

### 3. Session: `sess_005`

**失败规则数**: 1

#### 1. 规则: 支付成功前必须提交订单 (ID: R001)

- **类型**: sequence
- **详情**: {"message": "存在顺序规则验证失败", "failures": [{"after_line": 7, "after_event": "payment_success", "after_time": "2024-01-15 14:02:30", "message": "在 payment_success 之前未找到必需的事件 submit_order"}], "before_event": "submit_order", "after_event": "payment_success"}

**相关事件:**

| 事件 | 页面 | 时间戳 | 行号 |
|------|------|--------|------|
| payment_success | checkout | 2024-01-15 14:02:30 | None |

---

## 四、日志统计信息

| 指标 | 数值 |
|------|------|
| 总Session数 | 5 |
| 总事件数 | 32 |
| 独立用户数 | 5 |
| 平均每Session事件数 | 6.40 |
| 平均Session时长(秒) | 120.80 |

### 事件类型分布

| 事件类型 | 次数 |
|----------|------|
| page_view | 10 |
| product_impression | 10 |
| click_product | 5 |
| payment_success | 3 |
| click_buy | 2 |
| submit_order | 1 |
| add_to_cart | 1 |
