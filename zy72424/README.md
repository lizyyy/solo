# 乐团排练迟到统计系统

一个可追溯、边界清晰的乐团排练管理系统，专为琴行店长老周、版权运营和管理员设计。

## 核心特性

### 🎯 证据链完整
- 曲目别名表备注保留原始格式，不清洗成一行干净数据
- 3D/图表展示点击可追溯到合同页截图或曲目别名表
- 历史变更记录支持字符级 diff 对比和回滚

### 📋 边界规则代码化
所有业务规则写在代码和文档中，不依赖口头约定：
- 备注保留规则
- 返工原因检测规则
- 重复导入去重规则
- 历史追溯规则

### 🔄 三步核心工作流
1. **合同页截图导入** - SHA-256 哈希去重，避免统计翻倍
2. **琴行店长补看曲目别名表** - 备注编辑保留原始格式
3. **排练变更记录更新** - 含返工原因的记录留待版权运营复核

### 👥 用户角色
- **琴行店长老周** - 数据录入、备注编辑
- **版权运营** - 异常复核、返工原因判定
- **系统管理员** - 全局查看、规则配置

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式方案**: TailwindCSS 3
- **状态管理**: Zustand
- **路由**: React Router v7
- **3D 可视化**: Three.js + @react-three/fiber
- **2D 图表**: ECharts
- **文件哈希**: crypto-js (SHA-256)
- **差异对比**: diff-match-patch

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run check

# 代码检查
npm run lint
```

## 边界规则详解

### 1. 备注保留规则 (Remark Preserve)

**规则目的**: 曲目别名表的备注经常比正式表还重要，不能清洗成一行干净数据。

**实现代码**: `src/utils/boundaryRules.ts`

```typescript
export const DEFAULT_BOUNDARY_RULES: BoundaryRules = {
  remarkPreserve: {
    preserveLineBreaks: true,    // 保留换行
    preserveWhitespace: true,    // 保留空格缩进
    noTruncation: true,          // 不截断内容
  },
  // ...
};
```

**判定方式**:
- 所有备注字段使用 CSS `white-space: pre-wrap` 渲染
- 保存时不进行任何 trim 或正则替换
- 历史记录中完整保存变更前后的原始内容

### 2. 返工原因检测规则 (Rework Detection)

**规则目的**: 轨道备注里有返工原因时，别急着归正常，留给版权运营复核。

**实现代码**: `src/utils/reworkDetector.ts`

```typescript
const REWORK_KEYWORDS = ['返工', '重录', '补录', '修正', '重新'];

export function detectRework(content: string): ReworkDetectionResult {
  const found = REWORK_KEYWORDS.filter(keyword => 
    content.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    hasRework: found.length > 0,
    matchedKeywords: found,
    needsReview: found.length > 0,
  };
}
```

**判定方式**:
- 关键词匹配（不区分大小写）: 返工、重录、补录、修正、重新
- 检测到关键词后自动标记为「待复核」状态
- 自动创建复核任务分配给版权运营角色
- 复核通过前，该记录不参与「正常」统计

**修改流程**:
1. 琴行店长编辑备注，系统自动检测返工关键词
2. 如检测到关键词，记录状态变为「待复核」
3. 版权运营在复核工作台查看并判定
4. 复核通过 → 状态变为「正常」
5. 复核驳回 → 状态变为「异常」，退回给琴行店长修改

**回滚机制**:
- 所有复核操作记录变更历史
- 支持一键回滚到任意历史版本
- 回滚时保留完整的操作审计轨迹

### 3. 重复导入规则 (Duplicate Import)

**规则目的**: 重复导入同一批合同页截图时，不要把统计数量翻倍。

**实现代码**: `src/utils/fileHash.ts`

```typescript
import SHA256 from 'crypto-js/sha256';

export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const wordArray = crypto.lib.WordArray.create(buffer);
  return SHA256(wordArray).toString();
}

export function findDuplicateByHash(
  hash: string,
  existing: ContractScreenshot[]
): ContractScreenshot | undefined {
  return existing.find(item => item.fileHash === hash);
}
```

**判定方式**:
- 上传前计算文件 SHA-256 哈希值
- 与已有记录的哈希值比对
- 哈希相同则判定为重复文件
- 重复文件只更新导入时间，不创建新记录
- 统计数据不重复计数

### 4. 历史追溯规则 (History Tracking)

**规则目的**: 如果只改了一条备注，历史里要能看出改前改后的差别。

**实现代码**: `src/utils/historyTracker.ts`

```typescript
import { diff_match_patch } from 'diff-match-patch';

