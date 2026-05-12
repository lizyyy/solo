# API 速率套餐台 - 边界说明文档

## 1. 系统概述

API 速率套餐台是一个用于管理开放平台客户 API 套餐、订阅、用量和账单的系统。系统确保网关限速和账单同步，支持运营临时升配、延长试用等操作。

---

## 2. 主要边界

### 2.1 订阅类型边界

| 类型 | 优先级 | 生效时机 | 到期处理 |
|------|--------|----------|----------|
| temp_boost（临时加量） | 最高（0） | 立即生效 | 到期自动恢复原套餐 |
| paid/upgrade（付费/升级） | 高（1） | 升级立即生效 | 持续生效除非变更 |
| trial（试用） | 中（2） | 立即生效 | 到期标记为 expired |
| downgrade/promotion（降级/促销） | 低（3） | 下周期生效 | 持续生效除非变更 |

**边界规则：**
- 同一时间只允许一个主要订阅生效
- 临时加量会暂停当前订阅，加量结束后自动恢复
- 升级操作会立即替换当前订阅，旧订阅标记为 superseded
- 降级操作创建 pending 状态，到生效时间才激活

### 2.2 套餐变更边界

```
升级流程边界：
当前订阅 ──升级请求──> 旧订阅标记 superseded
                   └──> 创建 upgrade 类型新订阅（立即激活）

降级流程边界：
当前订阅 ──降级请求──> 创建 downgrade 类型 pending 订阅
                   └──> 等待生效时间到达

重复变更边界：
已有待生效降级 ──升级请求──> 待生效降级标记 superseded
                        └──> 执行升级流程

临时加量边界：
当前订阅 ──加量请求──> 原订阅标记 superseded（end_date=now）
                   └──> 创建 temp_boost 订阅（立即激活）
                   └──> 创建原套餐的 pending 恢复订阅
```

### 2.3 用量和限速边界

```
时间窗口边界（rate_window）：
- minute: 每自然分钟（00:00 - 59:59）
- hour: 每自然小时
- day: 每自然天

限速判断边界：
if 当前用量 >= 速率限制:
    if 高优先级接口（priority=1）:
        拒绝请求（allowed=false）
    else:
        允许但降速（allowed=true, 记录超额费用）
else:
    允许请求
```

### 2.4 账单预估边界

```
套餐费用计算：
每日费用 = 月费 / 30
周期费用 = 每日费用 * 生效天数

超额费用计算：
超额单价 = 月费 / 1000（月费为0时按 0.1元/次）
超额费用 = 超额次数 * 超额单价

边界：
- 试用套餐（月费=0）不计入套餐费用
- 临时加量套餐（月费=0）不计入套餐费用
- 超额费用按窗口计算，每个超额窗口单独记录
```

---

## 3. 失败路径

### 3.1 失败路径：无活跃订阅时的请求

**场景：**
客户"创新科技有限公司"（cust-001）的7天试用已于5月9日过期，5月12日尝试调用 API。

**执行步骤：**
1. 调用 `getCurrentRateInfo('cust-001')`
2. 查询该客户所有订阅，筛选 active 状态
3. 试用订阅状态已为 expired，无其他 active 订阅
4. 返回 `hasActiveSubscription: false, rateLimit: 0, excessReason: 'NO_ACTIVE_SUBSCRIPTION'`
5. 调用 `recordUsage('cust-001', { priority: 1 })`
6. 由于无活跃订阅，直接返回 `allowed: false, reason: 'NO_ACTIVE_SUBSCRIPTION'`
7. 本次请求记录 `is_exceeded: 1` 但不计入超额费用（无套餐可参考）

**预期结果：**
```json
{
  "allowed": false,
  "reason": "NO_ACTIVE_SUBSCRIPTION",
  "rateInfo": {
    "hasActiveSubscription": false,
    "rateLimit": 0,
    "isExceeded": true,
    "excessReason": "NO_ACTIVE_SUBSCRIPTION"
  }
}
```

**失败点检查：**
- [ ] 订阅过期后状态是否正确标记为 expired
- [ ] 无活跃订阅时是否正确返回 0 速率限制
- [ ] 所有优先级请求都被拒绝
- [ ] 账单预估中不计算该次请求的超额费用

---

## 4. 重复执行路径

### 4.1 重复执行路径：重复升级请求

**场景：**
客户"云端数据服务"（cust-002）当前在"专业版"（1000次/分钟），运营连续两次点击"升级到企业版"按钮。

