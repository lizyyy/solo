# mTLS 证书轮换风险预检工具

一个 TypeScript CLI 工具，用于在服务证书轮换前进行 mTLS 风险预检。

## 功能特性

- **证书链验证**：检查证书链完整性，检测缺失的中间证书
- **SAN 匹配验证**：验证证书的 Subject Alternative Names 是否符合预期
- **算法强度检查**：检测弱签名算法（如 SHA1）和密钥长度
- **有效期检查**：检测过期证书、即将过期证书和未生效证书
- **信任根验证**：验证证书链是否终止于正确的信任根
- **服务名匹配**：检查证书 CN/SAN 是否匹配服务名称
- **轮换批次管理**：基于服务依赖关系生成轮换计划

## 安装

```bash
npm install
```

## 使用方法

### 生成示例证书

首先生成示例证书用于演示：

```bash
npm run dev -- scripts/generate-certs.ts
```

### 运行验证

使用示例数据运行验证：

```bash
npm run dev -- validate samples
```

### 命令行参数

```
Usage: mtls-risk-precheck validate [options] <directory>

验证证书配置并生成风险报告

Arguments:
  directory                          包含证书配置文件的目录路径

Options:
  -o, --output <output-dir>          输出目录 (默认: ./output)
  --expiration-warning-days <days>   过期警告天数 (默认: 30)
  --clock-skew-minutes <minutes>     时钟偏移容忍度 (分钟) (默认: 5)
  --allowed-algorithms <algorithms>  允许的签名算法 (逗号分隔) (默认: sha256,sha384,sha512)
  --verbose                          显示详细输出
  -h, --help                         display help for command
```

## 输入文件格式

### cert_inventory.csv

服务证书清单，定义每个服务使用的证书：

```csv
service_name,cert_file_path,key_file_path,rotation_batch,expected_sans
api-gateway,certs/api-gateway.pem,certs/api-gateway-key.pem,batch-1,api.example.com,gateway.example.com
user-service,certs/user-service.pem,certs/user-service-key.pem,batch-1,user.example.com
```

字段说明：
- `service_name`: 服务名称
- `cert_file_path`: 证书文件路径（相对于 CSV 文件）
- `key_file_path`: 私钥文件路径
- `rotation_batch`: 轮换批次标识
- `expected_sans`: 期望的 SAN（多个用逗号分隔）

### trust_bundles.yaml

信任包配置，定义信任根和中间证书：

```yaml
internal-ca:
  name: Internal CA Bundle
  root_certs:
    - certs/root-ca.pem
  intermediate_certs:
    - certs/intermediate-ca.pem
  services:
    - api-gateway
    - user-service
```

### service_graph.json

服务调用关系图，定义服务之间的依赖：

```json
{
  "services": [
    {
      "name": "api-gateway",
      "trust_bundle": "internal-ca",
      "endpoint": "https://api.example.com:443"
    }
  ],
  "relationships": [
    {
      "client": "api-gateway",
      "server": "user-service",
      "protocol": "http",
      "requires_mtls": true
    }
  ]
}
```

### certs/ 目录

存放所有 PEM 格式的证书文件，包括：
- 根证书
- 中间证书
- 服务证书

## 输出文件

### issues.csv

所有验证问题的详细列表：

```csv
id,service_name,type,severity,description,recommendation,metadata
```

### rotation_plan.md

轮换计划报告，包含：
- 执行摘要
- 按优先级排序的轮换计划
- 详细问题描述
- 服务依赖图

### trust_graph.html

交互式信任关系可视化图表：
- 服务、根证书、中间证书的关系图
- 可缩放、可过滤
- 鼠标悬停显示详细信息

## 验证规则

| 规则ID | 名称 | 严重级别 | 描述 |
|--------|------|----------|------|
| validity_period | 有效期检查 | Critical | 检查证书是否过期或未生效 |
| algorithm_strength | 算法强度 | High | 检查是否使用弱算法 |
| san_match | SAN 匹配 | High | 检查 SAN 是否符合预期 |
| chain_validation | 证书链验证 | Critical | 验证证书链完整性 |
| trust_root_match | 信任根匹配 | High | 验证是否链到正确的信任根 |
| key_usage | 密钥用法 | Medium | 检查密钥用法扩展 |
| service_name_match | 服务名匹配 | High | 检查 CN/SAN 是否匹配服务名 |

## 边界情况处理

### 缺失中间证书

工具会检测证书链中的断链，并报告缺失的中间证书信息。

### 服务名不匹配

检查证书 CN 和 SAN 是否与服务名称模式匹配，支持通配符证书。

### 时钟偏移

支持配置时钟偏移容忍度，避免因时钟同步问题导致的误报。

## 项目结构

```
src/
├── types.ts              # 类型定义
├── cli.ts                # CLI 入口
├── parsers/              # 解析器模块
│   ├── csv-parser.ts     # CSV 解析
│   ├── yaml-parser.ts    # YAML 解析
│   ├── json-parser.ts    # JSON 解析
│   └── pem-parser.ts     # PEM 证书解析
├── x509/                 # X.509 模块
│   └── certificate-chain.ts  # 证书链验证
├── rules/                # 规则引擎
│   └── rules-engine.ts   # 验证规则实现
└── reports/              # 报告生成
    └── report-generator.ts  # CSV/Markdown/HTML 报告

samples/                  # 示例数据
├── cert_inventory.csv
├── trust_bundles.yaml
├── service_graph.json
└── certs/                # 证书目录

scripts/
└── generate-certs.ts     # 示例证书生成脚本
```

## 开发

### 构建

```bash
npm run build
```

### 运行开发模式

```bash
npm run dev -- validate samples
```

## 依赖

- `commander`: 命令行参数解析
- `csv-parse` / `csv-stringify`: CSV 处理
- `js-yaml`: YAML 解析
- `node-forge`: X.509 证书处理
- `uuid`: 生成唯一 ID

## License

MIT
