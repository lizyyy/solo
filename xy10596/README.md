# 调查问卷配额 CLI 工具

## 一、项目概述

这是一个围绕市场问卷回收的配额管理 CLI 工具，用于控制地区、年龄、渠道配额，并剔除重复和低质量答卷。

**核心功能：**
- 🔍 **质量检查**：手机号重复、答题时长过短、选项全一样
- 📊 **配额控制**：地区、年龄、渠道、组合配额
- 👥 **多渠道支持**：线上广告、地推、会员渠道
- 📝 **留痕追溯**：每步操作都有历史记录
- 🔄 **幂等执行**：重复执行不会产生副作用
- 🧑💼 **人工干预**：支持人工保留/驳回，记录操作者和前后差异

---

## 二、本地启动

### 1. 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10596
npm install
```

### 2. 全局链接（可选）

```bash
npm run build
npm link
```

### 3. 使用 ts-node 直接运行（推荐开发时）

```bash
npx ts-node src/index.ts --help
```

或者：

```bash
npm run dev -- --help
```

---

## 三、造数说明

### 1. 内置样例数据

系统内置了完整的样例数据，包括：

**渠道配置（3 个渠道）：**
- 线上广告（抖音、微信朋友圈等）
- 地推（线下门店、商场等）
- 会员渠道（现有会员定向邀请）

**配额规则（12 条规则）：**
- 城市配额：北京 100、上海 100、广州 80、深圳 80
- 年龄配额：18-25岁 120、26-35岁 150、36-45岁 100、46-55岁 90
- 渠道配额：线上广告 200、地推 100、会员渠道 160
- 组合配额：北京26-35岁 50

**质量规则（3 条规则）：**
- 手机号去重
- 最小答题时长 60 秒
- 选项全一样检查

**样例问卷数据（28 份）：**
- 20 份正常问卷
- 1 份手机号重复问卷
- 1 份答题时长过短问卷
- 1 份选项全一样问卷
- 5 份北京26-35岁组合配额测试问卷

### 2. 加载样例数据

```bash
# 初始化项目（使用样例配置）
npm run dev -- init --sample

# 加载样例问卷数据
npm run dev -- load-samples
```

### 3. 自定义数据导入

准备 JSON 文件（例如 `my-surveys.json`）：

```json
[
  {
    "id": "custom-001",
    "phone": "13900000001",
    "channel": "线上广告",
    "city": "北京",
    "ageGroup": "26-35",
    "duration": 95,
    "answers": {
      "q1": 4,
      "q2": 3,
      "q3": 5,
      "q4": "满意",
      "q5": "是"
    },
    "submittedAt": "2024-01-15T10:30:00.000Z",
    "sourceId": "custom-batch-001"
  }
]
```

导入命令：

```bash
npm run dev -- import ./my-surveys.json
```

---

## 四、主要演示路径

### 演示流程：完整业务闭环

```
init → load-samples → check → report → detail → reserve/reject → check → report
```

#### Step 1: 初始化项目

```bash
# 清除旧数据（如果有）
npm run dev -- clear --force

# 初始化项目
npm run dev -- init --sample
```

**预期输出：**
```
✓ 项目创建成功: 新产品市场调研项目
  渠道数量: 3
  配额规则: 12 条
  质量规则: 3 条
```

#### Step 2: 加载样例数据

```bash
npm run dev -- load-samples
```

**预期输出：**
```
✓ 数据导入完成
  总数: 28
  新增: 28
  更新: 0
  跳过: 0
```

#### Step 3: 执行质量和配额检查

```bash
npm run dev -- check --verbose
```

**预期输出要点：**
- ✅ 有效样本：约 20-23 份（正常通过的问卷）
- ❌ 剔除样本：3 份（重复手机号、时长过短、选项全一样）
- ⚠️ 超配额样本：2-3 份（北京26-35岁组合配额溢出）

查看详细列表可以看到：
- `duplicate-test` 问卷因为手机号重复被剔除
- `too-fast-test` 问卷因为答题时长只有 15 秒被剔除
- `all-same-test` 问卷因为所有选项都是 1 被剔除
- `beijing-over-quota-*` 问卷因为组合配额满了被标记为超配额

#### Step 4: 查看完整报告

```bash
npm run dev -- report
```

**预期输出要点：**

```
📈 总体统计:
  总数: 28
  ✅ 有效样本: XX
  ❌ 剔除样本: 3
  ⚠️  超配额样本: XX
  📋 待审核: 0

📦 配额使用情况:
  北京配额: ████████████████████████░░░░░░░░░░ XX%
    已用: XX/100 | 剩余: XX | 超限: 0
  ...
  北京26-35岁组合配额: ██████████████████████████████ 100%
    已用: 50/50 | 剩余: 0 | 超限: XX

⚠️  待补充样本:
  - 18-25岁配额: 还需 XX 份
    条件: {"ageGroup":"18-25"}
  ...
```

#### Step 5: 查看问卷详情

从 check 的详细列表中复制一个被剔除的问卷 ID：

```bash
npm run dev -- detail <问卷ID>
```

**预期输出：**
```
📋 基本信息:
  ID: xxx
  手机号: 13899999901
  渠道: 地推
  城市: 上海
  年龄段: 18-25
  答题时长: 15 秒
  状态: rejected

📝 回答内容:
  q1: 1
  q2: 2
  ...

📜 历史记录:
  1. [时间] 系统 - 导入: → pending (原因: 新问卷导入)
  2. [时间] 系统 - 质量检查: pending → rejected (原因: 质量检查失败: too_fast)
