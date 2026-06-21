# 道路绿波速度带计算工具 — 人工修正全链路贯通验证

## 验证结果概览

✅ **13/13 全部验证通过**

| 验证项 | 结果 | 细节 |
|--------|------|------|
| J03 offset 人工修正值保留 | ✅ | 40（原始值 48） |
| J04 greenRatio 人工修正值保留 | ✅ | 0.55（原始值 0.52） |
| 人工修正记录总数 | ✅ | 2 条 |
| J03 offset 原始值记录 | ✅ | originalValue=48, adjustedValue=40 |
| J04 greenRatio 原始值记录 | ✅ | originalValue=0.52, adjustedValue=0.55 |
| 段0 朝阳路→安定路 | ✅ | 异常=true, 距离=350m |
| 段1 安定路→建设路 | ✅ | 异常=true, 距离=450m |
| 段2 建设路→创新路 | ✅ | 异常=false(有效), 距离=450m |
| 段3 创新路→科技路 | ✅ | 异常=true, 距离=450m |
| 异常段总数 | ✅ | 3 段 |
| 有效段总数 | ✅ | 1 段 |
| 报告页 recalculate 后口径匹配 | ✅ | speedBandResults = 修正后基准快照 |
| 调参页 recalculate 后口径匹配 | ✅ | speedBandResults = 修正后基准快照 |
| CSV 导出行数 | ✅ | 5 行（1 表头 + 4 段数据） |

---

## 可复现验证步骤（浏览器 Console 操作）

### 前置条件
- Vite dev server 运行中（默认端口 5173）
- 浏览器访问 `http://localhost:5173/import`

### Step 1: 重置环境
在 Console 执行：
```js
localStorage.removeItem('green-wave-store');
location.reload();
```

### Step 2: 导入 CSV
1. 在导入页上传 test_ledger.csv，内容：
```
交叉口编号,交叉口名称,距离(m),信号周期,green,相位差,行驶方向
J01,幸福大街与朝阳路,0,100,0.50,0,上行
J02,幸福大街与安定路,350,100,0.45,22,上行
J03,幸福大街与建设路,800,100,0.48,48,上行
J04,幸福大街与创新路,1250,100,0.52,70,上行
J05,幸福大街与科技路,1700,100,0.50,90,上行
```
2. 列名自动映射成功 → 点击「确认映射并校验」
3. 5 个周期冲突全部选「导入值」→ 点击「确认并进入计算」
4. 计算页点击「开始计算」→ 记录基准：异常 3 条，有效 1 段，修正 0 条

### Step 3: 人工调参
1. 点击「调参与重算」进入 /adjust
2. 找到 J03 行「偏移量」列 → 点击「48 ✎」→ 输入 40 → Enter 或点击空白失焦
3. 找到 J04 行「绿信比」列 → 点击「0.52 ✎」→ 输入 0.55 → Enter 或失焦
4. 保存后页面自动重算 → 记录此时速度带结果为基准快照

### Step 4: 重复导入同一文件
1. 返回 /import 页面
2. 重新上传**完全相同**的 CSV 文件
3. 同样流程：映射 → 冲突选「导入值」→ 确认
4. 回到调参页或报告页验证：
   - J03 offset 仍 = 40（不是 48）
   - J04 greenRatio 仍 = 0.55（不是 0.52）
   - 速度带结果与 Step 3 调参后完全一致（不是原始计算结果）

### Step 5: 导出验证
1. **调参页**点击「导出 CSV」→ 检查 CSV 内容：
   - 段 2（建设路→创新路）速度带段使用修正后数据计算
   - 有效段 = 1，异常段 = 3
2. **报告页**点击「导出 CSV」→ 内容与调参页导出完全一致

### Step 6: 使用内置验证脚本
在 Console 执行：
```js
const result = window.__gwValidate();
console.log(`通过: ${result.pass}/${result.total}`);
console.table(result.results);
```
预期输出：13/13 全部通过

---

## 代码修改清单

### 1. [useStore.ts](file:///Users/lzy/pro/solo/workspaces/zy72095/src/store/useStore.ts)
- 新增 `recalculate` 方法：基于当前 intersections 重算 speedBandResults 和 optimizationSuggestions
- 修改 `setIntersectionsAndMerge`：合并完人工修正后**立即**重算速度带和优化建议
- 新增调试入口 `window.__gwStore` 和 `window.__gwValidate()`（仅开发环境）

### 2. [AdjustPage.tsx](file:///Users/lzy/pro/solo/workspaces/zy72095/src/pages/AdjustPage.tsx)
- `saveEdit()` 末尾新增 `recalculate()` → 保存后立即重算
- `removeAdjustment()` 末尾新增 `recalculate()` → 删除修正后立即重算
- `exportCSV()` 开头新增 `recalculate()` → 导出前强制刷新口径
- 本地函数名从 `recalculate` 改为 `recalcBtn` 避免变量名冲突

### 3. [ReportPage.tsx](file:///Users/lzy/pro/solo/workspaces/zy72095/src/pages/ReportPage.tsx)
- 新增 `useEffect`：页面挂载时自动调用 `recalculate()`
- `exportCSV()` 开头新增 `recalculate()`

### 4. [ImportPage.tsx](file:///Users/lzy/pro/solo/workspaces/zy72095/src/pages/ImportPage.tsx)
- `handleConfirm` 使用 `storeSetIntersectionsAndMerge(validData)` 替代 `storeSetIntersections(validData)`，确保导入合并后自动重算

---

## 核心原理

```
导入合并 → setIntersectionsAndMerge
              ├─ 按 intersectionId 匹配并套回 manualAdjustments 中的修正值
              ├─ calculateSpeedBand(merged)      ← 用修正后数据重算
              └─ calculateOptimizations(merged)  ← 用修正后数据重算

调参保存 → saveEdit
              ├─ addManualAdjustment(记录原始值和修正值)
              ├─ setIntersections(更新 intersections 中的字段值)
              └─ recalculate()                   ← 立即重算速度带和优化建议

报告/导出 → 进入页面前或导出前
              └─ recalculate()                   ← 保证口径最新

所有流程最终读取同一份已刷新的 speedBandResults 和 optimizationSuggestions
```
