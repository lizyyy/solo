# Stateflow Rehearsal

状态机交互可视化工具 - 让你在真实边界情况发生前，先演练一遍状态流。

## 为什么需要它？

在梳理复杂的状态机时，你是否遇到过以下问题：

- ❌ **边界情况遗漏**："已关闭"状态还能不能收到补充材料？
- ❌ **事件优先级混乱**：超时事件和人工驳回谁先触发？
- ❌ **不可达状态**：某些状态是不是永远走不到？
- ❌ **守卫条件冲突**：同一事件下多个条件谁会被触发？

**Stateflow Rehearsal** 就是为了解决这些问题而生的。它让你：

1. 📋 用 JSON/YAML 定义状态机
2. 👀 可视化查看状态图（可拖拽、缩放）
3. 🔄 逐条回放事件序列，看清每一步发生了什么
4. ✅ 自动检查常见问题（不可达、死端、冲突转换）
5. 📊 导出演练报告（Markdown/HTML）

## 功能特性

### 📝 状态机定义
- 支持 JSON 和 YAML 两种格式
- 定义状态、事件、转换、守卫条件、动作
- 支持初始状态和终态标记

### 🎨 可视化展示
- SVG 渲染的状态图
- 支持拖拽平移和滚轮缩放
- 节点和边点击选中高亮
- 悬停显示详情提示

### 🔄 事件回放
- 定义事件序列
- 逐条执行或一键执行
- 时间线记录每一步：
  - 当前状态
  - 命中的转换
  - 守卫条件通过/失败原因
  - 非法事件清晰提示
  - 上下文快照

### ✅ 智能检查
自动检查以下问题并定位到具体状态或边：

| 检查项 | 说明 | 严重程度 |
|--------|------|----------|
| 不可达状态 | 从初始状态无法到达的状态 | Warning |
| 死端状态 | 非终态但没有出口转换 | Warning |
| 冲突转换 | 同一事件下可能同时满足的多个转换 | Error |
| 目标状态缺失 | 转换引用了不存在的目标状态 | Error |
| 重复转换 | 完全相同的转换被定义多次 | Warning |

### 💾 数据持久化
- 本地文件存储项目数据
- 下次打开自动恢复
- 支持导入导出状态机定义

### 📊 报告导出
- Markdown 格式报告
- HTML 格式报告（带样式）
- 包含：状态图摘要、事件时间线、失败原因、检查清单

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装依赖

```bash
# 一键安装所有依赖（推荐）
npm run install:all

# 或分别安装
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 运行自检（可选但推荐）

```bash
npm run check
```

这会检查：
- 项目结构完整性
- 核心文件是否存在
- 依赖安装状态
- 核心模块能否正常加载
- 示例状态机能否正确解析

### 启动开发服务器

```bash
# 同时启动前后端（推荐）
npm run dev

# 或分别启动
# 后端（端口 3000）
npm run dev:backend