```

#### Step 6: 人工干预（保留/驳回）

假设我们认为某份被系统剔除的问卷其实是有效的（比如答题时长虽然短但回答真实）：

```bash
# 复制一个被剔除问卷的 ID
npm run dev -- reserve <问卷ID> -o "张三" -r "用户特殊情况，答题虽快但回答真实"
```

**预期输出：**
```
✓ 问卷已保留
  ID: xxx
  操作者: 张三
  原因: 用户特殊情况，答题虽快但回答真实
  状态变更: rejected → manually_reserved
```

#### Step 7: 重新检查（验证幂等性）

```bash
npm run dev -- check
```

**预期输出：**
- 之前人工保留的问卷状态不会改变（被跳过处理）
- 处理数量会显示跳过了手动干预的问卷
- 有效样本数量应该增加了 1

#### Step 8: 查看最终报告

```bash
npm run dev -- report
```

**预期输出：**
- 有效样本数量增加
- 查看历史记录可以追踪所有操作

---

## 五、失败路径演示

### 失败场景 1：导入格式错误的文件

创建一个格式错误的 JSON 文件 `bad-data.json`：

```json
[
  {
    "id": "bad-001",
    "phone": "12345",
    "channel": "不存在的渠道",
    "city": "北京",
    "ageGroup": "99-100",
    "duration": -10,
    "answers": {},
    "submittedAt": "invalid-date"
  }
]
```

执行：

```bash
npm run dev -- import ./bad-data.json
```

**预期行为：**
- 系统会尝试导入
- 检查阶段会根据规则处理
- 状态变化会被记录在历史中

### 失败场景 2：查看不存在的问卷

```bash
npm run dev -- detail non-existent-id
```

**预期输出：**
```
✗ 错误: 问卷不存在: non-existent-id
```

### 失败场景 3：未初始化就操作

```bash
# 先清除
npm run dev -- clear --force

# 尝试导入
npm run dev -- load-samples
```

**预期输出：**
```
✗ 错误: 项目未初始化，请先运行 init 命令
```

### 失败场景 4：重复导入相同数据

```bash
# 第一次导入
npm run dev -- load-samples

# 第二次导入相同数据（验证幂等性）
npm run dev -- load-samples
```

**预期输出（第二次）：**
```
✓ 数据导入完成
  总数: 28
  新增: 0
  更新: 0
  跳过: 28
```

---

## 六、结果解读

运行 `npm run dev -- report` 后，如何判断业务是否闭环：

### ✅ 业务闭环的标志

1. **有效样本数 > 0**：说明有符合要求的样本
2. **剔除样本数 > 0**：说明质量检查规则生效
3. **超配额样本数 >= 0**：说明配额控制生效
4. **待补充样本**：明确显示哪些维度还需要补充
5. **历史记录可追溯**：每个问卷都有完整的状态变更历史

### 📊 关键指标解读

| 指标 | 含义 | 业务意义 |
|------|------|----------|
| 有效样本 | 通过质量和配额检查的问卷 | 最终可用的数据 |
| 剔除样本 | 质量检查失败的问卷 | 垃圾数据，需要关注原因 |
| 超配额样本 | 质量通过但配额满了 | 可以考虑调整配额或人工筛选 |
| 待补充样本 | 配额未达到上限的维度 | 指导后续定向投放 |

### 📝 人工干预留痕验证

人工保留/驳回的问卷：
- `status` 变为 `manually_reserved` 或 `manually_rejected`
- 历史记录中会显示：
  - 操作者姓名
  - 操作原因
  - 状态变更前后对比（beforeStatus → afterStatus）

---

## 七、完整命令列表

```bash
# 初始化
sq init --sample           # 使用样例配置初始化
sq init --config <path>    # 使用自定义配置

# 数据导入
sq load-samples            # 加载内置样例数据
sq import <file>           # 从 JSON 文件导入

# 检查
sq check                   # 执行质量和配额检查
sq check --verbose         # 检查并显示详细列表

# 查询
sq detail <id>             # 查看问卷详情和历史
sq report                  # 生成配额报告

# 人工干预
sq reserve <id> -o <operator> -r <reason>   # 人工保留
sq reject <id> -o <operator> -r <reason>    # 人工驳回

# 工具
sq clear                   # 清除所有数据（需确认）
sq clear --force           # 强制清除
```

---

## 八、项目结构

```
survey-quota-cli/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── engine/
│   │   ├── qualityEngine.ts  # 质量检查引擎
│   │   └── quotaEngine.ts    # 配额控制引擎
│   ├── services/
│   │   └── projectService.ts # 核心业务服务
│   ├── utils/
│   │   ├── storage.ts        # 文件存储
│   │   └── history.ts        # 历史记录管理
│   └── data/
│       └── samples.ts        # 样例数据
├── .data/                    # 数据目录（运行时生成）
│   ├── state.json            # 当前状态
│   └── backups/              # 自动备份
├── package.json
├── tsconfig.json
└── README.md
```

---

## 九、技术栈

- **运行时**: Node.js 16+
- **语言**: TypeScript
- **CLI 框架**: Commander
- **日志美化**: Chalk
- **ID 生成**: UUID

---

## 十、开发命令

```bash
npm install                  # 安装依赖
npm run build                # 编译 TypeScript
npm run dev -- <command>     # 开发模式运行
npm run clean                # 清除编译和数据
```
