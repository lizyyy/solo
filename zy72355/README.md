# 电梯制动距离核算系统

为质检员、现场师傅和实验老师提供一套可追溯、不可篡改的工况照片录入与审核工具。

## 核心设计原则

> 结论可追证据，改动可查前后的差异，边界情况不靠口头约定

## 三步工作流

```
1. 工况照片导入 → 2. 巡检备注补看 → 3. 异常工况表更新
```

### 第 1 步：工况照片导入
- 批量导入工况照片，自动提取行号与结论
- **去重机制**：按 `file_hash + line_number` 唯一约束，重复导入时跳过，数量不翻倍
- 边界值自动检测并提示

### 第 2 步：巡检备注补看
- 质检员逐条对照手写巡检备注，补全/修改备注字段
- 若备注/方向含非标表述（如"向左"），自动标为 **"待实验老师复核"**
- **不直接归正常**，留给实验老师人工判定
- 仅改动的字段记入变更历史

### 第 3 步：异常工况表更新
- 展示所有异常/待复核/已复核条目
- 实验老师可对"待复核"项进行判定：确认异常 / 归正常 / 退回质检员
- 所有复核操作记入变更历史，附复核理由

## 边界规则（Boundary Rules）

所有规则存储于 `boundary_rules` 数据表，不靠口头约定。

| 规则ID | 非标表述 | 归一值 | 处理动作 |
|--------|----------|--------|----------|
| br001 | 向左 | 负方向 | 待实验老师复核 |
| br002 | 向右 | 正方向 | 待实验老师复核 |
| br003 | 往上 | 上行 | 待实验老师复核 |
| br004 | 往下 | 下行 | 待实验老师复核 |
| br005 | 向前 | 前进方向 | 待实验老师复核 |
| br006 | 向后 | 后退方向 | 待实验老师复核 |

### 判定流程

```
检测到非标方向 → boundary_flag = 1 → 状态 = 待实验老师复核 → 人工判定
                                  ↗ 确认异常
                                  → 归正常（记录理由）
                                  ↘ 退回质检员
```

## 变更历史（审计追踪）

每条核算条目的每一次修改，都会留下：
- **原始行号**：工况照片中的原始行号
- **改前值** / **改后值**：仅记录实际变化的字段
- **改动时间**：精确到秒
- **改动人**：质检员小白 / 实验老师
- **修改理由**：变更说明

查看入口：任意条目旁的"历史"图标

## 数据模型

```
assessment_items
  ├── id (主键)
  ├── file_name          # 工况照片文件名
  ├── file_hash          # 照片哈希（去重用）
  ├── line_number        # 原始行号
  ├── raw_conclusion     # 原始结论
  ├── direction          # 方向（可能含非标表述）
  ├── direction_normalized  # 归一化方向
  ├── remark             # 巡检备注
  ├── status             # 状态
  ├── boundary_flag      # 边界规则触发标记 0/1
  ├── boundary_rule      # 触发的规则ID
  └── timestamps

change_records
  ├── id
  ├── item_id (外键)
  ├── field              # 变更字段名
  ├── old_value          # 改前值
  ├── new_value          # 改后值
  ├── changed_by         # 改动人
  ├── changed_at         # 改动时间
  └── reason             # 理由

boundary_rules
  ├── id
  ├── pattern            # 匹配模式（如"向左"）
  ├── category           # 类别（如"direction"）
  ├── normalized_value   # 归一值
  ├── action             # 处理动作
  └── description        # 规则说明
```

## 开发命令

```bash
# 安装依赖
npm install

# 启动前后端开发服务器
npm run dev

# 仅启动前端
npm run client:dev

# 仅启动后端
npm run server:dev

# 类型检查
npm run check

# 构建
npm run build
```

## 技术栈

- **前端**：React 18 + TypeScript + Tailwind CSS + Zustand
- **后端**：Express 4 + TypeScript (ESM)
- **数据库**：SQLite + better-sqlite3
- **路由**：React Router
- **图标**：lucide-react