# 前端（端口 8080）
npm run dev:frontend
```

### 访问应用

打开浏览器访问：**http://localhost:8080**

## 项目结构

```
stateflow-rehearsal/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── app.js             # Express 应用入口
│   │   ├── engine/            # 核心状态机引擎
│   │   │   ├── parser.js      # JSON/YAML 解析器
│   │   │   ├── validator.js   # 状态机验证器
│   │   │   ├── executor.js    # 状态机执行引擎
│   │   │   ├── checker.js     # 状态机检查器
│   │   │   └── index.js       # 模块聚合
│   │   ├── routes/            # API 路由
│   │   │   ├── projects.js    # 项目管理 API
│   │   │   └── reports.js     # 报告生成 API
│   │   ├── storage/           # 存储模块
│   │   │   └── localStorage.js # 本地文件存储
│   │   └── export/            # 导出模块
│   │       └── reporter.js    # 报告生成器
│   └── package.json
│
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── main.ts            # 入口文件
│   │   ├── App.vue            # 根组件
│   │   ├── api/               # API 封装
│   │   ├── router/            # 路由配置
│   │   ├── views/             # 页面组件
│   │   │   ├── Home.vue       # 项目列表页
│   │   │   └── Editor.vue     # 状态机编辑器
│   │   ├── components/        # 功能组件
│   │   │   ├── StateGraph.vue    # 状态图可视化
│   │   │   ├── EventPanel.vue    # 事件序列面板
│   │   │   ├── TimelinePanel.vue # 执行时间线面板
│   │   │   ├── PropertyPanel.vue # 属性详情面板
│   │   │   └── CheckPanel.vue    # 检查结果面板
│   │   └── styles/            # 全局样式
│   ├── package.json
│   ├── tsconfig.json
│   └── vue.config.js
│
├── examples/                   # 示例状态机
│   ├── order-aftersale.yaml   # 订单售后状态机
│   └── device-inspection.yaml # 设备巡检状态机
│
├── scripts/                    # 工具脚本
│   └── self-check.js          # 自检脚本
│
├── package.json
└── README.md
```

## 状态机定义格式

### YAML 格式示例

```yaml
name: 订单售后状态机
description: 电商订单售后流程
initialState: pending_apply
states:
  pending_apply:
    name: 待申请
    description: 用户尚未发起售后申请
    type: initial
    on:
      apply_return:
        - target: pending_review
          description: 用户发起退货申请
          actions:
            - create_aftersale_record
            - notify_customer_service
  
  pending_review:
    name: 待审核
    description: 售后申请等待客服审核
    on:
      approve:
        - target: processing
          description: 客服审核通过
          guard:
            condition: has_valid_evidence
            description: 用户已提供有效凭证
          actions:
            - approve_aftersale
      reject:
        - target: closed
          description: 客服审核拒绝
          actions:
            - reject_aftersale
      timeout:
        - target: closed
          description: 审核超时自动关闭
          guard:
            condition: review_timeout_count >= 3
            description: 超时3次
  
  closed:
    name: 已关闭
    description: 售后流程已结束
    type: final
    on:
      reopen:
        - target: pending_review
          description: 管理员重新开启
          guard:
            condition: is_admin && within_30_days

events:
  apply_return:
    name: 申请退货
    description: 用户发起退货申请
    triggeredBy: [user]
  approve:
    name: 审核通过
    description: 客服审核通过
    triggeredBy: [customer_service, system]
  timeout:
    name: 超时
    description: 系统超时事件
    triggeredBy: [system]
```

### 状态定义字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 状态显示名称 |
| description | string | 否 | 状态描述 |
| type | string | 否 | 类型：`initial`（初始）、`final`（终态）、`normal`（普通） |
| on | object | 是 | 事件映射，key 是事件名，value 是转换数组 |
| actions | object | 否 | 生命周期动作：`entry`（进入）、`exit`（退出）、`do`（执行中） |

### 转换定义字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target | string | 是 | 目标状态 ID |
| guard | object | 否 | 守卫条件 |
| guard.condition | string | 否 | 条件表达式 |
| guard.description | string | 否 | 条件说明 |
| actions | string[] | 否 | 执行的动作列表 |
| description | string | 否 | 转换描述 |

### 守卫条件

守卫条件用于控制转换是否可以执行。支持简单的布尔表达式：

```yaml
# 简单条件
guard:
  condition: has_valid_evidence
  description: 用户已提供有效凭证

# 复合条件
guard:
  condition: is_vip_user || order_amount < 100
  description: VIP用户或小额订单

# 逻辑与
guard:
  condition: is_admin && within_30_days
  description: 管理员且在30天内

# 比较运算
guard:
  condition: review_timeout_count >= 3
  description: 超时次数达到3次
