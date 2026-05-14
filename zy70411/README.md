# 内部包版本准入服务

基于 Node.js + TypeScript 的内部包版本准入后端服务，支持规则版本化、异常检测、历史追踪等功能。

## 功能特性

- ✅ **手写仓库交接单样例** - 包含正常记录和时区偏移异常记录
- ✅ **规则版本化** - 规则变更后，旧批次仍能解释当时使用的判断口径
- ✅ **完整报告** - 包含处理前后对比、执行时间、下一步建议
- ✅ **异常样本留存** - 查询时可回溯到原始材料
- ✅ **多格式输出** - JSON、Markdown、下载接口，内容一致
- ✅ **边界情况测试** - 内置测试和自检脚本，覆盖各类边界情况
- ✅ **历史修改追踪** - 按资源范围查看会员续费流水等修改理由

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
npm run test
```

### 运行自检

```bash
npm run self-check
```

### 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

## API 接口

### 基础接口

- `GET /api/health` - 健康检查
- `GET /api/handover` - 获取所有交接单
- `GET /api/rules` - 获取所有规则

### 校验与报告

- `POST /api/validate` - 校验批次
  ```json
  { "batchId": "...", "ruleVersion": "1.0.0" }
  ```
- `GET /api/reports` - 获取所有报告
- `GET /api/reports/:id` - 获取报告详情
- `GET /api/reports/:id/markdown` - Markdown 格式报告
- `GET /api/reports/:id/download` - 下载报告（JSON）

### 异常样本

- `GET /api/anomalies` - 获取所有异常样本
- `GET /api/anomalies/:id` - 获取异常样本详情
- `GET /api/anomalies/:id/original` - 查看原始材料

### 历史记录

- `GET /api/history` - 获取所有历史记录
- `GET /api/history/scope/:scope` - 按资源范围获取历史记录

### 规则对比

- `POST /api/compare` - 对比不同规则版本
  ```json
  { "batchId": "...", "oldVersion": "1.0.0", "newVersion": "1.1.0" }
  ```
- `GET /api/compare/markdown` - Markdown 格式的规则对比报告

## 项目结构

```
.
├── src/
│   ├── types/          # 类型定义
│   ├── store/          # 数据存储
│   ├── engine/         # 规则引擎
│   ├── data/           # 样例数据生成
│   ├── report/         # 报告生成
│   ├── output/         # 输出格式化
│   ├── test.ts         # 测试脚本
│   ├── self-check.ts   # 自检脚本
│   ├── server.ts       # HTTP 服务
│   └── index.ts        # 入口
├── package.json
├── tsconfig.json
└── README.md
```

## 内置规则

### 版本 1.0.0

- 时区偏移检查 - 检查时区偏移是否在合法范围内
- 高风险版本前缀检查 - 拒绝以 alpha、beta、rc 开头的版本
- 内部包前缀检查 - 内部包必须以 @internal/ 开头

### 版本 1.1.0

- 时区偏移严格检查 - 必须为 -480（北京时间）
- 依赖数量检查 - 依赖超过 5 个需要审核

## 使用示例

### 1. 启动服务并生成首批校验报告

```bash
# 启动服务
npm run dev

# 在另一个终端，先获取交接单列表
curl http://localhost:3000/api/handover

# 然后用第一个批次 ID 进行校验
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"batchId": "第一个批次ID", "ruleVersion": "1.0.0"}'
```

### 2. 查看 Markdown 格式报告

```bash
# 先获取报告列表
curl http://localhost:3000/api/reports

# 查看 Markdown 报告
curl http://localhost:3000/api/reports/报告ID/markdown
```

### 3. 查看异常样本原始数据

```bash
# 获取异常列表
curl http://localhost:3000/api/anomalies

# 查看某个异常的原始材料
curl http://localhost:3000/api/anomalies/异常ID/original
```

### 4. 按资源范围查看历史修改记录

```bash
# 查看会员续费相关的修改记录
curl http://localhost:3000/api/history/scope/membership-renewal-2024-q1
```

### 5. 对比不同规则版本

```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{"batchId": "批次ID", "oldVersion": "1.0.0", "newVersion": "1.1.0"}'
```

## 测试覆盖

测试脚本覆盖以下场景：

- ✅ 正常时区的包
- ✅ Beta/Alpha 版本包
- ✅ 极端时区偏移包
- ✅ 空依赖列表
- ✅ 大量依赖包（20+）
- ✅ 规则版本化验证
- ✅ 历史记录追踪
- ✅ 异常样本留存
- ✅ 多格式输出一致性

## License

MIT
