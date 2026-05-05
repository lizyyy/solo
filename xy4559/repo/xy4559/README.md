# Puppet-Checkout 巡演木偶剧团出箱交接核验工具

一个用于巡演木偶剧团出箱前交接核验的本地 CLI 工具，支持导入数据、验证风险、人工审核和生成报告。

## 功能特性

- **import**: 导入木偶道具清单、维修记录、装箱扫描、演出场次表和车辆计划
- **validate**: 自动检查木偶缺件、易损件未修、箱号错装、场次道具不匹配、同车时段冲突等问题
- **review**: 给风险项补充人工结论，支持 accept/reject/pending/resolved 四种决策
- **report**: 导出 Markdown 出箱交接单和 JSON 审计明细

## 安装

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 全局安装（可选）
npm link
```

## 快速开始

### 1. 导入数据

使用 `import` 命令导入 5 类数据：

```bash
# 导入木偶道具清单
puppet import -t inventory -f examples/inventory.csv

# 导入维修记录
puppet import -t maintenance -f examples/maintenance.csv

# 导入装箱扫描
puppet import -t packing -f examples/packing.csv

# 导入演出场次表
puppet import -t shows -f examples/shows.csv

# 导入车辆计划
puppet import -t vehicles -f examples/vehicles.csv
```

### 2. 验证数据

使用 `validate` 命令检查所有风险项：

```bash
# 执行全部检查项
puppet validate

# 指定检查项
puppet validate -c missing-parts,unrepaired-items,wrong-box
```

**检查项说明**：

| 检查项 | 说明 | 风险等级 |
|--------|------|----------|
| missing-parts | 检查清单中物品是否未装箱，或已装箱物品是否不在清单中 | 高/中 |
| unrepaired-items | 检查易损件是否有未完成的维修记录 | 高 |
| wrong-box | 检查装箱箱号与清单指定箱号是否一致 | 高 |
| show-mismatch | 检查演出场次所需道具是否已装箱 | 高 |
| vehicle-conflict | 检查同一车辆是否存在时段冲突 | 高 |

### 3. 审核问题

使用 `review` 命令查看和处理验证问题：

```bash
# 列出所有问题
puppet review --list

# 只显示未审核的问题
puppet review --list --unresolved

# 为问题添加结论
puppet review --issue-id 1 \
  --conclusion "已补充缺件，确认可出箱" \
  --decision resolved \
  --reviewer "张团长" \
  --notes "后台库存紧急调用"
```

**决策类型**：

| 决策 | 说明 |
|------|------|
| accept | 接受/放行，认为问题不影响出箱 |
| reject | 拒绝/召回，必须修复后才能出箱 |
| pending | 待进一步确认 |
| resolved | 问题已解决，可继续出箱流程 |

### 4. 生成报告

使用 `report` 命令生成出箱交接单：

```bash
# 生成 Markdown 和 JSON 两种格式
puppet report -f both -o ./reports

# 只生成 Markdown
puppet report -f markdown -o ./reports -n 5月5日出箱交接