```

## API 接口

### 项目管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/projects | 获取项目列表 |
| POST | /api/projects | 创建新项目 |
| GET | /api/projects/:id | 获取项目详情 |
| PUT | /api/projects/:id | 更新项目 |
| DELETE | /api/projects/:id | 删除项目 |
| POST | /api/projects/import | 导入状态机 |
| POST | /api/projects/parse | 解析状态机（不保存） |
| POST | /api/projects/:id/check | 检查状态机 |
| POST | /api/projects/:id/execute | 执行事件序列 |
| GET | /api/projects/:id/export | 导出状态机定义 |

### 报告生成

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/:id | 生成演练报告 |

### 示例管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/examples | 获取示例列表 |
| GET | /api/examples/:filename | 获取示例内容 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 服务健康检查 |

## 示例状态机

项目包含两个完整的示例状态机：

### 1. 订单售后 (`order-aftersale.yaml`)

展示了典型的电商售后流程，包含以下特点：

- **7 个状态**：待申请、待审核、待补充材料、处理中、待仓库验货、待人工复核、已关闭
- **守卫条件优先级**：同一事件下不同守卫条件的顺序
- **超时处理**：审核超时多次后的自动关闭
- **终态特殊处理**：已关闭状态下收到补充材料如何处理
- **特殊重启**：管理员在30天内可重新开启

### 2. 设备巡检 (`device-inspection.yaml`)

展示了设备巡检和维护流程，包含：

- **9 个状态**：空闲、待巡检、巡检中、问题上报、维护排期、维护中、等待备件、待验证、逾期
- **并行流程**：不同问题类型的处理路径
- **循环等待**：备件到货后的重试
- **逾期升级**：未按时完成的状态流转

## 检查规则详解

### 不可达状态检查

**问题**：某些状态从初始状态无法到达。

**原因**：
- 拼写错误导致没有转换指向该状态
- 状态被弃用但未删除
- 守卫条件导致某些路径永远无法到达

**示例**：
```yaml
# "cancelled" 状态没有任何转换指向它，是不可达的
states:
  pending: { ... }
  completed: { ... }
  cancelled: { ... }  # 不可达！
```

### 死端状态检查

**问题**：非终态没有出转换，状态机会卡住。

**原因**：
- 忘记定义出转换
- 所有出转换的守卫条件永远为假

**示例**：
```yaml
processing:
  name: 处理中
  type: normal  # 不是终态
  on: {}        # 没有出转换！这是死端
```

### 冲突转换检查

**问题**：同一事件下有多个可能同时满足的转换。

**类型**：
1. **多个无守卫转换**：肯定冲突，只有第一个会被执行
2. **无守卫 + 有守卫混合**：无守卫会优先匹配，有守卫的永远不会触发
3. **重复守卫条件**：完全相同的守卫条件被多个转换使用

**示例**：
```yaml
pending_review:
  on:
    approve:
      # 问题1：两个无守卫转换，只有第一个会执行
      - target: processing
        description: 路径A
      - target: other_state
        description: 路径B（永远不会执行！）
      
      # 问题2：无守卫转换放在有守卫前面，后面的永远不会触发
      - target: quick_approve
        description: 快速通过（无守卫）
      - target: vip_processing
        guard:
          condition: is_vip  # 永远不会检查！
        description: VIP处理
```

### 目标状态引用检查

**问题**：转换引用了不存在的目标状态。

**原因**：
- 状态 ID 拼写错误
- 目标状态被删除但转换未更新

**示例**：
```yaml
pending:
  on:
    submit:
      - target: proccessing  # 拼写错误！应该是 processing
        description: 提交
```

### 重复转换检查

**问题**：完全相同的转换被定义多次。

**判定**：源状态 + 事件 + 目标状态 + 守卫条件 完全相同。

## 演练报告示例

### Markdown 报告结构

```markdown
# 状态机演练报告

## 状态机摘要
- **名称**: 订单售后状态机
- **状态数**: 7
- **事件数**: 12
- **初始状态**: 待申请

## 事件时间线
| 步骤 | 事件 | 源状态 | 目标状态 | 结果 | 守卫条件 |
|------|------|--------|----------|------|----------|
| 0 | - | - | 待申请 | 初始 | - |
| 1 | apply_return | 待申请 | 待审核 | 成功 | - |
| 2 | approve | 待审核 | 处理中 | 成功 | has_valid_evidence ✅ |

## 检查结果
### ✅ 通过检查
- 不可达状态检查
- 目标状态引用检查

### ⚠️ 发现警告
- 死端状态检查: 1 个问题

