# IP 段重叠检测 CLI 工具

用于检测网络策略中不同团队申请的 IP 段重叠问题。

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行命令

```bash
# 基本使用
node cli.js -i test.csv

# 输出 JSON 结果
node cli.js -i test.csv -j result.json
```

### 输入格式

CSV 文件格式：
```
CIDR,团队标签,用途,环境
192.168.1.0/24,TeamA,Web,Prod
192.168.1.128/25,TeamB,DB,Prod
10.0.0.0/8,TeamC,Internal,Dev
```

### 命令行参数

- `-i, --input <path>`: **必填** 输入 CSV 文件路径
- `-j, --json <path>`: 输出 JSON 结果文件路径
- `-m, --markdown <path>`: 输出 Markdown 报告文件路径

### 退出码

- `0`: 正常，无重叠，无坏行
- `2`: 发现重叠或存在坏行

### 示例输出

```
=== IP Overlap Analysis ===
Total entries: 9
Valid entries: 6
Bad entries: 3

WARNING: 发现 3 个重叠!
Overlap #1: 10.1.0.0/16
  [line 4] 10.0.0.0/8 | 团队C | 办公网络
  [line 8] 10.1.0.0/16 | 团队C | 服务器
...

=== 团队归属汇总 ===
WARNING 团队A: 2 网段, 2 重叠 | 环境:测试环境 | 用途:内部服务,监控系统
WARNING 团队B: 1 网段, 1 重叠 | 环境:生产环境 | 用途:数据库
...

JSON输出已写入: result.json
Markdown报告已写入: report.md
```

## 文件说明

- [cli.js](file:///Users/lzy/pro/solo/workspaces/zy70567/cli.js) - CLI 入口
- [test.csv](file:///Users/lzy/pro/solo/workspaces/zy70567/test.csv) - 示例输入
- [package.json](file:///Users/lzy/pro/solo/workspaces/zy70567/package.json) - 项目配置
- [src/cidr.ts](file:///Users/lzy/pro/solo/workspaces/zy70567/src/cidr.ts) - TypeScript 核心库代码

## 功能特性

✅ 所有核心功能均已实现：

1. **CIDR 解析与重叠检测** - IPv4 地址与 BigInt 双向转换、区间排序、重叠计算
2. **重叠区间 CIDR 格式输出** - `bigintToCidr()` 函数将重叠区间转换为标准 CIDR 格式
3. **团队归属汇总统计** - 按团队统计网段数量、环境、用途、重叠次数
4. **机器可读 JSON 输出** - 完整的结构化数据，便于后续处理
5. **Markdown 友好报告** - 含执行摘要、重叠详情、团队汇总、坏行详情的表格报告
6. **坏行保留机制** - 保留原始行号、内容和错误原因，便于排查问题