# 按验证批次筛选
puppet report -f both -o ./reports -b VAL-20260505-001
```

## 数据格式说明

### 1. 木偶道具清单 (inventory.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| 物品编号 | 唯一标识 | PU-001 |
| 物品名称 | 物品名称 | 孙悟空木偶 |
| 类型 | 分类 | 木偶/道具/服装/乐器 |
| 箱号 | 所属箱号 | A-01 |
| 状态 | 物品状态 | 正常/损坏/待修 |
| 是否易损 | 是否易损坏 | 是/否 |
| 描述 | 详细描述 | 齐天大圣主角木偶 |

### 2. 维修记录 (maintenance.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| 维修编号 | 唯一标识 | MT-001 |
| 物品编号 | 关联物品 | ST-003 |
| 物品名称 | 物品名称 | 二胡 |
| 问题描述 | 故障说明 | 琴弦断裂 |
| 报修日期 | 发现时间 | 2026-05-01 |
| 维修状态 | 状态 | 待修/维修中/已修 |
| 维修人员 | 负责人 | 李师傅 |
| 维修日期 | 完成时间 | 2026-05-04 |
| 备注 | 其他说明 | 需重新调试音准 |

### 3. 装箱扫描 (packing.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| 扫描编号 | 唯一标识 | SC-001 |
| 扫描时间 | 装箱时间 | 2026-05-05 08:00:00 |
| 物品编号 | 物品标识 | PU-001 |
| 物品名称 | 物品名称 | 孙悟空木偶 |
| 箱号 | 实际装箱箱号 | A-01 |
| 扫描人 | 操作人 | 小王 |
| 状态 | 装箱状态 | 已装箱/待装箱 |

### 4. 演出场次表 (shows.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| 场次编号 | 唯一标识 | SH-001 |
| 演出日期 | 日期 | 2026-05-06 |
| 演出时间 | 时间 | 19:30 |
| 演出地点 | 地点 | 北京大剧院 |
| 剧目名称 | 剧目 | 三打白骨精 |
| 所需道具 | 道具列表（逗号分隔） | 金箍棒,九齿钉耙 |
| 所需木偶 | 木偶列表（逗号分隔） | 孙悟空,猪八戒 |
| 状态 | 准备状态 | 待准备/已准备/已完成 |

### 5. 车辆计划 (vehicles.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| 计划编号 | 唯一标识 | VH-001 |
| 车辆编号 | 车牌号 | 京A-88888 |
| 车辆类型 | 车型 | 厢式货车 |
| 司机姓名 | 司机 | 王师傅 |
| 出发时间 | 出发时间 | 2026-05-05 10:00:00 |
| 到达时间 | 预计到达 | 2026-05-05 14:00:00 |
| 起点 | 出发地点 | 剧团仓库 |
| 终点 | 目的地点 | 北京大剧院后台 |
| 装载物品 | 货物描述 | A箱,B箱,C箱 |
| 状态 | 车辆状态 | 待出发/已出发/已到达 |

## 完整命令链示例

```bash
# 1. 构建项目
npm run build

# 2. 导入所有数据
puppet import -t inventory -f examples/inventory.csv
puppet import -t maintenance -f examples/maintenance.csv
puppet import -t packing -f examples/packing.csv
puppet import -t shows -f examples/shows.csv
puppet import -t vehicles -f examples/vehicles.csv

# 3. 执行验证
puppet validate

# 4. 查看待审核问题
puppet review --list --unresolved

# 5. 处理问题（假设问题ID为1、2、3）
puppet review --issue-id 1 --conclusion "箱号已更正为A-01" --decision resolved --reviewer "道具管理员"
puppet review --issue-id 2 --conclusion "易损件正在维修，本场次暂不使用" --decision accept --reviewer "张团长" --notes "已与演员确认换其他木偶"
puppet review --issue-id 3 --conclusion "车辆已重新调度" --decision resolved --reviewer "后勤主任"

# 6. 生成出箱交接单
puppet report -f both -o ./reports
```

## 数据库

数据存储在本地 SQLite 数据库 `puppet-checkout.db` 中，包含以下表：

- `inventory` - 木偶道具清单
- `maintenance` - 维修记录
- `packing_scans` - 装箱扫描记录
- `show_schedules` - 演出场次表
- `vehicle_plans` - 车辆计划
- `validation_issues` - 验证问题记录
- `review_conclusions` - 审核结论

## 项目结构

```
.
├── src/
│   ├── commands/
│   │   ├── import.ts      # 数据导入命令
│   │   ├── validate.ts    # 数据验证命令
│   │   ├── review.ts      # 问题审核命令
│   │   └── report.ts      # 报告生成命令
│   ├── utils/
│   │   └── csvReader.ts   # CSV 文件读取工具
│   ├── db.ts              # 数据库模型和连接
│   └── index.ts           # CLI 入口
├── examples/              # 示例数据
│   ├── inventory.csv
│   ├── maintenance.csv
│   ├── packing.csv
│   ├── shows.csv
│   └── vehicles.csv
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
