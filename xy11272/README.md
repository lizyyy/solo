# 叉车排班与充电管理系统

为仓库夜班班长设计的叉车电量管理、充电桩占用管理和班次排班系统。

## 功能特性

### 核心规则
- **低电量优先**：电量低于30%的叉车优先分配充电桩
- **跨班占用检查**：防止不同班次重复占用同一充电桩
- **重复锁桩幂等**：同一叉车重复锁定同一桩时自动拦截
- **每条操作都有原因记录**：放行/拦截都可追溯

### 业务功能
- ✅ 排班管理（创建班次、分配叉车）
- ✅ 充电桩锁定/释放
- ✅ 异常记录与处理
- ✅ 日报生成
- ✅ 叉车电量管理

### 查询与导出
- 按**负责人**筛选操作记录
- 按**时间范围**筛选
- 按**状态**（成功/拦截）筛选
- 按**异常类型**筛选
- 导出为CSV格式

## 安装

```bash
npm install
```

## 快速开始

### 运行测试（验证所有功能）
```bash
npm test
```

### CLI命令使用

#### 1. 基础数据管理
```bash
# 创建叉车
node src/cli.js forklift:create FL001 "叉车1号" 85

# 列出叉车
node src/cli.js forklift:list

# 更新电量
node src/cli.js forklift:battery FL001 25 "张班长"

# 创建充电桩
node src/cli.js station:create ST001 "充电桩A"

# 列出充电桩
node src/cli.js station:list
```

#### 2. 排班管理
```bash
# 创建班次 (date: YYYY-MM-DD)
node src/cli.js shift:create SH001 "白班" day 08:00 20:00 2024-01-15 "张班长"

# 列出某天的班次
node src/cli.js shift:list 2024-01-15

# 分配叉车到班次
node src/cli.js shift:assign SH001 FL001 "王司机" "卸货任务" 08:00 "张班长"
```

#### 3. 充电锁桩
```bash
# 锁定充电桩（duration: 小时，可选）
node src/cli.js lock ST001 FL001 SH001 "王司机" 8

# 释放充电桩
node src/cli.js release ST001 "张班长"

# 查看活跃锁桩
node src/cli.js lock:list
```

#### 4. 日志与异常
```bash
# 查询操作日志（支持多维度筛选）
node src/cli.js log:query --operator "张班长" --startDate 2024-01-15 --status success

# 查询异常
node src/cli.js exception:list --severity high --handled false

# 标记异常为已处理
node src/cli.js exception:handle EX001 "张班长"
```

#### 5. 日报与导出
```bash
# 生成日报
node src/cli.js report 2024-01-15

# 导出日志到CSV
node src/cli.js export:logs my_logs.csv --operator "张班长"

# 导出异常
node src/cli.js export:exceptions --severity high

# 导出日报
node src/cli.js export:report 2024-01-15
```

## 项目结构

```
.
├── src/
│   ├── storage/
│   │   ├── database.js      # SQLite数据库初始化
│   │   └── repositories.js  # 数据访问层
│   ├── business/
│   │   ├── rules.js         # 业务规则引擎
│   │   └── services.js      # 业务服务层
│   ├── utils/
│   │   ├── export.js        # CSV导出
│   │   └── import.js        # 数据导入
│   ├── cli.js               # 命令行接口
│   └── test.js              # 功能测试
├── data/                    # 数据库文件
├── exports/                 # 导出文件目录
└── package.json
```

## 核心数据表

1. **forklifts** - 叉车信息
2. **charging_stations** - 充电桩信息
3. **shifts** - 班次信息
4. **assignments** - 排班分配
5. **charging_locks** - 锁桩记录
6. **operation_logs** - 操作日志（全记录）
7. **exceptions** - 异常记录

## 规则验证

系统会对每次锁桩操作进行以下规则检查：
1. 叉车是否可用（非维护状态）
2. 低电量叉车优先检查
3. 幂等性检查（防止重复锁定）
4. 充电桩是否空闲
5. 跨班次占用检查

所有检查结果都会记录在 `operation_logs` 表中，方便后续追溯和审计。

## 幂等性保证

系统设计保证所有操作的幂等性：
- 重复创建相同ID的叉车 → 返回已有数据
- 重复锁定同一充电桩/叉车/班次组合 → 拦截并提示
- 重复导入相同数据 → 不会产生重复记录

## 数据一致性

- 所有状态变更都记录完整的操作日志
- 锁桩与充电桩状态联动
- 低电量自动生成异常警报
