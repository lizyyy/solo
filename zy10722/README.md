# 权限审计日志临权到期巡检 CLI

一个用于检测权限过期后仍在访问系统的用户的命令行工具。

## 功能特性

- ✅ 扫描CSV格式的权限审计日志
- ✅ 识别权限过期后仍访问的用户
- ✅ 检测数据质量问题（重复行、缺失列、无效数据）
- ✅ 支持diff对比两次巡检报告（令牌刷新、部门调整、权限继承变化）
- ✅ 多种输出格式（文本、JSON）
- ✅ 完整的自动化测试覆盖

## 安装

```bash
npm install
npm link
```

## 使用方法

### 1. 扫描审计日志目录

```bash
perm-scan scan <目录路径> [选项]
```

**选项：**
- `-d, --date <日期>` - 审计基准日期 (格式: YYYY-MM-DD，默认: 今天)
- `-f, --format <格式>` - 输出格式: text|json (默认: text)
- `-o, --output <文件路径>` - 输出到文件

**示例：**

```bash
# 基本扫描
perm-scan scan examples/normal -d 2026-05-18

# 输出JSON格式到文件
perm-scan scan examples/normal -d 2026-05-18 -f json -o report.json
```

### 2. 验证单个CSV文件

```bash
perm-scan validate <文件路径>
```

**示例：**

```bash
perm-scan validate examples/normal/audit-log-1.csv
```

### 3. 对比两次巡检报告差异

```bash
perm-scan diff <旧报告文件> <新报告文件>
```

**示例：**

```bash
# 先生成两份报告
perm-scan scan examples/normal -d 2026-01-01 -f json -o old-report.json
perm-scan scan examples/normal -d 2026-05-18 -f json -o new-report.json

# 对比差异
perm-scan diff old-report.json new-report.json
```

## CSV文件格式要求

必需列：
- **用户ID** - 用户唯一标识
- **用户名** - 用户姓名
- **权限令牌** - 权限访问令牌
- **权限到期时间** - 权限有效期截止日期 (YYYY-MM-DD)
- **最后访问时间** - 用户最后访问系统时间

可选列：
- **部门** - 用户所属部门
- **访问资源** - 用户访问的资源名称
- **权限来源** - 权限获取方式（用于diff对比检测权限继承变化）

## 业务规则

工具会标记以下用户为"过期仍访问用户"：
1. 权限到期时间 < 审计基准日期（权限已过期）
2. 最后访问时间 > 权限到期时间（过期后仍有访问行为）

## 退出码说明

- `0` - 正常执行，未发现过期仍访问用户
- `1` - 执行错误或验证失败
- `2` - 检测到过期仍访问用户

## 测试

运行自动化测试：

```bash
npm test
```

测试覆盖场景：
- ✅ 空目录扫描
- ✅ 缺少必需列检测
- ✅ 重复行检测
- ✅ 部分损坏文件处理
- ✅ 正常扫描流程
- ✅ 报告差异对比功能

## 项目结构

```
permission-audit-scanner/
├── bin/
│   └── perm-scan.js          # CLI入口文件
├── src/
│   └── scanner.js            # 核心扫描器逻辑
├── examples/                 # 样例数据目录
│   ├── normal/              # 正常数据
│   ├── empty/               # 空目录
│   ├── missing-column/      # 缺少列数据
│   ├── duplicate-rows/      # 重复行数据
│   └── corrupted-file/      # 损坏文件数据
├── test/                     # 测试文件
│   └── scanner.test.js      # 单元测试
├── package.json
└── README.md
```

## 许可证

MIT
