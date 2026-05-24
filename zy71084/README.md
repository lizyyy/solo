# Xcode 证书体检 CLI

一个功能强大的命令行工具，用于在 iOS 打包前检查 Profile、证书和 Bundle ID 的一致性，避免打包时才发现问题。

## 功能特性

- ✅ **Profile 解析**: 解析 `.mobileprovision` 文件，提取关键信息
- 🔐 **证书校验**: 检查证书有效性、过期时间、类型和 Team 信息
- 🎯 **Bundle ID 匹配**: 智能匹配，支持通配符，优先精确匹配
- 📋 **多 Target 支持**: 支持配置文件管理多个 Target
- 🚨 **过期提醒**: 提前 N 天提醒即将过期的证书和 Profile
- 📊 **多格式报告**: 终端摘要、JSON（机器可读）、Markdown（给同事看）
- 📍 **问题定位**: 精确到原文件行号，方便快速定位
- 🚦 **稳定退出码**: CI/CD 友好的退出码

## 安装

```bash
npm install
npm run build
npm link  # 可选，全局安装
```

## 使用方法

### 基本命令

```bash
# 查看帮助
cert-check --help
cert-check check --help

# 执行检查
cert-check check \
  -p ./profiles \
  -c ./certificates \
  -f ./targets.yaml \
  -o ./reports
```

### 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --profile <paths...>` | MobileProvision 文件或目录路径 | - |
| `-c, --certificate <paths...>` | 证书文件或目录路径 | - |
| `-t, --target <bundleIds...>` | Target Bundle ID 列表 | - |
| `-f, --config <path>` | Target 配置文件（YAML/JSON） | - |
| `-o, --output <dir>` | 报告输出目录 | `./cert-check-reports` |
| `-w, --warn-days <days>` | 过期提醒天数 | `30` |
| `--strict` | 严格模式：警告也返回非零退出码 | - |
| `--no-terminal` | 不输出终端报告 | - |
| `--no-json` | 不生成 JSON 报告 | - |
| `--no-markdown` | 不生成 Markdown 报告 | - |
| `--cert-password <password>` | P12 证书密码 | - |

### 退出码

| 退出码 | 含义 |
|--------|------|
| `0` | 检查通过（或仅有警告，非严格模式） |
| `1` | 有警告（严格模式下） |
| `2` | 有错误 |
| `3` | 执行异常 |

## 配置文件格式

### YAML 格式 (`targets.yaml`)

```yaml
targets:
  - name: App Main
    bundleId: com.example.app
    profileName: Example App Profile
    certificateName: Apple Distribution: Example Team

  - name: App Dev
    bundleId: com.example.app.dev
    profileName: Example App Dev Profile

  - name: Share Extension
    bundleId: com.example.app.share
```

### JSON 格式 (`targets.json`)

```json
{
  "targets": [
    {
      "name": "App Main",
      "bundleId": "com.example.app",
      "profileName": "Example App Profile"
    }
  ]
}
```

## 使用示例

### 1. 检查单个 Bundle ID

```bash
cert-check check \
  -p ~/Library/MobileDevice/Provisioning\ Profiles \
  -t com.example.app
```

### 2. 使用配置文件检查多个 Target

```bash
cert-check check \
  -p ./profiles \
  -c ./certs \
  -f ./targets.yaml \
  -w 15 \
  --strict
```

### 3. 只生成 JSON 报告（用于 CI）

```bash
cert-check check \
  -p ./profiles \
  -c ./certs \
  -f ./targets.yaml \
  --no-terminal \
  --no-markdown \
  -o ./ci-reports
```

### 4. 解析单个 Profile 文件

```bash
cert-check parse-profile ./myapp.mobileprovision
```

### 5. 解析单个证书文件

```bash
cert-check parse-cert ./dist.cer
cert-check parse-cert ./dist.p12 -p password123
```

## 检查项说明

### Profile 检查
- ✅ 过期时间检查
- ✅ Bundle ID 有效性（通配符警告）
- ✅ Team ID 完整性
- ✅ 内嵌证书数量

### 证书检查
- ✅ 过期时间检查
- ✅ 有效期验证
- ✅ 证书类型识别（开发/发布）
- ✅ Team 信息完整性

### Target 检查
- ✅ Bundle ID 格式验证
- ✅ Profile 匹配（精确 > 通配符）
- ✅ 证书匹配（Team ID > Team Name）
- ✅ Profile 与证书 Team 一致性
- ✅ 指定 Profile 名称校验

## 常见问题处理

### 通配符误匹配

**问题**: Target 使用了通配符 Profile，可能导致权限问题。

**解决**:
1. 为该 Bundle ID 创建专用 Profile
2. 或确认通配符 Profile 包含所有必要的 entitlements

### 多 Target 混用 Profile

**问题**: 多个 Target 共享同一个 Profile。

**影响**:
- 难以单独管理权限
- Profile 撤销影响所有 Target

**建议**: 为每个 Target 创建独立的 Profile

### 证书即将过期

**行动**:
1. 在 Apple Developer 网站生成新证书
2. 更新所有相关 Profile
3. 重新下载并安装

## 项目结构

```
src/
├── types.ts              # 类型定义
├── provisionParser.ts    # Profile 解析器
├── certificateValidator.ts  # 证书校验器
├── bundleMatcher.ts      # Bundle ID 匹配器
├── configParser.ts       # 配置文件解析器
├── checkEngine.ts        # 核心检查引擎
├── reportGenerator.ts    # 报告生成器
└── cli.ts                # 命令行入口
```

## 在 CI/CD 中使用

```yaml
# GitHub Actions 示例
- name: 证书体检
  run: |
    cert-check check \
      -p ${{ secrets.PROFILES_DIR }} \
      -c ${{ secrets.CERTS_DIR }} \
      -f targets.yaml \
      --strict
```

## License

MIT
