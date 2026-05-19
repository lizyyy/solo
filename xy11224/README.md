# 换电运营值班员工单系统

一个用于处理换电站故障工单的业务系统，支持自动分类、规则过滤、派修和复盘统计。

## 功能特性

### 核心业务流程
- **接单**: 接收客服工单，自动分类和处理
- **归因**: 分析故障根本原因
- **派修**: 安排维修人员
- **复核**: 审核维修结果
- **结案**: 完成工单处理

### 业务规则引擎
1. **重复故障合并**: 24小时内相同柜机相同故障自动合并
2. **离线柜排除**: 离线柜机的工单自动阻止派修
3. **维修状态一致性**: 有未完成维修记录时阻止新派修

### 数据持久化与审计
- SQLite本地数据库存储
- 完整的审计日志记录所有操作
- 每条工单记录规则执行结果和原因
- 维修前后状态追踪

### 导出与统计
- 工单数据CSV导出
- 月度报告生成（含故障类型、处理时效、派修统计）
- 月底复盘功能

## 项目结构

```
.
├── src/
│   ├── types/              # 类型定义
│   ├── storage/            # 数据存储层
│   │   ├── database.ts     # 数据库管理
│   │   └── repositories.ts # 数据访问仓库
│   ├── rules/              # 业务规则引擎
│   │   └── ruleEngine.ts   # 规则实现
│   ├── services/           # 业务服务层
│   │   ├── ticketService.ts
│   │   └── exportService.ts
│   ├── cli.ts              # 命令行接口
│   └── index.ts            # 导出入口
├── scripts/
│   └── demo.ts             # 演示脚本
├── data/                   # 数据库文件目录
├── exports/                # 导出文件目录
├── package.json
└── tsconfig.json
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 运行演示
```bash
npm run demo
```

### 使用命令行工具

查看所有命令:
```bash
npm run cli -- help
```

接单:
```bash
npm run cli -- receive \
  --external-id EXT-001 \
  --cabinet-id CAB-001 \
  --cabinet-name "测试柜机" \
  --fault-type CABINET_DOOR_FAILURE \
  --description "柜门无法打开"
```

归因分析:
```bash
npm run cli -- analyze --ticket-id <工单ID> --root-cause "故障原因"
```

派修:
```bash
npm run cli -- dispatch --ticket-id <工单ID> --technician "张三"
```

复核:
```bash
npm run cli -- review --ticket-id <工单ID> --resolution "已修复" --status-after NORMAL
```

查询工单列表:
```bash
npm run cli -- list
```

查看工单详情:
```bash
npm run cli -- show <工单ID>
```

导出工单:
```bash
npm run cli -- export
```

生成月度报告:
```bash
npm run cli -- report --year 2024 --month 5
```

## 故障类型

| 类型 | 说明 |
|------|------|
| `CABINET_DOOR_FAILURE` | 柜门打不开 |
| `SCAN_FAILURE` | 扫码失败 |
| `FALSE_EMPTY_SLOT_ALARM` | 空仓误报 |
| `OTHER` | 其他故障 |

## 工单状态

| 状态 | 说明 |
|------|------|
| `PENDING` | 待处理 |
| `RECEIVED` | 已接单 |
| `ANALYZED` | 已归因 |
| `DISPATCHED` | 已派修 |
| `REVIEWED` | 已复核 |
| `RESOLVED` | 已解决 |
| `REJECTED` | 已拒绝/合并 |

## 规则动作

| 动作 | 说明 |
|------|------|
| `ALLOW` | 允许通过 |
| `BLOCK` | 阻止派修 |
| `MERGE` | 合并工单 |

## 数据存储

- 数据库文件: `./data/battery_swap.db` (SQLite)
- 导出文件: `./exports/` 目录

## 幂等性保证

- 重复提交相同外部单号不会创建重复工单
- 所有操作都有审计记录
- 重复导入数据结果稳定

## API 使用

```typescript
import { TicketService, FaultType } from './src';

// 初始化服务
const ticketService = new TicketService(...);

// 接单
const result = ticketService.receiveTicket(
  'EXT-001',
  'CAB-001',
  '柜机名称',
  FaultType.CABINET_DOOR_FAILURE,
  '故障描述',
  false,
  'operator'
);

// 归因
ticketService.analyzeTicket(ticketId, '根本原因', 'operator');

// 派修
ticketService.dispatchTicket(ticketId, 'tech-001', new Date(), 'operator');

// 复核
ticketService.reviewTicket(ticketId, '解决方案', 'NORMAL', 'operator');

// 生成月报
const report = ticketService.generateMonthlyReport(2024, 5);
```