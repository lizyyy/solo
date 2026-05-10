# 版权授权到期下架 API 自然语言验收点

## 一、主流程验收点

### 1.1 素材档案作为入口
**验收步骤：**
1. 调用 `POST /api/v1/materials` 创建素材档案，填写素材编号、名称、类型、版权方
2. 调用 `GET /api/v1/materials/:id` 查询素材详情
3. 验证返回的素材信息与创建时一致

**预期结果：**
- 素材创建成功，返回唯一的素材 ID
- 查询接口能完整返回素材的所有属性
- 下一步：如失败，检查 `materials` 表数据是否正确插入

### 1.2 授权范围规则生效
**验收步骤：**
1. 调用 `POST /api/v1/materials/:id/authorizations` 为素材创建授权
2. 填写授权编号、渠道信息、生效日期、到期日期
3. 调用 `POST /api/v1/authorizations/:id/evaluate` 评估授权有效性

**预期结果：**
- 在生效日期之后、到期日期之前，返回 `isValid: true`
- 在生效日期之前，返回 `reason: NOT_YET_EFFECTIVE`
- 下一步：如失败，检查 `authorizations` 表的日期字段格式

### 1.3 地域规则生效
**验收步骤：**
1. 创建授权时添加 `regionRules`，设置包含规则（如包含 CN、JP）
2. 调用评估接口传入 `regionCode: "CN"`
3. 再调用评估接口传入 `regionCode: "US"`
4. 添加排除规则（如排除 CN-HK），调用评估接口传入 `regionCode: "CN-HK"`

**预期结果：**
- CN 地区评估通过（isValid: true）
- US 地区评估失败（不在包含列表中）
- CN-HK 地区评估失败（在排除列表中，即使 CN 在包含列表）
- 下一步：如失败，检查 `region_rules` 表的 `rule_type` 和 `region_code`

### 1.4 到期自动下架
**验收步骤：**
1. 创建一个授权，设置 `expirationDate` 为过去的时间
2. 确保授权状态为 `ACTIVE`
3. 调用 `POST /api/v1/removals/process-expired`
4. 查询该授权状态

**预期结果：**
- 下架接口返回处理数量 > 0
- 授权状态变为 `EXPIRED`
- `removal_records` 表新增一条记录，原因为 `expired`
- 下一步：如失败，检查 `processExpiredRemovals` 方法的日期比较逻辑

### 1.5 撤销通知
**验收步骤：**
1. 创建一个活跃状态的授权
2. 调用 `POST /api/v1/authorizations/:id/revoke`，传入撤销人、撤销原因
3. 查询该授权和下架记录

**预期结果：**
- 授权状态变为 `REVOKED`
- 生成下架记录，原因为 `revoked`
- 撤销时间和撤销人正确记录
- 下一步：如失败，检查 `processRevocation` 方法的事务处理

### 1.6 授权清单导出
**验收步骤：**
1. 确保系统中有至少一条授权记录
2. 调用 `POST /api/v1/exports/authorization-list`
3. 检查 `exports/` 目录下生成的 CSV 文件

**预期结果：**
- CSV 文件包含：授权编号、素材信息、版权方、渠道、授权范围、生效/到期日期、状态、地域规则、撤销信息
- 导出文件有业务意义，可直接用于合规复查
- 下一步：如失败，检查 `ExportService.exportAuthorizationList` 方法

## 二、异常场景验收点

### 2.1 重复撤销
**验收步骤：**
1. 创建授权并成功撤销一次
2. 对同一授权再次调用撤销接口

**预期结果：**
- 第二次撤销返回错误信息「授权已被撤销」
- 不产生新的下架记录
- 下一步：如失败，检查撤销前的状态校验逻辑

### 2.2 已到期但未处理
**验收步骤：**
1. 创建一个已到期但状态仍为 `ACTIVE` 的授权
2. 调用 `checkExpiredAuthorizations` 方法

**预期结果：**
- 该授权应被正确识别
- 评估日志记录 `AUTHORIZATION_EXPIRED`
- 下一步：如失败，检查查询条件中的日期比较

### 2.3 地域规则冲突
**验收步骤：**
1. 创建授权时同时设置包含规则（包含 CN）和排除规则（排除 CN-HK）
2. 分别评估 CN 和 CN-HK

**预期结果：**
- CN 通过，CN-HK 被拒绝
- 排除规则优先级高于包含规则
- 下一步：如失败，检查 `evaluateRegionRule` 中的规则执行顺序

