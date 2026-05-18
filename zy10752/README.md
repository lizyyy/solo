# 应用权限清单权限降级核验 CLI

一个用于检查应用权限降级后是否残留权限的命令行工具，专门用于验证权限降级操作的完整性。

## 功能特性

- ✅ 检查旧 token 权限残留
- ✅ 检查子应用继承权限残留
- ✅ 检查缓存权限未过期残留
- ✅ 输出结构化报告，便于 diff 对比
- ✅ 支持 JSON 和文本两种输出格式
- ✅ 包含明确的"应用权限清单权限降级核验"标识

## 安装

```bash
# 克隆或下载项目后
npm install -g .

# 验证安装
perm-check --help
```

## 快速开始

### 从样例输入到结果输出的完整命令链

```bash
# 1. 查看帮助信息
perm-check --help

# 2. 使用样例数据运行检查（发现残留权限 - 异常路径）
perm-check \
  --base examples/base-permissions.json \
  --target examples/target-permissions.json \
  --output examples/result-with-residue.json \
  --format json

# 3. 以文本格式输出查看详情
perm-check \
  -b examples/base-permissions.json \
  -t examples/target-permissions-with-residue.json \
  -f text

# 4. 正常降级路径（无残留权限）
perm-check \
  -b examples/base-permissions.json \
  -t examples/target-permissions-clean.json \
  -f text

# 5. 对比两次结果的差异（规则变更验证）
diff examples/result-with-residue.json <(perm-check -b examples/base-permissions.json -t examples/target-permissions-clean.json)
```

## 命令选项

| 选项 | 简写 | 说明 |
|------|------|------|
| `--base <文件>` | `-b` | 基准权限清单文件（降级前） |
| `--target <文件>` | `-t` | 目标权限清单文件（降级后） |
| `--output <文件>` | `-o` | 输出结果文件路径 |
| `--format <格式>` | `-f` | 输出格式: `json` (默认) 或 `text` |
| `--help` | `-h` | 显示帮助信息 |

## 输出结构

### JSON 输出

```json
{
  "toolName": "应用权限清单权限降级核验",
  "version": "1.0.0",
  "checkTime": "2024-06-01T12:00:00.000Z",
  "summary": {
    "totalResidue": 3,
    "categories": {
      "旧token残留权限": 1,
      "子应用残留权限": 1,
      "缓存残留权限": 1
    },
    "checkResult": "发现残留权限"
  },
  "residue": [
    {
      "permissionId": "perm_001",
      "permissionName": "用户数据读取",
      "hasResidue": true,
      "category": "旧token残留权限",
      "description": "旧token权限未完全降级",
      "baseValue": { ... },
      "targetValue": { ... },
      "diff": [ ... ]
    }
  ],
  "details": { ... },
  "metadata": {
    "baseCount": 5,
    "targetCount": 5,
    "diffHint": "规则变更后，请对比历史报告结构变化可通过diff直接观察"
  }
}
```

### 文本输出

```
============================================================
  应用权限清单权限降级核验 报告
============================================================
检查时间: 2024/6/1 12:00:00
检查结果: 发现残留权限
残留总数: 3

按类别统计:
  旧token残留权限: 1 项
  子应用残留权限: 1 项
  缓存残留权限: 1 项

残留权限详情:
------------------------------------------------------------
【旧token残留权限】
  权限ID: perm_001
  权限名称: 用户数据读取
  问题描述: 旧token权限未完全降级
  差异明细:
    enabled: true -> true
    level: "read" -> "read"
...
```

## 样例目录说明

```
examples/
├── base-permissions.json          # 基准权限（降级前）
├── target-permissions.json        # 默认目标权限（含部分残留）
├── target-permissions-clean.json  # 完全降级（无残留）
├── target-permissions-with-residue.json  # 全部残留（异常场景）
├── expected-output-demo.txt       # 期望输出样例
└── result-with-residue.json       # 运行后生成的结果文件
```

## 业务规则说明

### 检查维度

1. **旧 token 残留权限**
   - 检测点: `enabled` 状态、`level` 权限级别
   - 判定规则: enabled=true 或 权限级别未降级

2. **子应用残留权限**
   - 检测点: `inherited` 继承状态、`permissions` 权限列表长度
   - 判定规则: inherited=true 或 权限列表未减少

3. **缓存残留权限**
   - 检测点: `cached` 缓存状态、`expireTime` 过期时间
   - 判定规则: cached=true 或 过期时间未提前

### 权限级别顺序

```
readonly < read < write < admin
```

## 规则变更后的 Diff 验证方法

```bash
# 保存规则变更前的结果
perm-check -b old/base.json -t old/target.json -o result-v1.json

# 规则变更后，重新检查
perm-check -b new/base.json -t new/target.json -o result-v2.json

# 对比差异
diff result-v1.json result-v2.json
```

## 自动化测试

```bash
# 运行所有测试
npm test

# 测试内容包括:
# - 正常路径: 完全降级，应输出"无残留权限"
# - 异常路径: 存在残留权限，应检测到具体残留项
# - 边界条件: 空权限列表、格式错误等
```

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 无残留权限，检查通过 |
| 1 | 发现残留权限，检查不通过 |
| >1 | 执行错误（文件不存在、格式错误等） |

## 注意事项

1. 输入文件必须是合法的 JSON 数组格式
2. 每个权限项必须包含 `id` 字段作为唯一标识
3. 输出报告中的 `checkTime` 会随时间变化，diff 时可忽略该字段
4. 建议保留历史检查报告，便于追踪规则变更的影响

## 许可证

MIT
