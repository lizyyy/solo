# 稀疏矩阵账单压缩 - 端到端验证手册

## 一、启动项目

### 1. 安装依赖
```bash
cd /Users/lzy/pro/solo/workspaces/zy72329
npm install
```

### 2. 启动后端服务
```bash
cd /Users/lzy/pro/solo/workspaces/zy72329
npx tsx api/server.ts
```
默认端口：3002

### 3. 启动前端开发服务器
```bash
cd /Users/lzy/pro/solo/workspaces/zy72329
npx vite --port 5175
```
默认端口：5175

### 4. 打开浏览器
访问 http://localhost:5175

---

## 二、测试账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 行政老师 | admin | admin123 | 导入数据、查看结果、版本、历史、导出 |
| 唐老师（教练） | coach | coach123 | 处理冲突、查看结果、版本、历史 |
| 教研组 | reviewer | reviewer123 | 复核断档、查看结果、版本、历史 |

---

## 三、完整操作链路验证

### 前置准备
- 测试数据文件位于 `test-data/` 目录：
  - `teacher_notes_sample.csv`（4条老师批注）
  - `sampling_list_sample.csv`（4条抽样名单，含断档、补录）

---

### 验证步骤 1：老师批注第一次导入

**操作人**：行政老师（admin）

**操作步骤**：
1. 使用 admin/admin123 登录
2. 点击左侧菜单"数据导入"
3. 在"老师批注导入"区域，点击或拖拽上传 `teacher_notes_sample.csv`
4. 点击"开始导入"按钮

**验证要点**：
- ✅ 导入成功提示显示："成功导入 4 条老师批注数据"
- ✅ 顶部绿色横幅显示统计：总记录数、断档、补录、冲突
- ✅ 最近导入记录列表中新增一条：teacher_notes_sample.csv，4条，成功
- ✅ 左侧菜单点击"整合结果"，总记录数应为 4（全部为 pending 状态）
- ✅ 左侧菜单点击"参数版本"，应生成 v1.0 版本（导入老师批注 4 条）
- ✅ 左侧菜单点击"历史记录"，应有两条记录：
  - 创建参数版本 v1.0
  - 导入老师批注数据 4 条

---

### 验证步骤 2：抽样名单导入（触发匹配+断档检测+补录识别）

**操作人**：行政老师（admin）

**操作步骤**：
1. 保持登录状态，进入"数据导入"页
2. 在"抽样名单导入"区域，上传 `sampling_list_sample.csv`
3. 点击"开始导入"按钮

**验证要点**：
- ✅ 导入成功提示显示："成功导入 4 条抽样名单数据"
- ✅ 顶部横幅显示正确的分类统计：
  - 顺利记录：1（003）
  - 断档记录：1（007，缺006）
  - 补录记录：1（012，旧口径）
  - 冲突记录：1（009，仅抽样有，批注中无？或者要看实际匹配结果）
- ✅ 最近导入记录列表新增一条抽样名单导入记录
- ✅ "整合结果"页各标签页计数正确
- ✅ "参数版本"页生成 v1.1 版本
- ✅ "历史记录"页新增 N 条记录（导入、逐记录匹配、断档检测、版本创建）

---

### 验证步骤 3：断档复核（教研组）

**操作人**：教研组（reviewer）

**操作步骤**：
1. 退出登录，使用 reviewer/reviewer123 登录
2. 点击左侧"断档复核"菜单
3. 看到黄色警示条："编号断档不自动归正常！"
4. 看到断档卡片：005 → MISSING 006 → 007
5. 点击卡片展开复核表单
6. 填写复核意见（建议≥30字，如："经核对原始凭证，006号单据因学生退费已人工删除，断档属于正常情况，标记为正常。"）
7. 点击"标记正常"按钮

**验证要点**：
- ✅ 断档卡片状态变为"已复核 - 正常"
- ✅ "整合结果"页：断档记录数-1，已复核数+1
- ✅ "参数版本"页：生成 v1.2 版本
- ✅ "历史记录"页新增 2 条：
  - 复核断档记录 006，结果: 正常
  - 创建参数版本 v1.2
- ✅ 证据链完整保留：
  - 原始说法（编号序列）
  - 改后值（复核正常）
  - 处理原因（复核意见全文）
  - 下一步找谁（唐老师确认/归档）

---

### 验证步骤 4：参数版本对比（核心验证）

**操作人**：任意角色

**操作步骤**：
1. 进入"参数版本"页
2. 在版本时间线中，选择 v1.0（来源）和 v1.1（目标）
3. 点击"开始对比"按钮

