# 在线学习样本回放系统

专为数据科学家和评测运营人员设计的阈值变更复核系统。10分钟搞定会前复核，告别翻笔记。

## 核心特性

- **阈值异常自动检测**：自动识别阈值改过但报告仍写旧值的情况
- **去重导入**：重复导入同一批阈值调参笔记不会数量翻倍
- **版本历史追踪**：备注修改、阈值调整全记录，回滚一键搞定
- **可视化回溯**：图表/3D数据点点击直达调参笔记和线上实验桶
- **人性化错误提示**：只说人话，不吐内部字段名
- **三步工作流**：导入 → 补看实验桶 → 分层指标更新
- **异常留待复核**：检测到异常时不自动归正常，留给数据科学家拍板

## 技术栈

- React 18 + TypeScript 5
- Vite 5
- TailwindCSS 3
- Zustand（状态管理）
- React Router 7
- ECharts 5（2D图表）
- Three.js + @react-three/fiber（3D可视化）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# TypeScript 类型检查
npm run check
```

## 边界规则（代码即规则，拒绝口头约定）

### 规则一：异常判定规则

**什么情况算异常？**

当 `thresholdValue`（阈值当前值）与 `reportValue`（报告中写的值）的差值的绝对值 ≥ 0.0001 时，判定为**阈值改过但报告仍写旧值**。

```typescript
// src/utils/index.ts
export const checkThresholdConsistency = (
  thresholdValue: number,
  reportValue: number
): boolean => {
  return Math.abs(thresholdValue - reportValue) < 0.0001;
};
```

**状态流转：**
- 检测到异常 → 自动标记 `status = 'pending_review'`（待复核）
- 数据科学家确认是正常的 → `status = 'normal'`（正常）
- 数据科学家确认需修改 → `status = 'modified'`（已修改）

**⚠️ 重要：检测到异常时绝不会自动转为 normal，必须人工复核！**

---

### 规则二：导入规则

**去重机制：基于 `noteId`（调参笔记唯一标识）判断是否为同一批笔记。

```typescript
// src/utils/index.ts
export const findDuplicateByNoteId = (
  records: PlaybackRecord[],
  noteId: string
): PlaybackRecord | undefined => {
  return records.find(r => r.noteId === noteId);
};
```

**重复导入时的行为：**
- ✅ **不会**创建新记录（数量不翻倍）
- ✅ 合并更新已有记录的阈值、备注等字段
- ✅ 保留原记录的 `id`、`createdAt` 不变
- ✅ 自动重新检测异常，更新状态

```typescript
// src/utils/index.ts
export const mergePlaybackRecord = (
  existing: PlaybackRecord,
  newThresholds: ThresholdItem[],
  newRemark?: string
): PlaybackRecord => {
  const detectedThresholds = detectAnomalies(newThresholds);
  return {
    ...existing,
    thresholds: detectedThresholds,
    hasAnomaly: hasAnyAnomaly(detectedThresholds),
    remark: newRemark ?? existing.remark,
    updatedAt: formatDateTime(new Date())
  };
};
```

---

### 规则三：复核流程规则

**谁有权复核？**
- 数据科学家：可以审核异常，决定「确认正常」或「需修改」
- 评测运营小孟：可以导入数据、修改备注，但不能直接审核异常

**复核操作：**

1. 在「异常检测」页选择异常列表
2. 点击「确认正常」→ 该异常标记为 `confirmed_normal`
3. 点击「需修改」→ 该异常标记为 `needs_fix`
4. 同一条回放的所有异常都复核完才会更新整条记录状态

**代码实现位置：** `src/store/index.ts` → `reviewAnomaly()`

---

### 规则四：版本与回滚规则

**什么操作会生成版本历史？**
- 导入阈值调参笔记（首次导入是 v1）
- 修改备注
- 修改阈值
- 回滚操作本身

**版本历史记录内容：**
```typescript
interface VersionHistory {
  id: string;
  playbackId: string;
  fieldName: 'thresholds' | 'remark';
  oldValue: string;
  newValue: string;
  changeType: 'create' | 'update' | 'rollback';
  operator: string;
  operateAt: string;
  version: number;
}
```

**怎么看差别？**
- 在回放详情页 → 「版本历史」标签
- 点击「对比差异」按钮展开，绿色=新增，红色=删除

**怎么回滚？**
- 点击「回滚到此版本」按钮
- 自动生成一条 `changeType = 'rollback'` 的新版本记录
- 阈值/备注恢复到该版本时的值
- 自动重新检测异常

---

### 规则五：可视化回溯规则

**3D 或图表展示时，必须服务于复核，不能只剩漂亮画面。

**数据点必须绑定：**
- `noteId`：阈值调参笔记 ID
- `playbackId`：回放记录 ID
- `bucketUrl`：关联的线上实验桶链接

**点击数据点时的行为：**
- 弹出详情弹窗，显示阈值详情
- 提供「查看调参笔记」按钮 → 跳转到回放详情页
- 提供「查看线上实验桶」按钮 → 跳转到关联的实验桶页面

**代码实现位置：** `src/pages/Visualization.tsx`

---

### 规则六：错误提示规则

**错误提示必须说人话，不能吐内部字段名。

| 内部错误码/字段名 | 用户看到的提示 |
|---------------|-------------|
| FILE_PARSE_ERROR | 文件解析失败，请检查 JSON 格式是否正确 |
| NO_THRESHOLD_DATA | 文件中没有找到阈值配置数据 |
| INVALID_NOTE_ID | 调参笔记 ID 无效 |
| DUPLICATE_IMPORT | 已存在相同的调参笔记，将更新已有记录（这是提示，不是错误） |
| PERMISSION_DENIED | 您没有权限执行此操作 |

**代码实现位置：** `src/utils/index.ts` → `getHumanFriendlyError()`

---

### 规则七：三步工作流规则

**完整流程必须走完这三步：**

1. **第一步：导入阈值调参笔记**
   - 拖拽或选择 JSON 文件上传
   - 自动检测异常，高亮显示不一致项
   - 检测到异常时，别急着归正常，留给数据科学家

2. **第二步：补看线上实验桶**
   - 关联线上实验桶数据
   - 查看真实线上效果
   - 可以补充备注说明

3. **第三步：分层指标更新**
   - 确认各分层指标的阈值
   - 再次核对一致性
   - 完成后生成最终回放记录

**代码实现位置：** `src/pages/Workflow.tsx`

## 目录结构

```
src/
├── components/          # 通用组件
│   ├── Layout.tsx      # 主布局
│   └── Toast.tsx       # Toast 提示
├── data/               # Mock 数据
│   └── mockData.ts
├── pages/              # 页面
│   ├── Workflow.tsx       # 三步工作流
│   ├── PlaybackList.tsx  # 回放列表
│   ├── PlaybackDetail.tsx # 回放详情
│   ├── Anomalies.tsx     # 异常检测面板
│   ├── Visualization.tsx # 可视化展示
│   └── Rules.tsx         # 边界规则说明
├── store/              # 状态管理
│   └── index.ts
├── types/              # 类型定义
│   └── index.ts
├── utils/              # 工具函数（核心业务逻辑）
│   └── index.ts
├── App.tsx            # 路由配置
├── main.tsx           # 入口文件
└── index.css          # 全局样式
```

## 核心业务逻辑位置

所有边界规则的判定逻辑都在 `src/utils/index.ts` 中，确保代码即规则，杜绝口头约定。

| 功能 | 文件位置 |
|-----|---------|
| 阈值一致性检测 | `src/utils/index.ts` → `checkThresholdConsistency()` |
| 异常检测 | `src/utils/index.ts` → `detectAnomalies()` |
| 去重检测 | `src/utils/index.ts` → `findDuplicateByNoteId()` |
| 合并更新 | `src/utils/index.ts` → `mergePlaybackRecord()` |
| 版本历史生成 | `src/utils/index.ts` → `createVersionHistory()` |
| 人性化错误 | `src/utils/index.ts` → `getHumanFriendlyError()` |

## 使用说明

### 评测运营小孟的日常流程：

1. 打开首页 → 上传阈值调参笔记 JSON 文件
2. 系统自动检测异常，高亮显示
3. 关联线上实验桶，补充备注
4. 更新分层指标
5. 提交后等待数据科学家复核

### 数据科学家的 10 分钟会前复核：

1. 打开「异常检测」页面
2. 查看所有待复核的异常
3. 点击确认正常或需修改
4. 完成复核，更新记录状态自动更新
