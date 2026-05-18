# 月子餐配送组月子餐忌口替换API

专门为月子中心配送组设计的忌口菜品替换管理系统，核心闭环包含时间校验和一致性校验。

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 查看种子数据和异常样例

```bash
npm run seed
```

### 启动开发服务

```bash
npm run dev
```

服务启动后访问: http://localhost:3000

## 📋 验收流程（从创建到导出）

### 第一步：创建替换申请

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "YZC-2024-0520-001",
    "motherName": "王芳",
    "roomNumber": "806房",
    "admissionDate": "2024-05-15",
    "deliveryDate": "2024-05-18",
    "mealPlanType": "premium",
    "deliveryDateRange": {
      "start": "2024-05-20",
      "end": "2024-06-19"
    },
    "mealPreparationCutoffTime": "2024-05-21T18:00:00.000Z",
    "dietaryRestrictions": [
      {
        "type": "allergy",
        "name": "海鲜过敏",
        "description": "对虾、蟹等海产品过敏",
        "severity": "severe"
      }
    ],
    "replacementItems": [
      {
        "originalMealId": "MEAL-001",
        "originalMealName": "清蒸鲈鱼",
        "replacementMealId": "MEAL-001-ALT",
        "replacementMealName": "香菇滑鸡",
        "reason": "海鲜过敏，鲈鱼属于海产品",
        "dietaryRestrictionId": ""
      }
    ],
    "createdBy": "李护士",
    "notes": "产妇产后第3天"
  }'
```

**预期结果：
- 状态码 201
- status 为 "pending"（待审核）

### 第二步：查看所有申请

```bash
curl http://localhost:3000/api/applications
```

按状态筛选：

```bash
curl http://localhost:3000/api/applications?status=pending
curl http://localhost:3000/api/applications?status=rejected
```

### 第三步：审核申请（批准/驳回）

批准申请：

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewedBy": "张主管"}'
```

驳回申请：

```bash
curl -X POST http://localhost:3000/api/applications/{申请ID}/reject \
  -H "Content-Type: application/json" \
  -d '{"reviewedBy": "张主管", "reason": "替换菜品不在可选范围内"}'
```

### 第四步：导出申请数据

```bash
curl -O http://localhost:3000/api/applications/{申请ID}/export
```

## ⚠️ 异常场景说明

### 场景1：忌口变更晚于备餐时间

**触发条件**：`mealPreparationCutoffTime` 早于当前时间

**系统行为**：
- 状态自动设为 `rejected`（已驳回）
- `rejectionReason` 为 `too_late`
- 返回详细的可解释错误消息

**错误消息示例**：
```
忌口变更申请已超过备餐截止时间。备餐截止时间为 2024/5/19 18:00:00，当前时间已超过 X 分钟。请联系配送组进行人工处理或申请次日替换。
```

**调用方处理建议**：
- 引导用户联系配送组
- 或引导用户修改配送日期为次日以后

### 场景2：距备餐时间不足1小时

**触发条件**：距离备餐截止时间不足60分钟

**系统行为**：
- 状态自动设为 `processing`（待人工处理）
- `rejectionReason` 为 `too_late`
- 返回警告消息

**错误消息示例**：
```
距离备餐截止时间不足 30 分钟，申请已进入待人工审核状态。请立即联系配送组确认是否可加急处理。
```

### 场景3：替换清单与忌口不一致

**触发条件**：替换菜品的理由与申报的忌口清单不匹配

**系统行为**：
- 状态自动设为 `rejected`（已驳回）
- `rejectionReason` 为 `inconsistent`
- 返回详细的可解释错误消息

**错误消息示例**：
```
替换菜品"牛奶炖木瓜"的替换原因与申请的忌口清单不一致。请检查：替换原因必须明确对应已申报的忌口项（牛奶过敏），或确保 dietaryRestrictionId 与忌口ID匹配。
```

**调用方处理建议**：
- 提示用户修正替换理由，确保与忌口项对应
- 或引导用户重新选择与忌口匹配的替换菜品

### 场景4：同一菜品重复申请

**触发条件**：替换清单中存在相同 originalMealId 的菜品

**系统行为**：
- 状态自动设为 `rejected`（已驳回）
- `rejectionReason` 为 `inconsistent`

**错误消息示例**：
```
替换清单存在重复菜品：红豆沙汤圆。每个菜品只能申请一次替换，请合并相同菜品的替换理由后重新提交。
```

## 📊 业务字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| orderId | 订单编号 | YZC-2024-0520-001 |
| motherName | 产妇姓名 | 王芳 |
| roomNumber | 房间号 | 806房 |
| admissionDate | 入院日期 | 2024-05-15 |
| deliveryDate | 分娩日期 | 2024-05-18 |
| mealPlanType | 套餐类型 | standard/premium/vegetarian/diabetic |
| mealPreparationCutoffTime | 备餐截止时间 | ISO时间格式 |
| dietaryRestrictions[].type | 忌口类型 | allergy/religion/health/personal |
| dietaryRestrictions[].name | 忌口名称 | 海鲜过敏 |
| dietaryRestrictions[].severity | 严重程度 | mild/moderate/severe |

## 🔌 API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/applications | 创建替换申请 |
| GET | /api/applications | 查询所有申请 |
| GET | /api/applications/:id | 查询单个申请详情 |
| POST | /api/applications/:id/approve | 批准申请 |
| POST | /api/applications/:id/reject | 驳回申请 |
| GET | /api/applications/:id/export | 导出申请数据 |
| GET | /health | 健康检查 |

## 📁 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── routes.ts            # 路由定义
│   ├── types/
│   │   └── index.ts       # 类型定义
│   ├── controllers/
│   │   └── applicationController.ts  # 控制器
│   ├── services/
│   │   ├── applicationService.ts      # 业务逻辑
│   │   └── validationService.ts      # 校验逻辑
│   ├── data/
│   │   └── sampleData.ts  # 种子数据
│   └── scripts/
│       └── seedData.ts      # 数据演示脚本
├── package.json
├── tsconfig.json
└── README.md
```
