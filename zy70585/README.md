# 反向代理头检查 CLI 工具

检查多层代理环境下 X-Forwarded-* 头的正确性，识别脏输入并保留原始位置。

## 功能特性

- ✅ 解析并验证 X-Forwarded-For、X-Forwarded-Proto 等代理头
- ✅ 基于信任层级计算真实 IP 和协议
- ✅ 检测异常头（格式错误、IP/协议不匹配、可疑字符）
- ✅ 保留脏行的原始位置和错误原因
- ✅ 三种输出格式：终端摘要、JSON 机器可读报告、HTML 友好报告
- ✅ 正常样本原样输出，方便管道传递

## 安装

```bash
npm install
npm run build
npm link
```

## 使用方法

### 基本用法

```bash
# 从文件读取
proxy-header-check examples/normal-input.txt

# 从 stdin 读取
cat examples/normal-input.txt | proxy-header-check
```

### 指定配置文件

```bash
proxy-header-check examples/dirty-input.txt -c examples/config.json
```

### 生成多种报告

```bash
proxy-header-check examples/dirty-input.txt \
  -c examples/config.json \
  -j report.json \
  -h report.html
```

### 仅输出 JSON 报告

```bash
proxy-header-check examples/dirty-input.txt \
  -c examples/config.json \
  -j report.json \
  --no-terminal
```

## 退出码

- `0`: 所有样本正常
- `1`: 存在异常样本或脏数据

## 输入格式

每行一个 JSON 对象，包含以下字段：

```json
{
  "headers": {
    "X-Forwarded-For": "client-ip, proxy1-ip, proxy2-ip",
    "X-Forwarded-Proto": "https, http, http"
  },
  "expectedIp": "client-ip",
  "expectedProtocol": "https"
}
```

## 配置文件

```json
{
  "trustedProxies": ["127.0.0.1", "192.168.1.1"],
  "trustDepth": 2,
  "trustedHeaders": ["X-Forwarded-For", "X-Forwarded-Proto"]
}
```

## 异常类型

| 类型 | 严重程度 | 说明 |
|------|----------|------|
| `invalid_format` | high/medium | IP、协议或端口格式错误 |
| `ip_mismatch` | high | 计算出的真实 IP 与期望值不匹配 |
| `protocol_mismatch` | high | 计算出的真实协议与期望值不匹配 |
| `suspicious_header` | medium/high | 包含可疑字符（如 XSS 代码） |

## 示例

### 正常输入

```bash
$ proxy-header-check examples/normal-input.txt -c examples/config.json
# 退出码: 0
```

### 脏数据输入

```bash
$ proxy-header-check examples/dirty-input.txt -c examples/config.json
# 输出异常详情，保留坏行位置
# 退出码: 1
```

## 项目结构

```
.
├── src/
│   ├── cli.ts          # CLI 入口
│   ├── types.ts        # 类型定义
│   ├── config.ts       # 配置解析
│   ├── headerParser.ts # Header 链解析
│   ├── checker.ts      # 检查逻辑
│   └── reporter.ts     # 报告生成
├── examples/
│   ├── config.json     # 配置示例
│   ├── normal-input.txt # 正常输入样本
│   └── dirty-input.txt  # 脏数据输入样本
└── package.json
```
