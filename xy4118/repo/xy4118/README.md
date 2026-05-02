# 照片入库质检搬运工

博物馆藏品数字化照片管理工具，用于每天拍摄完成后的照片质量检查和归档管理。

## 功能特性

- **暂存区质检**: 先在暂存区进行全面校验，确认无误后再归档
- **多维度校验**:
  - 文件名格式校验（必须包含馆藏号）
  - 文件扩展名校验
  - EXIF 时间校验
  - 重复文件检测（哈希比对）
  - 馆藏号存在性校验（与藏品目录比对）
  - 拍摄清单匹配校验
  - 照片数量限制校验
- **事务式归档**: 校验通过后按馆藏号归档，带审计日志
- **报告导出**: 支持 Markdown 质检报告和 CSV 异常表
- **审计追踪**: 所有操作记录到审计日志

## 项目结构

```
.
├── src/
│   ├── cli.js          # CLI 入口
│   ├── config.js       # 配置管理
│   ├── scanner.js      # 文件扫描器
│   ├── validator.js    # 规则校验器
│   ├── archiver.js     # 归档事务
│   ├── store.js        # 持久化存储
│   └── reporter.js     # 报告生成
├── tests/
│   └── validator.test.js # 测试用例
├── examples/
│   ├── photos/                 # 示例照片
│   ├── shooting-list.csv       # 示例拍摄清单
│   └── collection-catalog.json # 示例藏品目录
├── package.json
└── README.md
```

## 安装

```bash
# 安装依赖
npm install

# 全局链接（可选，方便使用）
npm link
```

## 快速开始

### 1. 初始化工作区

```bash
# 创建新工作目录
mkdir museum-photos && cd museum-photos

# 初始化工作区结构
photo-checker init
```

初始化后会创建以下目录结构：

```
museum-photos/
├── staging/      # 暂存区 - 放置待质检的照片和清单
├── archive/      # 归档区 - 质检通过后的照片归档
├── reports/      # 报告区 - 质检报告和异常表
├── logs/         # 日志区 - 审计日志
└── .photo-checker.json # 配置文件
```

### 2. 准备数据

将以下文件放入 `staging/` 目录：

1. **照片文件**: 文件名必须包含馆藏号（如 `CUL-0001-front.jpg`）
2. **拍摄清单**: `shooting-list.csv`（可选）
3. **藏品目录**: `collection-catalog.json`（可选）

#### 拍摄清单格式 (CSV)

```csv
id,name,category,shooting_date,photographer,notes
CUL-0001,青铜器 - 商代青铜鼎,青铜器,2026-05-01,张工,正面、侧面、底部各一张
CUL-0002,瓷器 - 宋代青瓷瓶,瓷器,2026-05-01,张工,瓶身、瓶口、底部
```

#### 藏品目录格式 (JSON)

```json
{
  "version": "1.0.0",
  "museum": "XX博物馆",
  "items": [
    { "id": "CUL-0001", "name": "青铜器 - 商代青铜鼎", "category": "青铜器" },
    { "id": "CUL-0002", "name": "瓷器 - 宋代青瓷瓶", "category": "瓷器" }
  ]
}
```

### 3. 导入照片（可选）

如果照片在其他目录，可以使用 import 命令：

```bash
# 将照片从源目录移动到暂存区
photo-checker import /path/to/photos

# 复制而不是移动
photo-checker import /path/to/photos --copy

# 模拟执行（不实际操作）
photo-checker import /path/to/photos --dry-run
```

### 4. 执行质检

```bash
# 基本质检
photo-checker check

# 保存质检报告
photo-checker check --save-report

# 显示详细验证结果
photo-checker check --verbose
```

### 5. 归档照片

校验通过后，将照片归档到归档区：

```bash
# 执行归档
photo-checker commit

# 模拟执行（不实际移动文件）
photo-checker commit --dry-run

# 强制归档（忽略验证错误）
photo-checker commit --force

# 保存归档报告
photo-checker commit --save-report
```

### 6. 生成报告

```bash
# 查看上次校验结果
photo-checker report --last

# 生成质检报告
photo-checker report

# 只生成 Markdown 报告
photo-checker report --type check

# 只生成 CSV 异常表
photo-checker report --type archive
```

## 校验规则

| 规则 | 严重程度 | 说明 |
|------|----------|------|
| 文件扩展名 | 错误 | 只允许 .jpg, .jpeg, .png, .tiff, .tif, .raw |
| 文件名格式 | 错误 | 必须包含馆藏号（如 `CUL-0001`） |
| 馆藏号格式 | 错误 | 必须符合 `^[A-Z]+-\d{4,}$` 格式 |
| 馆藏号存在性 | 错误 | 必须在藏品目录中存在 |
| 文件名唯一性 | 错误 | 同一工作区不能有重名文件 |
| 重复文件 | 错误 | 哈希相同的文件视为重复 |
| EXIF 时间 | 警告 | 检查是否缺少或无效 |
| EXIF 时间一致性 | 警告 | 检查拍摄时间跨度是否合理 |
| 拍摄清单匹配 | 警告 | 检查照片与拍摄清单是否一致 |
| 照片数量限制 | 警告 | 单藏品照片数量限制（默认 10 张） |

