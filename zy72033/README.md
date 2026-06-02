# 火箭燃料配平赛

课堂实时竞赛工具，用于火箭燃料配平决策模拟教学。

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

默认运行在 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

### 类型检查

```bash
npx tsc --noEmit
```

---

## 核心概念

### 状态机设计

#### 对局状态 (MatchStatus)

| 状态 | 说明 | 可流转至 |
|------|------|----------|
| `setup` | 已创建未开始 | `playing` |
| `playing` | 进行中（有active轮次） | `paused`, `settled` |
| `paused` | 暂停中 | `playing` |
| `settled` | 已结算（可查看） | `locked` |
| `locked` | 已锁定（只读归档） | - |

#### 轮次状态 (RoundStatus)

| 状态 | 说明 | 可流转至 |
|------|------|----------|
| `pending` | 待开始 | `active` |
| `active` | 进行中 | `paused`, `completed` |
| `paused` | 暂停中 | `active` |
| `completed` | 已完成 | - |

---

## 状态流转链路

### 完整比赛流程

```
创建对局 (setup)
    ↓ 点击"开始比赛"
开始第1轮 (playing + round1:active)
    ↓ 提交各队选择 → 检测资源负数 → 弹窗异常确认
    ↓ 点击"结束本轮"
结束第1轮 (round1:completed)
    ↓ 非最后一轮：显示"开始下一轮"按钮
    ↓ 点击"开始下一轮"
开始第2轮 (round2:active)
    ↓ ... 重复 ...
    ↓ 最后一轮结束后
自动进入结算 (settled)
    ↓ 查看结算 / 导出成绩
    ↓ 点击"锁定结算"
锁定归档 (locked)
```

### 关键判断条件

#### 1. 开始下一轮的条件

**位置**: `src/store/useMatchStore.ts` → `startNextRound()`

```typescript
// 必须同时满足：
1. match.status === 'playing'      // 对局在进行中
2. 当前没有 active 的 round         // 上一轮已结束
3. 存在 status === 'pending' 的 round  // 有待开始的轮次
```

**修复记录**: 原逻辑中 `endRound()` 后未自动处理非最后一轮的状态，导致页面按钮状态异常。现已在 `Console.tsx` 中增加判断：

```typescript
// 当对局playing但无active轮次时，显示"开始下一轮"按钮
const activeRound = rounds.find(r => r.status === 'active')
const nextRound = rounds.find(r => r.status === 'pending')

if (match.status === 'playing' && !activeRound && nextRound) {
  // 显示"开始下一轮"按钮
}
```

#### 2. 结束轮次的状态流转

**位置**: `src/store/useMatchStore.ts` → `endRound()`

```typescript
// 结束当前轮次后：
1. 将当前 active round 设为 completed
2. 检查是否为最后一轮：
   ✓ 是最后一轮 → match.status = 'settled'
   ✗ 不是最后一轮 → match.status 保持 'playing'（等待开始下一轮）
```

#### 3. 资源负数异常检测

**位置**: `src/utils/deductionEngine.ts` → `calculateDeduction()`

```typescript
// 触发条件：
resourceRemaining < 0

// 触发后行为：
1. 立即扣除 15 分（最高惩罚）
2. 设置 teamRound.hasAnomaly = true
3. 设置 teamRound.needsConfirmation = true
4. 控制台页面弹出异常确认弹窗
5. 必须点击"确认异常"或"修正"才能继续操作
```

#### 4. 活跃对局切换

**位置**: `src/store/useMatchStore.ts` → `setActiveMatchId()`

```typescript
// 修复前：Console.tsx 直接修改 store 内部状态
useMatchStore.setState({ activeMatchId: match.id })  // ❌ 破坏封装

// 修复后：通过公开方法设置
setActiveMatchId: (id: string | null) => {
  set({ activeMatchId: id })
}
```

---

## 扣分规则引擎

**文件**: `src/utils/deductionEngine.ts`

| 条件 | 扣分 | 说明 |
|------|------|------|
| 偏离最优值 0-10% | 0 | 选择合理 |
| 偏离最优值 10-30% | -5 | 偏差中等 |
| 偏离最优值 >30% | -10 | 偏差严重 |
| 剩余资源 < 0 | -15 | 资源超支（需确认） |
| 超时未提交 | -8 | 本轮弃权 |

**最优燃料值**: 50（固定）

---

## 页面功能说明

### 控制台页面 (Console) - `/`

- 创建新对局（配置：队数、轮数、每轮时长、资源上限）
- 实时录入各队燃料选择
- 暂停/恢复比赛（记录暂停原因和时长）
- 异常确认弹窗（资源负数时阻断操作）
- 投屏补录功能（保留原始备注）
- 样例数据一键加载

### 投影大屏 (MatchScreen) - `/match/:id`

- 大字倒计时显示
- 各组实时状态
- 资源余量进度条
- 异常状态高亮

### 结算页面 (Settlement) - `/match/:id/settlement`

- 逐轮回放扣分明细
- 最终排名汇总
- 导出成绩 CSV
- 导出回放报告 TXT
- 锁定结算归档

### 复盘列表 (Replay) - `/replay`

- 历史对局搜索
- 按状态筛选
- 批量导出功能

### 复盘详情 (ReplayDetail) - `/replay/:id`

- 时间轴逐轮展示
- 完整扣分原因链

---

## 数据导出格式

### CSV 成绩表

**列顺序**:
```
组名, 总得分,
第N轮选择, 第N轮消耗, 第N轮剩余, 第N轮扣分, 第N轮扣分原因,
是否异常, 异常说明, 数据来源, 原始备注
```

**数据来源映射**:
- `normal` → "正常录入"
- `projection_screen` → "投影大屏补录"
- `manual_correction` → "手动修正"

### TXT 回放报告

**像人话的格式**:
```
===== 火箭燃料配平赛 回放报告 =====
对局：xxx
日期：2026/6/2 14:30:00
轮数：3  每轮时长：90秒

── 第 1 轮 ──
  A组：选择燃料 50，消耗资源 40，剩余 60，扣分 0（选择合理，无扣分）
  B组：选择燃料 60，消耗资源 48，剩余 52，扣分 -5（燃料配比偏差中等...）
  ⚠️ 资源为负（-36），需确认：资源超支
  📺 投影大屏补录
  📝 备注：乱备注原样保留

── 最终排名 ──
1. C组 85分 ⚠️ 需人工确认
2. B组 80分 📺投影大屏补录
3. A组 70分
```

---

## 样例数据

**文件**: `src/utils/sampleData.ts`

自动加载3条样例对局：

1. **顺利配平赛·示范** (`locked`) - 全程无异常的标准对局
2. **需人工确认·示范** (`settled`) - 包含资源负数异常的对局
3. **投影大屏补录·旧口径** (`locked`) - 投影大屏补录的旧数据

---

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Vite
- **样式**: TailwindCSS 3
- **状态**: Zustand
- **持久化**: localStorage
- **路由**: React Router

---

## 验证清单

交付前需通过以下验证：

- [ ] `npm install` 安装成功
- [ ] `npm run dev` 启动成功
- [ ] 完整流程跑通：创建 → 开始 → 录入 → 结束 → 下一轮 → 结算
- [ ] 资源负数时弹出异常确认，阻断正常操作
- [ ] 结算页面逐轮扣分明细正确
- [ ] 投屏页面实时状态同步
- [ ] 导出 CSV 文件内容完整
- [ ] 导出 TXT 文件内容完整（像人话）
- [ ] `npx tsc --noEmit` 无类型错误
