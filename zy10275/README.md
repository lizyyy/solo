# 🏸 羽毛球馆约球拼场台

一个完整的羽毛球馆拼场管理系统，支持开拼场、加人、候补、退场、确认到场和动态费用分摊结算。

## 功能特性

### 后端功能
- ✅ 场次管理（创建、取消、完成结算）
- ✅ 球员管理（添加、取消、候补转正）
- ✅ **数据持久化** - 数据自动保存到 JSON 文件，重启不丢失
- ✅ **动态费用调整** - 人数变化时自动重新计算人均费用
- ✅ **完整结算闭环** - 完成场次时自动生成结算单，计算多退少补
- ✅ **费用调整记录** - 记录每一次费用变动的原因和明细
- ✅ **候补自动转正机制**
- ✅ **人数不足自动取消** - 可配置开场前X分钟人数不足自动取消
- ✅ **会员折扣计算** - 会员享受折扣，非会员原价
- ✅ **退款管理** - 按当前实际应付金额退款

### 前端功能
- ✅ 场次列表展示（带进度条）
- ✅ 场次详情页
- ✅ **费用调整记录展示** - 显示每一次人均费用变化
- ✅ **结算结果展示** - 显示每人应退或应补金额
- ✅ 球员卡片展示（已报名、候补、已取消/退款）
- ✅ 筛选功能（日期、场地、状态）
- ✅ 数据导出 CSV
- ✅ 快速添加球员（支持会员选择）
- ✅ 操作反馈 Toast
- ✅ 人数不足检查按钮
- ✅ 自动取消规则提示

## 核心业务逻辑

### 费用计算规则（双口径设计）

#### 1. 报名时预估费用（固定不变）
```
个人预估费用 = (总费用 / 最大人数) × 会员折扣
- 会员默认 9 折，普通用户无折扣
- 此金额存入 originalPaidAmount，作为退款基准
```

#### 2. 实时动态调整费用
```
当前人均 = 总费用 / MAX(当前确认人数, 最低人数)
个人当前费用 = 当前人均 × 会员折扣
- 人数变化时自动触发重新计算
- 调整记录会保存到 feeAdjustments 数组
```

#### 3. 最终结算（多退少补）
```
点击"完成并结算"时触发：
- 计算最终实际人均费用
- 对比每人已付金额与应付金额
- 生成结算单，标记每人应退或应补金额
调整金额 = 最终应付 - 已付金额
  - 正数 → 补收费用（用户需补交）
  - 负数 → 退款金额（应退还给用户）
```

### 候补转正机制
- 当场次满员后，新加入的球员自动进入候补队列
- 当已确认球员取消报名时，候补队列第一名自动转正
- 候补转正会触发费用重新计算
- 候补队列按加入时间排序，先进先出

### 人数不足自动取消
- 创建场次时可配置 `autoCancelIfNotEnough` 和 `cancelThresholdMinutes`
- 后台每分钟自动检查所有开放场次
- 当距离开场不足 `cancelThresholdMinutes` 分钟，且确认人数 < `minPlayers` 时自动取消
- 前端也提供手动检查按钮

### 状态流转

**场次状态：**
- 开放中 (OPEN) → 可报名
- 已满 (FULL) → 新加入进入候补
- 已取消 (CANCELLED) → 场次关闭
- 已完成 (COMPLETED) → 场次已结算

**球员状态：**
- 已确认 (CONFIRMED) → 正常报名
- 候补 (WAITLIST) → 候补队列中
- 已取消 (CANCELLED) → 待退款
- 已退款 (REFUNDED) → 已完成退款

## 数据结构说明

### 场次数据结构
```typescript
{
  id: string,
  courtNumber: number,
  date: string,
  startTime: string,
  endTime: string,
  maxPlayers: number,
  minPlayers: number,
  totalFee: number,
  status: SessionStatus,
  players: Player[],
  waitlist: Player[],
  feeAdjustments: FeeAdjustment[],  // 费用调整历史
  settlement?: SessionSettlement,    // 结算结果
  referenceFeePerPerson?: number     // 当前参考人均
}
```

### 费用调整记录
```typescript
{
  id: string,
  adjustedAt: string,
  reason: 'player_added' | 'player_cancelled' | 'waitlist_promoted',
  playerCountBefore: number,
  playerCountAfter: number,
  feePerPersonBefore: number,
  feePerPersonAfter: number,
  description: string
}
```

