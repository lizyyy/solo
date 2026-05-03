# 素材授权交付核对器 (Material Authorization Checker)

一个给纪录片剪辑助理用的本地 CLI 工具，用于在交片前核对素材清单、授权合同、时间线 EDL 和交付文件夹，避免人工核对时容易漏掉的授权过期、片段超时长、缺源文件或命名不合规等问题。

## 功能特性

- 📁 **智能扫描**: 自动识别目录中的素材清单 (CSV)、授权合同 (JSON)、时间线 (EDL) 和媒体文件
- 🔍 **多维度核对**:
  - ✅ 授权有效期检查
  - ⏱️ 时长限制检查
  - 📄 源文件存在性检查
  - 🏷️ 命名规范检查
- ⚠️ **风险等级**: 按严重程度分为 CRITICAL（严重）、HIGH（高）、MEDIUM（中）、LOW（低）、OK（正常）
- 📊 **报告导出**: 支持导出 Markdown 制片报告和 JSON 机器可读结果
- 🛡️ **坏数据隔离**: 解析错误不会中断流程，会被隔离并记录

## 项目结构

```
xy4277/
├── src/
│   ├── index.js      # CLI 入口
│   ├── scanner.js    # 目录扫描模块
│   ├── parser.js     # 文件解析模块 (CSV/JSON/EDL)
│   ├── rules.js      # 规则引擎模块
│   └── reporter.js   # 报告生成模块
├── test/
│   └── test.js       # 单元测试
├── examples/
│   ├── valid/        # 有效示例数据
│   │   ├── 素材清单.csv
│   │   ├── 授权合同.json
│   │   ├── 时间线.edl
│   │   └── delivery/ # 媒体文件目录
│   └── invalid/      # 异常样例数据
│       ├── 素材清单_有问题.csv
│       ├── 授权合同_有问题.json
│       ├── 时间线_有问题.edl
│       └── delivery/
├── package.json
└── README.md
```

## 安装

### 环境要求

- Node.js >= 16.0.0

### 安装依赖

```bash
npm install
```

### 全局安装（可选）

```bash
npm install -g .
```

安装后可以直接使用 `material-check` 命令。

## 使用方法

### 命令概览

```bash
material-check <command> [options]

命令:
  scan <directory>        扫描目录并识别相关文件
  check <directory>       执行完整的素材授权核对流程
  examples                显示示例数据说明
  help [command]          显示命令帮助

选项:
  -v, --version           输出版本号
  -h, --help              显示帮助信息
```

### 1. 扫描目录

扫描目录查看有哪些相关文件：

```bash
material-check scan ./examples/valid
```

使用 `-v` 查看媒体文件详细列表：

```bash
material-check scan ./examples/valid -v
```

### 2. 执行完整核对

```bash
material-check check ./examples/valid -p "我的纪录片项目"
```

#### 常用选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-p, --project <name>` | 项目名称 | "未命名项目" |
| `-o, --output <path>` | 输出目录 | "./output" |
| `--csv <path>` | 指定素材清单CSV | 自动识别 |
| `--json <path>` | 指定授权合同JSON | 自动识别 |
| `--edl <path>` | 指定时间线EDL | 自动识别 |
| `--media <path>` | 指定媒体文件目录 | 主目录 |
| `--warning-days <days>` | 授权到期警告天数 | 30 |
| `--allow-missing-auth` | 允许缺少授权（降为警告） | false |
| `--no-strict-duration` | 禁用严格时长检查 | false |
| `--no-markdown` | 不生成Markdown报告 | false |
| `--no-json` | 不生成JSON报告 | false |
| `-v, --verbose` | 显示详细信息 | false |

#### 完整示例

```bash
material-check check ./project \
  -p "城市记忆纪录片" \
  -o ./reports \
  --csv ./custom/materials.csv \
  --json ./contracts/licenses.json \
  --edl ./timeline/final.edl \
  --media ./delivery \
  --warning-days 60 \
  -v
```

### 3. 查看示例说明

```bash
material-check examples
```

## 输入文件格式

### 素材清单 (CSV)

| 列名 | 说明 | 示例 |
|------|------|------|
| 素材ID / ID / MaterialID | 素材唯一标识 | DOC_2024_01 |
| 素材名称 / 文件名 / Name | 素材名称 | 张教授采访片段 |
| 类型 / Type | 素材类型 | 视频/音频/图片 |
| 时长 / Duration | 总时长 | 00:05:30:00 |
| 帧率 / FPS | 帧率 | 25 |
| 分辨率 / Resolution | 分辨率 | 1920x1080 |
| 格式 / Format | 文件格式 | ProRes 422 |
| 来源 / Source | 素材来源 | 北京电影学院 |
| 备注 / Notes | 备注信息 | 主要采访素材 |

**示例**:
```csv
素材ID,素材名称,类型,时长,帧率,分辨率,格式,来源,备注
DOC_2024_01,张教授采访片段,视频,00:05:30:00,25,1920x1080,ProRes 422,北京电影学院,主要采访素材
DOC_2024_02,城市空镜A组,视频,00:03:15:00,25,3840x2160,ProRes 422 HQ,独立摄影师,夜景素材
```

### 授权合同摘要 (JSON)

支持两种格式：数组形式或包含 `contracts` / `authorizations` / `licenses` 字段的对象。

