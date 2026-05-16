# 构建产物签名与审计流水管理工具

一个用于构建产物签名、离线会员续费流水管理、白名单复核、异常样本导出的命令行工具。

## 功能特性

- 🔐 **构建产物签名**: 支持文件和目录的SHA256校验和计算与签名验证
- 📊 **会员续费流水管理**: 完整的离线会员续费记录存储与查询
- ⚠️ **白名单复核机制**: 专门保留临时白名单未撤记录，方便审计复核
- 📋 **实验室样本管理**: 支持人工备注入库，按调用方追溯查询
- 📤 **异常样本导出**: 异常样本可导出给同事复核（支持CSV/XLSX/JSON格式）
- 🔍 **多维度查询过滤**: 支持按批次、操作者、风险类型等维度过滤
- 📝 **原始数据溯源**: 所有会员续费记录保留原始输入数据，可完整追溯
- 📑 **报告生成**: 自动生成Excel格式的会员续费报告

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 编译项目

```bash
npm run build
```

### 一键运行完整演示

```bash
npm run demo
```

### 全局安装（可选）

```bash
npm link
```

安装后可以直接使用 `audit-sign` 命令。

## 命令详解

### 1. 演示数据管理

#### 生成演示数据
```bash
audit-sign init-demo [--batch-id <批次号>]
```

生成贴近真实业务场景的演示数据，包含：
- 50-80条离线会员续费流水
- 8-13条白名单记录（**第一条始终为未撤销状态，方便复核**）
- 15-25条实验室样本记录
- 自动生成的异常样本记录

#### 完整演示流程
```bash
audit-sign demo
```

运行完整的演示流程，展示从数据生成到查询、导出的全流程。

### 2. 查询功能

#### 查询会员续费记录
```bash
audit-sign query-renewals [选项]

选项:
  --batch-id <batchId>    按批次号过滤
  --operator-id <operatorId>  按操作员ID过滤
  --risk-type <riskType>  按风险类型过滤
  --format <format>       输出格式 (table|json) (default: "table")
  --limit <number>        限制返回数量 (default: "50")
```

示例：
```bash
# 查看某批次的高风险记录
audit-sign query-renewals --batch-id BATCH-20240115-XXXXXX --risk-type "疑似套现"
```

#### 查询白名单记录
```bash
audit-sign query-whitelist [选项]

选项:
  --batch-id <batchId>    按批次号过滤
  --status <status>       按状态过滤 (active|revoked)
  --format <format>       输出格式 (table|json) (default: "table")
```

**重点**: 有效状态的白名单记录会在输出末尾专门标注，提示审核人员及时复核。

#### 查询实验室样本
```bash
audit-sign query-lab [选项]

选项:
  --batch-id <batchId>    按批次号过滤
  --status <status>       按状态过滤
  --format <format>       输出格式 (table|json) (default: "table")
```

实验室样本记录包含完整的**人工备注字段**，支持按调用方查询。

#### 查询异常样本
```bash
audit-sign query-abnormal [选项]

选项:
  --batch-id <batchId>    按批次号过滤
  --risk-type <riskType>  按风险类型过滤
  --status <status>       按状态过滤 (pending|reviewed|resolved)
  --format <format>       输出格式 (table|json) (default: "table")
```

### 3. 导出功能

#### 导出异常样本（给同事复核）
```bash
audit-sign export-abnormal --format <csv|xlsx|json> [选项]

选项:
  --batch-id <batchId>    按批次号过滤
  --risk-type <riskType>  按风险类型过滤
  --output <path>         输出路径
  --mark-exported         标记为已导出
  --include-raw           包含原始输入数据
```

示例：
```bash
# 导出Excel格式，标记为已导出
audit-sign export-abnormal --format xlsx --batch-id BATCH-001 --mark-exported

# 导出包含原始输入数据的完整信息
audit-sign export-abnormal --format xlsx --include-raw
```

#### 导出会员续费报告
```bash
audit-sign export-report <批次号> [--output <输出路径>]
```

生成包含以下内容的Excel报告：
- **会员续费明细工作表**: 所有字段详情
- **统计汇总工作表**: 总记录数、总金额、各风险等级统计、白名单数量

### 4. 签名功能

#### 对构建产物签名
```bash
audit-sign sign <产物路径> --signer <签名人> --version <版本号> \
  --build-number <构建号> --branch <分支名> --commit <提交哈希> [选项]

选项:
  --private-key <path>    私钥路径（可选，默认使用内置HMAC）
  --build-agent <name>    构建代理名 (default: "default-agent")
```

示例：
```bash
# 对构建目录签名
audit-sign sign ./dist --signer "张三" --version 1.0.0 \
  --build-number 2024011501 --branch main --commit abc123def456

# 对单个文件签名
audit-sign sign ./app-v1.0.0.tar.gz --signer "李四" --version 1.0.0 \
  --build-number 2024011502 --branch release --commit xyz789
```

#### 计算文件校验和
```bash
audit-sign checksum <文件路径> [--algorithm <sha256|md5>]
```

#### 生成RSA密钥对
```bash
audit-sign generate-keys [--output <输出目录>]
```

