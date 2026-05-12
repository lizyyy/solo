# 家电上门安装预约改约 API 系统

一个完整的家电上门安装预约改约管理系统，围绕安装预约改期时师傅排班、配件占用、客户确认和超时赔付展开。

## 功能特性

### 核心业务流程
- **订单管理**: 创建、查询、推进订单状态
- **师傅排班**: 分配师傅、检查可用性、工作量统计
- **配件管理**: 库存查询、占用分配、释放回收
- **预约确认**: 发送确认、超时处理、幂等确认
- **改约管理**: 客户改约、师傅改派、次数限制
- **赔付管理**: 超时赔付、赔付审批、支付处理
- **人工修正**: 记录差异、留痕操作、操作者追踪
- **报告导出**: 订单时间线、配件占用、赔付原因、师傅工作量

### 业务规则
- ✅ 客户改约次数限制 (默认3次)
- ✅ 已完工订单不能改期
- ✅ 配件占用在改约时自动释放并重分配
- ✅ 师傅迟到超过30分钟自动触发赔付
- ✅ 所有操作支持幂等性
- ✅ 人工修正记录前后差异和操作者

## 技术栈

- **运行时**: Node.js 16+
- **Web框架**: Express.js
- **数据存储**: 内存数据库 (便于演示)
- **工具库**: uuid (ID生成), moment (时间处理), joi (数据验证), cors (跨域)

## 项目结构

```
.
├── src/
│   ├── config/
│   │   └── constants.js        # 常量配置 (状态、规则参数)
│   ├── stores/
│   │   └── memoryStore.js      # 内存数据库
│   ├── services/
│   │   ├── orderService.js     # 订单服务 (核心业务逻辑)
│   │   ├── technicianService.js # 师傅服务
│   │   ├── partsService.js     # 配件服务
│   │   ├── eventService.js     # 事件服务
│   │   └── reportService.js    # 报告服务
│   ├── routes/
│   │   ├── orders.js           # 订单 API 路由
│   │   ├── technicians.js      # 师傅 API 路由
│   │   ├── parts.js            # 配件 API 路由
│   │   └── reports.js          # 报告 API 路由
│   └── server.js               # 服务器入口
├── scripts/
│   └── demo.js                 # 演示脚本 (覆盖所有场景)
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 运行演示脚本 (无需启动服务器)

```bash
npm run demo
```

演示脚本将按顺序执行以下场景：
1. **正常预约流程**: 创建订单 → 分配师傅 → 分配配件 → 客户确认 → 开始服务 → 完成服务
2. **客户改期流程**: 正常预约后客户申请改期 → 审批 → 重新确认
3. **师傅改派流程**: 师傅临时有事 → 申请改派 → 换师傅
4. **配件不足场景**: 耗尽配件库存 → 新订单分配配件失败
5. **超时赔付场景**: 师傅迟到45分钟 → 自动触发赔付 → 处理支付

## API 接口

### 订单接口

#### 创建订单
```
POST /api/orders
Content-Type: application/json
X-Idempotency-Key: <可选，用于幂等控制>
X-Operator: <可选，操作者标识>

{
  "customerId": "C001",
  "customerName": "张三",
  "customerPhone": "13900139001",
  "address": "北京市朝阳区XX小区1号楼101",
  "applianceType": "空调",
  "applianceModel": "格力 KFR-35GW",
  "partCodes": ["AIRCON-BRACKET", "AIRCON-PIPE"]
}
```

#### 查询订单列表
```
GET /api/orders?status=confirmed&customerId=C001&technicianId=<id>
```

#### 查询订单详情
```
GET /api/orders/:id
```

返回完整订单信息，包含：
- 订单基本信息
- 改约历史
- 赔付历史
- 完整事件时间线

#### 分配师傅
```
POST /api/orders/:id/assign-technician
{
  "technicianId": "xxx",
  "startTime": "2026-05-14T09:00:00.000Z",
  "endTime": "2026-05-14T11:00:00.000Z"
}
```

#### 分配配件
```
POST /api/orders/:id/allocate-parts
```

#### 发送预约确认
```
POST /api/orders/:id/send-confirmation
```

#### 客户确认预约
```
POST /api/orders/:id/confirm
{
  "confirmationId": "xxx"
}
```

#### 申请改约
```
POST /api/orders/:id/reschedule
{
  "type": "customer",           // customer | technician | system
  "reason": "客户当天有事",
  "newStartTime": "2026-05-15T14:00:00.000Z",
  "newEndTime": "2026-05-15T16:00:00.000Z",  // 可选
  "newTechnicianId": "xxx"                  // 可选，不指定则自动分配
}
```

#### 审批改约
```
POST /api/orders/:id/reschedule/:rescheduleId/approve
```

#### 开始服务
```
POST /api/orders/:id/start
{
  "actualStartTime": "2026-05-14T09:45:00.000Z"  // 可选，不填用当前时间
}
```
*迟到超过30分钟会自动触发赔付*

#### 完成服务
```
POST /api/orders/:id/complete
{
  "actualEndTime": "2026-05-14T11:00:00.000Z"  // 可选
}
```

#### 取消订单
```
POST /api/orders/:id/cancel
{
  "reason": "客户不再需要安装"
}
```

#### 人工修正
```
POST /api/orders/:id/manual-correction
X-Operator: admin_user

