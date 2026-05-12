# 社保基数申报 CLI (Social Security CLI)

一个帮助 HR 团队完成社保基数申报的命令行工具，围绕人事申报社保基数时需要核对工资、入离职、城市规则和补缴记录展开。

## 功能特性

- ✅ **初始化项目** - 快速创建项目并生成完整样例数据
- ✅ **数据导入** - 支持导入员工信息、工资明细、入离职记录、城市规则、历史申报
- ✅ **数据校验** - 自动检查数据完整性和一致性
- ✅ **智能计算** - 自动计算建议申报基数，考虑多种复杂场景
- ✅ **补缴提醒** - 自动识别需要补缴的人员和金额
- ✅ **详细报告** - 生成完整的申报报告，包含所有调整理由
- ✅ **操作审计** - 记录所有操作历史，支持追踪
- ✅ **幂等性保障** - 重复执行不产生副作用

## 核心规则处理

1. **试用期工资** - 新员工不满6个月使用试用期工资
2. **跨城市调动** - 自动计算调动前后基数差额并提示补缴
3. **离职当月** - 离职员工当月仍需缴纳社保
4. **基数上下限** - 工资低于下限按下限，高于上限按上限
5. **重复申报** - 检测并提示重复申报月份
6. **人工修正** - 记录所有人工调整的前后差异和操作者

## 快速开始

### 1. 环境要求

- Node.js >= 14.0.0
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 本地启动

**方式一：使用开发模式（推荐）**
```bash
npm run dev -- <command>
```

**方式二：编译后运行**
```bash
npm run build
node dist/index.js <command>
```

**方式三：全局安装**
```bash
npm install -g .
ssc <command>
```

## 主要演示路径

### 完整演示流程

#### 1. 初始化项目（带样例数据）

```bash
npm run dev -- init --with-sample
```

这会创建 `./data` 目录并生成完整的样例数据，覆盖：
- 北京、上海、成都三个城市的员工
- 完整年度的工资记录
- 入离职记录（含入职、离职、跨城市调动）
- 各城市2025年社保上下限
- 历史申报记录

样例数据场景：
1. **张三 (EMP001)** - 北京，高薪员工，含年终奖，正常申报
2. **李四 (EMP002)** - 上海，7月新入职，试用期员工
3. **王五 (EMP003)** - 成都，超高薪，超过上限，按上限申报
4. **赵六 (EMP004)** - 北京，3月已离职，低工资按下限调整
5. **钱七 (EMP005)** - 北京，有重复申报历史
6. **孙八 (EMP006)** - 上海，5月从北京调动到上海，需要补缴

#### 2. 检查数据完整性

```bash
npm run dev -- check
```

检查内容：
- 员工是否有对应的工资记录
- 员工是否有入离职记录
- 涉及的城市是否有对应的社保规则
- 是否存在重复的工资记录
- 是否已存在历史申报（幂等性提醒）

#### 3. 查看员工详情

```bash
# 按姓名查看
npm run dev -- detail --employee 孙八

# 按工号查看
npm run dev -- detail --employee EMP006
```

查看内容：
- 员工基本信息
- 入离职记录（入职、调动、离职）
- 年度工资明细和平均值
- 人工修正记录
- 历史申报记录
- 申报计算结果和补缴信息

#### 4. 生成申报报告

```bash
# 终端查看
npm run dev -- report

# 导出到 JSON 文件
npm run dev -- report --output report.json
```

报告内容：
- 汇总统计（正常/警告/错误数量）
- 需要补缴的人员列表（姓名、部门、补缴月份、补缴金额）
- 所有员工的建议申报基数和调整原因
- 调整原因分类统计
- 各城市的社保上下限规则

### 失败演示路径

此路径展示当数据存在问题时系统的表现：

#### 场景1：缺少城市规则

1. 初始化空项目
```bash
npm run dev -- init --data-dir ./data-error --with-sample false
```

2. 手动添加员工但不添加城市规则
```bash
cat > /tmp/employees.json << 'EOF'
[
  {
    "employeeNo": "EMP999",
    "name": "测试员工",
    "department": "测试部",
    "city": "深圳",
    "isProbation": false,
    "probationSalary": 0,
    "regularSalary": 15000
  }
]
EOF

npm run dev -- import --type employee --file /tmp/employees.json --data-dir ./data-error
```

3. 检查数据（会报错）
```bash
npm run dev -- check --data-dir ./data-error
```

**预期结果：**
- 错误提示：缺少 深圳 2025 年的社保上下限规则

#### 场景2：员工无工资记录

1. 查看已有样例数据中的员工信息
```bash
ls -la ./data/
cat ./data/employees.json | head -50
```

2. 可以想象：如果某个员工缺少工资记录，运行 `ssc check` 会显示警告信息，提示该员工无工资记录

## 命令详解

### init - 初始化项目

```bash
ssc init [options]
```

选项：
- `--name <name>` - 项目名称（默认：Social Security Declaration）
- `--year <year>` - 申报年度（默认：2025）
- `--month <month>` - 申报月份（默认：7）
- `--data-dir <dir>` - 数据目录（默认：./data）
- `--with-sample` - 生成样例数据（默认：true）
- `--operator <operator>` - 操作者标识（默认：HR-USER）

幂等性：项目已存在时不会覆盖，会提示先删除。

### import - 导入数据

```bash
ssc import --type <type> --file <file> [options]
```

选项：
- `--type <type>` - 数据类型（必填）
  - `employee` - 员工信息
  - `salary` - 工资明细
  - `employment` - 入离职记录
  - `city-rule` - 城市规则
  - `historical` - 历史申报
