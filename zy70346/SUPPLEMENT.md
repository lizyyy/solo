# 消息模板发布台 - 补充说明文档

## 一、主要边界

### 1. 发布状态流转边界

```
草稿(draft) → 灰度中(gradual) → 全量(full)
   ↓              ↓
   回滚(rolled_back) ←(灰度失败回滚)
```

**核心规则：**
- 灰度发布必须先于全量发布（草稿状态不能直接全量）
- 已回滚的版本不能再次发布（状态为 rolled_back 时所有发布接口拒绝）
- 只有灰度中状态才能执行全量发布
- 只有灰度中或全量状态才能执行回滚

**边界代码位置：**
- `backend/src/services/releaseService.js:209-214` - 全量发布前置状态检查
- `backend/src/services/releaseService.js:236-238` - 已回滚版本禁止发布
- `backend/src/services/releaseService.js:292-297` - 可回滚状态检查

### 2. 并发发布冲突边界

**规则：**
- 同一模板同一时间只能有一个进行中的发布操作
- 如果存在 `status IN ('pending', 'running')` 的 ReleaseRecord，则拒绝新的发布

**边界代码位置：**
- `backend/src/services/validationService.js:205-230` - `checkConcurrency` 函数
- `backend/src/services/releaseService.js:240-244` - 发布前并发检查

### 3. 变量校验边界

**必填变量校验：**
- 模板中使用的变量必须在变量字典中定义
- 定义为 `isRequired=true` 的变量必须提供 `defaultValue`
- 变量字典中定义但未使用的变量仅告警，不阻断

**渠道长度校验：**
| 渠道 | 字段 | 最大长度 | 代码位置 |
|------|------|----------|----------|
| 短信 | 内容 | 67字符 | `validationService.js:96-109` |
| 邮件 | 主题 | 100字符 | `validationService.js:111-125` |
| 站内信 | 标题 | 50字符 | `validationService.js:127-141` |

**长度计算：**
- 使用变量默认值替换后计算实际长度
- 中文、符号各算1个字符

**边界代码位置：**
- `backend/src/services/validationService.js:39-159` - `validateTemplate` 函数

### 4. 版本快照边界

**每次创建版本时自动快照：**
- 变量字典全量快照（`variableDictionary` 字段，JSON格式）
- 渠道限制配置快照（`channelLimits` 字段）
- 所有渠道模板内容独立存储

**设计意图：**
- 发布历史中的每个版本都能独立追溯
- 后续修改变量字典不影响已发布版本
- 回滚时能精确恢复到历史状态

**边界代码位置：**
- `backend/src/services/releaseService.js:27-34` - 变量字典快照
- `backend/src/services/releaseService.js:36-40` - 渠道限制快照
- `frontend/src/pages/TemplateDetail.jsx:566-574` - 前端展示快照

---

## 二、一个失败路径

### 路径名称：灰度验证失败回滚

#### 场景描述
运营人员修改了短信模板，增加了新变量但忘记设置默认值，或模板长度超限。经过校验发现问题后，或者灰度发布后实际验证失败，需要回滚到上一版本。

#### 完整执行流程

**阶段1：准备发布**
```
1. 运营在前端编辑模板内容
2. 点击"校验模板"按钮
3. 系统检查发现错误：
   - 错误1：变量 {{newVar}} 在模板中使用但未定义
   - 错误2：短信内容长度 78/67 超限
4. 显示红色错误提示，"灰度发布"按钮保持禁用
```

**阶段2：（假设运营绕过校验或校验后又修改）**
```
1. 运营创建新版本 v2
2. 点击"灰度发布"
3. 后端在发布前再次执行校验
4. 校验失败，接口返回错误
5. 灰度发布被拒绝
```

**阶段3：灰度发布后验证失败**
```
1. 假设 v2 版本通过了校验，灰度发布成功
2. 实际发送测试发现格式问题（如邮件HTML渲染异常）
3. 运营点击"灰度失败回滚"按钮
4. 填写失败原因："邮件样式在手机端显示异常"
5. 确认执行
```

**阶段4：系统执行回滚**
```
1. 创建 ReleaseRecord，status=failed，记录失败原因
2. 将 v2 版本状态更新为 rolled_back
3. 记录审计日志：action=rollback
4. 如果 v2 是当前版本，自动恢复到 v1
5. 前端刷新，显示 v1 为当前版本
6. v2 的"灰度发布"按钮变为禁用状态
```

#### 关键代码路径

**失败检测：**
- `backend/src/services/validationService.js:69-77` - 检测未定义变量
- `backend/src/services/validationService.js:101-108` - 检测短信长度超限
- `backend/src/services/releaseService.js:115-122` - 发布前强制校验

**回滚执行：**
- `backend/src/services/releaseService.js:362-435` - `failGradualAndRollback` 函数
- `backend/src/services/releaseService.js:401-404` - 版本状态更新
- `backend/src/services/releaseService.js:406-422` - 审计日志记录
- `backend/src/services/releaseService.js:407-419` - 当前版本恢复

**前端展示：**
- `frontend/src/pages/TemplateDetail.jsx:363-369` - 灰度失败回滚按钮
- `frontend/src/pages/TemplateDetail.jsx:834-843` - 失败原因输入
- `frontend/src/pages/TemplateDetail.jsx:712-716` - 发布历史中显示失败原因