{
  "updates": {
    "address": "修正后的地址"
  },
  "reason": "客户反馈地址错误"
}
```
*人工修正会记录前后差异和操作者*

#### 订单报告
```
GET /api/orders/:id/report           # JSON格式
GET /api/orders/:id/report?format=text  # 文本格式
```

### 师傅接口

#### 查询师傅列表
```
GET /api/technicians
```

#### 查询师傅详情
```
GET /api/technicians/:id
```

#### 检查师傅可用性
```
POST /api/technicians/:id/check-availability
{
  "startTime": "2026-05-14T09:00:00.000Z",
  "endTime": "2026-05-14T11:00:00.000Z"
}
```

#### 师傅工作量统计
```
GET /api/technicians/:id/workload?startDate=2026-05-01&endDate=2026-05-31
```

### 配件接口

#### 查询配件库存
```
GET /api/parts
```

#### 检查配件可用性
```
POST /api/parts/check-availability
{
  "partCodes": ["AIRCON-BRACKET", "TV-MOUNT"]
}
```

### 报告接口

#### 仪表盘汇总报告
```
GET /api/reports/dashboard?startDate=2026-05-01&endDate=2026-05-31
```

包含：
- 订单统计 (总数、完成数、取消数、改约率)
- 延迟统计 (延迟订单数、总延迟分钟、平均延迟)
- 赔付统计 (总笔数、总金额)
- 师傅工作量
- 配件库存状态

## 业务规则说明

### 改约规则
1. **客户改约限制**: 最多3次 (可在 constants.js 中配置 `MAX_CUSTOMER_RESCHEDULES`)
2. **师傅改约限制**: 无次数限制，但需记录原因
3. **已完工订单**: 不能改期或取消
4. **改约时的资源处理**:
   - 原师傅时间自动释放
   - 原配件自动释放
   - 新师傅时间重新分配
   - 新配件重新检查并分配

### 赔付规则
1. **触发条件**: 师傅实际开始时间比预约时间晚超过30分钟 (`LATE_THRESHOLD_MINUTES`)
2. **赔付金额**: 每小时50元 (`COMPENSATION_RATE`)，按小时向上取整
   - 迟到31分钟: ¥50
   - 迟到65分钟: ¥100
3. **赔付流程**: 自动发起 → 待审批 → 已支付

### 配件管理规则
1. **分配时机**: 师傅分配后、订单确认前
2. **释放时机**:
   - 订单完成
   - 订单取消
   - 订单改约审批通过
3. **库存检查**: 按配件编码精确匹配，可用数量 = 总数量 - 已分配数量

### 幂等性规则
1. 创建订单: 使用 `X-Idempotency-Key` Header
2. 确认预约: 同一确认ID多次调用返回相同结果
3. 取消订单: 已取消的订单再次取消返回幂等结果
4. 改约审批: 已审批的改约再次审批返回幂等结果
5. 赔付处理: 已处理的赔付再次处理返回幂等结果

## 主要演示路径

### 路径1: 正常预约 (成功路径)
```
创建订单 → 分配师傅 → 分配配件 → 发送确认 → 客户确认 → 开始服务 → 完成服务
     ↓          ↓          ↓          ↓          ↓          ↓          ↓
  created  tech_assigned  parts_allo  confirming  confirmed  in_prog   completed