**验证要点**：
- ✅ 对比页面显示来源版本和目标版本的基本信息：
  - 版本号、操作人、创建时间、变更摘要
- ✅ 对比摘要卡片：
  - 总记录数变化：4 → 更多
  - 新增/删除/修改/未变化 数量正确
- ✅ 各状态数量变化表：
  - 顺利、断档、补录、冲突的 before/after/diff
  - 颜色区分：新增绿色、减少红色
- ✅ 记录级详细变化：
  - 每条变化记录的编号、变化类型（新增/删除/修改）
  - 修改前后的状态标签
  - 逐字段变化明细（字段名 + before + after）

---

### 验证步骤 5：导出报告

**操作人**：行政老师（admin）

**操作步骤**：
1. 进入"整合结果"页
2. 点击右上角"导出 Excel"按钮
3. 点击"导出 CSV"按钮

**验证要点**：
- ✅ Excel 文件成功下载，文件名格式：稀疏矩阵账单压缩_对账报告_YYYY-MM-DD.xlsx
- ✅ Excel 包含两个 sheet：
  - "对账结果"：所有记录的完整字段（编号、日期、老师、金额、状态、批注原文、抽样原文、断档信息、冲突信息）
  - "统计汇总"：各状态数量统计
- ✅ CSV 文件成功下载，内容与 Excel 第一个 sheet 一致
- ✅ 导出内容与当前页面显示的数据完全一致（同一份最新数据）

---

### 验证步骤 6：证据链全链路一致性

**操作人**：任意角色

**操作步骤**：
1. 进入"整合结果"页
2. 点击任意一条记录（如 007 断档记录）
3. 右侧抽屉打开证据链

**验证要点 - 8大区信息完整**：
1. ✅ 当前状态（彩色徽标+文字说明）
2. ✅ 原始说法（批注原文+抽样原文+编号序列）
3. ✅ 改后值/当前状态
4. ✅ 处理原因（reason 全文）
5. ✅ 下一步找谁（nextHandler）
6. ✅ 完整批注内容
7. ✅ 完整抽样内容
8. ✅ 完整操作历史时间线（所有操作按时间倒序）

**同一份数据验证**：
- ✅ 列表页看到的状态 = 详情页状态 = 证据链当前状态
- ✅ 历史记录页的操作时间线 = 证据链里的操作时间线
- ✅ 参数版本里的记录数 = 整合结果页的统计数
- ✅ 导出文件里的状态 = 当前页面显示的状态

---

## 四、关键数据一致性核对表

以**007号断档记录**为例，全链路验证：

| 页面/模块 | 验证项 | 预期值 |
|-----------|--------|--------|
| 整合结果 - 断档标签 | 断档记录数 | 1 |
| 整合结果 - 列表 | 007号状态 | 断档 |
| 证据链 - 当前状态 | 状态标签 | 断档（橙色） |
| 证据链 - 原始说法 | 编号序列 | 005 → MISSING 006 → 007 |
| 证据链 - 处理原因 | reason | "编号断档：005之后跳过006直接到007..." |
| 证据链 - 下一步 | nextHandler | 教研组 |
| 历史记录 - 匹配记录 | 操作描述 | "匹配记录 007 状态为断档" |
| 历史记录 - 断档检测 | 操作描述 | "检测到断档：缺失记录 006" |
| 参数版本 v1.1 | 断档计数 | 1 |
| 导出报告 - 007行 | 当前状态 | 断档 |
| 导出报告 - 007行 | 断档缺失编号 | 006 |

---

## 五、API 快速验证（可选）

使用 curl 验证后端接口：

```bash
# 1. 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

echo "Token: $TOKEN"

# 2. 导入老师批注
curl -X POST http://localhost:3002/api/import/teacher-notes \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/teacher_notes_sample.csv"

# 3. 导入抽样名单
curl -X POST http://localhost:3002/api/import/sampling-list \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/sampling_list_sample.csv"

# 4. 获取记录列表
curl -s http://localhost:3002/api/records \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

# 5. 获取版本列表
curl -s http://localhost:3002/api/versions \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

# 6. 版本对比
curl -s "http://localhost:3002/api/versions/compare?from=1.0&to=1.1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

# 7. 获取导入历史
curl -s http://localhost:3002/api/import/history \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

# 8. 导出 Excel
curl -s -o report.xlsx http://localhost:3002/api/export/excel \
  -H "Authorization: Bearer $TOKEN"
file report.xlsx
```

---

## 六、重置数据库

如需重置数据库重新测试：

```bash
rm /Users/lzy/pro/solo/workspaces/zy72329/data/app.db
```

重启后端服务后，数据库会自动重新创建并初始化用户。
