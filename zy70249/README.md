# 城市树池积水巡检器

> 解决雨后城市树池积水、树种和病害记录分散，园林人员难以安排处置的问题

## 🚀 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

启动后访问: http://localhost:3000

### 3. 运行测试（确保服务器已启动）

```bash
npm test
```

---

## 📁 项目结构

```
.
├── server.js              # Express后端服务
├── package.json           # 项目配置
├── public/                # 前端静态文件
│   ├── index.html         # 主页面
│   ├── styles.css         # 样式文件
│   └── app.js             # 前端逻辑
├── sample-data/           # 样例数据（首次启动自动加载）
│   ├── tree-ponds.json    # 树池记录
│   ├── tree-species.json  # 树种档案
│   └── disease-records.json # 病害记录
├── data/                  # 运行时数据目录（自动创建）
├── exports/               # 导出文件目录（自动创建）
└── tests/
    └── run-tests.js       # API测试脚本
```

---

## 🌳 核心功能

### 1. 树池地图
- 可视化展示所有树池位置
- 按积水等级颜色区分（绿色=无积水，橙色=轻度/中度，红色=严重）
- 点击查看详情并快速编辑

### 2. 积水等级
- **0级**: 无积水
- **1级**: 轻度积水
- **2级**: 中度积水
- **3级**: 严重积水

### 3. 树种档案
- 管理城市树种信息（学名、耐水性、病害风险等）
- 关联树池记录，辅助决策

### 4. 病害记录
- 记录树池病害情况
- 关联树种常见病害
- 跟踪处理状态

### 5. 处置状态
- 待处理 → 处理中 → 已完成
- 一键更新状态

### 6. 本地筛选
- 按积水等级筛选
- 按处置状态筛选
- 按树种筛选
- 多种排序方式

### 7. 整改导出
- 导出当前筛选条件下的数据报告
- 包含统计汇总
- JSON格式，便于后续处理

### 8. 工作区保存/恢复
- 自动保存筛选和排序状态
- 刷新页面后自动恢复
- 手动保存/恢复命名工作区

---

## 🎯 主流程演示

### 场景：雨后巡检和处置安排

#### 步骤1：查看整体情况
1. 打开 http://localhost:3000
2. 左侧**统计信息**显示：树池总数、中度以上积水、待处理数量
3. **紧急处置（Top 5）** 列出优先级最高的树池
4. **树池地图**用颜色标识积水情况

#### 步骤2：筛选待处理的严重积水
1. 在左侧筛选区：
   - 积水等级：选择 **3级 - 严重**
   - 处置状态：选择 **待处理**
   - 排序方式：**优先处置排序**
2. 观察地图和列表自动更新
3. 点击地图上的红色点查看详情

#### 步骤3：开始处置
1. 在"树池列表"标签页
2. 点击某条记录的 **更新状态** 按钮
3. 状态从"待处理"变为"处理中"
4. 统计信息实时更新

#### 步骤4：查看关联病害
1. 切换到 **病害记录** 标签页
2. 查看哪些树池同时有积水和病害
3. 编辑病害记录，更新治疗状态

#### 步骤5：导出整改报告
1. 设置好筛选条件（如：严重积水 + 待处理）
2. 点击顶部 **导出整改报告** 按钮
3. 下载 JSON 格式报告
4. 报告包含：筛选条件、树池列表、关联病害、统计汇总

#### 步骤6：保存工作区
1. 点击 **保存工作区**
2. 输入名称（如："雨后紧急处置"）
3. 刷新页面后点击 **恢复工作区** 可恢复之前的筛选状态

---

## ⚠️ 异常操作演示

### 1. 重复编号冲突
**操作**：
1. 点击"树池列表" → "新增树池"
2. 输入已存在的编号（如 TP-001）
3. 填写其他必填字段
4. 点击创建

**预期结果**：
- 页面弹出红色提示：`冲突：树池编号冲突（已存在记录ID: 1）`
- API 响应 HTTP 409，包含 `conflictField` 和 `existingId`

**验证命令**：
```bash
curl -X POST http://localhost:3000/api/tree-ponds \
  -H "Content-Type: application/json" \
  -d '{"code":"TP-001","location":"测试","waterLevel":1,"status":"pending"}'
```

