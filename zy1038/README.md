# Feature Flag 灰度规则演练台

一个本地可运行的 Feature Flag 灰度规则演练平台，帮助团队可视化地理解和测试灰度发布规则，解决"为什么这个用户命中了/没命中灰度"的问题。

## 🎯 功能特性

### 核心功能
- **用户样本管理**：维护一批测试用户样本，支持地区、账号类型、标签、注册天数等属性
- **Segment 规则**：创建用户分群规则，支持多条件组合（AND/OR）
- **Feature Flags**：灵活的开关配置，支持：
  - 全局开关
  - 按 Segment 分群开启
  - 百分比灰度（基于稳定 Hash，同一用户结果永远一致）
  - Kill Switch（紧急关闭，最高优先级）
  - 依赖其他 Flag

### 演练功能
- **单用户演练**：选择一个用户，查看每个 Flag 的最终状态，并通过时间线展示评估过程
- **批量演练**：对一批用户进行评估，统计各 Flag 命中情况，识别冲突和异常用户

### 数据管理
- **本地持久化**：所有数据存储在 JSON 文件中
- **导入导出**：支持 JSON 格式的完整数据备份和恢复
- **审计记录**：所有增删改操作都有详细日志
- **演练报告**：支持导出 Markdown 和 HTML 格式的报告

## 🚀 快速开始

### 环境要求
- Node.js >= 16
- npm 或 yarn

### 安装依赖

```bash
# 安装所有依赖（后端 + 前端）
npm run install:all

# 或者分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 启动服务

```bash
# 同时启动后端和前端（开发模式）
npm run dev

# 或者分别启动
# 终端1：启动后端（端口 3001）
cd backend && npm run dev

