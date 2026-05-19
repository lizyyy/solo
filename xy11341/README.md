# 家电售后仓管理CLI工具

基于 SQLite 的轻量级售后仓管理系统，完整支持领件、旧件返还、厂商索赔全链路管理。

## 核心功能

### 1. 业务链路
- **领件单管理**: CSV批量导入、单条查询、条件筛选
- **旧件返还**: 状态追踪、事务处理
- **厂商索赔**: 完整规则校验、重复索赔拦截

### 2. 业务规则引擎
- **旧件未回拦截**: 只有旧件已返还的领件单才能索赔
- **重复索赔校验**: 已索赔订单自动拦截
- **批次追踪验证**: 索赔批次与领件批次必须一致

### 3. 数据安全
- **敏感字段脱敏**: 工程师姓名、手机号在查询、导出、日志中自动脱敏
- **操作审计日志**: 所有变更操作完整记录

### 4. 批量处理
- 批量导入支持成功/失败分别统计
- 事务保证数据一致性

## 安装

```bash
npm install
```

## 快速开始

### 1. 导入领件单
```bash
node src/index.js import test_orders.csv
```

### 2. 查看领件单
```bash
node src/index.js list-receive
node src/index.js list-receive --pending-return    # 旧件未返还
node src/index.js list-receive --pending-claim     # 待索赔
```

### 3. 旧件返还
```bash
node src/index.js return R001 --date 2024-01-20
```

### 4. 创建索赔单
```bash
node src/index.js claim --vendor-code V001 --vendor-name "XX厂商" --orders R001,R002 --price 100
```

### 5. 查看索赔单
```bash
node src/index.js list-claims
```

### 6. 查看规则校验记录
```bash
node src/index.js rules R001
```

### 7. 导出数据
```bash
node src/index.js export --type receive --output output/receive.csv
node src/index.js export --type claims --output output/claims.csv
node src/index.js export --type rules --output output/rules.csv
```

### 8. 查看统计
```bash
node src/index.js stats
```

### 9. 查看操作日志
```bash
node src/index.js logs --type receive
```

## 项目结构

```
.
├── src/
│   ├── index.js              # CLI入口
│   ├── db/
│   │   └── index.js          # 数据库初始化
│   ├── services/
│   │   ├── importService.js  # 导入服务
│   │   ├── receiveService.js # 领件查询服务
│   │   ├── returnService.js  # 旧件返还服务
│   │   ├── claimService.js   # 索赔服务
│   │   └── exportService.js  # 导出服务
│   ├── rules/
│   │   ├── engine.js         # 规则引擎
│   │   └── claimRules.js     # 索赔规则
│   └── utils/
│       ├── mask.js           # 脱敏工具
│       └── audit.js          # 审计日志
├── test_orders.csv           # 测试数据
├── package.json
└── README.md
```

## 数据库表结构

- **receive_orders**: 领件单主表
- **old_part_returns**: 旧件返还记录表
- **claims**: 索赔单主表
- **claim_items**: 索赔明细表
- **rule_results**: 规则校验结果表
- **audit_logs**: 操作审计日志表

## 注意事项

1. 数据库文件 `warehouse.db` 会在首次运行时自动创建
2. 所有敏感字段在查询、导出、日志中均已自动脱敏
3. 批量操作采用事务处理，失败时自动回滚
4. 每条规则校验结果都会永久保存，可追溯