| 字段 | 说明 | 示例 |
|------|------|------|
| materialId / id | 关联素材ID | DOC_2024_01 |
| title | 合同标题 | 张教授采访授权 |
| type | 授权类型 | 人物采访授权 |
| startDate | 生效日期 | 2024-01-15 |
| endDate | 到期日期 | 2026-12-31 |
| maxDuration | 最大允许时长 | 00:10:00:00 |
| usage | 使用范围 | 纪录片《城市记忆》全球发行 |
| territory | 发行地区 | 全球 |
| notes | 备注 | 已签署书面授权书 |

**示例**:
```json
{
  "contracts": [
    {
      "materialId": "DOC_2024_01",
      "title": "张教授采访授权",
      "type": "人物采访授权",
      "startDate": "2024-01-15",
      "endDate": "2026-12-31",
      "maxDuration": "00:10:00:00",
      "usage": "纪录片《城市记忆》全球发行",
      "territory": "全球",
      "notes": "已签署书面授权书"
    }
  ]
}
```

### 时间线 (EDL)

标准 CMX 3600 EDL 格式。工具会解析：
- 事件ID
- Reel 名称（用于匹配素材ID）
- 源入/出点
- 录制入/出点
- FROM CLIP NAME 注释
- SOURCE FILE 注释

**示例**:
```edl
TITLE: 纪录片《城市记忆》粗剪_V03
FCM: NON-DROP FRAME

001  DOC_2024_01 V     C        00:00:30:00 00:01:00:00 00:00:00:00 00:00:30:00
* FROM CLIP NAME: DOC_2024_01_张教授采访片段
* SOURCE FILE: DOC_2024_01_张教授采访片段.mov

002  DOC_2024_02 V     C        00:00:10:00 00:00:45:00 00:00:30:00 00:01:05:00
* FROM CLIP NAME: DOC_2024_02_城市空镜A组
```

### 媒体文件命名规范

默认命名规范（可自定义）：`^[A-Z]{2,3}_\d{4}_\d{2}_\w+$`

示例：
- ✅ `DOC_2024_01_张教授采访片段.mp4`
- ✅ `DOC_2024_02_城市空镜A组.mov`
- ❌ `bad_name_123.mp4`
- ❌ `随机命名文件.avi`

## 检查规则

| 规则代码 | 风险等级 | 说明 |
|----------|----------|------|
| AUTH_EXPIRED | CRITICAL | 授权已过期 |
| MISSING_AUTH | CRITICAL | 素材在时间线中使用但无授权 |
| MISSING_SOURCE | CRITICAL | 素材在时间线中使用但缺源文件 |
| DURATION_EXCEEDED | HIGH | 使用时长超过授权限制 |
| AUTH_EXPIRING_SOON | MEDIUM | 授权即将到期（可配置天数） |
| NAMING_VIOLATION | MEDIUM | 文件名不符合规范 |
| MISSING_IN_MANIFEST | MEDIUM | 素材在时间线中使用但未在清单列出 |
| UNUSED_MATERIAL | LOW | 有授权但未在时间线中使用 |
| DATE_FORMAT_INVALID | LOW | 日期格式无法解析 |
| NO_CONTRACT_LIMIT | LOW | 合同时长限制无法解析 |

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，无高风险问题 |
| 1 | 执行错误 |
| 2 | 发现 CRITICAL 或 HIGH 级别风险 |

## 运行测试

```bash
npm test
```

## 输出示例

### Markdown 报告

```markdown
# 我的纪录片项目 - 素材授权交付核对报告

> 生成时间: 2024-05-03 14:30:00
> 生成工具: 素材授权交付核对器 v1.0.0

## 📊 执行摘要

| 指标 | 数值 |
|------|------|
| **最高风险等级** | 🔴 CRITICAL |
| **素材总数** | 5 |
| **合同总数** | 5 |
| **时间线事件数** | 5 |
| **媒体文件数** | 3 |
| **违规问题数** | 🔴 2 |
| **警告数** | 🟡 1 |

## 🔴 违规问题 (Violations)

### 🔴 CRITICAL (1项)
- **[DOC_2024_05]** 素材 DOC_2024_05 的授权已于 2024-05-31 过期
  - 规则: 授权已过期 (AUTH_EXPIRED)
```

### JSON 报告

```json
{
  "meta": {
    "projectName": "我的纪录片项目",
    "generatedAt": "2024-05-03T14:30:00.000Z",
    "generatedBy": "material-check CLI",
    "toolVersion": "1.0.0"
  },
  "summary": {
    "totalMaterials": 5,
    "totalContracts": 5,
    "totalEDLEvents": 5,
    "totalMediaFiles": 3,
    "violations": 2,
    "warnings": 1,
    "highestRisk": "CRITICAL",
    "highestRiskLabel": "严重"
  },
  "materials": [
    {
      "materialId": "DOC_2024_01",
      "riskLevel": "OK",
      "riskLabel": "正常",
      "violations": [],
      "warnings": [],
      "material": { ... },
      "contracts": [ ... ],
      "edlEvents": [ ... ],
      "mediaFiles": [ ... ]
    }
  ],
  "violations": [ ... ],
  "warnings": [ ... ],
  "gaps": [ ... ],
  "sources": { ... }
}
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

**注意**: 此工具用于辅助核对，最终交付责任仍由人工确认。