---

## 三、一次重复执行路径

### 路径名称：多轮迭代发布流程

#### 场景描述
模板需要经过多轮修改 → 发布 → 验证 → 迭代的循环。每一轮都创建新版本，保持完整的版本历史和发布轨迹。

#### 完整执行流程

**第一轮迭代（基础版本）**
```
1. 系统初始化创建 v1（草稿）
2. 运营确认内容无误
3. 校验通过 → 灰度发布（10%用户）
   - 状态：draft → gradual
   - 创建 ReleaseRecord: gradual, success
4. 灰度验证通过
5. 全量发布
   - 状态：gradual → full
   - 模板 currentVersionId = v1.id
   - 创建 ReleaseRecord: full, success
```

**第二轮迭代（需求变更）**
```
1. 运营修改模板内容
2. 点击"保存为新版本" → 创建 v2（草稿）
3. 修改变量字典（新增变量）
4. 校验：检查新变量是否都有默认值
5. 预览：测试不同渠道渲染效果
6. 灰度发布 v2（指定内部测试用户）
   - 状态：v2: draft → gradual
   - v1 保持 full 状态（继续服务其他用户）
7. 灰度验证发现问题
   - 运营点击"灰度失败回滚"
   - 状态：v2: gradual → rolled_back
   - 创建 ReleaseRecord: gradual, failed
   - 记录失败原因
8. v2 永久冻结，不能再次发布
```

**第三轮迭代（修复问题）**
```
1. 基于 v2 的问题进行修复
2. 保存为新版本 v3（草稿）
3. 重新执行完整校验
4. 预览确认修复效果
5. 灰度发布 v3
   - 状态：v3: draft → gradual
6. 灰度验证通过
7. 全量发布 v3
   - 状态：v3: gradual → full
   - 模板 currentVersionId = v3.id
   - v1 状态保持 full（历史记录）
8. 发布历史显示：
   v1: 全量 → v2: 失败回滚 → v3: 灰度 → 全量
```

#### 版本历史示例

```
版本链：
┌─────────────────────────────────────────────────────┐
│ v1: full (当前) │ v2: rolled_back │ v3: draft       │
├─────────────────────────────────────────────────────┤
│ 变量快照 v1    │ 变量快照 v2     │ 变量快照 v3     │
│ （3个变量）    │ （4个变量）     │ （4个变量修复）  │
└─────────────────────────────────────────────────────┘

发布时间线：
v1 灰度 → v1 全量 → v2 灰度(失败) → v3 灰度 → v3 全量
     ↑              ↑                   ↑
  成功            失败              成功
```

#### 关键代码路径

**版本创建：**
- `backend/src/services/releaseService.js:4-61` - `createVersion` 函数
- `backend/src/services/releaseService.js:11-20` - 版本号递增逻辑
- `backend/src/services/releaseService.js:22-34` - 获取并快照当前变量

**状态流转：**
- `backend/src/routes/templates.js:298-311` - 灰度发布接口
- `backend/src/routes/templates.js:313-326` - 全量发布接口
- `backend/src/routes/templates.js:328-341` - 回滚接口

**历史查询：**
- `backend/src/services/releaseService.js:437-468` - `getReleaseHistory` 函数
- `backend/src/services/releaseService.js:470-523` - `getVersionDiff` 函数
- `frontend/src/pages/TemplateDetail.jsx:302-326` - 版本列表展示
- `frontend/src/pages/TemplateDetail.jsx:664-750` - 发布历史时间线

#### 重复执行的关键保障

1. **版本号单调递增**：每次创建新版本，`versionNumber` 自动 +1，不会重复
2. **状态单向流转**：full → rolled_back 后不可逆转，避免状态混乱
3. **快照独立存储**：每个版本的变量字典独立保存，修改不影响历史
4. **并发控制**：事务 + 状态检查，防止同一版本重复发布
5. **审计追踪**：每个操作都有 AuditLog，可追溯谁在什么时候做了什么

---

## 四、复查清单

### 发布前检查（必做）
- [ ] 所有必填变量是否有默认值？
- [ ] 模板中使用的变量是否都在字典中定义？
- [ ] 短信内容替换变量后是否超过67字符？
- [ ] 邮件主题是否超过100字符？
- [ ] 站内信标题是否超过50字符？
- [ ] 是否已预览三个渠道的渲染效果？

### 灰度发布检查
- [ ] 灰度比例是否合理（建议10%起步）？
- [ ] 是否需要指定测试用户列表？
- [ ] 是否有上一版本可回滚？

### 全量发布检查
- [ ] 灰度发布是否已验证通过？
- [ ] 版本状态是否为 "灰度中"？
- [ ] 是否已准备好回滚计划？

### 回滚触发条件
- [ ] 灰度用户反馈异常
- [ ] 实际发送格式不符合预期
- [ ] 变量替换后数据显示异常
- [ ] 渠道兼容性问题

### 发布后确认
- [ ] 发布历史中状态是否为 "成功"？
- [ ] 版本状态是否正确更新？
- [ ] 审计日志是否已记录？
- [ ] 变量字典快照是否正确保留？
