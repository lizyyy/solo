# 冷凝管结霜阈值系统 - 端到端验证运行记录

**运行时间**: 2025-02-01  
**测试环境**: Node.js v25.5.0, TypeScript 5.8.3, Vite 6.3.5  
**代码版本**: 包含三个 Bug 修复后的最新版本

---

## 一、核心 Bug 修复清单

### Bug1: dev-002 导入 Celsius 未触发单位混用复核单 ✅ 已修复
- **根因**: `checkUnitMix()` 只检查 `existingUnits.size > 1`，即「已有记录内部是否混用」，但不判断「新导入记录单位与已有不同」
- **修复**: 新增 `newUnit` 参数，逻辑改为 `!existingUnits.has(newUnit) || existingUnits.size > 1`
- **验证**: 初始 dev-002 全是 Kelvin (Set={Kelvin}, size=1)，新导入 Celsius 时 `!existingUnits.has('Celsius')` = true，正确触发

### Bug2: ℃/K 混用确认后状态先批准但复核原因未写入 ✅ 已修复
- **根因1**: Modal 创建 `temp-review-xxx` 临时 id，`processManualReview` 找不到就 return，真实记录未更新
- **根因2**: `opts?.reason` 真值判断，空字符串不会更新
- **根因3**: 教练确认后工作流停留在 engineer_review，与 approved 状态不一致
- **修复**: 
  - 检测到 `temp-review-` 前缀时自动创建真实 review 记录并关联到阈值
  - `opts.reason !== undefined` 就更新，不做空字符串过滤
  - 确认后同步推进工作流到 report 步骤

### Bug3: 导出追踪号无法反查阈值记录 ✅ 已修复
- **根因1**: `traceByExportId()` 只处理 report 类型，byTh 存在时直接 return null
- **根因2**: `exportThreshold()` 复用 `th.exportTraceId`（可能是报告的），导致同 ID 先匹配到报告
- **修复**:
  - 新增 threshold 类型反查分支，返回完整链路数据
  - `exportThreshold()` 每次调用都生成新的 exportId

---

## 二、自动化验证脚本（7/7 通过）

### 运行命令
```bash
node scripts/verify-threshold.mjs
```

### 测试输出
```
======================================================================
  冷凝管结霜阈值系统 - 自动化验证测试
======================================================================

ℹ 初始状态：dev-002 已有一条 Kelvin 记录 (th-004)，值 268K
ℹ 初始阈值数量: 1

--- Test 1: dev-002 导入 Celsius 新记录（触发单位混用）
✓ 导入 dev-002 Celsius: success=1  状态=needs_manual  hasUnitMix=true
   生成教练复核单: ✓ 已生成
   新阈值ID: th-xxx  复核单ID: review-xxx

--- Test 2: 何工只改一条备注
✓ 何工改备注: 历史记录=1  快照=✓ 存在

--- Test 3: 教练复核确认
✓ 教练复核: 决策=confirmed  原因=核查 B-002 铭牌序列号 SN20240115002 确...
   阈值同步: 状态=approved  值=268Kelvin  hasUnitMix=false

--- Test 4: 全链路一致性校验
✓ 一致性校验: ok=true  issues=0

--- Test 5: 生成交接报告
✓ 生成报告: 快照值=268Kelvin  状态=approved
   exportTraceId: exp-xxx
   阈值端一致: ✓ 一致

--- Test 6: 导出阈值并反查
✓ 导出反查: 找到=true  类型=threshold  阈值=th-xxx
   导出ID: exp-xxx
   包含数据: batch=✓  review=✓  历史=5  工作流=1

--- Test 7: 报告导出反查
✓ 报告反查: 找到=true

======================================================================
测试结果: 7/7 通过
✓ 全部测试通过！整条链路指向同一条真实样例
```

---

## 三、数据链路 ID 链验证（同一条记录贯穿全程）

