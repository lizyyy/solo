# 客服排班公平性 CLI 使用指南

## 一、项目简介

这是一个本地可运行的客服排班公平性检查工具，帮助客服主管在做下月班表时：

- ✅ 检查夜班次数是否公平
- ✅ 确保各技能组（售前/售后/投诉）每个班次都有人覆盖
- ✅ 检测请假期间是否错误排班
- ✅ 检查节假日轮值是否均衡
- ✅ 防止连续夜班或连续工作超限
- ✅ 保护人工锁定的班次不被意外修改

**核心输出**：
- 公平分（0-100分）
- 冲突列表（按严重程度排序）
- 可执行的换班建议
- 技能组覆盖率

---

## 二、环境要求

- Node.js >= 18.0.0
- 无需外部数据库，所有数据存在本地 `data/` 目录

检查 Node 版本：
```bash
node --version
```

---

## 三、快速开始

### 3.1 查看帮助

```bash
node src/cli.js help
```

或者如果你想注册为全局命令 `csp`：
```bash
npm link
csp help
```

以下示例使用 `node src/cli.js` 方式。

### 3.2 初始化工作目录

项目提供了**两套内置样例**，覆盖售前、售后、投诉三个技能组：

**方式 A：加载标准样例（主要演示路径）**
```bash
node src/cli.js init --sample --month 2025-06
```

**方式 B：加载有问题的样例（失败路径演示）**
```bash
node src/cli.js init --bad-sample --month 2025-06
```

参数说明：
- `--sample`: 标准样例（基本合规，少量可优化点）
- `--bad-sample`: 有问题的样例（故意制造多种冲突）
- `--month YYYY-MM`: 指定目标月份（默认自动取下月）
- `--operator NAME`: 记录操作者（默认 system）

初始化后会在当前目录创建 `data/` 目录。

### 3.3 查看系统状态

```bash
node src/cli.js status
```

输出示例：
```
【系统状态】
  已初始化: 是
  目标月份: 2025-06

【数据统计】
  客服: 6
  技能组: 3
  排班记录: 180
  请假记录: 2
  锁定班次: 1
```

JSON 格式输出：
```bash
node src/cli.js status --json
```

---

## 四、内置样例数据说明

### 4.1 技能组（3个）

| ID | 名称 | 说明 | 需要最小覆盖 |
|---|---|---|---|
| skill-presales | 售前咨询 | 产品咨询、购买引导 | 是 |
| skill-postsales | 售后支持 | 订单处理、退换货 | 是 |
| skill-complaint | 投诉处理 | 投诉跟进、纠纷调解 | 是 |

### 4.2 客服（6人）

| ID | 姓名 | 技能 |
|---|---|---|
| agent-zhang | 张三 | 售前咨询、售后支持 |
| agent-li | 李四 | 售前咨询 |
| agent-wang | 王五 | 售后支持、投诉处理 |
| agent-zhao | 赵六 | 投诉处理 |
| agent-chen | 陈七 | 售前咨询、售后支持、投诉处理（全能） |
| agent-liu | 刘八 | 售后支持 |

### 4.3 请假记录（2条）

- 张三：2025-06-16 ~ 2025-06-18（年假）
- 刘八：2025-06-21 ~ 2025-06-23（病假）

### 4.4 锁定班次

- 陈七：2025-06-15 中班（主管指定值班）

### 4.5 班次类型

| 类型 | 名称 | 时段 | 是否夜班 |
|---|---|---|---|
| morning | 早班 | 08:00-16:00 | 否 |
| afternoon | 中班 | 14:00-22:00 | 否 |
| night | 晚班 | 20:00-04:00 | 是 |

---

## 五、主要演示路径（标准样例）

### 步骤 1：初始化并加载标准样例

```bash
node src/cli.js init --sample --month 2025-06
```

你会看到：
```
[OK] 已导入 3 个技能组
[OK] 已导入 6 个客服
[OK] 已导入 2 条请假记录
[OK] 已导入 180 条排班记录
[OK] 已导入 1 个锁定班次
[OK] 已加载「标准样例数据」，包含售前/售后/投诉三个技能组
```

### 步骤 2：运行快速检查

```bash
node src/cli.js check
```

**期望结果**：公平分较高（80分以上），可能有少量中低优先级提示。

如果想只看概要：
```bash
node src/cli.js check --brief
```

JSON 格式：
```bash
node src/cli.js check --json
```

### 步骤 3：生成完整报告

```bash
node src/cli.js report
```

