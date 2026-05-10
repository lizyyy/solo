# 中央厨房配餐路由 API - 普通用户操作指引

## 一、快速启动

### 1. 安装依赖
打开终端，进入项目目录，执行：
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init
```
这会创建所有数据库表。

### 3. 填充测试数据（可选）
```bash
npm run seed
```
这会添加示例学校、班级、配送线路和过敏源规则。

### 4. 启动服务
```bash
npm start
```
服务会在 `http://localhost:3000` 启动。

---

## 二、功能确认指南

普通用户可以通过以下步骤确认系统功能是否可用：

### 步骤 1：确认服务运行
**怎么做：** 访问 `http://localhost:3000/api/health`

**怎么确认：** 看到类似这样的返回就表示服务正常：
```json
{
  "success": true,
  "message": "服务运行正常",
  "data": {
    "status": "ok",
    "timestamp": "..."
  }
}
```

**下一步：** 查看基础数据

---

### 步骤 2：查看基础数据

**查看所有学校：**
访问 `http://localhost:3000/api/schools`

**查看所有班级：**
访问 `http://localhost:3000/api/classes`

**查看配送线路：**
访问 `http://localhost:3000/api/routes`

**查看过敏源规则：**
访问 `http://localhost:3000/api/allergens`

**怎么确认：** 能看到数据列表，说明基础数据已配置。

**下一步：** 测试路由匹配

---

### 步骤 3：测试核心路由匹配（主线功能）

**主线说明：** 配餐时，过敏源、班级人数和配送线路**必须同时匹配**。

**测试方法：**
使用 curl 或 Postman 发送 POST 请求：

```bash
curl -X POST http://localhost:3000/api/mealPlans/matchRoute \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 1,
    "mealCount": 47,
    "menuAllergens": [],
    "operator": "测试员"
  }'
```

**参数说明：**
- `classId`: 班级ID（从步骤2的班级列表获取）
- `mealCount`: 配餐人数
- `menuAllergens`: 今天菜单包含的过敏源列表，例如 `["牛奶", "鸡蛋"]`

**怎么确认：**
返回结果中 `checks` 部分会显示三项检查：
1. **allergen**: 过敏源检查 - 显示班级过敏源是否与菜单冲突
2. **route**: 线路容量检查 - 显示分配的线路是否有足够容量
3. **studentCount**: 配餐人数 - 与班级基准人数对比

**成功标志：** 三项检查都显示 `passed: true`，且 `success: true`

**如果失败：**
- 过敏源检查失败：检查 `classAllergens` 和 `conflicts` 字段，了解冲突的过敏源
- 线路检查失败：查看线路容量是否足够，考虑调整线路或拆分配餐
- 人数异常：确认配餐人数是否合理

**下一步：** 创建配餐计划

---

### 步骤 4：创建配餐计划

**操作：**
```bash
curl -X POST http://localhost:3000/api/mealPlans \
  -H "Content-Type: application/json" \
  -d '{
    "planDate": "2026-05-10",
    "notes": "日常配餐",
    "operator": "配餐员"
  }'
```

**返回结果：** 会得到一个 `id`，这就是配餐计划ID，记下来后续会用到。

**下一步：** 向计划中添加班级

---

### 步骤 5：添加配餐项目

```bash
curl -X POST http://localhost:3000/api/mealPlans/{计划ID}/items \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 1,
    "mealCount": 47,
    "menuAllergens": [],
    "operator": "配餐员"
  }'
```

**把 {计划ID} 换成步骤4得到的实际ID**

**怎么确认：** 访问 `http://localhost:3000/api/mealPlans/{计划ID}/items` 查看已添加的项目。

**下一步：** 过敏源规则校验

---

### 步骤 6：执行过敏源规则校验

**操作：**
```bash
curl -X POST http://localhost:3000/api/mealPlans/{计划ID}/validateAllergens \
  -H "Content-Type: application/json" \
  -d '{ "operator": "审核员" }'
```

**怎么确认：**
- 成功：`success: true`，显示"全部X个班级过敏源校验通过"
- 失败：`success: false`，`details` 中列出哪些班级有冲突

**下一步：** 查看流程状态

---

### 步骤 7：查看流程状态

访问 `http://localhost:3000/api/process/{计划ID}/status`

**返回内容说明：**
- `currentStatus`: 当前流程状态
- `isBlocked`: 是否被卡阻
- `blockedStep`: 卡阻在哪个步骤（如果有的话）
- `allSteps`: 所有7个步骤的状态列表

**下一步：** 处理人数变更

---

### 步骤 8：测试人数变更功能