**第一次执行：**
1. 调用 `upgradeSubscription('cust-002', 'enterprise')`
2. 检查当前订阅：专业版 temp_boost（1500次/分钟，active）
3. 检查目标套餐：企业版（10000次/分钟，存在且不同于当前）
4. 检查 pending 订阅：存在一个专业版恢复的 pending 订阅
5. 将 pending 恢复订阅标记为 superseded
6. 将当前 temp_boost 订阅标记为 superseded，end_date=now
7. 创建新的 upgrade 类型订阅：企业版，立即 active
8. 返回新订阅信息

**第二次执行（重复点击）：**
1. 调用 `upgradeSubscription('cust-002', 'enterprise')`
2. 检查当前订阅：企业版 upgrade（active）
3. 检查目标套餐：企业版
4. `currentSub.plan_id === newPlanId` 条件成立
5. 抛出错误：`Already on this plan`
6. 前端捕获错误并提示"您已在该套餐上"

**预期结果：**
- 第一次：成功升级，套餐时间线显示：
  ```
  [past] 专业版 (superseded)
  [past] 临时加量 专业版+500 (superseded)
  [pending] 专业版 (superseded) ← 被升级取代
  [active] 企业版 (upgrade)
  ```
- 第二次：返回 400 错误 `{ "error": "Already on this plan" }`

**重复执行检查点：**
- [ ] 同一套餐的重复升级是否被拦截
- [ ] 第一次升级产生的 pending 订阅是否被正确标记
- [ ] 升级后时间线是否按顺序排列
- [ ] 账单预估是否正确计算各阶段的天数和费用

---

## 5. 关键接口速查

### 后端接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/customers/:id/rate/check` | POST | 查询当前速率信息 |
| `/api/customers/:id/usage/record` | POST | 记录用量并判断是否限速 |
| `/api/customers/:id/timeline` | GET | 获取套餐时间线 |
| `/api/customers/:id/excess` | GET | 获取超额记录 |
| `/api/customers/:id/billing` | GET | 账单预估 |
| `/api/customers/:id/upgrade` | POST | 升级套餐（立即生效） |
| `/api/customers/:id/downgrade` | POST | 降级套餐（下周期生效） |
| `/api/customers/:id/boost` | POST | 临时加量（立即生效） |
| `/api/system/process-pending` | POST | 处理待生效订阅 |
| `/api/system/expire-subscriptions` | POST | 过期订阅处理 |

### 前端页面

| 页面 | 路由 | 功能 |
|------|------|------|
| 仪表盘 | `/` | 总览客户数、套餐数、系统状态 |
| 套餐管理 | `/plans` | 查看/创建套餐（速率限制、优先级、月费） |
| 客户列表 | `/customers` | 查看所有客户 |
| 客户详情 | `/customers/:id` | 套餐时间线、当前用量、账单、实时测试 |

---

## 6. 内置示例数据

### 客户
1. **创新科技有限公司**（cust-001）
   - 状态：试用已过期（5月2日-5月9日）
   - 当前：无活跃订阅
   - 样例：5次历史调用

2. **云端数据服务**（cust-002）
   - 状态：临时加量中（专业版+500，1500次/分钟）
   - 加量时长：2小时
   - 待生效：加量结束后恢复专业版
   - 样例：15次混合优先级调用

3. **智能物联网**（cust-003）
   - 状态：企业版正式订阅（10000次/分钟）
   - 样例：大量历史调用

### 套餐
- 免费试用：10次/分钟，¥0/月，7天试用
- 入门版：100次/分钟，¥99/月
- 专业版：1000次/分钟，¥499/月
- 企业版：10000次/分钟，¥2999/月

---

## 7. 复查清单

### 每次变更后复查

**边界检查：**
- [ ] 升级是否立即生效，旧订阅是否 superseded
- [ ] 降级是否创建 pending，不影响当前
- [ ] 临时加量是否创建恢复订阅
- [ ] 无订阅时所有请求是否被拒绝
- [ ] 超额时高优先级被拒、低优先级允许

**数据一致性：**
- [ ] 时间线按 start_date 升序排列
- [ ] 账单天数计算与时间线一致
- [ ] 超额记录与 usage_records 对应
- [ ] audit_logs 记录所有关键操作

**错误处理：**
- [ ] 重复升级同一套餐返回错误
- [ ] 已有待生效降级时再次降级返回错误
- [ ] 升级到更低套餐被拦截（前端判断）
- [ ] 已过期日期正确处理

## 8. 技术栈

- **后端：** Node.js + Express + 内存数据库
- **前端：** React 18 + Vite + React Router
- **日期处理：** date-fns
- **开发工具：** nodemon（后端热重载）

---

*最后更新：2026-05-12*
