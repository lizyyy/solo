# 骑行俱乐部骑行轨迹整理 CLI

一个专为骑行俱乐部设计的GPS轨迹数据清洗工具，能够识别并报告各种数据异常情况。

## 功能特性

### 核心清洗功能
- ✅ **缺列检测** - 识别缺失的必需字段（timestamp, latitude, longitude, altitude, speed, rider_id, ride_id）
- ✅ **重复记录检测** - 基于（rider_id + ride_id + timestamp）去重
- ✅ **无效记录过滤** - 验证经纬度范围、速度合理性等
- ✅ **空文件处理** - 正确识别并跳过空文件

### 骑行专属异常检测
- 🚴 **设备断电检测** - 识别GPS设备断电导致的时间断层（>30分钟）
- 🔄 **路线反向检测** - 检测路线记录异常折返
- 📊 **详细统计** - 完整的处理统计和错误分类

### 错误处理能力
- ⚠️ **错误日志输出** - JSON格式的完整错误报告，包含错误类型、位置、原因
- 🔄 **遇错继续模式** - 部分文件失败不影响整体处理流程
- 📁 **可复跑输出** - 每次运行输出独立文件，不覆盖原始数据

## 项目结构

```
.
├── src/
│   ├── index.js          # 核心清洗逻辑
│   └── cli.js            # 命令行入口
├── test/
│   └── trace-cleaner.test.js  # 测试用例
├── data/
│   └── samples/          # 样例测试数据
│       ├── normal_ride.csv       # 正常骑行数据
│       ├── power_loss_ride.csv   # 设备断电场景
│       ├── reverse_route.csv     # 路线反向场景
│       ├── missing_columns.csv   # 缺列测试
│       ├── duplicate_rows.csv    # 重复行测试
│       ├── empty_file.csv        # 空文件测试
│       ├── invalid_records.csv   # 无效记录测试
│       └── README.md             # 样例数据说明
├── package.json
└── jest.config.js
```

## 安装

```bash
npm install
```

## 使用方法

### 基本用法
```bash
# 处理单个文件
node src/cli.js -i data/samples/normal_ride.csv

# 批量处理多个文件
node src/cli.js -i data/samples/*.csv

# 指定输出目录
node src/cli.js -i data/samples/*.csv -o ./output
```

### 命令行选项

| 选项 | 别名 | 说明 | 默认值 |
|------|------|------|--------|
| `--input` | `-i` | 输入文件路径（支持多个） | 必填 |
| `--output-dir` | `-o` | 输出目录 | `./data/output` |
| `--continue-on-error` | `-c` | 遇错继续处理 | `true` |
| `--no-continue-on-error` | | 遇错即停 | - |
| `--help` | `-h` | 显示帮助 | - |

### 遇错即停模式
```bash
node src/cli.js -i data/samples/*.csv --no-continue-on-error
```

## 输出文件

### 清洗后数据
- 文件名：`{原文件名}_cleaned.csv`
- 格式：标准CSV，包含所有必需字段
- 内容：仅保留有效且不重复的记录

### 错误日志
- 文件名：`error_log.json`
- 格式：JSON，结构如下：

```json
{
  "timestamp": "2024-05-19T...",
  "stats": {
    "totalFiles": 7,
    "processedFiles": 6,
    "failedFiles": 1,
    "totalRecords": 50,
    "validRecords": 30,
    "invalidRecords": 10,
    "duplicateRecords": 5,
    "powerLossEvents": 2,
    "reverseRouteEvents": 1
  },
  "errors": [
    {
      "type": "MISSING_COLUMNS",
      "message": "缺少必需列: ride_id",
      "file": "/path/to/file.csv",
      "missingFields": ["ride_id"]
    }
  ]
}
```

## 错误类型说明

| 错误类型 | 说明 | 处理方式 |
|----------|------|----------|
| `EMPTY_FILE` | 文件为空 | 文件标记为失败 |
| `FILE_NOT_FOUND` | 文件不存在 | 文件标记为失败 |
| `MISSING_COLUMNS` | 缺少必需列 | 发出警告，继续处理 |
| `DUPLICATE_RECORD` | 重复记录 | 过滤重复项 |
| `INVALID_RECORD` | 字段值无效 | 过滤无效记录 |
| `POWER_LOSS_DETECTED` | 检测到设备断电 | 发出警告，保留数据 |
| `REVERSE_ROUTE_DETECTED` | 检测到路线反向 | 发出警告，保留数据 |
| `ENCODING_ERROR` | 文件编码异常 | 文件标记为失败 |
| `PARSE_ERROR` | CSV解析错误 | 文件标记为失败 |

## 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并显示覆盖率
npm run test:coverage
```

### 测试覆盖范围
- ✅ 空文件处理
- ✅ 缺列检测
- ✅ 重复行去重
- ✅ 无效记录验证（经纬度、速度等）
- ✅ 设备断电检测
- ✅ 路线反向检测
- ✅ 批量处理与部分失败
- ✅ 边界条件处理
- ✅ 错误路径可见性验证

## 业务场景设计

### 适用场景
1. **骑行俱乐部数据归档** - 清洗历史GPS数据
2. **活动成绩统计** - 确保统计数据准确性
3. **路线规划验证** - 识别异常轨迹数据
4. **设备质量监控** - 统计各品牌设备异常率

### 典型异常场景
- 休息时设备休眠，唤醒后时间断层
- 山区信号丢失后数据漂移
- APP导出时网络重传造成重复
- 旧版设备数据格式不兼容
- 管理员多次导出同一活动

## 字段说明

| 字段名 | 类型 | 说明 | 验证规则 |
|--------|------|------|----------|
| timestamp | string | ISO 8601时间戳 | 非空 |
| latitude | number | 纬度 | -90 ~ 90 |
| longitude | number | 经度 | -180 ~ 180 |
| altitude | number | 海拔（米） | 非空 |
| speed | number | 速度（km/h） | 0 ~ 150 |
| rider_id | string | 骑手编号 | 非空 |
| ride_id | string | 骑行活动编号 | 非空 |

## 开发说明

### 添加新的检测规则
在 `src/index.js` 的 `TraceCleaner` 类中添加新方法，并在 `processFile` 中调用。

### 扩展错误类型
在错误处理逻辑中添加新的 `type` 字段，并确保在错误日志中正确记录。

## License

MIT
