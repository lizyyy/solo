# 搬家调度队 - 装车估算CLI工具

统一口径的搬家装车体积重量估算工具，支持大件不可拆、无电梯等特殊情况处理，保留原始行号和文件名的详细异常报告。

## 功能特点

- ✅ **统一口径**：内置标准计算规则，避免人为估算误差
- ✅ **原始信息保留**：异常报告包含文件名和行号，精准定位问题
- ✅ **特殊情况处理**：大件不可拆、无电梯、可复跑等场景
- ✅ **详细异常报告**：不只是总数统计，包含每条记录的问题详情
- ✅ **不依赖外网**：所有样例数据内置项目中
- ✅ **多种格式支持**：CSV、Excel (xlsx/xls)

## 安装

```bash
npm install
npm run build
npm link
```

## 快速开始

### 1. 使用样例数据演示

```bash
moving-estimate sample
```

带无电梯场景演示：
```bash
moving-estimate sample --no-elevator
```

### 2. 查看默认估算规则

```bash
moving-estimate rules
```

### 3. 处理自己的文件

```bash
moving-estimate estimate samples/normal_furniture.csv samples/office_moving.csv
```

带无电梯场景处理：
```bash
moving-estimate estimate samples/large_non_disassemblable.csv --no-elevator --floors 5
```

## 命令说明

### estimate - 执行装车估算

```bash
moving-estimate estimate <files...> [options]
```

参数：
- `files`: 要处理的文件路径（支持多个）

选项：
- `--no-elevator`: 目标地点无电梯
- `--floors <number>`: 楼层数 (默认: 3)
- `--output-json <path>`: 输出JSON报告路径
- `--output-text <path>`: 输出文本报告路径
- `--show-rules`: 显示默认估算规则

### sample - 使用样例数据演示

```bash
moving-estimate sample [options]
```

选项：
- `--no-elevator`: 模拟无电梯场景
- `--output-json <path>`: 输出JSON报告路径
- `--output-text <path>`: 输出文本报告路径

### rules - 显示默认估算规则

```bash
moving-estimate rules
```

## 数据格式说明

CSV或Excel文件需要包含以下列：

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 否 | 物品ID |
| name | string | 是 | 物品名称 |
| category | string | 是 | 物品类别 |
| width | number | 是 | 宽度（毫米） |
| height | number | 是 | 高度（毫米） |
| depth | number | 是 | 深度（毫米） |
| weight | number | 是 | 单件重量（公斤） |
| isNonDisassemblable | boolean | 否 | 是否大件不可拆 |
| quantity | number | 否 | 数量 |

示例：
```csv
id,name,category,width,height,depth,weight,isNonDisassemblable,quantity
1,实木双人床,卧室家具,1800,2000,500,80,false,1
```

## 默认估算规则

### 体积计算规则
```
单物体积 = 宽(m) × 高(m) × 深(m) × 数量
总体积 = Σ(单物体积) × 堆放系数(0.85)
调整后体积 = 总体积 × 填充系数(1.2)
```

### 重量计算规则
```
总重量 = Σ(单件重量 × 数量)
调整后重量 = 总重量 × 分布系数(0.9)
```

### 特殊情况规则
- **大件不可拆**：体积 × 1.5倍系数
- **无电梯**：每层增加 10% 搬运成本
- **可复跑物品**：享受 10% 折扣

### 车辆配置
| 车型 | 最大体积 | 最大重量 | 基础费用 |
|------|----------|----------|----------|
| 4.2米小货车 | 12 m³ | 1500 kg | 300 元 |
| 6.8米中货车 | 35 m³ | 5000 kg | 600 元 |
| 9.6米大货车 | 65 m³ | 10000 kg | 1200 元 |

## 样例文件说明

`samples/` 目录下提供了多个业务样例：

1. **normal_furniture.csv** - 正常家庭家具清单
2. **large_non_disassemblable.csv** - 大件不可拆物品清单
3. **with_errors.csv** - 包含错误数据的清单（用于测试异常报告）
4. **office_moving.csv** - 办公室搬迁物品清单

## 输出报告示例

### 控制台输出
```
[normal_furniture.csv] 估算结果:
  总体积: 12.345 m³
  总重量: 458.00 kg
  调整后体积: 14.814 m³
  调整后重量: 412.20 kg

  推荐车辆:
    6.8米中货车 x 1: 600 元
    4.2米小货车 x 2: 600 元
```

### 异常报告
```
  文件: with_errors.csv
  状态: PARTIAL
  总计: 10 | 成功: 8 | 失败: 2

    错误详情:
      [行 3] PARSE_ERROR: 尺寸或重量必须是有效数字
        原始内容: {...}
```

## 目录结构

```
moving-estimation-cli/
├── src/
│   ├── index.ts           # CLI入口
│   ├── types/             # 类型定义
│   ├── parsers/           # 文件解析器
│   ├── rules/             # 估算规则引擎
│   ├── report/            # 报告生成器
│   └── utils/             # 工具函数
├── samples/               # 业务样例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

```bash
# 开发模式运行
npm run dev -- sample

# 构建
npm run build

# 运行
npm start -- sample
```

## 接手流程

新同事接手时：

1. 阅读本 README.md 了解项目
2. 运行 `moving-estimate rules` 查看默认规则
3. 运行 `moving-estimate sample` 跑通样例
4. 根据业务需要修改 `src/rules/defaultConfig.ts` 中的规则
5. 处理实际业务数据

## 许可证

MIT
