# 少儿体能馆课程录播重命名 CLI 工具

专为少儿体能馆课程录播视频文件批量重命名设计，支持错别字自动修正、多段视频识别、异常结果分离。

## 功能特性

- ✅ **错别字自动修正** - 内置体能课程常见错字词典（题能→体能、平横→平衡等）
- 📹 **多段视频识别** - 自动识别同一课次的多段视频（P1、P2、P3...）
- 📊 **正常/异常分离** - 正常结果和异常结果分开输出，方便人工复核
- 🔄 **可复跑（幂等性）** - 重复运行结果一致，可使用 diff 对比变化
- 🔢 **固定排序** - 结果按日期→课程名→难度等级→分段排序
- 📁 **样例目录** - 提供正常输入、脏数据输入、重跑对照三套样例

## 安装

```bash
npm install
```

## 快速开始

### 1. 处理正常样例

```bash
node src/cli.js --input samples/normal_input --output samples/normal_output --dry-run
```

### 2. 处理脏数据（含错别字和异常）

```bash
node src/cli.js --input samples/dirty_input --output samples/dirty_output --dry-run
```

### 3. 重跑对照（测试幂等性）

```bash
# 第一次运行
node src/cli.js --input samples/rerun_reference --output samples/rerun_output1 --dry-run

# 第二次运行（对比输出是否一致）
node src/cli.js --input samples/rerun_reference --output samples/rerun_output2 --dry-run

# 使用 diff 对比两次输出是否一致
diff samples/rerun_output1/normal_results.csv samples/rerun_output2/normal_results.csv
```

## 命令行选项

```
选项:
  -i, --input <dir>    输入目录路径 (默认: "./input")
  -o, --output <dir>   输出目录路径 (默认: "./output")
  -r, --recursive      递归处理子目录 (默认: false)
  --dry-run            仅预览不执行重命名 (默认: false)
  --no-summary         不显示处理摘要
  -V, --version        输出版本号
  -h, --help           显示帮助
```

## 命名规范

### 标准格式

```
日期_课程名_难度等级[_分段].扩展名
```

示例：
- `240515_少儿体能基础_L1.mp4`
- `240520_幼儿体能启蒙_L1_P1.mp4` (多段视频)
- `240520_幼儿体能启蒙_L1_P2.mp4` (多段视频)

### 字段说明

| 字段 | 格式 | 说明 |
|------|------|------|
| 日期 | 6位数字 | 年月日，如 240519 表示2024年5月19日 |
| 课程名 | 中文 | 课程名称，如：少儿体能基础、平衡训练 |
| 难度等级 | L1-L6 | L1=初级、L2=中级、L3=高级，以此类推 |
| 分段 | P1、P2... | 可选，同一课次多段视频 |

## 输出文件说明

处理完成后，输出目录包含以下文件：

| 文件名 | 说明 | 重点关注 |
|--------|------|----------|
| `normal_results.csv` | 正常处理的文件列表 | |
| `abnormal_results.csv` | 异常文件列表（命名错误、格式问题等） | ⭐ 人工复核 |
| `multi_part_videos.csv` | 多段视频课次列表 | ⭐ 检查分段是否正确 |
| `typo_fixed.csv` | 错别字修正记录 | ⭐ 检查修正是否正确 |
| `summary.txt` | 处理摘要统计 | |

## 支持的视频格式

- .mp4, .avi, .mov, .mkv, .flv, .wmv

## 内置错别字修正规则

| 错字 | 正确 | 说明 |
|------|------|------|
| 题能、提能、体熊、休能 | 体能 | |
| 棵程、课城 | 课程 | |
| 录波、路播 | 录播 | |
| 幼而、少兒、邵儿 | 幼儿/少儿 | |
| 基楚、出级、初极 | 基础/初级 | |
| 平横、协条、敏结 | 平衡/协调/敏捷 | |
| 力亮、耐立、柔忍 | 力量/耐力/柔韧 | |
| 暴发力、速渡 | 爆发力/速度 | |

## 使用流程建议

1. **首次运行** 使用 `--dry-run` 参数预览
2. **检查异常** 查看 `abnormal_results.csv` 人工修正命名
3. **检查错别字** 查看 `typo_fixed.csv` 确认自动修正
4. **检查多段视频** 查看 `multi_part_videos.csv` 确认分段
5. **确认无误** 去掉 `--dry-run` 参数执行实际重命名
6. **保留输出** 每次运行保留输出目录，可使用 `diff` 对比变化

## 样例目录结构

```
samples/
├── normal_input/       # 正常命名样例（5个文件）
├── dirty_input/        # 含错别字、异常、多段视频（15个文件）
│   ├── 含错别字的文件
│   ├── 多段视频（3段）
│   ├── 命名格式错误
│   ├── 非视频文件
│   └── 无效等级
└── rerun_reference/    # 用于测试幂等性的样例
```

## 项目结构

```
├── src/
│   ├── cli.js         # CLI 入口
│   ├── renamer.js     # 核心重命名逻辑
│   ├── output.js      # 结果输出处理器
│   └── config.js      # 配置文件（错别字、命名规则等）
├── samples/           # 样例文件目录
├── package.json
└── README.md
```

## 许可证

MIT
