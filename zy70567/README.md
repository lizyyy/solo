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

### 退出码

- `0`: 正常，无重叠，无坏行
- `2`: 发现重叠或存在坏行

### 示例输出

```
=== IP Overlap Analysis ===
Total entries: 3
Valid entries: 3
Bad entries: 0

WARNING: 发现 1 个重叠!
Overlap #1: 192.168.1.0/24 (TeamA) vs 192.168.1.128/25 (TeamB)

JSON输出已写入: result.json
```

## 文件说明

- [cli.js](file:///Users/lzy/pro/solo/workspaces/zy70567/cli.js) - CLI 入口
- [test.csv](file:///Users/lzy/pro/solo/workspaces/zy70567/test.csv) - 示例输入
- [package.json](file:///Users/lzy/pro/solo/workspaces/zy70567/package.json) - 项目配置
- [src/cidr.ts](file:///Users/lzy/pro/solo/workspaces/zy70567/src/cidr.ts) - TypeScript 核心库代码

## 已知问题（待后续完善）

1. 重叠区间未转换回 CIDR 格式显示（`bigintToCidr()` 函数已实现但未集成）
2. 团队归属汇总统计功能尚未集成到 CLI 输出
3. Markdown 友好报告生成功能尚未实现