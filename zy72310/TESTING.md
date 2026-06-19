# 概率抽样审计计划 — 导出样本一致性测试说明

**测试目标**：验证在「导入边界值说明 → 处理 S001 沿用 / S003&S005 按权重表修正 → 生成报告 → 导出 JSON」完整工作流后，
导出的样本数据（尤其是 SA002、SA003、SA006、SA015 这四个待复核样本）完整携带：
- 最终判定 `finalJudgement`
- 判定快照 `judgements`（原始边界 / 权重表 / 生效边界 / 最终）
- 待复核类型 `pendingType`、待复核原因 `pendingReason`、下一步找谁 `reviewHandler`
- 操作历史 `operationLog`
- 冲突审计 `conflictAudit`（如适用）

并且证明：`effectiveBoundary.currentBoundary === conflictAuditTrail.finalBoundary`（S001/S003/S005）；
沿用边界值说明后，边界±2 范围内样本不会被提前归为 normal/borderline。

---

## 一、依赖与环境

- Python ≥ 3.7（内置 `http.server` + `json`，无需 pip 安装）
- 现代浏览器（Chrome / Edge / Safari，能加载 `index.html` 即可）
- 项目目录即工作根，`index.html`、`styles.css`、`app.js`、`verify_export.py` 在同一目录下。

## 二、启动项目

```bash
cd /Users/lzy/pro/solo/workspaces/zy72310
python3 -m http.server 8000 --bind 127.0.0.1
# 浏览器访问 http://127.0.0.1:8000/index.html
```

## 三、完整复现步骤（手工操作路径）

| 步骤 | 操作 | 预期 |
|------|------|------|
| 1 | 在第一步点「选择文件导入」或直接触发 `importBoundaryValues()` | 6 项边界值导入；`边界值预览表` 显示「首次导入」标记；右侧「操作历史」增加 1 条。 |
| 2 | 点「下一步：补看评分权重表 →」 | 自动检测出 3 处冲突（S001/60 vs 65，S003/70 vs 72，S005/65 vs 68），每条冲突的「合格阈值」不再是 `undefined`。 |
| 3 | 处理 S001：选「沿用边界值说明」，处理说明填「与业务组确认语文保持原始阈值」，下一步填「转交学生助教复核边界±2范围的样本」，确认。 | 冲突标记为已处理；操作历史新增；`AppState.effectiveBoundary.S001.currentBoundary === 60`，`sourceLabel` 改为「沿用边界值说明（经人工确认）」。 |
| 4 | 处理 S003：选「按评分权重表修正 70→72」，处理说明填「英语听力按群内补发评分权重表修正」，下一步填「自动按新阈值重算」。 | `effectiveBoundary.S003.currentBoundary === 72`。 |
| 5 | 处理 S005：选「按评分权重表修正 65→68」，处理说明填「化学方程式按最新补录材料修正」，下一步填「样本已按新阈值重算」。 | `effectiveBoundary.S005.currentBoundary === 68`。 |
| 6 | 点「下一步：更新边界样本报告 →」 | 生成 18 条样本报告；2 个负数样本（SA006/SA015）和 2 个边界±2 范围样本（SA002/SA003）标记为 **待复核**（橙色徽章）。 |
| 7 | 点左侧「📤 导出一致性检查」 | 检查页展示「通过」，逐条列出 SA002/SA003/SA006/SA015 的字段断言。 |
| 8 | 点「📤 导出报告」 | 下载一个 `概率抽样审计报告_YYYY-MM-DD.json`，文件结构符合下述第四节。 |

## 四、导出文件结构（schemaVersion: 2.0）

