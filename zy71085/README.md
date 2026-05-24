# Android 权限差异 CLI (apkd)

一个用于安全评审的 Android APK 权限差异分析命令行工具。对比不同版本应用的权限变化，追踪权限来源，评估安全风险。

## ✨ 功能特性

- 🔍 **多格式输入**: 支持 APK 文件、AndroidManifest.xml、JSON 解析结果
- 📊 **权限对比**: 新增/移除/变更权限的精确对比
- 🎯 **来源归因**: 追踪权限来自哪个业务模块
- 📦 **库注入检测**: 识别第三方库注入的权限
- ⚠️ **风险分级**: 五级风险评估体系
- 👥 **权限组分析**: 按权限组分类展示变更
- 🔄 **uses-feature 映射**: 特性与权限关联分析
- 🕵️ **混淆检测**: 识别可能被混淆的权限名称
- 📝 **多格式输出**: 终端摘要、JSON、Markdown 报告

## 📦 安装

```bash
# 克隆项目后安装依赖
npm install

# 全局链接命令
npm link

# 或者直接使用
node bin/apkd.js --help
```

**环境要求**: Node.js >= 16.0.0

## 🚀 快速开始

### 基本用法 - 对比两个 Manifest

```bash
# 对比两个 Manifest 文件
apkd compare \
  --old examples/old/AndroidManifest.xml \
  --new examples/new/AndroidManifest.xml \
  --output ./output
```

### 带模块溯源的对比

```bash
# 对比并追踪权限来源模块
apkd compare \
  --old examples/old/AndroidManifest.xml \
  --new examples/new/AndroidManifest.xml \
  --modules examples/modules \
  --output ./output
```

### 只输出指定格式

```bash
# 只生成 JSON 和 Markdown，不显示终端输出
apkd compare \
  --old old.apk \
  --new new.apk \
  --modules ./modules \
  --format all \
  --no-terminal \
  --output ./report
```

### 解析单个文件

```bash
# 解析 APK 并显示权限信息
apkd parse app.apk

# 解析 Manifest 并保存结果
apkd parse AndroidManifest.xml --output ./output
```

### 查看支持的权限和风险等级

```bash
# 查看所有信息
apkd list

# 只看风险等级
apkd list --risk

# 只看权限组
apkd list --groups
```

## 📁 目录结构

### 输入目录结构示例

```
your-project/
├── apks/
│   ├── app-v1.0.apk
│   └── app-v1.1.apk
├── manifests/
│   ├── old/
│   │   └── AndroidManifest.xml
│   └── new/
│       └── AndroidManifest.xml
└── modules/              # 可选，用于权限来源追踪
    ├── feature-auth-manifest.xml
    ├── feature-camera-manifest.xml
    ├── feature-map-manifest.xml
    └── library-thirdparty-manifest.xml
```

### 输出目录结构

```
output/
├── permission-diff.json      # 机器可读的完整数据
└── permission-diff.md        # 给同事看的 Markdown 报告
```

## 🎮 命令详解

### compare 命令

| 参数 | 必需 | 说明 |
|------|------|------|
| `--old <path>` | ✅ | 旧版本 APK / Manifest / JSON 路径 |
| `--new <path>` | ✅ | 新版本 APK / Manifest / JSON 路径 |
| `-m, --modules <dir>` | - | 模块清单目录，用于权限来源归因 |
| `-o, --output <dir>` | - | 输出目录，默认 `./output` |
| `-f, --format <format>` | - | 输出格式: `terminal|json|markdown|all`，默认 `all` |
| `--verbose` | - | 显示详细信息 |
| `--show-all` | - | 显示所有权限（包括未变更的） |
| `--no-terminal` | - | 不输出终端摘要 |

### parse 命令

| 参数 | 必需 | 说明 |
|------|------|------|
| `<file>` | ✅ | APK 或 Manifest 文件路径 |
| `-o, --output <dir>` | - | 输出目录，保存解析结果 |

### list 命令

| 参数 | 说明 |
|------|------|
| `--risk` | 只显示风险等级说明 |
| `--groups` | 只显示权限组列表 |

## 📊 退出码说明

| 退出码 | 名称 | 说明 |
|--------|------|------|
| 0 | SUCCESS | 成功，无权限变更 |
| 1 | ERROR_INVALID_INPUT | 参数错误 |
| 2 | ERROR_FILE_NOT_FOUND | 文件不存在 |
| 3 | ERROR_PARSE_FAILED | 解析失败 |
| 4 | ERROR_COMPARE_FAILED | 对比失败 |
| 5 | ERROR_OUTPUT_FAILED | 输出失败 |
| 10 | WARNING_PERMISSIONS_CHANGED | 存在权限变更（无高风险） |
| 11 | WARNING_HIGH_RISK_ADDED | 新增高风险权限 |