### 2. 缺失必填字段
**操作**：
1. 新增树池时，只填"积水等级"和"状态"
2. 不填"树池编号"和"位置"
3. 提交

**预期结果**：
- 页面弹出红色提示：`缺失字段：code, location`
- API 响应 HTTP 400，包含 `missingFields` 数组

**验证命令**：
```bash
curl -X POST http://localhost:3000/api/tree-ponds \
  -H "Content-Type: application/json" \
  -d '{"waterLevel":1,"status":"pending"}'
```

### 3. 操作不存在的记录
**操作**：
1. 直接调用 API 更新不存在的树池

**预期结果**：
- API 响应 HTTP 404，`error: "树池记录不存在"`

**验证命令**：
```bash
curl -X PUT http://localhost:3000/api/tree-ponds/99999 \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

### 4. 筛选无结果
**操作**：
1. 设置筛选条件：积水等级=3级，处置状态=已完成
2. 如果没有数据符合条件

**预期结果**：
- 表格显示：`暂无符合条件的树池记录`
- 地图上没有点
- 统计信息不显示错误，只显示0

---

## 🔧 API接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tree-ponds | 获取树池列表 |
| POST | /api/tree-ponds | 创建树池记录 |
| PUT | /api/tree-ponds/:id | 更新树池记录 |
| DELETE | /api/tree-ponds/:id | 删除树池记录 |
| GET | /api/tree-species | 获取树种档案 |
| POST | /api/tree-species | 创建树种档案 |
| PUT | /api/tree-species/:id | 更新树种档案 |
| GET | /api/disease-records | 获取病害记录 |
| POST | /api/disease-records | 创建病害记录 |
| PUT | /api/disease-records/:id | 更新病害记录 |
| GET | /api/statistics | 获取统计数据 |
| GET | /api/export | 导出数据报告（支持查询参数过滤） |
| GET | /api/workspaces | 获取工作区列表 |
| POST | /api/workspaces/:name | 保存工作区 |

---

## 📊 关键判断验证

### 1. 处置排序逻辑
**核心算法**（`server.js:491-497`）：
```javascript
urgentPonds: treePonds.filter(p => 
  p.waterLevel >= 2 && p.status !== 'completed'
).sort((a, b) => {
  const levelDiff = b.waterLevel - a.waterLevel;
  if (levelDiff !== 0) return levelDiff;
  return new Date(a.createdAt) - new Date(b.createdAt);
}).slice(0, 5)
```

**验证方式**：
- 运行 `npm test`，查看"紧急列表按积水等级降序排列"测试
- 访问 `/api/statistics`，检查 `urgentPonds` 数组顺序

### 2. 积水影响病害判断
**数据关联**：
- 树种档案中记录 `waterTolerance`（耐水性）
- 树种档案中记录 `commonDiseases`（常见病害）
- 积水严重的树池（2-3级）如果树种耐水性"较差"，风险更高

**验证方式**：
- 查看"紧急处置"列表中的树池
- 检查其关联病害记录

### 3. 冲突检测
**逻辑位置**：`server.js:91-99`（创建时）、`server.js:146-158`（更新时）

**验证方式**：
- 运行异常操作演示1
- 检查 API 响应包含 `conflictField` 字段

---

## 📝 样例数据说明

首次启动时，`sample-data/` 目录下的文件会自动复制到 `data/` 目录：

- **tree-ponds.json**: 8个树池记录，包含不同积水等级和处置状态
- **tree-species.json**: 5个树种档案（悬铃木、香樟树、银杏树、桂花树、水杉）
- **disease-records.json**: 4条病害记录，关联到具体树池

如需重置数据，删除 `data/` 目录后重启服务即可。

---

## 🎨 辨识度特征

本项目的核心辨识度来自：

1. **树池积水**：4级积水等级，颜色编码地图展示
2. **树种病害**：树种档案关联常见病害，辅助诊断
3. **处置排序**：积水等级优先 + 状态优先的智能排序算法

这些特征确保园林人员能够快速识别最紧急的处置任务，解决"记录分散、难以安排"的核心问题。