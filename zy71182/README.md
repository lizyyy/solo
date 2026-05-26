# Impose Master · 印刷排产拼版游戏

面向印刷厂新人的 2D 策略模拟器，通过真实的印刷行业规则，在限定回合内完成订单拼版、上料、调墨、排产，平衡纸张浪费、颜色切换成本、交期超时三大核心难题。

## 快速开始

```bash
pnpm install
pnpm run dev
```

开发服务器默认在 [http://localhost:5173/](http://localhost:5173/)。

## 游戏入口与核心流程

**入口页面**：[`/`](http://localhost:5173/) 主菜单，三档难度卡片 + 历史回放列表。

**核心流程**：
1. 选择关卡（学徒 / 领机 / 车间主任）进入对局。
2. 左侧点击订单选中 → 中间"拼版到选中版" → 订单会被自动旋转并放入合适位置。
3. 点击上墨按钮给当前版指定色组（色组与订单不一致会印废，换色有成本）。
4. 点击"结束回合"触发印刷与结算：
   - 版上已拼版的订单会被印刷（色组匹配才成功）。
   - 交期超时的订单会被罚款。
   - 已印版的纸张成本 + 浪费成本一次性扣除（仅扣一次，不会跨天重复）。
5. 到达目标回合后进入结算页，可导出 CSV 报告或查看历史回放。

## 三档难度规则差异

| 档位 | 开数 | 色组 | 回合 | 最大订单 | 换色成本 | 逾期罚款 | 最低质量 |
|-----|------|------|------|---------|----------|----------|----------|
| 学徒班 | 大对开 | 单黑 K | 8 天 | 4 | 0 | ¥80 | 70 |
| 领机班 | 大对开 + 四开 | 单黑 + 双色 | 12 天 | 6 | ¥60 | ¥120 | 75 |
| 车间主任 | 三种开数 | CMYK + 专色 | 16 天 | 8 | ¥120 | ¥180 | 80 |

## 关键规则说明

- **拼版**：订单会尝试 0° / 90° 两种方向，按左上扫描线放入第一个空位。
- **色组匹配**：版的 ink 必须与订单 colors 完全一致，否则印废扣分。
- **纸张浪费**：每张版印刷后仅结算一次，浪费面积 ÷ 10000 × wastePenaltyPer + 基础纸张成本。
- **质量门槛**：订单 quality 低于关卡 minQuality 时，即使色组匹配也会失败。
- **历史回放**：每局结束后自动存入 localStorage，最多保留最近 20 局，可在首页点击回放。

## 目录与代码参考

- 主路由与页面：[App.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/App.tsx)
- 游戏状态机：[store.ts](file:///Users/lzy/pro/solo/workspaces/zy71182/src/game/store.ts)
- 核心结算与拼版：[engine.ts](file:///Users/lzy/pro/solo/workspaces/zy71182/src/game/engine.ts)
- 数据与关卡定义：[types.ts](file:///Users/lzy/pro/solo/workspaces/zy71182/src/game/types.ts)
- 2D 拼版画布：[ImpositionCanvas.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/components/ImpositionCanvas.tsx)
- 订单队列 / 资源面板 / 操作条：[OrderQueue.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/components/OrderQueue.tsx)、[ResourcePanel.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/components/ResourcePanel.tsx)、[ActionBar.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/components/ActionBar.tsx)
- 主菜单 / 对局 / 回放：[Home.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/pages/Home.tsx)、[Game.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/pages/Game.tsx)、[Replay.tsx](file:///Users/lzy/pro/solo/workspaces/zy71182/src/pages/Replay.tsx)

## 验证流程

```bash
pnpm run check   # TypeScript 类型检查
pnpm run build   # 生产构建
pnpm run dev     # 启动开发服务器后，打开首页选择关卡即可验证流程
```

典型验证路径：
1. 首页 → 选择"学徒班" → 进入对局。
2. 选中左侧第一个订单 → 点击"拼版到选中版" → 画布显示订单。
3. 点击"单黑 K"上墨 → 点击"结束回合"。
4. 观察日志：印刷完成加分 + 纸张+浪费扣分仅出现一次。
5. 继续"结束回合"直到结算 → 查看分数、报告导出、历史回放入口。
