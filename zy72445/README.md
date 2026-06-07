# 剧院返场曲库审批系统

## 概述

本系统用于剧院返场曲目的审批流程管理，涵盖曲目别名表导入、课时签到照片复核、排练变更记录更新三步工作流。

## 核心边界规则（写入代码，不靠口头约定）

### 1. 返工原因处理规则

**检测关键词**：返工、重录、修改、调整、需复核、待确认、不对、错误

**自动行为**：
- 轨道备注中包含上述关键词时，自动标记 `hasReworkReason: true`
- 审批状态自动切换为 `rework_required`（需返工）
- 阻止自动标记为 `normal`（正常），必须由版权运营人工复核

**处理流程**：
1. 检测到返工原因 → 状态变为"需返工"
2. 版权运营小鹿复核 → 确认处理后状态变为"审核中"
3. 复核通过 → 可继续推进工作流

**回滚机制**：
- 可从 `reviewing`、`rework_required`、`approved` 状态回滚
- 已标记为 `normal` 的记录无法直接回滚，需使用"申请返工"功能

### 2. 曲目别名表导入去重规则

**去重维度**：
- 批次标识（batchIdentifier）：同一批次重复导入全部跳过
- 曲目ID（trackId）+ 别名（aliases）：单条重复自动跳过

**行为**：
- 重复导入同一批时，不会导致审批数量翻倍
- 返回 `skippedCount` 告知跳过数量
- 如需更新请使用"修改备注"功能，不要重复导入

### 3. 状态流转规则

```
pending → reviewing | rework_required
reviewing → approved | rejected | rework_required
rework_required → reviewing | approved
approved → normal
rejected → reviewing
normal → (无出口，锁定状态)
```

### 4. 三步工作流规则

**步骤顺序**（不可跳步）：
1. **曲目别名表导入** (alias_import)
2. **课时签到照片复核** (photo_review) - 必须有已审核的签到照片
3. **排练变更记录更新** (rehearsal_update)

**推进条件**：
- 每步推进前检查是否存在未处理的返工原因
- 照片复核步骤必须有已审核的签到照片
- 存在返工原因时，必须先由版权运营复核才能推进

## 错误提示规范（说人话，不吐内部字段名）

所有错误返回格式：
```json
{
  "message": "直白的问题描述",
  "suggestion": "具体该怎么做",
  "fieldName": "对应的输入框（可选）"
}
```

示例：
- ❌ 不好：`field batch_id required`
- ✅ 好：
  ```
  message: "导入批次标识不能为空"
  suggestion: "请填写批次号或导入时间作为唯一标识，避免重复导入"
  ```

## 变更历史记录

- 所有字段修改都会记录变更历史
- 单条备注修改时，可查看改前改后的差别
- 记录字段：字段名、旧值、新值、修改人、修改时间、修改原因

查看方式：
```typescript
service.getChangeHistory('track_remark', remarkId);
```

## 3D / 图表展示规则

**服务复核前置**：
- 切换到 `chart` 或 `three_d` 模式前，必须先完成服务复核
- 存在未处理返工原因时，禁止切换展示模式

**导航回退**：
- 在3D/图表视图中，点击有返工原因的轨道时，可导航回：
  - 曲目别名表
  - 课时签到照片
  - 排练变更记录
- 不会只剩漂亮画面，关键数据溯源有保障

## 完整操作流程示例

### 场景：三步审批 + 中途返工处理

1. **第一步：导入曲目别名表**
   ```typescript
   const result = service.importTrackAliases(
     'BATCH-2024-001',
     [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
     'admin'
   );
   ```

2. **版权运营小鹿补看课时签到照片**
   ```typescript
   const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://...', 'xiaolu');
   service.reviewCheckinPhoto(photo.id, 'xiaolu');
   ```

3. **添加轨道备注（含返工原因）**
   ```typescript
   const remark = service.addTrackRemark(
     'TRK001',
     '这段录音有杂音，需要返工重录',
     'editor'
   );
   // 系统自动将审批状态设为 rework_required
   ```

4. **尝试推进工作流（被阻止）**
   ```typescript
   const result = service.advanceWorkflow(approvalId, 'xiaolu');
   // 返回错误：该轨道备注中存在未处理的返工原因
   ```

5. **版权运营小鹿复核返工原因**
   ```typescript
   service.updateTrackRemark(remarkId, '已处理，杂音已消除', 'xiaolu');
   ```

6. **继续推进工作流**
   ```typescript
   service.advanceWorkflow(approvalId, 'xiaolu'); // 进入照片复核
   service.addRehearsalChange('TRK001', '时长调整', '延长10秒', 'xiaolu');
   service.advanceWorkflow(approvalId, 'xiaolu'); // 进入排练更新
   service.advanceWorkflow(approvalId, 'xiaolu'); // 完成，标记为 normal
   ```

## 代码结构

```
src/
├── types/              # 类型定义
├── constants/
│   ├── boundaryRules.ts   # 边界规则（代码即文档）
│   └── errorMessages.ts   # 人性化错误消息
├── store/
│   └── DataStore.ts       # 数据存储
├── services/
│   ├── ImportService.ts      # 曲目导入（含去重）
│   ├── BoundaryRulesEngine.ts # 边界规则引擎
│   ├── WorkflowEngine.ts     # 三步工作流引擎
│   ├── DisplayModeService.ts # 3D/图表展示服务
│   ├── ChangeHistoryService.ts # 变更历史服务
│   └── ApprovalService.ts    # 主审批服务（编排层）
└── index.ts
```

## 开发命令

```bash
npm install    # 安装依赖
npm run build  # 编译
npm run dev    # 开发模式运行
npm test       # 运行测试
npm run lint   # 类型检查
```