```jsonc
{
  "schemaVersion": "2.0",
  "exportTime": "2026/6/19 15:25:07",
  "summary": {
    "totalSamples": 18,
    "totalBoundaries": 6,
    "conflictCount": 3,
    "resolvedCount": 3,
    "finalCounts": { "normal": 9, "borderline": 3, "pending": 4, "abnormal": 2, "missing": 0 },
    "pendingBreakdown": { "negative_value": 2, "boundary_range": 2, "other": 0 }
  },
  "effectiveBoundaries": [{
    "boundaryId": "S001", "originalBoundary": 60, "currentBoundary": 60,
    "sourceLabel": "沿用边界值说明（经人工确认）", "auditTrail": [ /* ... */ ]
  }],
  "conflictAuditTrail": [{
    "id": "S001", "originalBoundary": 60, "finalBoundary": 60, "needReview": true,
    "reason": "与业务组确认语文保持原始阈值",
    "nextStep": "转交学生助教复核边界±2范围的样本"
  }],
  "sampleData": [{
    "sampleId": "SA002",
    "finalJudgement": "pending",
    "isPending": true,
    "pendingType": "boundary_range",
    "pendingReason": "沿用边界值说明(阈值=60)，原始值(62)落在边界±2复核范围[58, 62]内，按处理说明(与业务组确认语文保持原始阈值)需留交学生助教复核后才能最终判定。",
    "reviewHandler": "学生助教（边界样本复核）",
    "operationLog": "原始边界(60)判定：normal | 权重表(65)判定：abnormal | 沿用边界值标记，值(62)在边界±2范围[58,62]内...",
    "judgements": {
      "byOriginalBoundary": "normal",
      "byWeightTable": "abnormal",
      "byEffectiveBoundary": "normal",
      "final": "pending"
    },
    "conflictAudit": {
      "choice": "沿用边界值说明（60 → 保持60）",
      "originalBoundary": 60,
      "weightBoundary": 65,
      "finalBoundary": 60,
      "reason": "与业务组确认语文保持原始阈值",
      "nextStep": "转交学生助教复核边界±2范围的样本",
      "needReview": true
    },
    "reportIncluded": true
  }],
  "pendingSamples": [ /* 仅 pending 样本的精简清单，方便学生助教直接查收 */ ],
  "negativeSamples": [ /* 负数样本的富集清单，含 finalJudgement / pendingReason / reviewHandler / operationLog */ ]
}
```

### 四个关键样本的期望字段

| 样本 | 值 | 触发原因 | finalJudgement | pendingType | reviewHandler |
|------|----|----------|----------------|-------------|---------------|
| SA002 | 62 | 语文 S001，沿用边界值 60，边界±2 范围 [58, 62] 内 | `pending` | `boundary_range` | 学生助教（边界样本复核） |
| SA003 | 58 | 语文 S001，沿用边界值 60，边界±2 范围 [58, 62] 内 | `pending` | `boundary_range` | 学生助教（边界样本复核） |
| SA006 | -3 | 数学 S002，负数被旧版表标为缺失 | `pending` | `negative_value` | 学生助教（负数样本复核组） |
| SA015 | -1 | 化学 S005（已修正为 68），负数被旧版表标为缺失 | `pending` | `negative_value` | 学生助教（负数样本复核组） |

四个样本必须同时出现在 `sampleData`、`pendingSamples` 中；SA006、SA015 还必须出现在 `negativeSamples` 中，
且三份清单中同一样本的 `pendingReason`、`reviewHandler`、`finalJudgement` 字节级一致。

## 五、自动化断言（verify_export.py）

### 用法

先完成上述手工步骤 1–7，在第三步把导出 JSON 保存为 `exported_from_browser.json`
（或直接传任意路径作为第一个参数），然后运行：

```bash
cd /Users/lzy/pro/solo/workspaces/zy72310
python3 verify_export.py
# 或：
python3 verify_export.py /path/to/概率抽样审计报告_2026-06-19.json
```

### 断言覆盖

| 编号 | 断言内容 | 对应用户要求 |
|------|----------|--------------|
| 1 | 4 个关键样本的 `finalJudgement`、`pendingType`、`pendingReason`、`reviewHandler`、`operationLog`、`judgements.final` 齐全且值正确 | "导出的样本数据必须带出最终判定、判定结果、处理说明和操作历史" |
| 2 | SA002/SA003 的 `conflictAudit` 含 `choice`/`reason`/`nextStep`/`finalBoundary`/`originalBoundary`/`weightBoundary`/`needReview`，且 `needReview=true` | "保留原始说法、改后的值、处理原因和下一步找谁" |
| 3 | 顶级 `pendingSamples` / `negativeSamples` 中对应样本与 `sampleData` 字段完全一致 | "相关的列表、摘要、历史记录都要跟着同一条记录更新" |
| 4 | S001/S003/S005 的 `effectiveBoundary.currentBoundary === conflictAuditTrail.finalBoundary` | "重点核对沿用边界值说明、边界样本报告和历史记录要能走完同一条最新结果一致" |
| 5 | SA002/SA003 `finalJudgement` 不是 `normal/borderline/abnormal/missing` 任何终态；SA002 生效边界本应为 `normal`，但被覆盖为 `pending` | "不能提前归到正常结果里" |
| 6 | `summary.finalCounts`、`summary.pendingBreakdown` 与实际样本计数一致 | "禁止只改总览数字" |