报告包含六个部分：
1. **公平性评分** - 综合得分和等级
2. **覆盖率分析** - 按技能组、日期、班次的覆盖率
3. **冲突列表** - 按类型分组的详细冲突
4. **换班建议** - 可执行的优化建议
5. **客服统计** - 每人的班次、夜班、节假日、冲突统计
6. **技能组统计** - 每个技能组的覆盖情况

保存报告到文件：
```bash
node src/cli.js report --file my-report.json
```

### 步骤 4：查看详情

查看某个客服的详情：
```bash
node src/cli.js detail --agent agent-zhang
```

查看某个技能组的详情：
```bash
node src/cli.js detail --skill skill-presales
```

查看第 0 个冲突的详情（索引从 check 输出中获取）：
```bash
node src/cli.js detail --conflict 0
```

查看第 0 条建议的详情：
```bash
node src/cli.js detail --suggestion 0
```

### 步骤 5：锁定/解锁班次（人工调整保护）

锁定某个班次（防止后续被覆盖）：
```bash
node src/cli.js lock --agent agent-chen --date 2025-06-15 --shift afternoon --reason "主管指定" --operator "王主管"
```

如果班次已锁定，重复执行不会报错（幂等）：
```bash
node src/cli.js lock --agent agent-chen --date 2025-06-15 --shift afternoon --operator "王主管"
# 输出: 该班次已锁定，跳过
```

解锁：
```bash
node src/cli.js unlock --agent agent-chen --date 2025-06-15 --shift afternoon --operator "王主管"
```

### 步骤 6：查看操作历史

查看所有历史类型：
```bash
node src/cli.js history
```

查看特定类型的历史：
```bash
node src/cli.js history --type check --limit 5
node src/cli.js history --type schedules_update
node src/cli.js history --type locks_update
```

每条历史记录都包含：
- 时间戳
- 操作者
- 变更前后的差异
- 操作原因

### 步骤 7：导入自定义数据

准备一个 JSON 文件 `my-agents.json`：
```json
[
  {
    "id": "agent-new",
    "name": "新员工",
    "skills": ["skill-presales"],
    "status": "active"
  }
]
```

导入（追加模式，默认）：
```bash
node src/cli.js import --category agents --file my-agents.json --operator "张主管"
```

导入（替换模式，覆盖原有数据）：
```bash
node src/cli.js import --category agents --file my-agents.json --replace --operator "张主管"
```

支持的类别：
- `agents` - 客服
- `skills` - 技能组
- `holidays` - 节假日
- `leaves` - 请假
- `schedules` - 排班
- `locks` - 锁定班次

---

## 六、失败路径演示（有问题的样例）

### 步骤 1：加载有问题的样例

```bash
rm -rf data/
node src/cli.js init --bad-sample --month 2025-06
```

### 步骤 2：运行检查

```bash
node src/cli.js check
```

**你会看到多种冲突：**

#### 冲突类型 1：请假冲突（CRITICAL）
- 张三的请假期间（6-16~6-18）被排了班
- 刘八的请假期间（6-21~6-23）被排了班

#### 冲突类型 2：锁定班次违规（CRITICAL）
- 陈七在 6-15 的中班是锁定班次，但排班表未匹配

#### 冲突类型 3：连续夜班（HIGH）
- 李四连续 3 天夜班，超过限制 2 天

#### 冲突类型 4：技能组空档（HIGH）
- 某些班次某个技能组没人

#### 冲突类型 5：连续工作超限（MEDIUM）
- 连续工作超过 6 天

### 步骤 3：查看冲突详情

```bash
node src/cli.js detail --conflict 0
```

### 步骤 4：生成报告查看换班建议

```bash
node src/cli.js report
```

报告会给出具体的换班建议，例如：
- 将请假期间的班次换给其他可用员工
- 打破连续夜班
- 补充技能组缺口

### 步骤 5：查看历史记录

```bash
node src/cli.js history --type check
```

---

## 七、核心规则说明

### 7.1 检查规则（7大类）

| 规则 | 严重级别 | 说明 |
|---|---|---|
| 请假冲突 | CRITICAL | 请假期间被排班 |
| 锁定班次违规 | CRITICAL | 锁定班次未匹配 |
| 连续夜班 | HIGH | 连续夜班超过限制（默认 2 天） |
| 技能组空档 | HIGH | 某技能组某班次没人 |
| 夜班超限 | HIGH | 单人夜班超过限制（默认 8 次） |
| 连续工作超限 | MEDIUM | 连续工作超过限制（默认 6 天） |
| 夜班不均 | MEDIUM | 单人夜班远高于平均值 |
| 节假日不均 | LOW | 节假日轮值不均衡 |

### 7.2 公平分计算