## 临时目录验证流程

### 快速验证（使用示例数据）

```bash
# 1. 创建临时工作目录
cd /tmp
mkdir temp-museum-test && cd temp-museum-test

# 2. 初始化
photo-checker init

# 3. 复制示例数据到 staging 目录
cp -r /path/to/photo-checker/examples/* staging/

# 4. 执行质检
photo-checker check --verbose

# 5. 查看报告
ls reports/

# 6. 执行归档（模拟）
photo-checker commit --dry-run

# 7. 实际归档
photo-checker commit

# 8. 查看归档结果
ls archive/
ls logs/
```

### 测试错误场景

1. **创建无效文件名测试**

```bash
cd staging
echo "invalid" > bad-filename.jpg
photo-checker check --verbose
# 应该报告：文件名格式错误
```

2. **创建重复文件测试**

```bash
cd staging
cp CUL-0001-front.jpg CUL-0001-duplicate.jpg
photo-checker check --verbose
# 应该报告：重复文件
```

3. **创建不存在的馆藏号测试**

```bash
cd staging
echo "test" > INVALID-9999.jpg
photo-checker check --verbose
# 应该报告：馆藏号不存在
```

## 配置说明

配置文件 `.photo-checker.json` 包含以下设置：

```json
{
  "version": "1.0.0",
  "directories": {
    "staging": "staging",
    "archive": "archive",
    "reports": "reports",
    "logs": "logs"
  },
  "validation": {
    "allowedExtensions": [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".raw"],
    "collectionIdPattern": "^[A-Z]+-\\d{4,}$",
    "maxPhotosPerItem": 10,
    "exifTimeToleranceMinutes": 5
  }
}
```

### 馆藏号格式

默认馆藏号格式：`^[A-Z]+-\d{4,}$`

示例有效馆藏号：
- `CUL-0001`
- `ART-12345`
- `OBJ-9999`

如需修改馆藏号格式，编辑 `.photo-checker.json` 中的 `collectionIdPattern`。

## 审计日志

所有操作都会记录到 `logs/audit-log.json`，包括：

- **import**: 照片导入记录
- **check**: 质检记录
- **commit**: 归档事务记录

日志格式示例：

```json
[
  {
    "id": "uuid-xxx",
    "timestamp": "2026-05-02T10:00:00.000Z",
    "type": "archive",
    "action": "commit",
    "transactionId": "uuid-yyy",
    "photos": [
      {
        "originalPath": "staging/CUL-0001-front.jpg",
        "archivePath": "archive/CUL-0001/CUL-0001-front.jpg",
        "hash": "abc123...",
        "collectionId": "CUL-0001"
      }
    ],
    "summary": {
      "total": 5,
      "successful": 5,
      "failed": 0
    }
  }
]
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
node --test tests/validator.test.js
```

## 命令参考

| 命令 | 说明 | 选项 |
|------|------|------|
| `init` | 初始化工作区 | `-f, --force` 强制重新初始化 |
| `import <source>` | 导入照片到暂存区 | `-c, --copy` 复制而非移动<br>`-n, --dry-run` 模拟执行 |
| `check` | 执行质检 | `-s, --save-report` 保存报告<br>`-v, --verbose` 详细输出 |
| `commit` | 归档照片 | `-n, --dry-run` 模拟执行<br>`-f, --force` 强制归档<br>`-s, --save-report` 保存报告 |
| `report` | 生成报告 | `-l, --last` 查看上次结果<br>`-t, --type` 报告类型 |

## 常见问题

### Q: 如何处理验证错误？

1. 运行 `photo-checker check --verbose` 查看详细错误
2. 根据错误信息修复问题文件
3. 重新运行 `photo-checker check`
4. 确认通过后再执行 `photo-checker commit`

### Q: 归档后文件在哪里？

归档后的文件会按馆藏号组织在 `archive/` 目录下：

```
archive/
├── CUL-0001/
│   ├── CUL-0001-front.jpg
│   ├── CUL-0001-side.jpg
│   └── CUL-0001-bottom.jpg
└── CUL-0002/
    └── CUL-0002-front.jpg
```

### Q: 如何恢复误删的文件？

本工具默认**复制**而非**移动**文件到归档区，原始文件仍保留在 staging 目录。如需清理 staging 目录，请手动确认后删除。

### Q: 支持哪些图片格式？

默认支持：.jpg, .jpeg, .png, .tiff, .tif, .raw

如需添加其他格式，编辑 `.photo-checker.json` 中的 `allowedExtensions`。

## 许可证

MIT License
