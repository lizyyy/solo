# 眼镜店镜片参数校验 CLI

一个专门用于眼镜店镜片处方参数校验的命令行工具，支持左右眼颠倒检测、轴位范围校验、重跑数据标记等功能。

## 功能特性

- **左右眼颠倒检测**：当左右眼球镜差值超过阈值时发出警告
- **轴位范围校验**：验证轴位是否在0-180度有效范围内
- **可复跑输出标记**：检测并标记重跑数据记录
- **退出码机制**：
  - 0: 全部校验通过
  - 3: 部分成功（存在警告）
  - 2: 存在错误
  - 1: 执行异常
- **结果排序**：按文件名、处方单号固定排序，方便diff比较

## 安装

```bash
npm install
```

## 使用方法

```bash
node src/cli.js -i <输入目录> -o <输出目录> -r <规则文件> [-v]
```

### 参数说明

- `-i, --input <dir>`: 输入目录路径（包含CSV处方文件）
- `-o, --output <dir>`: 输出目录路径（校验结果将写入此目录）
- `-r, --rules <file>`: 规则文件路径（JSON格式）
- `-v, --verbose`: 显示详细处理信息

### 使用示例

#### 1. 正常数据校验
```bash
node src/cli.js -i samples/normal -o output/normal -r rules/lens-validation-rules.json -v
```
退出码: 0（全部通过）

#### 2. 脏数据校验
```bash
node src/cli.js -i samples/dirty -o output/dirty -r rules/lens-validation-rules.json -v
```
退出码: 2（存在错误）

#### 3. 重跑数据校验
```bash
node src/cli.js -i samples/reprocess -o output/reprocess -r rules/lens-validation-rules.json -v
```
退出码: 3（部分成功，存在警告）

## 输出文件

每个校验任务会在输出目录生成以下三个文件：

1. **validation_summary.json** - 完整的校验结果（JSON格式）
2. **validation_details.csv** - 校验详情（CSV格式，便于查看）
3. **validation_stats.txt** - 校验统计报告

## 项目结构

```
.
├── src/
│   ├── cli.js          # CLI入口文件
│   ├── validator.js    # 核心校验逻辑
│   ├── utils.js        # 工具函数（排序、输出）
│   └── index.js        # 模块导出
├── rules/
│   └── lens-validation-rules.json  # 校验规则配置
├── samples/
│   ├── normal/         # 正常输入样例
│   ├── dirty/          # 脏数据输入样例
│   └── reprocess/      # 重跑对照样例
├── output/             # 输出目录（运行时生成）
├── package.json
└── README.md
```

## 规则配置说明

规则文件 `rules/lens-validation-rules.json` 包含以下配置项：

- `requiredFields`: 必填字段列表
- `eyeSwap`: 左右眼颠倒检测配置
  - `enabled`: 是否启用
  - `threshold`: 差值阈值
- `axisRange`: 轴位范围配置
  - `min/max`: 有效范围
- `reprocess`: 重跑标记配置
