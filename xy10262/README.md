# 口岸冷藏车排队温控 API

口岸冷藏车排队通关时的温控记录、查验队列和货物风险联动系统。

## 业务背景

冷藏车在口岸排队通关时：
- **入口**：车辆入队排队（分配排队号）
- **关键校验**：温度片段实时上报（自动判定正常/异常）
- **判断依据**：查验优先级（由风险等级+温控异常联动计算）
- **状态流转**：排队 → 待查验 → 查验中 → 放行/暂扣

## 快速开始

### 1. 安装依赖
```bash
cd /Users/mac/pro/solo/workspaces/xy10262
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python -m uvicorn app.main:app --reload
```
服务地址: http://localhost:8000

API文档: http://localhost:8000/docs

### 3. 运行验收测试
**新开一个终端窗口**：
```bash
cd /Users/mac/pro/solo/workspaces/xy10262

# 执行正常流程验收
python -m scripts.acceptance_test

# 执行异常样例演示
python -m scripts.anomaly_samples
```

---

## 📋 业务人员验收步骤

### 前置准备

**步骤 0：确认环境**
- 打开终端（Terminal）
- 复制执行以下命令：

```bash
cd /Users/mac/pro/solo/workspaces/xy10262
pip install -r requirements.txt
```

看到 `Successfully installed` 字样表示成功。

---

### 场景一：运行服务

**步骤 1：启动 API 服务**

打开一个新的终端窗口，复制执行：
```bash
cd /Users/mac/pro/solo/workspaces/xy10262
python -m uvicorn app.main:app --reload
```

看到如下输出表示服务启动成功：
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**步骤 2：验证服务健康**

打开浏览器访问：
```
http://localhost:8000/api/health
```

看到 `{"status":"ok"}` 表示服务正常。

---

### 场景二：正常通关流程验收

**步骤 3：运行验收脚本**

打开另一个新的终端窗口，复制执行：
```bash
cd /Users/mac/pro/solo/workspaces/xy10262
python -m scripts.acceptance_test
```

**步骤 4：选择验收场景**

脚本会提示：
```
选择验收场景:
  1. 正常通关流程 (推荐先执行)
  2. 优先级联动验证
  3. 全部执行
  0. 退出

请输入选项 (1/2/3/0):
```

输入 `1` 并按回车。

**步骤 5：按提示逐步验收**

脚本会一步步展示：

1. **车辆入队** → 3辆车依次入队，自动分配排队号、判定风险等级
   - 车辆A：疫苗 → 风险等级 critical
   - 车辆B：生鲜肉类 → 风险等级 high
   - 车辆C：冷冻食品 → 风险等级 low

   按回车继续。

2. **上报温度片段** → 每辆车上报3条温度
   - 车辆A（疫苗）：全部正常 → 无异常
   - 车辆B（生鲜）：1条异常高温 → 标记异常
   - 车辆C（冷冻）：全部正常 → 无异常

   观察温度记录的 `is_normal` 字段，异常温度会自动标记。

   按回车继续。

3. **查验优先级联动** → 排队列表按优先级排序

   验收要点：
   - 车辆B（高风险+温控异常）→ 优先级最高
   - 车辆A（极高风险+无异常）→ 优先级次之
   - 车辆C（低风险+无异常）→ 优先级最低

   按回车继续。

4. **开始查验** → 状态从 waiting 变为 inspecting

   按回车继续。

5. **完成查验** → 判定放行/暂扣
   - 车辆B：passed（放行）
   - 车辆A：passed（放行）
   - 车辆C：detained（暂扣，模拟发现问题）

   按回车继续。

6. **车辆详情查询** → 查看完整业务轨迹

   按回车继续。

看到 `✅ 验收场景1完成: 正常通关流程验证通过!` 表示场景一验收通过。

---

### 场景三：异常样例验收

**步骤 6：运行异常样例脚本**

复制执行：
```bash
cd /Users/mac/pro/solo/workspaces/xy10262
python -m scripts.anomaly_samples
```

脚本会依次演示 4 类异常：

1. **重复数据异常**
   - 同一车牌二次入队 → 报错 `DUPLICATE_RECORD`
   - 同一时间点二次上报温度 → 报错 `DUPLICATE_RECORD`

