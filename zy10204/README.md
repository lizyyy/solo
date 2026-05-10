# 校车临时改线通知 CLI

一个专门为学校校车管理设计的命令行工具，用于处理雨天或修路等临时改线情况，自动生成司机、家长和值班老师版通知。

## 功能特点

- **线路管理**：创建和维护校车线路及站点
- **学生管理**：管理学生信息、家长联系方式和线路分配
- **司机排班**：管理司机信息和班次安排
- **临时改线**：处理临时改线和站点跳过
- **请假管理**：记录学生请假，避免给请假学生发通知
- **多版本通知**：自动生成司机版、家长版、值班老师版通知
- **数据存档**：导出JSON和TXT格式的改线记录留档
- **幂等性保证**：重复执行同一批输入结果保持稳定

## 边界情况处理

1. **同一学生在两条线路**：支持学生同时分配到多条线路，有明确警告
2. **站点被删除但仍有学生**：有线路一致性检查和警告提示
3. **请假后又生成上车通知**：请假学生不会收到改线通知
4. **改线重复执行**：通过SHA256哈希检测重复内容，避免重复处理

## 安装

```bash
npm install
```

## 快速开始

### 1. 创建基础数据

```bash
# 创建线路
node index.js line create L1 "一号线" -d "城东方向"

# 添加站点
node index.js line add-stop L1 S1 "东门站" 1 -a "东门路口"
node index.js line add-stop L1 S2 "南门站" 2 -a "南门路口"
node index.js line add-stop L1 S3 "西门站" 3 -a "西门路口"

# 创建学生
node index.js student create S001 "小明" "一年级" "一班"
node index.js student create S002 "小红" "一年级" "一班"

# 添加家长
node index.js student add-parent S001 "明父" "13800138001" "父亲"
node index.js student add-parent S001 "明母" "13800138002" "母亲"

# 分配学生到线路站点
node index.js student assign S001 L1 S1
node index.js student assign S002 L1 S2

# 创建司机和班次
node index.js driver create D01 "张司机" "13900139001" -p "京A12345"
node index.js driver create-shift AM "早班" -s "07:00" -e "09:00"
node index.js driver assign D01 L1 AM 2026-05-01
```

### 2. 处理临时改线

```bash
# 创建改线（站点变更：S1->S2，S3跳过）
node index.js diversion create 2026-05-11 "道路施工" L1:S1->S2 L1:S3@skip

# 查看改线详情
node index.js diversion show 2026-05-11
```

### 3. 添加请假记录

```bash
# 学生请假（不会收到改线通知）
node index.js student leave S002 2026-05-11 -n "生病"
```

### 4. 生成通知

```bash
# 生成所有通知
node index.js notify generate 2026-05-11

# 查看司机版通知
node index.js notify driver 2026-05-11

# 查看值班老师版通知
node index.js notify teacher 2026-05-11

# 查看家长版通知
node index.js notify parent 2026-05-11

# 查看所有版本
node index.js notify all 2026-05-11
```

### 5. 导出存档

```bash
# 导出改线存档
node index.js export archive 2026-05-11 -o ./exports
```

## 命令参考

### 线路管理 (line)

| 命令 | 说明 |
|------|------|
| `line create <code> <name>` | 创建线路 |
| `line add-stop <lineCode> <stopCode> <stopName> <order>` | 添加站点 |
| `line list` | 列出所有线路 |
| `line show <lineCode>` | 显示线路详情 |
| `line show <lineCode> -s` | 显示线路和学生列表 |

### 学生管理 (student)

| 命令 | 说明 |
|------|------|
| `student create <studentId> <name> <grade> <class>` | 创建学生 |
| `student add-parent <studentId> <name> <phone> <relationship>` | 添加家长 |
| `student assign <studentId> <lineCode> <stopCode>` | 分配到线路站点 |
| `student change-stop <studentId> <lineCode> <newStopCode>` | 更改当前站点 |
| `student change-stop -u ...` | 同时更新默认站点 |
| `student reset-stop <studentId> <lineCode>` | 恢复默认站点 |
| `student leave <studentId> <date>` | 添加请假记录 |
| `student list` | 列出所有学生 |
| `student show <studentId>` | 显示学生详情 |

### 司机管理 (driver)

| 命令 | 说明 |
|------|------|
| `driver create <driverId> <name> <phone>` | 创建司机 |
| `driver create-shift <code> <name>` | 创建班次 |
| `driver assign <driverId> <lineCode> <shiftCode> <effectiveDate>` | 分配司机 |
| `driver list` | 列出所有司机 |
| `driver schedule [date]` | 查看司机排班 |

### 改线管理 (diversion)

| 命令 | 说明 |
|------|------|
| `diversion create <date> <reason> [changes...]` | 创建临时改线 |
| `diversion show [date]` | 查看改线详情 |

**站点变更格式：**
- `线路代码:原站点->新站点` - 站点变更
- `线路代码:原站点@skip` - 跳过站点

### 通知管理 (notify)

| 命令 | 说明 |
|------|------|
| `notify generate [date]` | 生成通知 |
| `notify driver [date]` | 显示司机版通知 |
| `notify teacher [date]` | 显示值班老师版通知 |
| `notify parent [date]` | 显示家长版通知 |
| `notify all [date]` | 显示所有版本通知 |

### 导出 (export)

| 命令 | 说明 |
|------|------|
| `export archive [date] -o <dir>` | 导出改线存档 |

## 数据存储

- 数据库文件：`data/schoolbus.db` (SQLite)
- 导出文件：`exports/diversion_YYYY-MM-DD.json` 和 `.txt`

## 运行测试

```bash
npm test
```

## 项目结构

```
├── src/
│   ├── models/          # 数据模型
│   ├── storage/         # 数据存储层 (Repository)
│   ├── services/        # 业务逻辑层
│   ├── cli/             # CLI 命令层
│   └── utils/           # 工具函数
├── data/                # 数据库文件
├── exports/             # 导出文件
├── test/                # 测试文件
├── index.js             # 入口文件
└── package.json
```

## 许可证

ISC