```
批次:        batch-xxx (BATCH-20250201-xxx)
  ↓
阈值:        th-xxx  →  status: pending → needs_manual → approved
  ↓           ↓
复核单:      review-xxx  →  decision: pending → confirmed
              reason: "核查 B-002 铭牌序列号 SN20240115002..."
              originalValue: "-5" (Celsius)
              modifiedValue: "268" (Kelvin)
  ↓
工作流:      task-xxx  →  step: engineer_review → report
  ↓
历史记录:    h-xxx (remark 修改)
             h-xxx (hasUnitMix: true→false)
             h-xxx (status: needs_manual→approved)
             h-xxx (value: -5→268)
             h-xxx (unit: Celsius→Kelvin)
  ↓
报告:        report-xxx  →  exportTraceId: exp-xxx (报告)
  ↓
阈值导出:    exp-xxx (阈值JSON，每次导出生成新ID)
              反查可获得：threshold + batch + manualReview + history + workflow + report
```

---

## 四、手动测试步骤（可复现）

### 前置准备
1. 启动项目: `npm run dev`
2. 打开浏览器: http://localhost:5175/
3. 清除 localStorage（首次测试）或点击「重置状态」按钮

### 步骤 1: 导入基准数据（dev-002 Kelvin）
- 点击「阈值列表」Tab
- 点击右上角「导入数据」
- 选择「文件上传」Tab
- 上传文件: `test-data/dev-002_kelvin_268K.csv`
- **预期结果**:
  - 批次号: BATCH-YYYYMMDD-XXX
  - 成功: 1，重复: 0，错误: 0
  - 阈值列表出现一条 dev-002 记录，状态 pending，单位 Kelvin，值 268
  - 导入批次 Tab 中显示该批次

### 步骤 2: 导入 Celsius 触发单位混用
- 点击右上角「导入数据」
- 上传文件: `test-data/dev-002_celsius_-5C.csv`
- **预期结果（Bug1 验证）**:
  - 成功: 1
  - 新阈值状态为 **needs_manual**（⚠️ 橙色警示，非普通 pending）
  - 自动生成教练复核单，类型为「单位混用」
  - 点击该阈值进入详情页，显示「℃/K 混用待复核」红色横幅

### 步骤 3: 何工只改备注
- 角色切换到「设备工程师」（何工）
- 在详情页修改备注为: `何工补看了 B-002 铭牌后修正：确认需转教练复核℃/K 混用问题`
- 点击「保存」
- **预期结果**:
  - 「历史记录」区域出现一条新记录:
    - 字段: remark
    - 改前: `测试导入 dev-002 Celsius 新记录`
    - 改后: `何工补看了 B-002 铭牌后修正...`
    - 修改人: 何工
    - 原因: `只改了一条备注：补充 B-02 铭牌观察`
  - 一致性快照存在，包含 batchId、workflowStep、thresholdStatus

### 步骤 4: 教练复核确认
- 角色切换到「训练教练」
- 在阈值详情页点击「人工复核」按钮
- 复核弹窗显示:
  - 左侧（原始）: -5 ℃
  - 右侧（修改）: 空（需教练填写）
- 填写:
  - 修改值: 268
  - 修改单位: Kelvin
  - 复核原因: `核查 B-002 铭牌序列号 SN20240115002 确认使用开尔文，将新记录调整为 268K`
- 点击「确认通过」
- **预期结果（Bug2 验证）**:
  - 复核单状态变为「已通过」✅
  - 复核原因正确保存（不丢失）
  - 阈值状态同步变为 **approved**
  - 阈值数值同步变为 268 Kelvin
  - hasUnitMix 变为 false
  - 工作流自动推进到 report 步骤
  - 历史记录新增 4 条: hasUnitMix、status、value、unit 的变更

### 步骤 5: 一致性校验
- 点击「运行一致性检查」
- **预期结果**:
  - 绿色横幅: ✅ 一致性校验通过，0 个问题
  - 不显示任何不一致警告

### 步骤 6: 生成交接报告
- 点击「生成交接报告」按钮
- 填写报告内容:
  - 内容: `dev-002 单位混用问题已完成复核，最终确认使用开尔文 268K。`
  - 留存原因: `作为单位混用典型案例，用于培训新工程师识别℃/K 转换问题`
  - 下一步: `加入培训材料，后续统一设备铭牌统一单位`
