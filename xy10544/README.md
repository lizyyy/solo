# 施工隐患闭环管理 CLI

一个面向施工现场的隐患闭环管理命令行工具，从**发现→整改→复查→罚款**形成完整闭环，保留图片证据索引，支持月底检查时快速证明哪些隐患已经复查闭环。

## 功能特性

- **完整闭环流程**：发现 → 整改 → 复查 → 罚款 → 闭环
- **图片证据索引**：每一步都关联照片，便于追溯
- **重复隐患检测**：自动检测同一隐患重复登记
- **整改照片校验**：整改时必须提供照片证据
- **复查不通过重新计时**：复查失败后重新计算整改时限
- **重大隐患保护**：重大/特大隐患不能直接关闭
- **幂等操作**：重复执行不会产生副作用
- **人工修正审计**：所有人工修改记录前后差异和操作者
- **审计日志**：完整的操作历史记录

## 项目结构

```
.
├── package.json
├── src/
│   ├── index.js              # CLI 入口
│   ├── commands/             # 命令实现
│   │   ├── init.js          # 初始化
│   │   ├── import.js        # 数据导入
│   │   ├── check.js         # 状态检查
│   │   ├── detail.js        # 详情查看
│   │   ├── report.js        # 报告生成
│   │   ├── rectify.js       # 整改提交
│   │   ├── review.js        # 复查提交
│   │   ├── close.js         # 闭环关闭
│   │   ├── fine.js          # 罚款管理
│   │   ├── amend.js         # 人工修正
│   │   └── history.js       # 历史记录
│   ├── core/                # 业务逻辑
│   │   ├── hazardService.js
│   │   ├── rectificationService.js
│   │   ├── reviewService.js
│   │   ├── fineService.js
│   │   ├── amendmentService.js
│   │   └── teamService.js
│   ├── data/                # 样例数据
│   │   └── sampleData.js
│   └── utils/               # 工具函数
│       ├── storage.js       # 文件存储
│       ├── constants.js     # 常量定义
│       ├── helpers.js       # 辅助函数
│       └── audit.js         # 审计日志
└── .hazard-data/            # 数据目录（运行时生成）
    ├── hazards.json
    ├── rectifications.json
    ├── reviews.json
    ├── fines.json
    ├── teams.json
    └── audit.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化并加载样例数据

```bash
# 使用内置样例数据初始化
node src/index.js init --sample
```

样例数据包含：
- **4个责任班组**：土建一班、水电二班、消防三班、材料四班
- **5条隐患记录**：
  - 临边防护（已闭环）
  - 用电安全（特大隐患，待复查）
  - 材料堆放（一般隐患，整改中）
  - 消防通道（一般隐患，已发现）
  - 临边防护（重大隐患，需重新整改）
- **4条整改记录**、**3条复查记录**、**2条罚款记录**

### 3. 查看所有命令

```bash
node src/index.js --help
```

## 主要演示路径

### 路径1：完整闭环流程（新发现→整改→复查→闭环）

```bash
# 1. 初始化数据
node src/index.js init --sample

# 2. 查看当前隐患状态
node src/index.js check

# 3. 查看一条待整改隐患的详情
node src/index.js detail hz-0004

# 4. 提交整改（必须带照片）
node src/index.js rectify hz-0004 \
  -d "已清理消防通道，通道宽度恢复至3米" \
  -i "IMG_20260512_140001.jpg,IMG_20260512_140015.jpg" \
  -r "王工（消防三班）"

# 5. 再次查看详情，状态已变为"待复查"
node src/index.js detail hz-0004

# 6. 提交复查通过
node src/index.js review hz-0004 \
  -r passed \
  -c "消防通道已清理畅通，符合消防安全要求" \
  -v "安全员-陈" \
  -i "IMG_20260512_153001.jpg"

# 7. 查看详情，确认已闭环
node src/index.js detail hz-0004

# 8. 查看操作历史
node src/index.js history --hazard hz-0004
```

### 路径2：复查不通过→重新整改→罚款

```bash
# 1. 查看需重新整改的隐患
node src/index.js detail hz-0005

# 2. 再次提交整改（重新计时）
node src/index.js rectify hz-0005 \
  -d "已加装防护门锁，确保意外情况下无法打开" \
  -i "IMG_20260512_160001.jpg" \
  -r "张工（土建一班）"

# 3. 再次复查通过
node src/index.js review hz-0005 \
  -r passed \
  -c "防护门已加锁，符合安全要求" \
  -v "安全员-陈"
```

### 路径3：生成月底报告

```bash
# 生成完整报告（终端输出）
node src/index.js report

# 生成报告并保存到文件
node src/index.js report --output report.json
```

报告内容包括：
- **统计概览**：总隐患数、闭环率、按等级/状态分布
- **未闭环隐患明细**：未闭环原因、证据索引数量
- **罚款建议**：自动计算建议罚款金额
- **责任班组汇总**：各班组的隐患、罚款统计

## 失败路径演示

### 失败场景1：整改时未提供照片

```bash
# 尝试提交整改但不带照片
node src/index.js rectify hz-0003 -d "已降低堆放高度"

# 失败信息：整改照片缺失，必须提供整改前后对比照片
```

### 失败场景2：重大隐患直接关闭

```bash
# 尝试直接关闭重大隐患
node src/index.js close hz-0002

# 失败信息：重大/特大隐患不能直接关闭，必须通过复查流程闭环
```

### 失败场景3：重复登记同一隐患

```bash
# 导入重复隐患（样例数据中已有 hz-0001）
echo '[{"type":"临边防护","location":"1号楼3层东单元","description":"临边防护栏杆缺失，缺口约2米","level":"major","responsibleTeamId":"team-001","discoveryImages":["IMG_DUP_001.jpg"]}]' > /tmp/dup.json
node src/index.js import --hazards /tmp/dup.json

