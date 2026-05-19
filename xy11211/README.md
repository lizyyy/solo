# 泵房巡检记录管理工具

一个CLI工具，用于管理小区地下泵房巡检记录，解决微信群记录散乱、漏看导致停水的问题。

## 核心功能

- ✅ **重复报修拦截**：同一泵房4小时内重复报修自动拦截
- ✅ **超时自动升级**：24小时未处理自动升级到更高层级负责人
- ✅ **复测留痕**：复测不合格记录完整保留历史
- ✅ **多维度筛选**：按负责人、时间、状态、异常类型筛选
- ✅ **报告导出**：支持CSV/JSON/TXT格式导出
- ✅ **持久化存储**：所有记录保存在本地JSON文件

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入样例数据

```bash
node src/index.js import examples/sample-data.json
```

### 3. 查看统计摘要

```bash
node src/index.js summary
```

### 4. 查看所有记录

```bash
node src/index.js list
```

### 5. 测试重复报修拦截

```bash
# 先添加一条记录
node src/index.js add -p "测试泵房" -h "张工程" -a "压力异常"

# 立即再添加同一条（会被拦截）
node src/index.js add -p "测试泵房" -h "张工程" -a "压力异常"
```

### 6. 复核记录

```bash
# 先获取记录ID
node src/index.js list

# 复测通过（关闭记录）
node src/index.js review <记录ID> -p -i "李主管"

# 复测不通过（重开并留痕）
node src/index.js review <记录ID> -r "问题仍然存在，需要更换零件" -i "李主管"
```

### 7. 导出报告

```bash
# 导出CSV格式
node src/index.js export -f csv

# 导出汇总报告
node src/index.js export --summary

# 按负责人筛选导出
node src/index.js export -H "张工程" -o zhang-records.csv
```

## 完整命令说明

### 添加记录
```bash
node src/index.js add -p <泵房名称> [选项]
  -p, --pump-room <name>    泵房名称（必填）
  -a, --anomaly-type <type> 异常类型
  -d, --description <text>  问题描述
  -h, --handler <name>      负责人
```

### 批量导入
```bash
node src/index.js import <json文件路径>
```

### 查询记录
```bash
node src/index.js list [选项]
  -H, --handler <name>       按负责人筛选
  -s, --status <status>      按状态筛选 (open/closed/reopen)
  -a, --anomaly-type <type>  按异常类型筛选
  -p, --pump-room <name>     按泵房筛选
  --start-date <date>        开始日期 (YYYY-MM-DD)
  --end-date <date>          结束日期 (YYYY-MM-DD)
```

### 复核/复测
```bash
node src/index.js review <记录ID> [选项]
  -p, --passed               复测通过
  -r, --reason <text>        复测不通过原因
  -i, --inspector <name>     复核人
```

### 统计摘要
```bash
node src/index.js summary
```

### 超时升级检查
```bash
node src/index.js escalate
```

### 导出报告
```bash
node src/index.js export [选项]
  -f, --format <type>        导出格式 (csv/json/txt) 默认: csv
  -o, --output <path>        输出文件路径
  -H, --handler <name>       按负责人筛选
  -s, --status <status>      按状态筛选
  -a, --anomaly-type <type>  按异常类型筛选
  --summary                  导出汇总报告
```

### 查看配置
```bash
node src/index.js config
```

## 数据存储位置

所有数据存储在项目根目录的 `data/` 文件夹下：
- `data/records.json` - 巡检记录
- `data/config.json` - 配置文件

## 配置说明

默认配置：
- 超时升级时间：24小时
- 重复报修检测窗口：4小时
- 升级级别：工程主管 → 项目经理 → 物业总监

## 状态说明

- `open` - 进行中
- `closed` - 已关闭
- `reopen` - 已重开（复测不合格）

## 典型使用流程

1. **每日巡检录入**：发现问题后使用 `add` 命令录入
2. **批量导入**：从微信群整理后使用 `import` 批量导入
3. **定时检查升级**：每天早上执行 `escalate` 检查超时
4. **维修后复核**：维修完成使用 `review` 复核
5. **生成日报**：使用 `export --summary` 生成每日汇总

## 目录结构

```
.
├── src/
│   ├── index.js      # CLI入口
│   ├── storage.js    # 存储模块
│   ├── rules.js      # 业务规则
│   └── exporter.js   # 导出模块
├── examples/
│   └── sample-data.json  # 样例数据
├── data/             # 数据目录（自动创建）
├── package.json
└── README.md
```