### 2.4 评估历史可追溯
**验收步骤：**
1. 对同一授权多次调用评估接口（不同时间、不同地区）
2. 调用 `GET /api/v1/authorizations/:id/evaluation-history`

**预期结果：**
- 返回多条评估记录，按时间倒序排列
- 每条记录包含：评估时间、输入参数、执行步骤、最终结果、触发动作
- 下一步：如失败，检查 `rule_evaluation_logs` 表数据

### 2.5 无效参数处理
**验收步骤：**
1. 创建素材时缺少必填字段（如不填 `materialCode`）
2. 撤销授权时不指定 `revokedBy`

**预期结果：**
- 返回 400 状态码和明确的错误信息
- 不产生任何数据变更
- 下一步：如失败，检查各路由的参数校验逻辑

## 三、数据一致性验收点

### 3.1 下架记录与授权状态一致
**验收步骤：**
1. 查询所有 `removal_records`
2. 对比每条记录对应的 `authorization.status`

**验证逻辑：**
- 下架原因 = expired → 授权状态必须 = EXPIRED
- 下架原因 = revoked → 授权状态必须 = REVOKED
- 下一步：如不一致，检查下架流程中的状态更新

### 3.2 规则评估日志完整性
**验收步骤：**
1. 对任意授权执行一次评估
2. 查询 `rule_evaluation_logs` 中对应记录

**验证内容：**
- `input_data` 包含所有输入参数
- `evaluation_steps` 包含每一步的判断条件和结果
- `final_result` 明确说明通过或失败的原因
- `triggered_action` 在触发下架时有值
- 下一步：如缺失，检查 `RuleEngine.logStep` 和 `saveEvaluationLog`

### 3.3 导出文件与数据库一致
**验收步骤：**
1. 导出授权清单 CSV
2. 随机抽取几条记录与数据库对比

**验证字段：**
- 授权编号、素材编号、版权方、渠道名称
- 生效日期、到期日期、状态
- 地域规则（允许/禁止地区）
- 下一步：如不一致，检查 `ExportService` 中的字段映射

### 3.4 通知记录与事件一致
**验收步骤：**
1. 执行一次撤销或到期下架操作
2. 查询 `notifications` 表

**验证逻辑：**
- 通知类型与事件类型匹配（expired/revoked）
- 通知内容包含正确的素材、渠道、日期信息
- 下一步：如缺失，检查各服务中的通知创建调用

## 四、业务复核路径指引

### 4.1 「为什么这个素材被下架了？」
1. 调用 `GET /api/v1/removals`，按 `materialId` 筛选
2. 找到下架记录，查看 `reason` 和 `reason_detail`
3. 点击下架记录 ID 调用 `GET /api/v1/removals/:id`
4. 查看 `rule_evaluation_result` 中的执行步骤
5. 如需要追溯历史，调用授权的 `evaluation-history`

### 4.2 「这个授权在哪些地区可用？」
1. 调用 `GET /api/v1/authorizations/:id/region-rules`
2. 查看包含规则（include）和排除规则（exclude）
3. 执行逻辑：排除优先 → 仅包含时白名单 → 无规则默认允许
4. 可调用 `POST /api/v1/authorizations/:id/evaluate` 传入具体地区测试

### 4.3 「即将到期的授权有哪些？」
1. 调用 `POST /api/v1/notifications/send-expiration-warnings`（会创建通知记录）
2. 或直接查看 `authorizations` 表中 `expiration_date` 在 N 天内的记录
3. 导出授权清单，按到期日期排序进行人工复核

### 4.4 「撤销操作是谁执行的？」
1. 查询 `authorizations` 表，找到 `revoked_by` 和 `revoked_at`
2. 查询 `removal_records` 表，找到对应 `executed_by`
3. 两者应一致，如不一致说明流程有问题

## 五、快速排查清单

| 现象 | 可能原因 | 检查位置 |
|------|----------|----------|
| 到期未下架 | 授权状态不是 ACTIVE | authorizations.status |
| 地域规则不生效 | 规则类型错误 | region_rules.rule_type |
| 导出缺少地域 | 关联查询失败 | ExportService 中的 RegionRule 查询 |
| 评估历史为空 | 日志未保存 | RuleEngine.saveEvaluationLog |
| 通知未创建 | 参数缺失 | 通知接收人 recipient |

---

**说明：** 普通使用者可按照上述验收点逐步验证，每一步都明确标注了「下一步该查哪里」，便于问题定位和业务复核。
