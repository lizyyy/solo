# 邮件模板变量预检报告

> 生成时间: 2026/5/24 20:49:56

## 📊 检查摘要

**状态:** ❌ **发现错误 - 需要修复**

| 指标 | 数值 |
|------|------|
| 扫描模板 | 2 |
| 发现变量 | 17 |
| ❌ 错误 | 2 |
| ⚠️ 警告 | 11 |
| ℹ️ 信息 | 0 |
| **退出码** | **2** |

## 📄 模板检查详情

### 1. /Users/lzy/pro/solo/workspaces/zy71080/examples/templates/welcome.en-US.html [en-US]

**状态:** ⚠️ 警告

#### 发现的变量

| 变量名 | 默认值 | 出现次数 | 条件变量 |
|--------|--------|----------|----------|
| `companyName` | ❌ | 3 | ❌ |
| `username` | ❌ | 3 | ❌ |
| `userEmail` | ✅ | 1 | ❌ |
| `vip_code` | ❌ | 1 | ❌ |
| `registerDate` | ❌ | 1 | ❌ |
| `membershipLevel` | ✅ | 1 | ❌ |
| `promotionText` | ❌ | 1 | ❌ |
| `extraMessage` | ❌ | 1 | ❌ |

#### 发现的问题

##### ⚠️ 必填变量 "companyName" 建议设置默认值

**出现位置:**
- 位置 undefined
- 位置 undefined
- 位置 undefined

**说明:** 公司名称

##### ⚠️ 必填变量 "username" 建议设置默认值

**出现位置:**
- 位置 undefined
- 位置 undefined
- 位置 undefined

**说明:** 用户姓名

##### ℹ️ 变量 "userEmail" 的默认值与清单不一致

##### ⚠️ 模板中使用的变量 "vip_code" 不在变量清单中

**出现位置:**
- 第 17 行 - `ar VIP Member</strong>         <p>Exclusive code: {{ vip_code }}</p>     </div>     {% endif %}`

##### ⚠️ 必填变量 "registerDate" 建议设置默认值

**出现位置:**
- 位置 undefined

**说明:** 注册日期

##### ℹ️ 变量 "membershipLevel" 的默认值与清单不一致


### 2. /Users/lzy/pro/solo/workspaces/zy71080/examples/templates/welcome.zh-CN.html [zh-CN]

**状态:** ⚠️ 警告

#### 发现的变量

| 变量名 | 默认值 | 出现次数 | 条件变量 |
|--------|--------|----------|----------|
| `companyName` | ❌ | 3 | ❌ |
| `userName` | ❌ | 3 | ❌ |
| `userEmail` | ✅ | 1 | ❌ |
| `vipCode` | ❌ | 1 | ❌ |
| `registerDate` | ❌ | 1 | ❌ |
| `membershipLevel` | ✅ | 1 | ❌ |
| `promotionText` | ❌ | 1 | ❌ |
| `promotionEndDate` | ❌ | 1 | ❌ |
| `footerText` | ✅ | 1 | ❌ |

#### 发现的问题

##### ⚠️ 必填变量 "companyName" 建议设置默认值

**出现位置:**
- 位置 undefined
- 位置 undefined
- 位置 undefined

**说明:** 公司名称

##### ⚠️ 必填变量 "userName" 建议设置默认值

**出现位置:**
- 位置 undefined
- 位置 undefined
- 位置 undefined

**说明:** 用户姓名

##### ⚠️ 必填变量 "registerDate" 建议设置默认值

**出现位置:**
- 位置 undefined

**说明:** 注册日期



## 🌐 多语言一致性检查

| 类型 | 严重程度 | 描述 |
|------|----------|------|
| `i18n_missing_variable` | ❌ 错误 | 变量 "vip_code" 在 zh-CN 版本中缺失 |
| `i18n_missing_variable` | ❌ 错误 | 变量 "extramessage" 在 zh-CN 版本中缺失 |
| `i18n_extra_variable` | ⚠️ 警告 | 变量 "vipcode" 在 zh-CN 版本中存在但 en-US 版本中没有 |
| `i18n_extra_variable` | ⚠️ 警告 | 变量 "promotionenddate" 在 zh-CN 版本中存在但 en-US 版本中没有 |
| `i18n_extra_variable` | ⚠️ 警告 | 变量 "footertext" 在 zh-CN 版本中存在但 en-US 版本中没有 |
| `i18n_case_inconsistency` | ⚠️ 警告 | 变量 "username" 在各语言版本中命名不一致 |

### 各语言版本变量对比

| 变量名 | en-US | zh-CN |
| --- | --- | --- |
| `companyname` | ✅ | ✅ |
| `username` | ✅ | ✅ |
| `useremail` | ✅ | ✅ |
| `vip_code` | ✅ | ❌ |
| `registerdate` | ✅ | ✅ |
| `membershiplevel` | ✅ | ✅ |
| `promotiontext` | ✅ | ✅ |
| `extramessage` | ✅ | ❌ |
| `vipcode` | ❌ | ✅ |
| `promotionenddate` | ❌ | ✅ |
| `footertext` | ❌ | ✅ |

## 🎨 样例渲染

### /Users/lzy/pro/solo/workspaces/zy71080/examples/templates/welcome.en-US.html [en-US]

**状态:** ✅ 成功

- 预览文件: [welcome.en-US_en-US.html](/Users/lzy/pro/solo/workspaces/zy71080/reports/previews/welcome.en-US_en-US.html)

### /Users/lzy/pro/solo/workspaces/zy71080/examples/templates/welcome.zh-CN.html [zh-CN]

**状态:** ✅ 成功

- 预览文件: [welcome.zh-CN_zh-CN.html](/Users/lzy/pro/solo/workspaces/zy71080/reports/previews/welcome.zh-CN_zh-CN.html)


## 📖 问题类型说明

| 问题类型 | 严重程度 | 说明 | 修复建议 |
|----------|----------|------|----------|
| `missing_variable` | ❌ 错误 | 变量清单中标记为必填的变量未在模板中使用 | 检查模板是否遗漏该变量，或更新清单 |
| `extra_variable` | ⚠️ 警告 | 模板中使用了变量清单中不存在的变量 | 确认变量是否必要，或添加到变量清单 |
| `case_inconsistency` | ⚠️ 警告 | 同一变量在模板中大小写不一致 | 统一变量命名风格 |
| `i18n_missing_variable` | ❌ 错误 | 某语言版本缺少其他版本有的变量 | 检查翻译版本是否遗漏变量 |
| `conditional_issue` | ⚠️ 警告 | 条件块可能存在问题 | 检查条件逻辑和内容 |
| `missing_sample` | ⚠️ 警告 | 样例数据中缺少该变量且无默认值 | 补充样例数据或设置默认值 |