# 结果：检测到重复隐患，幂等跳过
```

### 失败场景4：对已发现状态的隐患进行复查

```bash
# 尝试复查未整改的隐患
node src/index.js review hz-0004 -r passed

# 失败信息：只有待复查状态的隐患才能复查
```

## 完整命令列表

### 基础命令

| 命令 | 说明 |
|------|------|
| `hazard init [--sample] [--force]` | 初始化数据目录，`--sample` 加载样例数据 |
| `hazard check [--status] [--team] [--overdue] [--all]` | 检查隐患状态和统计 |
| `hazard detail <hazardId>` | 查看隐患详情（证据索引、历史、未闭环原因） |
| `hazard report [--team] [--level] [--output]` | 生成闭环报告 |

### 业务流程命令

| 命令 | 说明 |
|------|------|
| `hazard rectify <hazardId> -d <desc> -i <images> -r <rectifier>` | 提交整改反馈 |
| `hazard review <hazardId> -r passed\|failed [-c comment] [-v reviewer] [-i images]` | 提交复查记录 |
| `hazard close <hazardId>` | 关闭隐患（完成闭环） |

### 管理命令

| 命令 | 说明 |
|------|------|
| `hazard fine --create <hazardId> [-a amount] [-r reason] [-o operator]` | 创建罚款记录 |
| `hazard fine --pay <fineId>` | 标记罚款已缴纳 |
| `hazard amend <hazardId> [--location] [--description] [--level] [--team] -o <operator>` | 人工修正隐患信息 |
| `hazard history --hazard <hazardId>` | 查看操作历史记录 |
| `hazard import --teams <file>` | 导入责任班组数据 |
| `hazard import --hazards <file>` | 导入隐患台账数据 |

## 核心规则说明

### 1. 隐患等级与整改时限

| 等级 | 英文标识 | 首次整改时限 | 复查失败后 | 基础罚款 |
|------|----------|-------------|-----------|---------|
| 轻微 | minor | 1天 | 12小时 | ¥200 |
| 一般 | general | 3天 | 1天 | ¥500 |
| 重大 | major | 5天 | 2天 | ¥2,000 |
| 特大 | critical | 10天 | 5天 | ¥10,000 |

### 2. 状态流转

```
发现 (discovered) 
    ↓ 分配班组
整改中 (rectifying)
    ↓ 提交整改（必须带照片）
待复查 (pending_review)
    ↓ 复查通过 ─┐
    ↓ 复查失败  │
需重新整改 (reopened) │
    ↓ 重新整改  │
待复查 (pending_review) │
    ↓ 复查通过 ─┘
    ↓ 非重大隐患直接闭环
    ↓ 重大隐患需二次验证
已闭环 (closed)
```

### 3. 罚款计算规则

- 基础金额 = 隐患等级对应的基础罚款
- 每次复查失败（第2次及以后），罚款金额 × 1.5 倍
- 公式：`总罚款 = 基础金额 × (1 + (复查失败次数 - 1) × 0.5)`

### 4. 幂等规则

以下操作重复执行不会产生副作用：
- 重复导入相同的班组/隐患数据
- 重复提交相同的整改记录（描述+整改人相同）
- 重复提交相同的复查记录（结果+复查人+意见相同）
- 重复关闭已闭环的隐患
- 重复标记罚款已缴纳

### 5. 人工修正审计

使用 `amend` 命令修改隐患信息时：
- 必须指定操作者（`-o` 参数）
- 自动记录修改前后的差异
- 差异保存到审计日志，可追溯

## 数据导入格式

### 责任班组数据格式（JSON）

```json
[
  {
    "name": "土建一班",
    "code": "TJ01",
    "leader": "张工",
    "phone": "138****1001"
  }
]
```

### 隐患台账数据格式（JSON）

```json
[
  {
    "type": "临边防护",
    "location": "1号楼3层东单元",
    "description": "临边防护栏杆缺失",
    "level": "major",
    "discoverer": "安全员-刘",
    "responsibleTeamId": "team-001",
    "discoveryImages": ["IMG_001.jpg", "IMG_002.jpg"]
  }
]
```

## 证据索引说明

每条隐患的证据索引包含：

- **发现时照片**：`discoveryImages`
- **整改照片**：每条整改记录的 `images`
- **复查照片**：每条复查记录的 `images`

使用 `detail` 命令可以完整查看所有证据索引。

## 月底检查工作流

1. **执行 `hazard check`**：快速查看哪些隐患已闭环，哪些未闭环
2. **对未闭环隐患执行 `hazard detail`**：查看未闭环原因（无整改/无复查/复查不通过/逾期）
3. **执行 `hazard report`**：生成完整报告，查看罚款建议
4. **执行 `hazard history --hazard <id>`**：对于有疑问的隐患，查看完整操作历史
5. **根据报告结果**：
   - 对复查失败的隐患执行 `hazard fine --create`
   - 催促责任班组完成整改

## 如何判断业务是否真的闭环？

不看源码也能判断：

1. **状态检查**：`hazard detail <id>` 中状态必须是「已闭环」
2. **三步证据**：
   - ✅ 有发现时照片（发现证据）
   - ✅ 有整改记录+整改照片（整改证据）
   - ✅ 有复查记录+复查照片（复查证据）
3. **复查结果**：最后一次复查必须是「复查通过」
4. **无未解决问题**：闭环检查区域显示「所有条件已满足」

任何一步缺失，`detail` 命令都会明确指出未闭环原因。