**在 CI/CD 中使用**:

```bash
apkd compare --old old.apk --new new.apk

if [ $? -eq 11 ]; then
  echo "⚠️  新增高风险权限，需要人工审核!"
  exit 1
fi
```

## ⚠️ 风险等级

| 等级 | 颜色 | 说明 | 示例权限 |
|------|------|------|----------|
| 🔴 严重 | red | 涉及隐私或安全的高危权限 | SMS、相机、麦克风、精确位置 |
| 🟣 高 | magenta | 敏感权限，需要用户授权 | 读取手机状态、存储 |
| 🟡 中 | yellow | 普通权限，存在一定风险 | 日历、大致位置 |
| 🔵 低 | blue | 正常权限，基本无安全风险 | 网络、震动、蓝牙 |
| ⚪ 未知 | gray | 未知权限，需要人工评估 | 自定义权限 |

## 🤔 坏数据处理

### 常见问题及解决方案

#### 1. APK 解析失败

**问题**: 提示 "APK 文件中未找到 AndroidManifest.xml"

**原因**:
- APK 文件损坏
- APK 是 AAB 格式
- APK 经过加固，Manifest 被加密

**解决方案**:
```bash
# 1. 尝试先解压 APK 提取 Manifest
unzip app.apk AndroidManifest.xml

# 2. 直接使用解压后的 Manifest
apkd compare --old old/AndroidManifest.xml --new new/AndroidManifest.xml

# 3. 如果是加固 APK，使用反编译工具先处理
apktool d app.apk -o decoded/
apkd compare --old decoded/AndroidManifest.xml ...
```

#### 2. 模块清单解析失败

**问题**: 模块清单无权限信息

**原因**:
- 文件名不匹配（工具只识别含 "manifest" 的 XML 文件）
- XML 格式错误

**解决方案**:
```bash
# 正确的文件命名
modules/
├── feature-login-manifest.xml    # ✅ 包含 "manifest"
├── payment_manifest.xml          # ✅
└── base.xml                      # ❌ 不会被识别
```

#### 3. 权限来源未知

**问题**: 新增权限显示"未知来源"

**可能原因**:
- 第三方库通过 manifest merger 注入
- 动态添加的权限
- 缺少对应的模块清单

**解决方案**:
```bash
# 检查 APK 中的所有 manifest 合并结果
# 或在构建时保存 manifest-merger-report.txt

# 将第三方库的权限单独整理到一个模块清单
# modules/library-thirdparty-manifest.xml
```

#### 4. 权限名称混淆

**问题**: 检测到可能混淆的权限名称

**解决方案**:
- 人工核查这些权限
- 如果是自定义权限，更新风险映射表
- 在 `src/config/constants.js` 的 `PERMISSION_RISK_MAP` 中添加

#### 5. uses-feature 相关权限未关联

**问题**: 新增了 `<uses-feature>` 但没有显示关联权限

**解决方案**:
- 检查 `FEATURE_PERMISSION_MAP` 映射表
- 提交 PR 更新特性与权限的映射

## 🔧 自定义配置

### 添加自定义权限风险等级

编辑 `src/config/constants.js`:

```javascript
const PERMISSION_RISK_MAP = {
  // ... 现有配置
  'com.example.custom.permission': 'MEDIUM',
  'com.example.very.sensitive': 'CRITICAL'
}
```

### 添加 uses-feature 映射

```javascript
const FEATURE_PERMISSION_MAP = {
  // ... 现有配置
  'android.hardware.nfc.hce': ['android.permission.NFC']
}
```

## 📝 报告示例

### Markdown 报告包含

1. **应用信息**: 新旧版本对比
2. **变更摘要**: 新增/移除/变更统计
3. **风险评估**: 各风险等级统计
4. **新增权限详情**: 按风险排序，含来源和置信度
5. **移除权限详情**
6. **变更权限详情**
7. **特性变更**: uses-feature 变更
8. **权限组变更**: 按组统计
9. **来源分析**: 库注入权限检测
10. **混淆检测**: 可能混淆的权限
11. **安全建议**: 分级建议

### JSON 报告字段

```json
{
  "metadata": { ... },
  "versions": { "old": { ... }, "new": { ... } },
  "permissions": {
    "summary": { ... },
    "added": [ ... ],
    "removed": [ ... ],
    "changed": [ ... ],
    "unchanged": [ ... ]
  },
  "features": { ... },
  "groups": [ ... ],
  "risk": { ... },
  "sources": { ... },
  "obfuscated": { ... },
  "exitCode": 0
}
```

## 🧪 运行测试

```bash
# 运行示例对比
npm run example:manifest

# 查看帮助
apkd --help

# 调试模式
DEBUG=1 apkd compare ...
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 PR！