export function createChangeHistory<T>(
  entityType: string,
  entityId: string,
  oldData: T,
  newData: T,
  changedBy: User,
  fieldName?: string
): ChangeHistory {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(
    JSON.stringify(oldData, null, 2),
    JSON.stringify(newData, null, 2)
  );
  dmp.diff_cleanupSemantic(diffs);
  
  return {
    id: generateId(),
    entityType,
    entityId,
    oldValue: oldData,
    newValue: newData,
    diff: diffs,
    changedBy,
    changedAt: new Date().toISOString(),
    fieldName,
  };
}
```

**判定方式**:
- 所有字段变更都记录完整的新旧值
- 使用 diff-match-patch 生成字符级差异
- 支持单字段变更追踪（如只修改备注）
- 保留完整操作人、操作时间信息
- 支持一键回滚到任意历史版本

## 项目结构

```
src/
├── components/          # 通用组件
│   ├── Layout.tsx       # 主布局
│   ├── Sidebar.tsx      # 侧边导航
│   └── DiffViewer.tsx   # 差异查看器
├── pages/               # 页面组件
│   ├── Dashboard.tsx    # 仪表盘
│   ├── Contracts.tsx    # 合同页截图
│   ├── TrackAliases.tsx # 曲目别名表
│   ├── Statistics.tsx   # 排练迟到统计
│   ├── Statistics3D.tsx # 3D 统计视图
│   ├── History.tsx      # 历史变更
│   ├── Review.tsx       # 异常复核
│   └── Rules.tsx        # 边界规则
├── store/               # 状态管理
│   └── useStore.ts      # Zustand store
├── utils/               # 工具模块
│   ├── boundaryRules.ts # 边界规则配置
│   ├── fileHash.ts      # 文件哈希去重
│   ├── reworkDetector.ts # 返工原因检测
│   └── historyTracker.ts # 历史变更追踪
├── types/               # TypeScript 类型
│   └── index.ts
├── data/                # Mock 数据
│   └── mockData.ts
└── App.tsx              # 应用入口
```

## 核心模块说明

### 合同页截图管理
- 支持拖拽上传、批量导入
- SHA-256 哈希自动去重
- 图片预览、元数据查看
- 关联曲目别名和排练记录

### 曲目别名表
- 备注保留原始格式（换行、空格、缩进）
- 单条记录变更历史展开查看
- 返工关键词自动检测标记
- 支持追溯到原始合同截图

### 排练迟到统计
- 多维度筛选（曲目、时间、人员、状态）
- 列表视图 + 3D 柱状图视图
- 点击数据点钻取溯源
- 异常记录高亮显示

### 历史变更记录
- 全量操作日志
- 字符级 diff 对比展示
- 按实体类型、操作人筛选
- 一键回滚功能

### 异常复核工作台
- 待复核任务列表
- 返工原因详情查看
- 复核通过/驳回操作
- 复核意见记录

## 设计理念

### 界面简单，证据链不断
> "我不介意界面简单，怕的是结论看着很满，追证据时断在半路。"

- 每个统计数字都能追溯到原始凭证
- 3D 可视化不只是漂亮画面，支持钻取溯源
- 变更历史完整保存，不丢失任何操作轨迹

### 规则写在代码里，不写在口头上
> "边界规则要写在代码和 README 里，别只靠口头约定。"

- 所有业务规则在 `src/utils/boundaryRules.ts` 中明确定义
- 规则参数可配置，不硬编码在业务逻辑中
- 文档与代码保持同步更新

### 三步工作流，异常有人管
> "中间碰到轨道备注里有返工原因时，别急着归正常，留给版权运营复核。"

- 导入 → 补录 → 更新 的三步流程清晰
- 异常自动识别，自动进入复核队列
- 角色权限分离，权责明确

## 开发说明

### 数据持久化
当前版本使用 Mock 数据，实际项目中可替换为：
- LocalStorage + IndexedDB（纯前端方案）
- REST API / GraphQL（后端方案）
- Supabase / Firebase（BaaS 方案）

### 扩展建议
- 用户认证与权限管理
- 文件存储（云存储替代本地 Mock）
- 数据导出（Excel/PDF）
- 邮件/消息通知
- 多租户支持

## License

MIT