- 基础分：100 分
- 严重冲突：-20 分/个
- 高优先级冲突：-10 分/个
- 中优先级冲突：-5 分/个
- 低优先级提示：-2 分/个
- 夜班分布方差过大：额外扣分（最多 15 分）

等级判定：
- 90-100: excellent（优秀）🟢
- 80-89: good（良好）🟡
- 60-79: fair（一般）🟠
- 0-59: poor（较差）🔴

### 7.3 幂等性保证

以下操作是幂等的（重复执行结果相同）：
- `init`: 已初始化会提示，不会覆盖
- `lock`: 已锁定会跳过
- `unlock`: 未锁定会跳过
- `import`（非 replace 模式）: 已存在的 ID 会跳过

---

## 八、目录结构

```
.
├── package.json          # 项目配置
├── src/
│   ├── cli.js           # CLI 入口（9 个命令）
│   ├── engine.js        # 核心规则引擎
│   ├── storage.js       # 数据存储和历史记录
│   ├── models.js        # 数据模型和验证
│   ├── utils.js         # 工具函数
│   ├── sample-data.js   # 内置样例数据
│   └── index.js         # 模块导出
├── tests/
│   └── engine.test.js   # 单元测试（17 个测试用例）
├── data/                # 运行时数据（运行 init 后生成）
│   ├── config.json      # 配置
│   ├── agents.json      # 客服
│   ├── skills.json      # 技能组
│   ├── holidays.json    # 节假日
│   ├── leaves.json      # 请假
│   ├── schedules.json   # 排班
│   ├── locks.json       # 锁定班次
│   ├── state.json       # 状态和历史索引
│   ├── report.json      # 上次报告
│   └── history/         # 详细操作历史
│       ├── init.jsonl
│       ├── import.jsonl
│       ├── check.jsonl
│       ├── report.jsonl
│       ├── agents_update.jsonl
│       ├── schedules_update.jsonl
│       └── ...
└── DEMO.md              # 本文档
```

---

## 九、运行测试

```bash
npm test
```

测试覆盖：
- 连续夜班规则
- 连续工作日规则
- 请假冲突检测
- 技能组覆盖检测
- 锁定班次检测
- 夜班分布检测
- 公平分计算
- 覆盖率计算
- 完整报告生成

---

## 十、业务闭环判断

拿到报告后，按以下步骤判断业务是否闭环：

### 10.1 快速判断

```bash
node src/cli.js check
```

看输出末尾：
- ✅ `排班质量良好，可以发布` → 可发布
- ⚠️ `排班存在一些问题，建议查看报告并调整` → 需要优化
- ❌ `排班存在严重问题，必须调整后才能发布` → 不能发布

### 10.2 详细判断标准

| 检查项 | 通过标准 | 失败影响 |
|---|---|---|
| 公平分 | >= 90 | 员工抱怨风险高 |
| 严重冲突 (CRITICAL) | 0 个 | 必须修复，否则违规 |
| 高优先级冲突 (HIGH) | 0-3 个 | 建议修复 |
| 技能组覆盖率 | 100% | 客户问题无人处理 |
| 每个客服夜班数 | 接近平均值 | 夜班过多者抱怨 |
| 请假期间 | 无排班 | 员工无法休假 |
| 锁定班次 | 全部匹配 | 人工调整被覆盖 |

### 10.3 典型场景

**场景 A：标准样例**
- 公平分：85-95
- 严重冲突：0
- 结果：✅ 可发布

**场景 B：有请假冲突**
- 公平分：< 60
- 严重冲突：> 0
- 结果：❌ 不能发布，必须先处理请假冲突

**场景 C：技能组有空档**
- 公平分：60-80
- 高优先级冲突：> 0
- 结果：⚠️ 建议补充对应技能组的人手

---

## 十一、常见问题

**Q: 如何重新初始化？**
```bash
rm -rf data/
node src/cli.js init --sample --month 2025-06
```

**Q: 如何修改规则参数？**
- 直接编辑 `data/config.json` 中的 `rules` 字段
- 或通过导入新配置覆盖

**Q: 如何查看所有历史操作？**
```bash
node src/cli.js history
```

**Q: JSON 数据格式要求是什么？**
- 可以是数组 `[ {...}, {...} ]`
- 或包含数组的对象 `{ agents: [...] }`、`{ records: [...] }`、`{ data: [...] }`

---

## 十二、下一步建议

1. 先用 `--bad-sample` 跑一遍，熟悉冲突检测
2. 再用 `--sample` 跑一遍，看理想状态
3. 准备真实数据 JSON 文件，用 `import` 导入
4. 运行 `check` 和 `report` 评估
5. 根据建议调整排班
6. 用 `lock` 保护人工调整
7. 再次 `check` 直到满意