生成公私钥对用于签名验证：
- `private.pem`: 私钥（请妥善保管）
- `public.pem`: 公钥（可公开）

### 5. 数据溯源

#### 追溯原始输入
```bash
audit-sign trace-raw <会员ID>
```

查看该会员续费记录的**完整原始输入数据**，确保数据可追溯至导入时的原始状态。

## 样例数据说明

### 业务场景设计

本工具的样例数据贴近真实的会员运营部门场景，包含：

#### 1. 门店信息
- 北京朝阳门店
- 上海静安寺店
- 广州天河城店
- 深圳华强北店
- 杭州西湖店

#### 2. 会员套餐
- 月卡会员 (¥99)
- 季卡会员 (¥269)
- 年卡会员 (¥999)
- 家庭年卡 (¥1699)
- 企业年卡 (¥2999)
- 学生季卡 (¥199)

#### 3. 风险类型
- 正常交易
- 疑似套现
- 异常充值
- 退款异常
- 频繁交易
- 异地登录

#### 4. 操作员角色
- 张经理、李主管（管理角色）
- 王专员（操作角色）
- 赵审核（审核角色）
- 刘风控（风控角色）

### 白名单复核设计

专门的白名单复核机制：
- 每条白名单记录包含：创建人、原因、有效期、撤销状态、撤销人、撤销原因
- 演示数据中第一条白名单**故意不撤销**，用于测试复核流程
- 查询时自动高亮显示待复核记录

### 实验室样本人工备注

实验室样本支持详细的人工备注，例如：
- "样本清晰，信息完整，核验通过"
- "客户签名略有模糊，但不影响识别"
- "身份证件有效期已核实"
- "补充材料已收到，符合要求"
- "样本存在涂改痕迹，待进一步核实"

## 主业务流程

### 标准流程（成功路径）

```
1. 数据导入
   ↓
2. 风控检测 → 生成风险标记
   ↓
3. 白名单审核 → 特殊客户豁免
   ↓
4. 实验室核验 → 人工备注入库
   ↓
5. 异常样本导出 → 转同事复核
   ↓
6. 生成审计报告 → 归档
```

### 失败路径示例

#### 场景1：白名单未及时撤销
- **触发条件**: 白名单过期后系统未自动撤销
- **检测方式**: `audit-sign query-whitelist --status active`
- **处理流程**:
  1. 发现有效但已过期的白名单记录
  2. 导出异常样本给风控团队
  3. 人工复核确认原因
  4. 执行撤销操作并记录撤销原因

#### 场景2：高风险交易未处理
- **触发条件**: 高风险交易长时间处于pending状态
- **检测方式**: `audit-sign query-abnormal --status pending --risk-type "疑似套现"`
- **处理流程**:
  1. 查询未处理的高风险异常
  2. 追溯原始输入数据，确认交易背景
  3. 联系门店操作员核实情况
  4. 更新状态并记录处理备注

#### 场景3：实验室样本检测异常
- **触发条件**: 样本检测结果异常，人工备注标注"待进一步核实"
- **检测方式**: `audit-sign query-lab --status pending`
- **处理流程**:
  1. 查询待复核样本
  2. 查看人工备注详情
  3. 联系采样人员补充信息
  4. 二次核验后更新状态

## 数据库结构

数据存储在SQLite数据库文件 `audit-data.db` 中，包含以下表：

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| offline_member_renewals | 会员续费流水 | member_id, batch_id, risk_type, raw_input |
| whitelist_records | 白名单记录 | member_id, is_revoked, revoke_reason |
| lab_samples | 实验室样本 | sample_code, manual_notes, reviewer |
| abnormal_samples | 异常样本 | source_type, risk_level, export_status |
| build_artifacts | 构建产物签名 | checksum, signature, signer |

## 常见问题

### Q: 如何重置所有数据？
A: 删除 `audit-data.db` 文件，然后重新运行 `audit-sign init-demo` 即可。

### Q: 导出的Excel文件无法打开？
A: 确保使用支持xlsx格式的软件（Microsoft Excel、WPS、Google Sheets等）。

### Q: 签名功能如何在CI/CD中使用？
A: 可以在构建脚本中调用：
```bash
audit-sign sign ./build-output \
  --signer "CI System" \
  --version $VERSION \
  --build-number $BUILD_NUMBER \
  --branch $CI_COMMIT_BRANCH \
  --commit $CI_COMMIT_SHA
```

### Q: 如何自定义风险类型？
A: 编辑 `src/demo-data.ts` 中的 RISK_TYPES 数组，然后重新编译。

## 技术栈

- **TypeScript**: 类型安全的开发语言
- **SQLite**: 轻量级嵌入式数据库
- **Commander.js**: 命令行框架
- **SheetJS (xlsx)**: Excel文件生成
- **date-fns**: 日期时间处理
- **uuid**: 唯一ID生成

## 项目结构

```
.
├── src/
│   ├── cli.ts          # 命令行入口
│   ├── database.ts     # 数据库操作
│   ├── signature.ts    # 签名功能
│   ├── export.ts       # 导出功能
│   ├── demo-data.ts    # 演示数据生成
│   └── types.ts        # 类型定义
├── package.json
├── tsconfig.json
└── README.md
```

## 许可证

MIT
