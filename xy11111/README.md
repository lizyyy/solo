# 摄影工作室照片选片合并 CLI

专为摄影工作室设计的照片选片和合并工具，支持预览-正式双模式，解决后续追责和复盘无依据的问题。

## 核心特性

✅ **预览模式先行**：先查看完整计划动作，确认后再执行正式操作  
✅ **可复跑输出**：中断后可继续处理剩余文件，已处理文件会被跳过  
✅ **扩展名大小写统一**：自动将 .JPG/.PNG 转为小写格式  
✅ **重复文件名处理**：目标文件已存在时自动重命名（添加序号）  
✅ **完整日志记录**：每次操作生成详细 JSON 日志，便于追责和复盘  
✅ **已处理文件记录**：记录所有已处理文件，避免重复操作

## 快速开始

```bash
# 安装依赖
npm install

# 预览样例效果（推荐先运行这个）
npm run sample

# 正式执行样例
npm run sample:run
```

## 使用方法

### 命令行参数

```bash
# 预览模式 - 只显示计划，不实际操作
node src/index.js --config config/default.json --preview

# 正式模式 - 执行合并操作
node src/index.js --config config/default.json --run
```

### 配置文件说明

编辑 `config/default.json` 配置：

```json
{
  "name": "摄影工作室选片合并默认配置",
  
  "sourceDirs": {
    "精修": "sample/photos/精修",
    "原片": "sample/photos/原片",
    "花絮": "sample/photos/花絮"
  },
  
  "outputDir": "sample/output",
  "logDir": "sample/logs",
  
  "rules": {
    "allowedExtensions": [".jpg", ".jpeg", ".png", ".raw", ".cr2", ".nef", ".arw"],
    "normalizeExtension": true,
    "duplicateStrategy": "rename",
    "skipProcessed": true,
    "maxFilenameLength": 100
  },
  
  "filenamePattern": "{拍摄日期}_{客户姓名}_{照片类型}_{序号}{扩展名}",
  
  "客户信息": {
    "拍摄日期": "20240515",
    "客户姓名": "张三_李四",
    "套餐类型": "婚纱摄影A套系"
  }
}
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

测试覆盖以下场景：
1. ✅ 空目录处理
2. ✅ 扩展名大小写规范化
3. ✅ 跳过非照片文件（.db/.txt/.MOV 等）
4. ✅ 重复文件名自动重命名
5. ✅ 可复跑机制（已处理文件跳过）
6. ✅ 完整日志记录
7. ✅ 多目录合并（精修/原片/花絮）
8. ✅ 预览模式标记
9. ✅ 序号补零格式

## 日志说明

每次执行会在 `logDir` 目录生成两个文件：

1. `merge_YYYY-MM-DDTHH-MM-SS.SSSZ.json` - 本次执行的详细日志
2. `processed_files.json` - 所有已处理文件的记录（用于可复跑）

### 日志文件结构

```json
{
  "config": { ... },
  "plan": [ ... ],
  "logs": [
    { "type": "copy", "source": "...", "target": "...", "renamed": false, ... },
    { "type": "skip", "source": "...", "reason": "...", ... },
    { "type": "error", "source": "...", "error": "...", ... }
  ],
  "summary": {
    "total": 12,
    "copied": 9,
    "skipped": 3,
    "errors": 0
  },
  "executedAt": "2024-05-15T...",
  "mode": "run"
}
```

## 新人接手流程

1. 先运行 `npm run sample` 预览样例效果
2. 查看 `config/default.json` 了解默认配置
3. 复制配置文件，修改客户信息和目录路径
4. 使用 `--preview` 预览计划
5. 确认无误后使用 `--run` 正式执行

## 项目结构

```
.
├── src/
│   ├── index.js          # CLI 入口
│   └── PhotoMerge.js     # 核心业务逻辑
├── config/
│   └── default.json      # 默认配置文件
├── tests/
│   └── PhotoMerge.test.js # 测试用例
├── sample/
│   ├── photos/           # 样例照片目录
│   ├── output/           # 样例输出目录
│   └── logs/             # 样例日志目录
├── package.json
├── jest.config.js
└── README.md
```
