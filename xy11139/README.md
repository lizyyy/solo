# 滑雪装备租赁点雪具损伤归类 CLI 工具

用于对滑雪装备租赁点的雪具损伤报告进行自动归类的命令行工具。

## 功能特性

- **清晰的退出码**：方便集成到 CI/CD 或定时任务中
- **边界情况处理**：
  - 旧伤复现检测
  - 照片角度缺失检查
  - 可复跑输出格式
- **业务样例**：包含真实的滑雪装备损伤场景
- **日志系统**：默认简洁模式，支持详细日志输出
- **可配置规则**：通过 JSON 配置文件灵活定义归类规则

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 - 所有记录完全归类成功 |
| 1 | 部分成功 - 存在旧伤复现或照片角度缺失的情况 |
| 2 | 输入错误 - 参数无效或文件不存在 |
| 3 | 配置错误 - 规则配置文件不存在 |
| 4 | 处理失败 - 记录处理过程中发生错误 |
| 5 | 无记录 - 输入文件中没有损伤记录 |

## 安装

```bash
npm install
```

## 使用方法

### 基本命令

```bash
# 使用样例数据运行
npm run sample

# 详细模式运行
npm run sample:verbose

# 手动运行
npx ts-node src/index.ts classify \
  --input samples/damage-reports.json \
  --config config/rules.json
```

### 命令选项

- `-i, --input <path>`: 输入的损伤报告 JSON 文件路径（必需）
- `-c, --config <path>`: 规则配置文件路径（必需）
- `-o, --output <path>`: 输出结果的 JSON 文件路径（可选）
- `-v, --verbose`: 显示详细日志
- `-r, --reproducible`: 生成可复跑的输出格式

### 示例

```bash
# 基本使用
npx ts-node src/index.ts classify -i data.json -c config.json

# 详细模式 + 输出结果
npx ts-node src/index.ts classify -i data.json -c config.json -v -o result.json

# 可复跑格式输出（用于定时任务）
npx ts-node src/index.ts classify -i data.json -c config.json -r -o reproducible.json
```

## 项目结构

```
.
├── src/
│   ├── index.ts          # CLI 入口
│   ├── classifier.ts     # 归类引擎
│   ├── types.ts          # 类型定义
│   └── logger.ts         # 日志系统
├── config/
│   └── rules.json        # 归类规则配置
├── samples/
│   └── damage-reports.json  # 业务样例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 规则配置说明

在 `config/rules.json` 中定义归类规则：

- `defaultConfidence`: 默认置信度 (0.5)
- `requiredPhotoAngles`: 必填的照片角度
- `oldDamageRecurrenceKeywords`: 旧伤复现关键词
- `rules`: 具体的归类规则列表

每个规则包含：
- `id`: 规则唯一标识
- `name`: 规则名称
- `description`: 规则描述
- `category`: 损伤分类
- `severity`: 严重程度
- `keywords`: 描述匹配关键词
- `locationKeywords`: 位置匹配关键词（可选）
- `photoAngleRequirements`: 需要的照片角度
- `confidence`: 规则置信度

## 损伤分类

- `base_scratch`: 底板划痕
- `edge_damage`: 刃口损坏
- `top_sheet_crack`: 面板裂纹
- `binding_malfunction`: 固定器故障
- `core_exposure`: 板芯暴露
- `delamination`: 分层脱胶
- `tip_tail_damage`: 板头板尾损坏
- `unknown`: 未知分类

## 严重程度

- `minor`: 轻微
- `moderate`: 中等
- `severe`: 严重
- `critical`: 危急

## 在 CI/CD 中使用

```bash
#!/bin/bash

npx ts-node src/index.ts classify \
  -i daily-reports.json \
  -c config/rules.json \
  -r \
  -o results/$(date +%Y%m%d).json

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ 全部归类成功"
elif [ $EXIT_CODE -eq 1 ]; then
  echo "⚠️  部分成功，需要人工审核"
else
  echo "❌ 处理失败，退出码: $EXIT_CODE"
  exit $EXIT_CODE
fi
```

## 许可证

MIT
