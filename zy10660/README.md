# 在线医疗问诊处方撤回通知 API

## 目录结构

```
├── src/
│   ├── app.ts          # 应用入口
│   ├── routes.ts       # API路由
│   ├── service.ts      # 业务逻辑服务层
│   ├── repository.ts   # 数据存储层
│   ├── validator.ts    # 状态校验和状态机
│   ├── models.ts       # 数据模型
│   └── app.test.ts     # 测试用例
├── package.json
├── tsconfig.json
├── jest.config.js
└── sample-data.json    # 样例数据
```

## 核心状态

- `prescribed` - 已开方
- `withdrawing` - 撤回中
- `notified` - 已通知
- `closed` - 已关闭
- `rejected` - 已驳回
- `dispensed` - 已配药

## 状态流转图

```
已开方(prescribed)
    │
    ├─→ 撤回中(withdrawing)
    │     ├─→ 已通知(notified) → 已关闭(closed)
    │     └─→ 已驳回(rejected) ──┘
    │
    └─→ 已配药(dispensed) → 已关闭(closed)
```

## API接口

### 处方管理
- `GET /api/prescriptions` - 处方列表（支持status、patientName筛选）
- `GET /api/prescriptions/:id` - 处方详情
- `GET /api/prescriptions/:id/history` - 撤回历史
- `POST /api/prescriptions` - 创建处方

### 撤回流程
- `POST /api/prescriptions/:id/withdraw` - 发起撤回
- `POST /api/prescriptions/:id/audit` - 审核撤回
- `POST /api/prescriptions/:id/close` - 关闭处方

### 药房操作
- `POST /api/prescriptions/:id/dispensed` - 标记已配药（会触发冲突判断）

### 导入导出
- `POST /api/prescriptions/import` - 批量导入
- `GET /api/prescriptions/export/csv` - CSV导出
- `GET /api/prescriptions/export/json` - JSON导出

## 安装运行

```bash
npm install
npm run dev    # 开发模式
npm run test   # 运行测试
```

## 测试覆盖场景

1. **完整流转**：创建 → 发起撤回 → 审核通过 → 关闭
2. **冲突记录**：药房已配药后发起撤回 → 返回409冲突
3. **导入坏行**：重复处方号、缺少必填字段、空药品列表
4. **审核驳回**：发起撤回 → 审核驳回 → 关闭
5. **数据一致性**：列表、详情、历史、导出数据互相对应

## 冲突判断机制

药房已配药(`isDispensed = true`)后，医生发起处方撤回时：
- 不按普通更新处理
- 返回409 Conflict状态码
- 提示"处方已配药，无法直接撤回，请走特殊审批流程"