```

### 路径2: 客户改期 (改约路径)
```
创建订单 → 分配师傅 → 分配配件 → 发送确认 → 客户确认
                                                    ↓
                                              申请改约 (rescheduling)
                                                    ↓
                                               审批改约
                                                    ↓
                                              重新分配师傅/配件
                                                    ↓
                                               发送新确认 → 确认 → 开始 → 完成
```

### 路径3: 超时赔付 (赔付路径)
```
创建订单 → ... → 客户确认 → 开始服务 (迟到45分钟)
                                           ↓
                                    自动触发赔付 (¥50)
                                           ↓
                                      财务审批支付
                                           ↓
                                         完成服务
```

## 失败路径演示

### 失败路径1: 配件不足
```
创建订单 → 分配师傅 → 分配配件 (失败: 库存不足)
```
- 订单状态停留在 `technician_assigned`
- 错误码: `PARTS_ALLOCATION_FAILED`
- 需要补货或换用其他配件

### 失败路径2: 已完工订单改期
```
已完工订单 → 申请改期 (失败: 已完工订单不能改期)
```
- 错误码: `ORDER_COMPLETED`
- 只能创建新订单

### 失败路径3: 超过改约次数
```
客户已改约3次 → 再次申请改期 (失败: 超过次数限制)
```
- 错误码: `MAX_REACHED`
- 需要特殊审批或创建新订单

### 失败路径4: 确认超时
```
发送确认 → 客户24小时内未确认 (超时)
```
- 错误码: `CONFIRMATION_TIMEOUT`
- 需要重新发送确认

## 内置样例数据

### 师傅 (启动时自动初始化)
| 师傅 | 电话 | 技能 |
|------|------|------|
| 张师傅 | 13800138001 | 空调、洗衣机 |
| 李师傅 | 13800138002 | 空调、冰箱 |
| 王师傅 | 13800138003 | 电视、洗衣机 |
| 赵师傅 | 13800138004 | 空调、电视、冰箱 |

### 配件 (启动时自动初始化)
| 编码 | 名称 | 库存 |
|------|------|------|
| AIRCON-BRACKET | 空调支架 | 10 |
| AIRCON-PIPE | 空调铜管 | 20 |
| WASHING-MACHINE-HOSE | 洗衣机进水管 | 15 |
| REFRIGERATOR-STAND | 冰箱底座 | 5 |
| TV-MOUNT | 电视挂架 | 8 |

## 订单状态流转

```
created → technician_assigned → parts_allocated → confirming → confirmed
                                                              ↓
                                                        in_progress
                                                              ↓
                                                          completed
                                                              
任意状态 (除completed) → rescheduling → confirming (改约后重新确认)
任意状态 (除completed) → cancelled
```

## 配置参数 (constants.js)

```javascript
MAX_CUSTOMER_RESCHEDULES = 3;      // 客户最大改约次数
CONFIRMATION_TIMEOUT_HOURS = 24;    // 确认超时时间(小时)
LATE_THRESHOLD_MINUTES = 30;        // 迟到赔付阈值(分钟)
COMPENSATION_RATE = 50;             // 每小时赔付金额(元)
```

## 验证业务闭环

通过以下输出判断业务是否闭环：

1. **订单履约时间线**: `GET /api/orders/:id/report?format=text`
   - 显示完整事件流
   - 可追溯每个状态变化

2. **配件占用变化**: `GET /api/parts`
   - 分配订单后: 可用数量减少
   - 完成/取消/改约后: 可用数量恢复

3. **赔付原因**: 订单报告中的 `compensationHistory`
   - 显示赔付触发原因
   - 显示赔付金额和状态

4. **师傅工作量**: `GET /api/technicians/:id/workload`
   - 显示各时间段任务数
   - 显示总工作时长

## 运行测试

```bash
# 运行完整演示
npm run demo

# 启动 API 服务
npm start

# 开发模式 (自动重启)
npm run dev
```

## 注意事项

1. **内存数据库**: 重启服务后数据会清空，适合演示和测试
2. **时间格式**: 所有时间字段使用 ISO 8601 格式 (如 `2026-05-14T09:00:00.000Z`)
3. **时区**: 系统使用 UTC 时间，前端展示时需转换为本地时区
4. **幂等性**: 生产环境建议使用 Redis 存储幂等键，设置过期时间