**提交变更申请：**
```bash
curl -X POST http://localhost:3000/api/studentCount/requests \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 1,
    "mealPlanId": {计划ID},
    "changeType": "增加",
    "newCount": 50,
    "reason": "3名学生今天返校",
    "createdBy": "班主任"
  }'
```

**查看待审核的变更：**
访问 `http://localhost:3000/api/studentCount/requests/{计划ID}/pending`

**审核变更（批准或拒绝）：**
```bash
curl -X POST http://localhost:3000/api/studentCount/requests/{变更ID}/review \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reviewedBy": "配餐主管",
    "reviewNote": "同意增加"
  }'
```

**action 可选值：**
- `approve`: 批准，会自动更新配餐数量
- `reject`: 拒绝，需要填写 `reviewNote` 说明原因

**怎么确认：** 再次访问 `http://localhost:3000/api/mealPlans/{计划ID}/items`，配餐数量应已更新。

**下一步：** 线路装载

---

### 步骤 9：线路装载

**创建装载记录：**
```bash
curl -X POST http://localhost:3000/api/delivery/loads \
  -H "Content-Type: application/json" \
  -d '{
    "mealPlanId": {计划ID},
    "routeId": 1,
    "loadedBy": "装卸工"
  }'
```

**返回结果：** 得到 `loadId`（装载ID）

**确认装载完成：**
```bash
curl -X POST http://localhost:3000/api/delivery/loads/{装载ID}/confirm \
  -H "Content-Type: application/json" \
  -d '{ "confirmedBy": "配送主管" }'
```

**怎么确认：** 流程状态中"线路装载确认"步骤应变为 `completed`。

**下一步：** 签收回执

---

### 步骤 10：签收回执

**操作：**
```bash
curl -X POST http://localhost:3000/api/delivery/receipts \
  -H "Content-Type: application/json" \
  -d '{
    "loadId": {装载ID},
    "schoolId": 1,
    "receivedBy": "王校长",
    "receivedCount": 50,
    "condition": "餐品完好，温度正常",
    "signature": "已签收"
  }'
```

**参数说明：**
- `condition`: 餐品状况描述
- `signature`: 签收确认信息

**怎么确认：** 可通过导出功能查看签收记录。

**下一步：** 异常报告

---

### 步骤 11：异常报告（可选）

**提交异常：**
```bash
curl -X POST http://localhost:3000/api/delivery/exceptions \
  -H "Content-Type: application/json" \
  -d '{
    "mealPlanId": {计划ID},
    "stepName": "签收回执",
    "exceptionType": "数量不符",
    "description": "实际送达数量与配餐单不符",
    "relatedEntityType": "receipt",
    "reportedBy": "司机陈师傅"
  }'
```

**查看异常列表：**
访问 `http://localhost:3000/api/delivery/exceptions/{计划ID}`

**解决异常：**
```bash
curl -X POST http://localhost:3000/api/delivery/exceptions/{异常ID}/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "经核实，司机在运输途中临时调整，已与学校确认无误",
    "resolvedBy": "客服主管"
  }'
```

**怎么确认：** 异常列表中该记录的 `status` 变为 `resolved`。

---

### 步骤 12：流程卡阻查询（关键功能）

**什么时候用：** 当某个步骤被拒绝时，查询卡点位置和历史记录。

**查询当前卡点：**
访问 `http://localhost:3000/api/process/{计划ID}/status`

**返回字段：**
- `isBlocked: true` 表示被卡阻
- `blockedStep.name`: 卡阻在哪个步骤
- `blockedStep.latestMessage`: 卡阻原因
- `lastSuccessfulStep`: 最后一个成功的步骤

**查询某步骤的历史记录：**
访问 `http://localhost:3000/api/process/{计划ID}/previous/{步骤名}`

**步骤名示例：** `过敏源规则校验`、`人数变更审核`、`线路装载确认`

**返回内容：**
- `latest`: 最新的处理记录（被拒绝的那次）
- `history`: 该步骤之前的所有处理记录

**怎么确认：** 能看到 `latest.status: "rejected"` 和历史记录。

---

### 步骤 13：导出业务复核文件

**一键导出全部文件：**
访问 `http://localhost:3000/api/exports/full/{计划ID}`

**也可单独导出：**
| 导出类型 | 访问地址 | 说明 |
|---------|---------|------|
| 配餐计划复核 | `/api/exports/mealPlan/{计划ID}` | 计划概览+配餐明细 |
| 配送签收复核 | `/api/exports/delivery/{计划ID}` | 装载清单+签收明细 |
| 异常报告 | `/api/exports/exception/{计划ID}` | 异常统计+详细记录 |
| 流程追溯 | `/api/exports/process/{计划ID}` | 流程状态+日志+步骤概览 |