# 终端2：启动前端（端口 5173）
cd frontend && npm run dev
```

### 访问应用
启动成功后访问：http://localhost:5173

## 📦 项目结构

```
feature-flag-playground/
├── backend/                    # 后端服务
│   ├── package.json
│   ├── src/
│   │   ├── server.js          # Express 入口
│   │   ├── services/
│   │   │   ├── storage.js          # JSON 文件存储
│   │   │   ├── hashService.js      # 稳定 Hash 服务
│   │   │   ├── evaluationEngine.js # 规则评估引擎
│   │   │   ├── auditService.js     # 审计日志服务
│   │   │   └── sampleData.js       # 示例数据
│   │   └── routes/
│   │       ├── users.js
│   │       ├── segments.js
│   │       ├── flags.js
│   │       ├── evaluation.js
│   │       ├── audit.js
│   │       ├── importExport.js
│   │       └── report.js
│   └── data/                    # 数据存储目录
│       ├── users.json
│       ├── segments.json
│       ├── flags.json
│       └── audit.json
├── frontend/                    # 前端应用
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── services/
│       │   └── api.js
│       └── pages/
│           ├── Dashboard.jsx
│           ├── Users.jsx
│           ├── Segments.jsx
│           ├── Flags.jsx
│           ├── SingleEvaluation.jsx
│           ├── BatchEvaluation.jsx
│           ├── Audit.jsx
│           ├── ImportExport.jsx
│           └── Report.jsx
└── package.json                # 根目录脚本配置
```

## 🧪 示例数据验证流程

首次启动时，系统会自动初始化示例数据。你可以按以下流程验证核心功能：

### 1. 查看示例数据
- 访问仪表盘，查看统计概览（24 个用户、6 个 Segment、7 个 Flag）
- 点击"用户样本"查看所有测试用户
- 点击"Segment 规则"查看预设的分群规则
- 点击"Feature Flags"查看预设的开关配置

### 2. 单用户演练测试
点击左侧菜单的"单用户演练"：

**测试场景 1：Kill Switch 覆盖**
- 选择用户"张三"（中国付费老用户）
- 点击"开始评估"
- 查看 `feature_dark_mode` Flag：
  - 注意该 Flag 的 Kill Switch 是开启的
  - 结果应该是"关闭"，并且评估时间线会显示"Kill Switch 开启，直接关闭"

**测试场景 2：依赖检查**
- 选择任意用户
- 查看 `feature_new_payment` Flag：
  - 该 Flag 依赖 `feature_payment_v2`
  - 评估时间线会先检查依赖的 Flag 状态

**测试场景 3：百分比灰度**
- 选择用户"李四"
- 查看 `feature_ai_assistant`（30% 灰度）
- 记录分桶值（Hash 计算结果）
- 刷新页面，再次评估同一用户
- **验证**：分桶值和结果应该完全一致（稳定 Hash）

### 3. 批量演练测试
点击左侧菜单的"批量演练"：

1. 保持默认"全部用户"
2. 点击"开始批量评估"
3. 查看结果：
   - **统计概览**：总用户数、总 Flag 数、冲突数、异常数
   - **各 Flag 命中统计**：每个 Flag 的开启人数和开启率
   - **冲突列表**：被 Kill Switch 或依赖覆盖的用户
   - **异常用户**：识别出的异常用户
   - **所有用户详情**：可展开查看每个用户的详细评估结果

### 4. 修改规则并验证

**测试修改 Flag**：
1. 进入"Feature Flags"页面
2. 找到 `feature_dark_mode`，关闭它的 Kill Switch
3. 回到"单用户演练"，重新评估"张三"
4. **验证**：结果应该变为"开启"，因为张三匹配了"中国付费老用户"Segment

**测试创建新 Segment**：
1. 进入"Segment 规则"页面
2. 点击"新建"，填写：
   - 名称：日本用户
   - 条件 1：字段 `region`，运算符 `==`，值 `JP`
3. 保存
4. 进入"Feature Flags"，修改某个 Flag 关联这个新 Segment
5. 演练验证：选择"田中さん"（日本用户），应该命中该 Flag

### 5. 导入导出测试
1. 进入"导入导出"页面
2. 点击"导出为 JSON 文件"，保存到本地
3. 修改一些配置（例如删除一个用户）
4. 点击"重置为示例数据"
5. **验证**：所有数据恢复到初始状态

### 6. 审计记录验证
1. 做一些操作（创建/修改/删除）
2. 进入"审计记录"页面
3. **验证**：刚才的操作都有记录，包含：
   - 操作时间
   - 操作类型
   - 实体类型
   - 操作描述
   - 可展开查看新旧值对比

### 7. 报告导出
1. 先执行一次批量演练（生成统计数据）
2. 进入"演练报告"页面
3. 点击"导出 Markdown"或"导出 HTML"
4. **验证**：下载的文件包含：
   - 快速统计
   - Flag 规则摘要
   - Segment 规则摘要
   - 批量命中统计
   - 最近改动记录

## 🔧 规则评估逻辑

### 评估优先级（从高到低）
1. **Kill Switch**：如果开启，直接返回 `false`（最高优先级）
2. **依赖检查**：如果 `dependsOnFlag` 存在且为 `false`，返回 `false`
3. **全局开关**：如果 `enabled` 为 `false`，返回 `false`
4. **Segment 匹配**：如果配置了 segments，检查用户是否匹配任一 Segment
5. **百分比灰度**：如果配置了 percentage，计算稳定 Hash 分桶

### 稳定 Hash 算法
使用 MurmurHash 算法，输入为 `userId + flagKey`：
```javascript
bucket = (murmurhash(userId + ":" + flagKey) % 100) + 1;
// bucket 范围 1-100
// 如果 bucket <= percentage，则命中
```

**特性**：同一 userId 对同一 flagKey，每次计算结果永远一致。

## 📝 API 接口

### 用户管理
- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取单个用户
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### Segment 管理
- `GET /api/segments` - 获取 Segment 列表
- `GET /api/segments/:id` - 获取单个 Segment
- `POST /api/segments` - 创建 Segment
- `PUT /api/segments/:id` - 更新 Segment
- `DELETE /api/segments/:id` - 删除 Segment

### Flag 管理
- `GET /api/flags` - 获取 Flag 列表
- `GET /api/flags/:id` - 获取单个 Flag
- `POST /api/flags` - 创建 Flag
- `PUT /api/flags/:id` - 更新 Flag
- `DELETE /api/flags/:id` - 删除 Flag
- `PUT /api/flags/:id/toggle` - 切换开关
- `PUT /api/flags/:id/kill-switch` - 切换 Kill Switch

### 评估接口
- `POST /api/evaluate/:userId` - 评估单个用户的所有 Flag
- `POST /api/evaluate` - 批量评估
- `POST /api/evaluate/segment-check` - 检查用户是否匹配 Segment
- `GET /api/evaluate/hash/:userId/:flagKey` - 计算 Hash 分桶

### 审计记录
- `GET /api/audit` - 获取审计记录
- `DELETE /api/audit` - 清空审计记录

### 导入导出
- `GET /api/export` - 导出所有数据
- `POST /api/import` - 导入数据
- `POST /api/init-sample` - 初始化示例数据

### 报告
- `GET /api/report` - 获取报告数据（JSON）
- `GET /api/report?format=markdown` - 导出 Markdown
- `GET /api/report?format=html` - 导出 HTML

## 🔍 Segment 条件运算符

支持的字段类型和运算符：

### 字符串类型 (region, accountType)
- `==` - 等于
- `!=` - 不等于
- `in` - 包含在列表中
- `not in` - 不包含在列表中

### 数值类型 (registrationDays)
- `==` - 等于
- `!=` - 不等于
- `>` - 大于
- `>=` - 大于等于
- `<` - 小于
- `<=` - 小于等于
- `between` - 介于两者之间

### 数组类型 (tags)
- `contains` - 包含任一标签
- `contains all` - 包含所有标签
- `not contains` - 不包含
- `empty` - 为空
- `not empty` - 不为空

## 📄 License

MIT

---

## ❓ 常见问题

**Q：数据存储在哪里？**
A：所有数据存储在 `backend/data/` 目录下的 JSON 文件中，可以直接查看或备份。

**Q：为什么同一用户每次评估结果都一样？**
A：百分比灰度使用的是稳定 Hash 算法，结合 userId 和 flagKey 计算，确保同一用户对同一 Flag 的分桶结果永远一致。

**Q：Kill Switch 和全局开关有什么区别？**
A：Kill Switch 是紧急关闭开关，优先级最高，开启后无论其他配置如何都返回 false。全局开关是普通开关，优先级低于 Kill Switch 和依赖检查。

**Q：如何添加更多用户属性？**
A：可以在用户样本中添加任意属性，然后在 Segment 规则中使用这些属性进行匹配。评估引擎会自动处理新增的字段。