---
生成时间: 2024-01-01 12:00:00
```

## 开发指南

### 架构设计

项目采用**前后端分离**架构：

**后端** (Node.js + Express):
- 状态机核心逻辑（解析、验证、执行、检查）
- 本地文件存储
- 报告生成
- RESTful API

**前端** (Vue 3 + TypeScript + Element Plus):
- 状态图可视化 (SVG + dagre)
- 事件序列管理
- 执行时间线展示
- 检查结果面板

### 核心模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| Parser | `parser.js` | JSON/YAML 解析与规范化 |
| Validator | `validator.js` | 状态机结构验证 |
| Executor | `executor.js` | 状态机执行、事件处理、守卫评估 |
| Checker | `checker.js` | 状态机静态检查 |
| LocalStorage | `localStorage.js` | 项目持久化 |
| Reporter | `reporter.js` | 报告生成（Markdown/HTML） |

### 扩展指南

#### 添加新的检查规则

在 `checker.js` 中添加新方法：

```javascript
class StateMachineChecker {
  // ... 现有方法 ...
  
  checkMyCustomRule(machine) {
    const issues = [];
    
    // 实现你的检查逻辑
    for (const [stateId, stateDef] of Object.entries(machine.states)) {
      // ... 检查逻辑 ...
      if (hasIssue) {
        issues.push({
          type: 'my_issue_type',
          state: stateId,
          stateInfo: stateDef,
          message: '问题描述',
          detail: '详细说明',
          location: { state: stateId }
        });
      }
    }
    
    return {
      id: 'my_custom_rule',
      name: '自定义规则名称',
      description: '规则描述',
      severity: 'error', // 或 'warning'
      passed: issues.length === 0,
      count: issues.length,
      issues
    };
  }
  
  // 在 checkAll 中添加调用
  checkAll(machine) {
    // ...
    results.checks.push(this.checkMyCustomRule(machine));
    // ...
  }
}
```

#### 添加新的守卫条件运算符

在 `executor.js` 的 `_evaluateGuard` 方法中扩展：

```javascript
_evaluateGuard(guard, context) {
  // ... 现有逻辑 ...
  
  // 支持新的运算符，例如 "contains"
  if (condition.includes(' contains ')) {
    const [left, right] = condition.split(' contains ');
    const leftValue = this._getValue(left.trim(), context);
    const rightValue = this._getValue(right.trim(), context) || right.trim();
    return {
      passed: Array.isArray(leftValue) && leftValue.includes(rightValue),
      condition,
      reason: `数组包含检查: ${leftValue} contains ${rightValue}`
    };
  }
  
  // ...
}
```

## 常见问题

### Q: 为什么某些状态显示为"不可达"？

A: 检查是否有转换指向该状态。可能的原因：
- 状态 ID 拼写错误
- 守卫条件导致永远无法到达
- 该状态确实是孤立的（可以删除或标记为终态）

### Q: 守卫条件支持哪些表达式？

A: 当前支持简单的布尔表达式：
- 简单变量名：`has_evidence`
- 逻辑与：`a && b`
- 逻辑或：`a \|\| b`
- 比较运算：`count >= 3`, `amount < 100`, `status == 'active'`

更复杂的表达式建议拆分为多个守卫或使用自定义函数扩展。

### Q: 如何处理"已关闭"状态下的补充材料？

A: 参考订单售后示例中的做法：

```yaml
closed:
  name: 已关闭
  type: final
  on:
    submit_supplement:
      - target: closed  # 保持在已关闭状态
        description: 已关闭状态下收到补充材料（忽略）
        guard:
          condition: 'true'  # 总是匹配
        actions:
          - log_supplement_ignored  # 只记录日志，不改变状态
```

### Q: 事件优先级如何处理？

A: 执行引擎按以下顺序选择转换：
1. 按定义顺序检查同一事件下的转换
2. 第一个守卫条件通过的转换会被执行
3. 因此，更具体的条件应该放在前面

**正确示例**：
```yaml
on:
  approve:
    # 更具体的条件在前
    - target: vip_processing
      guard:
        condition: is_vip && order_amount >= 1000
      description: VIP大额订单
    # 一般条件在后
    - target: normal_processing
      guard:
        condition: 'true'
      description: 普通订单
```

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 JSON/YAML 状态机定义
- 状态图可视化（可拖拽、缩放）
- 事件序列执行与时间线记录
- 5 项智能检查规则
- Markdown/HTML 报告导出
- 本地项目持久化
- 两个完整示例状态机

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
