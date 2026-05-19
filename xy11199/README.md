# 旅拍客服组 - 照片交付 CLI 工具

专为旅拍客服组设计的照片交付数据处理工具，专门解决旅拍行业中的多地点同名文件、多次补拍追踪、源文件追溯等业务痛点。

## 功能特性

### 🔍 **多地点同名文件识别
- 自动识别不同拍摄地点的相同文件名
- 为重复文件名生成唯一标识
- 记录涉及的所有地点信息

### 📸 **补拍追踪系统**
- 追踪同一订单的多次补拍
- 记录补拍次数和顺序
- 标记多次补拍的特殊状态

### 📄 **源文件可追溯**
- 每条记录标记来源文件路径
- 精确记录来源文件行号
- 支持问题快速定位

### ✅ **数据清洗功能**
- 必填字段验证（订单号、客户姓名、拍摄地点、文件名）
- 自动检测和移除重复行
- 空文件和空记录识别

### 📊 **多格式输出**
- CSV 格式
- JSON 格式
- Markdown 表格格式

## 安装

### 全局安装（推荐）

```bash
npm install -g .
```

### 直接运行（无需安装）

```bash
node bin/cli.js
```

## 快速开始

### 基本使用

```bash
# 处理单个文件，输出到 CSV
lvpai-delivery examples/sanya-2024-05.csv -o output/sanya-result.csv

# 处理多个文件，输出 JSON
lvpai-delivery examples/*.csv -o output/all-result.json -f json

# 遇到错误继续处理其他文件
lvpai-delivery examples/*.csv --continue-on-error -o report.md -f md
```

### 完整示例

```bash
# 创建输出目录
mkdir -p output

# 处理三亚和丽江的所有照片数据
lvpai-delivery examples/sanya-2024-05.csv examples/lijiang-2024-05.csv -o output/may-delivery.csv

# 查看统计信息
# 输出将包含:
# ✅ 结果已保存到: output/may-delivery.csv
# 📊 处理统计:
#   文件总数: 2
#   成功处理: 2
#   处理失败: 0
#   记录总数: 17
#   有效记录: 15
#   重复记录: 2
#   补拍记录: 4
```

## 命令行选项

| 选项 | 说明 |
|------|------|
| `-o, --output <文件>` | 指定输出文件路径 |
| `-f, --format <格式>` | 输出格式: `csv`, `json`, `md` (默认: csv) |
| `--continue-on-error` | 遇到错误时继续处理其他文件 |
| `--no-stats` | 不显示统计信息 |
| `-h, --help` | 显示帮助信息 |

## 业务字段说明

### 必填字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 订单号 | 客户订单编号 | LP20240501001 |
| 客户姓名 | 客户姓名 | 张三 |
| 拍摄地点 | 拍摄城市/地点 | 三亚、丽江、大理 |
| 文件名 | 照片文件名 | 三亚_海边_001.jpg |

### 可选字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 拍摄日期 | 拍摄日期 | 2024-05-01 |
| 是否补拍 | 是否为补拍照片 | 是/否 |
| 摄影师 | 摄影师姓名 | 李师傅 |
| 备注 | 备注信息 | 主纱造型 |

### 元数据字段（自动生成）

| 字段 | 说明 |
|------|------|
| `_source.file` | 来源文件完整路径 |
| `_source.line` | 来源文件行号 |
| `_uniqueId` | 全局唯一记录ID |
| `_duplicateResolved` | 是否已处理重名 |
| `_reshootInfo.isReshoot` | 是否补拍标记 |
| `_reshootInfo.reshootNumber` | 第几次补拍 |
| `_reshootInfo.totalReshoots` | 总补拍次数 |
| `_validation.isValid` | 验证是否通过 |
| `_validation.missingFields` | 缺失的必填字段列表 |
| `_validation.status` | 状态（待处理/处理失败） |

## 业务场景示例

### 场景1: 多地点同名文件处理

**输入数据 (examples/same-filename.csv):
```csv
订单号,客户姓名,拍摄地点,文件名,拍摄日期
LP001,张三,三亚,海边_001.jpg,2024-05-01
LP002,李四,青岛,海边_001.jpg,2024-05-02
LP003,王五,三亚,海边_001.jpg,2024-05-03
```

