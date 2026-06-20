# 宠物训练课回访追踪

这是一个 Node.js API + SQLite 的本地后端服务，用事件日志追踪宠物训练课回访材料的导入、确认、撤回、补录、人工改判和导出影响。前端演示仍保留，但核心入口是 `server/` 下的 API 服务和 SQLite 数据库。

## 运行

### 方式一：启动后端 API（核心入口）

```bash
npm install
npm run api
```

默认监听 `http://localhost:3001`，数据库文件位于 `data/pet-training-tracker.sqlite`。可用 `PET_TRACKER_DB=/tmp/pet.sqlite npm run api` 指定位置。

启动后会自动初始化表结构并写入「不干净」的演示数据（含别名重复、人工改判、补录差异等异常场景）。

### 方式二：启动前后端联调（用于 API 调试和验收界面）

```bash
# 终端 1：启动后端 API
npm run api

# 终端 2：启动前端开发服务器
npm run dev
```

前端默认 `http://localhost:5173`，通过 Vite 代理 `/api` → `http://localhost:3001`。

### 重置演示数据

```bash
# 方式一：调用 API
curl -X POST http://localhost:3001/api/reset-demo

# 方式二：前端界面点击右上角「重置演示」按钮
```

## 验证

```bash
npm run api:test
npm run check
```

## API 详细说明

所有 API 统一前缀 `/api`，请求和响应均为 JSON。

### 1. 健康检查
- **GET /api/health**

查看数据库状态：数据库路径、宠物数、事件数、异常行、人工改判数。

**响应示例：**
```json
{
  "ok": true,
  "dbPath": "/data/pet-training-tracker.sqlite",
  "pets": 5,
  "events": 16,
  "anomalyRows": 5,
  "manualRejudge": 2
}
```

---

### 2. 宠物列表（支持筛选）
- **GET /api/pets**
- **Query 参数：**
  - `anomaly`: 按异常类型筛选（alias_duplicate / self_alias_duplicate / manual_rejudge / pending_confirm / conflict_history）
  - `q`: 关键词搜索（宠物名、别名、品种）

**示例：**
```bash
# 筛选别名重复
curl http://localhost:3001/api/pets?anomaly=alias_duplicate

# 搜索含"豆"的宠物
curl http://localhost:3001/api/pets?q=豆
```

---

### 3. 单只宠物时间线
- **GET /api/pets/:petId/timeline**

读取同一份 SQLite 事件日志中的完整历史快照，按时间倒序排列。

**响应包含每个事件的 `snapshotBefore` 和 `snapshotAfter` JSON 快照，可重建任意时间点的档案状态。

---

### 4. 导入档案
- **POST /api/import**
- **Body：**
```json
{
  "operator": "老周",
  "source": "vaccine_photo",
  "profile": {
    "name": "豆豆",
    "aliases": ["豆包"],
    "species": "犬",
    "breed": "柯基",
    "vaccineStatus": "4联+狂犬",
    "trainingProgress": "course_completed",
    "trainingJudge": "qualified",
    "photoUrls": ["vaccine/doudou-202409.jpg"],
    "latestNote": "疫苗本照片解析：9月5日已完成4联+狂犬"
  },
  "note": "首次导入疫苗本照片"
}
```

`source` 可选值：`vaccine_photo`（疫苗本照片）/ `old_screenshot`（旧版本截图）/ `owner_supplement`（主人补录）

---

### 5. 确认记录
- **POST /api/pets/:petId/confirm**
- **Body：**
```json
{
  "operator": "老周",
  "note": "手动确认归档"
}
```

---

### 6. 撤回确认
- **POST /api/pets/:petId/revoke**
- **Body：**
```json
{
  "operator": "老周",
  "note": "信息有误，待重新导入"
}
```

---

### 7. 补录备注（返回导出差异）
- **POST /api/pets/:petId/addendum**
- **Body：**
```json
{
  "operator": "老周",
  "note": "主人补录：脱敏课回访视频显示可正常接触陌生人",
  "updates": {
    "latestNote": "脱敏训练完成；主人补录视频显示可正常接触陌生人和喂食",
    "photoUrls": ["owner-video/meiqiu-final-proof.png"]
  }
}
```

**响应包含 `exportImpact.changedFields` 说明导出变了哪些字段：
```json
{
  "ok": true,
  "eventId": "evt_xxx",
  "exportImpact": {
    "changedFields": [
      {
      "field": "最新备注",
      "oldValue": "（原备注内容",
      "newValue": "脱敏训练完成；主人补录视频显示可正常接触陌生人和喂食"
    },
    {
      "field": "疫苗本照片",
      "oldValue": "2 张",
      "newValue": "3 张"
    }
  ]
}
```

---

### 8. 人工改判（强制记录旧判断、新判断、改判说明）
- **POST /api/pets/:petId/rejudge**
- **Body：**
```json
{
  "operator": "老周",
  "oldJudge": "unqualified",
  "newJudge": "qualified",
  "reason": "主人提供了后续训练视频，展示了稳定的服从性和社会化表现"
}
```

响应会自动添加 `manual_rejudge` 异常标记，永久留痕。

---

### 9. 导出结果
- **GET /api/export**
- **Query 参数：**
  - `format`: `csv` / `json`（默认 json）
  - `anomaly`: 可选，按异常筛选导出

**示例：**
```bash
# 导出 CSV
curl http://localhost:3001/api/export?format=csv

# 仅导出含别名重复异常
curl http://localhost:3001/api/export?format=csv&anomaly=alias_duplicate
```

**CSV 格式说明：**
- 共 13 列：宠物编号、宠物名、别名、品种、疫苗状态、训练进度、评定、状态、最新备注、照片张数、最后更新、异常标记、最后事件
- 末尾以 `#` 号开头的变更摘要注释

每次导出都会保存到 `exports` 表，可通过 `/api/export/:exportId` 查询历史导出。

---

### 10. 查询历史导出
- **GET /api/export/:exportId**

---

### 11. 重置演示数据
- **POST /api/reset-demo**

清空所有数据并重新写入「不干净」演示数据。

## 示例

```bash
curl http://localhost:3001/api/pets?anomaly=manual_rejudge

curl -X POST http://localhost:3001/api/pets/pet_meiqiu/addendum \
  -H 'Content-Type: application/json' \
  -d '{
    "operator": "老周",
    "note": "主人补录：脱敏课回访视频显示可正常接触陌生人",
    "updates": {
      "latestNote": "脱敏训练完成；主人补录视频显示可正常接触陌生人和喂食",
      "photoUrls": ["vaccine/meiqiu-202410.jpg", "owner-video/meiqiu-final-proof.png"]
    }
  }'
```

种子数据包含撤回后重新导入、旧版本截图保留、主人补录、别名重复和人工改判，避免只展示正常样例。
