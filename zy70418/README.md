# 文件入库校验后端服务

## 功能概述

基于 Express + TypeScript + SQLite 构建的文件入库校验服务，专为图片审核场景设计。

## 核心特性

### 1. 空值校验
- 检测 supplier_code, supplier_name, department, file_name 等字段的空值
- 空值被错误地当作有效数据处理时会被标记为失败
- 按空值数量分级标记风险等级（medium/high）

### 2. 供应商目录校验
- 内置标准供应商目录（北京图像、上海视觉、深圳高峰图片社等）
- 验证供应商代码是否在目录中
- 校验供应商名称与代码是否匹配
- 检查供应商状态是否为活跃

### 3. 文件完整性校验
- 验证文件格式（仅允许图片格式）
- 检查文件大小（0字节文件视为损坏）

### 4. 失败项管理
- 所有校验失败项单独保存
- 记录失败原因、风险等级、文件信息
- 支持按批次、风险等级筛选
- 支持标记已解决状态

### 5. 多格式输出
- JSON 格式：结构化数据，便于系统集成
- Markdown 格式：人类可读的报告
- Download 格式：文件下载

### 6. 清理/回滚机制
- 生成回滚候选清单
- 需要审批人确认
- 避免误伤真实数据

### 7. 人工修正
- 记录修正前后值
- 保存修正原因、修正人、时间
- 不直接覆盖系统原始判断
- 保留完整审计轨迹

### 8. 风险等级查询
- 支持按 low/medium/high/critical 等级回查
- 统计各等级失败项、修正项数量

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── database/
│   │   ├── db.ts             # 数据库操作
│   │   └── schema.ts         # 表结构定义
│   ├── services/
│   │   ├── validation.service.ts   # 校验核心逻辑
│   │   └── output.service.ts       # 输出/报告服务
│   └── routes/
│       └── validation.routes.ts    # API 路由
├── examples/
│   └── sample-usage.ts       # 使用示例
├── uploads/                  # 上传文件目录
├── package.json
├── tsconfig.json
└── file_validation.db        # SQLite 数据库（自动生成）
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
npm run dev
```
服务将在 http://localhost:3000 启动

### 3. 运行演示
在新终端窗口中运行：
```bash
npm run demo
```
演示脚本将模拟完整的校验流程。

## API 接口

### 批次管理
- `POST /api/validation/batches` - 创建校验批次
- `GET /api/validation/batches` - 获取所有批次
- `GET /api/validation/batches/:batchId` - 获取批次详情

### 文件上传与校验
- `POST /api/validation/upload` - 单文件上传并校验
- `POST /api/validation/batch-upload` - 批量上传（最多50个文件）

### 失败项管理
- `GET /api/validation/failed-items` - 获取失败项列表（支持按批次/风险等级筛选）
- `PUT /api/validation/failed-items/:id/resolve` - 标记失败项已解决

### 人工修正
- `POST /api/validation/correct` - 提交字段修正
- `GET /api/validation/corrections` - 获取修正记录

### 回滚/清理
- `POST /api/validation/rollback-candidates` - 生成回滚候选清单
- `GET /api/validation/rollback-candidates` - 获取回滚候选列表

### 报告导出
- `GET /api/validation/export/:batchId` - 导出校验报告
  - `?format=json` - JSON格式
  - `?format=markdown` - Markdown格式
  - `?format=download` - 文件下载

### 风险等级查询
- `GET /api/validation/risk-level/:batchId/:riskLevel` - 按风险等级查询

## 样例数据说明

内置供应商目录（贴近真实场景）：
- SUP001 - 北京图像科技有限公司 - 市场部
- SUP002 - 上海视觉传媒有限公司 - 市场部
- SUP003 - 广州创意设计工作室 - 设计部
- SUP004 - 深圳高峰图片社 - 审核部
- SUP005 - 杭州影像制作中心 - 生产部
- SUP006 - 成都摄影艺术公司 - 市场部
- SUP007 - 武汉数码冲印中心 - 生产部
- SUP008 - 南京图片处理工作室 - 审核部

## 核心设计原则

1. **失败路径透明化**：空值被当作成功处理时会被明确标记，原因可追溯
2. **失败项单独保存**：方便接手人直接看到问题，无需重新校验
3. **多格式输出一致性**：JSON、Markdown、下载接口内容一致
4. **安全清理机制**：清理/回滚需先生成候选清单，经审批后执行
5. **人工修正可追溯**：所有修正都有备注，不直接覆盖系统判断
6. **真实场景样例**：使用贴近真实业务的文件名称和供应商信息
7. **供应商目录对比**：导出结果保留修正前后值，支持按风险等级回查

## 健康检查

```bash
curl http://localhost:3000/health
```