**处理结果**:
- 自动识别"海边_001.jpg"出现在三亚和青岛两个地点
- 为每条记录生成唯一ID: `海边_001.jpg-三亚-1`, `海边_001.jpg-青岛-2`
- 标记 `_sameFileNameDifferentLocations: true`

### 场景2: 多次补拍追踪

**输入数据 (examples/reshoots.csv):
```csv
订单号,客户姓名,拍摄地点,文件名,拍摄日期,是否补拍
LP004,赵六,丽江,茶马古道_001.jpg,2024-05-10,否
LP004,赵六,丽江,茶马古道_001.jpg,2024-05-11,是
LP004,赵六,丽江,茶马古道_001.jpg,2024-05-12,是
```

**处理结果**:
- 识别该订单共有2次补拍
- 第一次补拍: `reshootNumber: 1`, `totalReshoots: 2`
- 第二次补拍: `reshootNumber: 2`, `hasMultipleReshoots: true`

### 场景3: 源文件追溯

假设第5行数据有问题，可通过 `_source` 字段快速定位:
```javascript
{
  "订单号": "LP001",
  "_source": {
    "file": "/path/to/examples/sanya-2024-05.csv",
    "line": 5
  }
}
```

## 边界情况处理

### 1. 缺失列处理
当文件缺少必填列时:
- 标记 `_validation.isValid: false`
- 记录缺失的字段列表
- 状态标记为"处理失败"

### 2. 重复行处理
当存在完全重复的（订单号+文件名+拍摄地点）时:
- 保留第一条记录
- 后续重复记录被过滤
- 统计重复记录数量

### 3. 空文件处理
当处理空文件时:
- 记录错误信息: "文件为空"
- 跳过该文件继续处理其他文件（需启用 `--continue-on-error`）

### 4. 部分文件失败处理
使用 `--continue-on-error` 选项:
- 单个文件处理失败不影响整体流程
- 失败文件信息记录在 errors 数组
- 统计信息分别统计成功/失败文件数

## 使用示例

### 示例1: 处理完整的5月交付数据

```bash
lvpai-delivery examples/sanya-2024-05.csv examples/lijiang-2024-05.csv -o output/may-full-report.md -f md
```

输出的 Markdown 报告包含:
- 所有照片交付清单
- 每条记录的源文件和行号
- 补拍次数标记
- 验证状态

### 示例2: 测试边界情况

```bash
# 包含空文件、缺列文件、重复数据的测试
lvpai-delivery examples/empty.csv examples/missing-columns.csv examples/duplicates.csv --continue-on-error -o output/border-test.json -f json
```

### 示例3: 仅输出统计信息

```bash
lvpai-delivery examples/*.csv -o /dev/null
# 只显示统计不输出数据
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

测试覆盖:
- ✅ CSV 解析和源文件行号记录
- ✅ 缺失字段验证
- ✅ 重复行处理
- ✅ 补拍追踪
- ✅ 多地点同名文件处理
- ✅ 空文件处理
- ✅ 部分失败继续处理
- ✅ 多种输出格式

## 项目结构

```
.
├── bin/
│   └── cli.js              # CLI 入口文件
├── src/
│   └── core.js              # 核心业务逻辑
├── tests/
│   └── core.test.js         # 测试用例
├── examples/
│   ├── sanya-2024-05.csv   # 三亚样例数据
│   ├── lijiang-2024-05.csv  # 丽江样例数据
│   ├── missing-columns.csv    # 缺列测试数据
│   ├── duplicates.csv         # 重复行测试数据
│   └── empty.csv             # 空文件测试
├── package.json
└── README.md
```

## 业务价值

1. **提高客服效率**: 快速定位问题照片的来源文件和具体行号
2. **减少出错率**: 自动识别重复照片和补拍记录，避免重复交付
3. **数据可追溯**: 每条记录都有完整的来源信息，问题可追溯
4. **支持复杂场景**: 专门针对旅拍行业的多地点、多次补拍等特殊业务场景

## License

MIT