2. **缺字段异常**
   - 入队缺少 `cargo_type` → 报错（Pydantic 校验）
   - 入队缺少 `plate_number` → 报错
   - 人工修改缺少 `modified_by` → 报错

3. **人工改错异常**
   - 上报异常高温 8℃ → 自动标记异常，优先级提升
   - 人工修改为正常温度 -18℃ → 保留痕迹：原温度、修改人、原因
   - 再次修改同一条记录 → 报错 `MANUAL_MODIFICATION_ERROR`

4. **状态流转异常**
   - 车辆放行后尝试再次查验 → 报错 `INVALID_STATUS`

看到 `异常样例演示完成` 表示场景二验收通过。

---

### 场景四：查看 API 文档

**步骤 7：访问 Swagger UI**

打开浏览器访问：
```
http://localhost:8000/docs
```

可以交互式测试所有接口：

| 接口 | 说明 |
|------|------|
| POST /api/queue/vehicles | 车辆入队 |
| GET /api/queue/vehicles | 查询排队列表 |
| GET /api/queue/vehicles/{id} | 查询车辆详情 |
| POST /api/temperature | 上报温度 |
| PATCH /api/temperature/{id}/manual-update | 人工修改温度 |
| POST /api/inspection/start | 开始查验 |
| POST /api/inspection/{id}/complete | 完成查验 |

---

## 🏗️ 项目结构

```
xy10262/
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI入口，路由定义
│   ├── database.py         # SQLite数据库配置
│   ├── models.py           # ORM模型（车辆、温度、查验）
│   ├── schemas.py          # Pydantic数据校验模型
│   ├── services.py         # 业务服务层（核心逻辑）
│   ├── exceptions.py       # 业务异常定义
│   └── constants.py        # 常量和枚举
├── scripts/
│   ├── __init__.py
│   ├── client.py           # API客户端封装
│   ├── acceptance_test.py  # 业务验收测试脚本
│   └── anomaly_samples.py  # 异常样例演示脚本
├── requirements.txt        # 依赖包
└── README.md               # 本文档
```

---

## 🔑 核心业务逻辑

### 1. 风险等级判定（基于货物类型）

| 货物类型 | 风险等级 |
|---------|---------|
| 疫苗 | critical（极高） |
| 药品、生鲜肉类 | high（高） |
| 海鲜、乳制品 | medium（中） |
| 冷冻食品 | low（低） |

### 2. 查验优先级计算公式

```
优先级得分 = 风险等级评分 + 温控异常评分
```

- 风险等级评分：critical=6, high=4, medium=2, low=0
- 温控异常评分：≥3次异常=3, 1-2次异常=2, 0次=0

| 得分范围 | 优先级 |
|---------|-------|
| ≥6 | highest（最高） |
| 4-5 | high（高） |
| 2-3 | normal（正常） |
| 0-1 | low（低） |

### 3. 状态流转

```
waiting (排队中)
    ↓
inspection_pending (待查验)
    ↓
inspecting (查验中)
    ↓
passed / detained (放行/暂扣) ← 最终状态，不可逆转
```

---

## 📝 常见问题

**Q1: 运行脚本时报 `无法连接到服务器`？**

A: 请确保服务已启动（步骤1），服务运行在 http://localhost:8000

**Q2: 如何重置测试数据？**

A: 删除数据库文件即可：
```bash
rm /Users/mac/pro/solo/workspaces/xy10262/port_cold_chain.db
```
下次启动服务会自动创建新数据库。

**Q3: 看到数据库文件很大？**

A: SQLite数据库会自动增长，测试环境可随时删除重建。

---

## ✅ 验收清单

- [ ] 服务能正常启动（`/api/health` 返回 ok）
- [ ] 车辆入队能自动分配排队号
- [ ] 根据货物类型能自动判定风险等级
- [ ] 温度上报能自动判定正常/异常
- [ ] 温控异常能触发查验优先级提升
- [ ] 排队列表按优先级正确排序
- [ ] 状态流转正确（排队→查验→放行/暂扣）
- [ ] 已放行车辆不可再次查验
- [ ] 人工修改温度保留完整痕迹
- [ ] 重复数据有明确错误提示
- [ ] 缺字段有明确错误提示