### 本次实际运行记录（2026-06-19）

```
读取文件: /Users/lzy/pro/solo/workspaces/zy72310/exported_from_browser.json
schemaVersion: 2.0
exportTime: 2026/6/19 15:25:07
summary: {"totalSamples": 18, "totalBoundaries": 6, "conflictCount": 3, "resolvedCount": 3,
          "finalCounts": {"normal": 9, "borderline": 3, "pending": 4, "abnormal": 2, "missing": 0},
          "pendingBreakdown": {"negative_value": 2, "boundary_range": 2, "other": 0}}

== 1. 关键样本字段级断言 ==
[SA002] 21 项 ✅ / 0 项 ❌
[SA003] 21 项 ✅ / 0 项 ❌
[SA006] 13 项 ✅ / 0 项 ❌
[SA015] 13 项 ✅ / 0 项 ❌

== 2. 顶级 pendingSamples / negativeSamples 清单与 sampleData 一致性 ==
全部 4 样本在 pendingSamples 中存在且 pendingReason 一致；
SA006/SA015 在 negativeSamples 中 finalJudgement/pendingReason/reviewHandler/effectiveBoundary/operationLog 全一致。

== 3. effectiveBoundary ↔ conflictAuditTrail 数据一致性 ==
S001: currentBoundary(60) == finalBoundary(60) — 同步，needReview=true
S003: currentBoundary(72) == finalBoundary(72) — 同步
S005: currentBoundary(68) == finalBoundary(68) — 同步

== 4. summary 统计与实际样本计数一致 ==
finalCounts 全部一致；pendingBreakdown 全部一致。

== 5. 证明沿用边界值说明 + 边界±2 范围样本没有被提前归为正常 ==
SA002: 按生效边界本应判定 normal，但 finalJudgement=pending ✅
SA003: 按生效边界本应判定 borderline(58<60)，最终被 pendingReason 强制覆盖为 pending ✅
SA002: finalJudgement=pending 不是任何终态判定 ✅
SA003: finalJudgement=pending 不是任何终态判定 ✅

🎉 全部断言通过。
```

退出码 `0`；任何一项失败会输出具体字段并退出码 `1`。

## 六、浏览器端一键自检

页面上点「📤 导出一致性检查」等价于手工把 exportData 构建出来后跑 `validateExportData()`
+ 关键字段断言，结果会显示在自检页。它与 `verify_export.py` 读取磁盘 JSON 的区别：

| 检查方式 | 数据来源 | 覆盖度 |
|----------|----------|--------|
| 页面「📤 导出一致性检查」 | 在浏览器内实时 `buildExportData()` | 验证页面内存中的最新处理结果是否可导出 |
| `verify_export.py` | 磁盘上实际导出的 JSON 文件 | 验证已下载的文件字节级内容是否符合契约 |

二者必须同时通过，才算整个导出链路正确。

## 七、改动溯源

核心改动集中在 `app.js`：

| 函数 | 作用 | 关键行 |
|------|------|--------|
| `buildExportData()` | 与 `exportReport()` 复用同一份构建逻辑，确保自检和真实导出读同一条数据 | [app.js:1085-1240](file:///Users/lzy/pro/solo/workspaces/zy72310/app.js#L1085-L1240) |
| `validateExportData()` | 导出前的字段级校验（缺字段直接拦截导出） | [app.js:1242-1302](file:///Users/lzy/pro/solo/workspaces/zy72310/app.js#L1242-L1302) |
| `exportReport()` | 调用上述两个函数，不通过则弹窗拦截 | [app.js:1304-1334](file:///Users/lzy/pro/solo/workspaces/zy72310/app.js#L1304-L1334) |
| `checkExportConsistency()` | 真实构建 exportData，对 SA002/SA003/SA006/SA015 做字段断言 + S001/S003/S005 两份数据一致性断言 | [app.js:1009-1140](file:///Users/lzy/pro/solo/workspaces/zy72310/app.js#L1009-L1140) |
| `generateReport()` | 把最终判定写回 `AppState.sampleData` 与 `AppState.reportData`，不再仅生成局部变量 | [app.js:562-626](file:///Users/lzy/pro/solo/workspaces/zy72310/app.js#L562-L626) |