- `--file <file>` - JSON 文件路径（必填）
- `--data-dir <dir>` - 数据目录（默认：./data）
- `--operator <operator>` - 操作者标识

幂等性：自动检测重复记录（员工按工号、工资按员工+年月、城市规则按城市+年度），重复数据会被跳过。

#### 导入文件格式示例

**员工信息 (employee)**
```json
[
  {
    "employeeNo": "EMP001",
    "name": "张三",
    "department": "技术部",
    "city": "北京",
    "isProbation": false,
    "probationSalary": 15000,
    "regularSalary": 25000
  }
]
```

**工资明细 (salary)**
```json
[
  {
    "employeeId": "uuid-xxx",
    "year": 2025,
    "month": 1,
    "baseSalary": 25000,
    "bonus": 5000,
    "allowance": 2000,
    "totalSalary": 32000
  }
]
```

**入离职记录 (employment)**
```json
[
  {
    "employeeId": "uuid-xxx",
    "type": "hire",
    "date": "2023-03-15",
    "operator": "HR-SYSTEM",
    "reason": "新员工入职"
  }
]
```

**城市规则 (city-rule)**
```json
[
  {
    "city": "北京",
    "year": 2025,
    "minBase": 6957,
    "maxBase": 35283,
    "effectiveDate": "2025-07-01",
    "note": "北京2025年度社保缴费基数上下限"
  }
]
```

### check - 检查数据完整性

```bash
ssc check [options]
```

选项：
- `--data-dir <dir>` - 数据目录（默认：./data）
- `--operator <operator>` - 操作者标识

检查项：
1. 员工是否有申报年度的工资记录
2. 员工是否有入离职记录
3. 员工涉及的所有城市是否有对应的社保规则
4. 是否存在重复的工资记录
5. 是否存在已提交的历史申报

### detail - 查看员工详情

```bash
ssc detail --employee <identifier> [options]
```

选项：
- `--employee <identifier>` - 员工 ID/工号/姓名（必填）
- `--data-dir <dir>` - 数据目录（默认：./data）
- `--operator <operator>` - 操作者标识

### report - 生成申报报告

```bash
ssc report [options]
```

选项：
- `--output <file>` - 导出 JSON 文件路径
- `--data-dir <dir>` - 数据目录（默认：./data）
- `--operator <operator>` - 操作者标识

## 数据目录结构

```
./data/
├── config.json              # 项目配置
├── employees.json           # 员工信息
├── salaries.json            # 工资明细
├── employment-records.json  # 入离职记录
├── city-rules.json          # 城市规则
├── historical-declarations.json  # 历史申报
├── manual-corrections.json  # 人工修正记录
└── operation-logs.json      # 操作日志
```

## 操作日志

所有命令执行都会记录到 `operation-logs.json`，包含：
- 命令名称
- 执行时间
- 操作者
- 命令参数
- 执行状态（成功/失败）
- 执行结果消息

## 幂等性保证

1. **init** - 项目已存在时不会覆盖
2. **import** - 自动检测重复记录并跳过
3. **check** - 只读操作，不修改数据
4. **detail** - 只读操作，不修改数据
5. **report** - 只读操作，不修改数据（导出文件时会覆盖指定文件）

## 业务闭环验证

使用此工具时，可以按以下流程验证业务是否闭环：

1. **init** - 初始化项目，确认数据完整性
2. **import** - 导入实际业务数据
3. **check** - 检查是否有数据缺失或错误
4. **detail** - 抽查关键员工（特别是有调动、离职的）
5. **report** - 查看最终报告：
   - 是否所有员工都有建议申报值？
   - 需要补缴的人员是否合理？
   - 调整理由是否符合业务规则？
   - 补缴金额是否准确？

如果以上步骤都能顺利完成且结果符合预期，则说明业务流程已闭环。

## 示例输出解析

### 需要补缴的场景

孙八（EMP006）5月从北京调动到上海：
- 1-4月在北京按北京规则申报
- 5月及以后在上海按上海规则申报
- 系统自动计算：
  - 北京1-4月基数：约13500元（平均工资）
  - 上海全年基数：约17083.33元（全年平均）
  - 补缴差额：(17083.33 - 13500) × 4 = 14333.33元

### 超出上下限的场景

王五（EMP003）在成都，年平均工资约47583.33元：
- 成都2025年上限：25000元
- 系统自动调整为：25000元
- 调整理由：工资高于上限，按上限调整

### 低于下限的场景

赵六（EMP004）在北京，平均工资约5500元：
- 北京2025年下限：6957元
- 系统自动调整为：6957元
- 调整理由：工资低于下限，按下限调整

## 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **Commander.js** - 命令行框架
- **Chalk** - 终端颜色输出
- **CLI Table3** - 终端表格输出
- **Day.js** - 日期处理
- **UUID** - 唯一标识符生成

## 项目结构

```
src/
├── commands/
│   ├── init.ts     # 初始化命令
│   ├── import.ts   # 导入命令
│   ├── check.ts    # 检查命令
│   ├── detail.ts   # 详情命令
│   └── report.ts   # 报告命令
├── services/
│   └── calculation-service.ts  # 核心计算逻辑
├── data/
│   └── sample-data.ts  # 样例数据生成器
├── utils/
│   └── storage.ts   # 数据存储服务
├── types/
│   └── index.ts     # 类型定义
└── index.ts         # 入口文件
```

## License

MIT