**文件在哪里：**
- 返回结果中的 `filePath` 是完整路径
- 所有文件都在项目的 `exports` 文件夹中
- 也可通过 `http://localhost:3000/exports/文件名.xlsx` 直接访问

**Excel文件内容说明：**
1. **配餐计划复核.xlsx**
   - 计划概览：配餐日期、总份数、流程状态
   - 配餐明细：每个班级的学校、班级、配餐份数、过敏源、检查状态

2. **配送签收复核.xlsx**
   - 线路装载清单：每条线路的装载情况
   - 签收回执明细：每个学校的签收人、数量、餐品状况

3. **异常报告.xlsx**
   - 异常统计：总数、待处理、已解决数量
   - 异常报告明细：每条异常的类型、描述、处理状态

4. **流程追溯.xlsx**
   - 流程状态：当前状态、卡点信息
   - 流程日志：每一步的处理记录
   - 步骤概览：7个步骤的最新状态汇总

**怎么确认：** 打开Excel文件，能看到业务相关的数据，不是调试日志。

---

## 三、完整流程测试脚本

项目中提供了一键测试脚本，可以完整跑通所有流程：

```bash
chmod +x test-api.sh
./test-api.sh
```

脚本会执行：
1. 检查服务健康
2. 查看基础数据
3. 测试路由匹配
4. 创建配餐计划
5. 添加配餐项目
6. 过敏源校验
7. 人数变更申请和审核
8. 线路装载
9. 签收回执
10. 异常报告和处理
11. 导出所有复核文件

---

## 四、常见问题排查

### Q1: 访问接口返回404
**检查：**
- 服务是否启动（看终端输出）
- 端口是否被占用（默认3000）
- URL路径是否正确

### Q2: 路由匹配失败
**排查步骤：**
1. 查看返回的 `checks` 部分，看哪个检查没通过
2. 过敏源问题：确认班级过敏源规则和菜单过敏源
3. 线路问题：查看线路的 `max_capacity` 和已分配的餐数
4. 访问 `/api/routes` 确认线路状态是 `active`

### Q3: 流程被卡阻
**排查步骤：**
1. 访问 `/api/process/{计划ID}/status` 查看卡点
2. 查看 `blockedStep.latestMessage` 了解原因
3. 访问 `/api/process/{计划ID}/previous/{步骤名}` 查看历史
4. 修复问题后重新执行该步骤

### Q4: 导出文件找不到
**排查：**
- 查看 `exports` 文件夹是否存在
- 看接口返回的 `filePath` 完整路径
- 直接访问 `http://localhost:3000/exports` 浏览所有导出文件

---

## 五、API 参考

### 基础数据接口
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/schools | 学校列表 |
| GET | /api/classes | 班级列表 |
| GET | /api/routes | 配送线路列表 |
| GET | /api/routes/:id/stops | 线路站点 |
| GET | /api/allergens | 过敏源规则 |
| POST | /api/allergens | 添加过敏源规则 |

### 配餐计划接口
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/mealPlans | 计划列表 |
| GET | /api/mealPlans/:id | 计划详情 |
| POST | /api/mealPlans | 创建计划 |
| POST | /api/mealPlans/matchRoute | 路由匹配测试 |
| POST | /api/mealPlans/:id/items | 添加配餐项目 |
| GET | /api/mealPlans/:id/items | 项目列表 |
| POST | /api/mealPlans/:id/validateAllergens | 过敏源校验 |

### 流程管理接口
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/process/steps | 流程步骤定义 |
| GET | /api/process/:planId/status | 流程状态 |
| GET | /api/process/:planId/previous/:stepName | 步骤历史记录 |

### 人数变更接口
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/studentCount/requests | 提交变更申请 |
| GET | /api/studentCount/requests/:planId/pending | 待审核列表 |
| GET | /api/studentCount/requests/:planId | 全部变更 |
| POST | /api/studentCount/requests/:id/review | 审核变更 |

### 配送管理接口
| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | /api/delivery/loads | 创建装载 |
| POST | /api/delivery/loads/:id/confirm | 确认装载 |
| POST | /api/delivery/receipts | 创建签收 |
| POST | /api/delivery/exceptions | 提交异常 |
| GET | /api/delivery/exceptions/:planId | 异常列表 |
| POST | /api/delivery/exceptions/:id/resolve | 解决异常 |
| POST | /api/delivery/:planId/complete | 完成配餐 |

### 导出接口
| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | /api/exports/mealPlan/:planId | 导出配餐计划复核 |
| GET | /api/exports/delivery/:planId | 导出配送签收复核 |
| GET | /api/exports/exception/:planId | 导出异常报告 |
| GET | /api/exports/process/:planId | 导出流程追溯 |
| GET | /api/exports/full/:planId | 一键导出全部 |