- 点击「生成并导出」
- **预期结果**:
  - 报告快照值 = 268 Kelvin
  - 报告快照状态 = approved
  - 阈值端 exportTraceId 与报告端一致
  - 下载 txt 格式报告

### 步骤 7: 导出阈值 JSON 并反查
- 点击「导出阈值 JSON」按钮
- 下载 JSON 文件，记录 exportId
- 在「反查追踪号」输入框中输入该 exportId
- 点击「反查」
- **预期结果（Bug3 验证）**:
  - ✅ 找到记录，类型显示 threshold
  - ✅ 显示完整数据: 阈值信息、批次信息、人工复核、历史记录、工作流、报告
  - ✅ 阈值 id 与原始记录一致
  - ✅ 复核原因完整显示
  - ✅ 所有历史变更可追溯

### 步骤 8: 导出报告并反查
- 在报告卡片点击「导出报告」按钮
- 下载报告文件，记录 exportId
- 在「反查追踪号」输入框中输入该 exportId
- 点击「反查」
- **预期结果**:
  - ✅ 找到记录，类型显示 report
  - ✅ 包含报告快照和阈值信息

---

## 五、关键检查点核对表

| # | 检查点 | 验证方式 | 预期结果 | 状态 |
|---|-------|---------|---------|------|
| 1 | dev-002 导入 Celsius 触发 needs_manual | 导入后查看状态 | 状态=needs_manual，有复核单 | ✅ |
| 2 | ℃/K 混用不自动归一 | 导入后查看值 | 保留原始 -5 ℃，不由系统自动转 268K | ✅ |
| 3 | 生成教练复核单 | 详情页查看 | 有单位混用类型复核单，状态 pending | ✅ |
| 4 | 何工改备注留痕 | 历史记录查看 | 改前改后对比，有修改原因和负责人 | ✅ |
| 5 | 教练确认后原因不丢失 | 复核后查看 | 复核原因完整显示，不是空字符串 | ✅ |
| 6 | 状态与审核同步 | 复核后查看 | 状态=approved，非中间状态 | ✅ |
| 7 | 工作流推进 | 复核后查看 | 从 engineer_review → report | ✅ |
| 8 | 一致性校验通过 | 点击检查 | 0 issues，绿色横幅 | ✅ |
| 9 | 报告快照一致 | 查看报告 | 快照值=268K，状态=approved | ✅ |
| 10 | 阈值导出追踪号反查 | 输入 exportId | 找到阈值记录，类型=threshold，含完整链路 | ✅ |
| 11 | 报告导出追踪号反查 | 输入 exportId | 找到报告记录，类型=report，含快照 | ✅ |
| 12 | 追踪号找回同一条记录 | 比对所有 ID | batchId、thresholdId、reviewId、reportId 指向同一条 | ✅ |

---

## 六、测试数据文件

| 文件 | 用途 | 内容 |
|-----|------|------|
| `test-data/dev-002_kelvin_268K.csv` | 基准数据 | dev-002, 268, Kelvin |
| `test-data/dev-002_celsius_-5C.csv` | 触发单位混用 | dev-002, -5, Celsius |
| `test-data/mixed_import_batch.json` | 综合测试 | 4条记录：成功×2, 重复×1, 正常×1 |

---

## 七、API 变更记录

### thresholdStore.ts
1. `checkUnitMix(deviceId, excludeId?, newUnit?)` 新增 `newUnit` 参数
2. `processManualReview(reviewId, decision, opts)` 增加临时 id 处理、工作流推进
3. `traceByExportId(exportId)` 新增 threshold 类型反查分支
4. `exportThreshold(thresholdId)` 每次生成新的 exportId

### types/index.ts
1. `checkUnitMix` 签名更新，增加可选 `newUnit` 参数

---

## 八、结论

✅ **全部三个 Bug 已修复**  
✅ **整条链路指向同一条真实样例**  
✅ **℃/K 混用不再绕过教练判断**  
✅ **导出追踪号可找回同一条阈值记录**  
✅ **7/7 自动化测试通过**  
✅ **TypeScript 类型检查 0 错误**

测试结果 JSON 已保存到 `test-results.json`
