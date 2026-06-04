# 冰箱门封漏热检测系统

为维修师傅和实验老师提供温度校准记录的导入、审阅、异常处理全流程工具。

## 核心原则

1. **数据源唯一**：导出明细、页面展示、接口返回读同一份结果数据（calibration_records 表）
2. **全链路审计**：所有人工改动留有痕迹（原始行号、改前改后、操作人、时间、原因）
3. **边界规则明确**：不靠口头约定，所有判断逻辑写在代码和文档中

## 技术栈

- 前端：React 18 + TypeScript + Tailwind CSS + Vite
- 后端：Express 4 + TypeScript
- 数据库：SQLite (better-sqlite3)
- 文件解析：xlsx + papaparse

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（前端 + 后端）
npm run dev

# 单独启动前端
npm run client:dev

# 单独启动后端
npm run server:dev
```

前端地址：http://localhost:5173
后端地址：http://localhost:3001

## 边界规则（方向字段）

### 方向字段处理规则

所有规则定义在 `api/direction-rules.ts` 的 `DIRECTION_RULES` 常量中。

| 输入值 | 规则类型 | 标准化值 | 状态 | 说明 |
|--------|----------|----------|------|------|
| 正方向 / 正向 / 正 / positive / + | auto_fix | positive | normal | 标准正方向值，自动修正 |
| 负方向 / 负向 / 负 / negative / - | auto_fix | negative | normal | 标准负方向值，自动修正 |
| 向左 / 左 / left | mark_pending_review | null | pending_review | **口语化表达，不自动归正常，留给实验老师复核** |
| 向右 / 右 / right | mark_pending_review | null | pending_review | **口语化表达，不自动归正常，留给实验老师复核** |
| 反方向 / 反向 / 反转 / reverse / backward | mark_pending_review | null | pending_review | **含义模糊，需确认是正还是负** |
| 其他值 | - | null | abnormal | 无法识别，标记为异常 |

### 关键决策点

> **负方向被现场师傅写成向左？不急着归正常！**

当方向字段值为 "向左" 时：
- ✅ **不会**自动映射为 "负方向"
- ✅ **会**标记为 `pending_review`（待复核）
- ✅ **会**在异常工况表中高亮显示
- ✅ **必须**由实验老师人工确认后才能转为正常

### 修改与回滚流程

```
导入记录 → 自动校验 → 待复核状态 → 维修师傅标记 → 实验老师复核
                                                          ↓
                                                  ┌─────┴─────┐
                                                  ↓           ↓
                                             确认通过     驳回回滚
                                                  ↓           ↓
                                           status=confirmed  status=rolled_back
                                                             恢复原始值
```

每一步操作都会写入 `audit_logs` 表，包含：
- 改前值（old_value）
- 改后值（new_value）
- 操作人（changed_by）
- 角色（role: technician / lab_teacher）
- 原因（reason）
- 时间戳（created_at）

## API 接口

### 温度校准记录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/calibration/import` | 导入温度校准记录（CSV/Excel） |
| GET | `/api/calibration/records` | 获取记录列表（分页+筛选） |
| PATCH | `/api/calibration/records/:id` | 更新单条记录（触发审计日志） |
| GET | `/api/calibration/records/:id/audit` | 获取单条记录的审计日志 |
| POST | `/api/calibration/records/:id/rollback` | 回滚到指定审计日志版本 |

### 异常工况

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/anomalies/summary` | 异常工况汇总 |
| GET | `/api/anomalies/records` | 异常工况明细 |
| PATCH | `/api/anomalies/records/:id/confirm` | 实验老师确认 |
| PATCH | `/api/anomalies/records/:id/rollback` | 实验老师驳回回滚 |
| GET | `/api/anomalies/export` | 导出异常工况明细（CSV） |

## 数据模型

### calibration_records 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| original_line_number | INTEGER | **原始文件行号，永不修改** |
| sensor_id | TEXT | 传感器编号 |
| temperature | REAL | 温度值 |
| direction | TEXT | 原始方向值（用户输入） |
| direction_normalized | TEXT | 标准化后的方向值 |
| direction_status | TEXT | normal / abnormal / pending_review |
| status | TEXT | imported / reviewed / confirmed / rolled_back |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### audit_logs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_id | INTEGER | 关联 calibration_records.id |
| field_name | TEXT | 修改的字段名 |
| old_value | TEXT | 修改前的值 |
| new_value | TEXT | 修改后的值 |
| changed_by | TEXT | 操作人 |
| role | TEXT | technician / lab_teacher |
| reason | TEXT | 修改原因 |
| created_at | TEXT | 操作时间 |

## 项目结构

```
├── api/                    # 后端代码
│   ├── routes/
│   │   ├── calibration.ts  # 校准记录接口
│   │   └── anomalies.ts    # 异常工况接口
│   ├── db.ts               # 数据库初始化
│   ├── direction-rules.ts  # 方向边界规则引擎
│   ├── app.ts              # Express 应用
│   └── server.ts           # 服务器入口
├── src/                    # 前端代码
│   ├── components/
│   │   └── Layout.tsx      # 布局组件
│   ├── pages/
│   │   ├── ImportPage.tsx  # 导入页
│   │   ├── ReviewPage.tsx  # 审阅页
│   │   └── AnomaliesPage.tsx # 异常工况表页
│   ├── types/
│   │   └── index.ts        # 类型定义
│   ├── App.tsx             # 路由配置
│   └── main.tsx            # 入口文件
└── data/
    └── fridge.db           # SQLite 数据库文件
```

## 测试流程（三步核心）

1. **第一次导入**：准备包含 "向左" 方向值的 CSV 文件，在导入页上传
2. **维修师傅老岑补看传感器编号**：在审阅页查看记录，确认传感器编号正确
3. **异常工况表更新**：切换到异常工况表页，看到待复核记录，由实验老师确认或回滚

## 常见问题

### Q: 为什么页面和导出的数据不一样？
A: 本系统保证 **导出明细、页面展示、接口返回读同一份结果数据**。如果发现不一致，请检查：
- 浏览器缓存是否未刷新
- 是否有人在后台直接修改了数据库

### Q: "向左" 为什么不自动变成 "负方向"？
A: 根据边界规则，口语化表达一律标记为待复核，由实验老师人工确认。这是为了避免：
- 现场师傅口误（向左其实是向右）
- 设备安装方向与预期相反
- 不同人对方向的定义不同

### Q: 如何回滚一条记录？
A: 两种方式：
1. 在异常工况表页点击"驳回回滚"按钮
2. 在审阅页的改动历史中选择具体版本回滚

两种方式都会写入审计日志，可追溯。