### 结算单
```typescript
{
  isSettled: boolean,
  settledAt: string,
  finalPlayerCount: number,
  totalFee: number,
  actualFeePerPerson: number,
  playerSettlements: [
    {
      playerId: string,
      playerName: string,
      originalFee: number,
      finalFee: number,
      adjustmentAmount: number,
      refundDue: number,           // 应退金额
      additionalPaymentDue: number, // 应补金额
      isMember: boolean,
      memberDiscount: number
    }
  ]
}
```

## 技术栈

### 后端
- Node.js
- Express
- TypeScript
- UUID
- JSON 文件持久化

### 前端
- React 18
- TypeScript
- Vite
- React Router

## 快速开始

### 安装依赖

```bash
# 安装根目录依赖（用于并发启动）
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 启动项目

#### 方式一：同时启动前后端（推荐）
```bash
npm run dev
```

#### 方式二：分别启动
```bash
# 启动后端 (端口 3001)
cd server && npm run dev

# 启动前端 (端口 3000)
cd client && npm run dev
```

### 访问应用
打开浏览器访问: http://localhost:3000

## 测试用例流程

### 核心流程测试（满员→退场→补位→结算）

1. **进入任一场次详情页**
2. **添加4名球员**（达到maxPlayers=4）
   - 球员A（非会员）→ 已付 ¥30
   - 球员B（会员）→ 已付 ¥27
   - 球员C（非会员）→ 已付 ¥30
   - 球员D（会员）→ 已付 ¥27
   - ✅ 状态变为"已满"
3. **加第5人** → 自动进入候补队列 ✅
4. **取消球员A**
   - ✅ 候补第1人自动转正
   - ✅ 费用调整记录显示变化
   - ✅ 场次保持"已满"状态
5. **无候补时取消1人**
   - ✅ 活跃人数变为 3/4
   - ✅ 状态从"已满"→"报名中"
   - ✅ 人均费用自动调整上升
   - ✅ 费用调整记录新增一条
6. **再添加1人**
   - ✅ 直接进入报名，不会候补
   - ✅ 人均费用自动调整下降
7. **点击"完成并结算"**
   - ✅ 生成结算单
   - ✅ 显示每人应退或应补金额
   - ✅ 场次状态变为"已完成"
   - ✅ 操作按钮禁用，数据锁定

### 数据持久化测试
1. 进行任意操作（添加球员、取消、结算等）
2. 重启后端服务器
3. 刷新页面，验证所有数据仍然存在 ✅

## API 接口

### 场次相关
- `GET /api/sessions` - 获取所有场次（含参考人均）
- `GET /api/sessions/:id` - 获取场次详情（含参考人均）
- `POST /api/sessions` - 创建新场次
- `POST /api/sessions/:id/cancel` - 取消场次
- `POST /api/sessions/:id/complete` - 完成并结算场次
- `POST /api/sessions/:id/check-auto-cancel` - 检查是否需要自动取消

### 球员相关
- `POST /api/sessions/:id/players` - 添加球员（自动触发费用调整）
- `POST /api/sessions/:id/players/:playerId/confirm` - 确认到场
- `POST /api/sessions/:id/players/:playerId/cancel` - 取消报名（自动触发费用调整和候补转正）
- `POST /api/sessions/:id/players/:playerId/refund` - 确认退款

### 会员相关
- `GET /api/members` - 获取所有会员

## 样例数据

系统启动时会自动创建样例数据：
- 8 个样例会员（含普通会员和 VIP 会员）
- 3 个场次（今天、明天不同场地）

你可以通过上面的测试流程验证所有功能。

## 项目结构

```
.
├── server/                 # 后端代码
│   ├── src/
│   │   ├── index.ts       # 入口文件
│   │   ├── types.ts       # 类型定义
│   │   ├── store.ts       # 数据存储和业务逻辑核心
│   │   └── routes.ts      # API 路由
│   ├── package.json
│   └── tsconfig.json
├── client/                 # 前端代码
│   ├── src/
│   │   ├── main.tsx       # 入口文件
│   │   ├── App.tsx        # 主应用
│   │   ├── index.css      # 全局样式
│   │   ├── types.ts       # 类型定义
│   │   ├── api.ts         # API 封装
│   │   └── pages/         # 页面组件
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── data/                   # 数据存储目录（自动创建）
│   ├── sessions.json      # 场次数据
│   └── members.json       # 会员数据
├── package.json
└── README.md
```
