# 蛋糕预订台取货码核对 CLI

专门针对蛋糕预订台取货码核对业务场景开发的命令行工具，重点处理边界情况。

## 项目结构

| 文件路径 | 用途说明 |
|---------|---------|
| [package.json](file:///Users/mac/pro/solo/workspaces/xy11179/package.json) | 项目配置、依赖管理、脚本命令 |
| [src/cli.js](file:///Users/mac/pro/solo/workspaces/xy11179/src/cli.js) | CLI 入口文件，命令行参数解析、输出格式化 |
| [src/verifier.js](file:///Users/mac/pro/solo/workspaces/xy11179/src/verifier.js) | 核心业务逻辑，取货码核对、边界情况检测 |
| [data/sample-orders.csv](file:///Users/mac/pro/solo/workspaces/xy11179/data/sample-orders.csv) | 蛋糕订单样例数据（含各种边界情况） |
| [data/sample-pickups.csv](file:///Users/mac/pro/solo/workspaces/xy11179/data/sample-pickups.csv) | 取货记录样例数据（含各种边界情况） |

## 功能特性

### 核心功能
- ✅ 取货码规范化与匹配核对
- ✅ 机器可读输出（CSV/JSON）
- ✅ 人类友好的彩色汇总输出
- ✅ 稳定列顺序，方便后续 diff 对比

### 边界情况处理
| 边界类型 | 检测逻辑 | 输出文件 |
|---------|---------|---------|
| **代取** | 检测代取人姓名/手机号字段 | `output/boundary-proxy-pickup.csv` |
| **手输码** | 检测短数字、简格式取货码 | `output/boundary-manual-code.csv` |
| **跨店取货** | 订单门店与取货门店不一致 | `output/boundary-cross-store.csv` |
| **可复跑** | 信息不完整，可重新核对 | `output/boundary-rerunnable.csv` |

## 关键业务列（固定顺序）

结果输出按以下稳定顺序排列，便于 diff：

```
orderId, pickupCode, customerName, customerPhone, cakeName, cakeSize,
orderStore, pickupStore, pickupTime, pickupType, isProxy, proxyName,
proxyPhone, isManualCode, isCrossStore, status, verificationResult, remark
```

## 安装与使用

### 1. 安装依赖
```bash
npm install
```

### 2. 基本使用
```bash
# 使用样例数据
npm test

# 或直接运行
node src/cli.js data/sample-orders.csv data/sample-pickups.csv
```

### 3. 自定义输出路径
```bash
node src/cli.js data/orders.csv data/pickups.csv output/my-results.csv
```

### 4. 机器可读 JSON 输出
```bash
node src/cli.js data/sample-orders.csv data/sample-pickups.csv --json
```

## 业务样例说明

### [data/sample-orders.csv](file:///Users/mac/pro/solo/workspaces/xy11179/data/sample-orders.csv)
- **ORD001**：正常订单，标准 CAKE-XXXX 格式取货码
- **ORD002**：代取订单（isProxy=是，含代取人信息）
- **ORD003**：手输码订单（4位纯数字 1234）
- **ORD004**：跨店取货订单（东城门店→朝阳门店）
- **ORD005**：手输码订单（A5678 简格式）
- **ORD006**：缺失手机号，可复跑
- **ORD007**：代取 + 跨店取货
- **ORD008**：手输码（9999 纯数字）

### [data/sample-pickups.csv](file:///Users/mac/pro/solo/workspaces/xy11179/data/sample-pickups.csv)
包含实际取货记录，与订单数据进行核对，覆盖所有边界场景。

## 输出文件说明

运行后 `output` 目录将生成：

| 文件名 | 内容 |
|-------|------|
| `verification-results.csv` | 完整核对结果，所有记录 |
| `boundary-proxy-pickup.csv` | 代取记录，单独列出 |
| `boundary-manual-code.csv` | 手输码记录，单独列出 |
| `boundary-cross-store.csv` | 跨店取货记录，单独列出 |
| `boundary-rerunnable.csv` | 可复跑记录，单独列出 |
