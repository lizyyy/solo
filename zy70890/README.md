# 司法社工对账服务

一个用于司法社工日常考勤对账的后端服务，自动比对签到、请假和定位数据，支持人工复核和报告导出。

## 功能特性

- **数据导入**: 支持CSV签到数据、JSON请假数据、定位轨迹数据导入
- **自动比对**: 自动检测超时未签、请假覆盖、轨迹缺口、定位异常等差异
- **差异溯源**: 每条差异记录来源和证据信息
- **人员等级**: 支持A/B/C三级人员分类统计
- **人工复核**: 支持批量复核，放行/驳回/要求补材料
- **人工修正**: 支持对自动比对结果进行人工修正并记录原因
- **重新计算**: 复核改动后重新计算汇总数据
- **报告导出**: 支持Excel多工作表和CSV格式导出

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- ExcelJS (Excel导出)
- json2csv (CSV导出)
- csv-parser (CSV解析)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 3. 快速体验

```bash
# 1. 导入样例数据
curl -X POST http://localhost:3000/api/reconciliation/import/sample-data

# 2. 执行对账
curl -X POST http://localhost:3000/api/reconciliation/reconcile

# 3. 查看对账结果汇总
curl http://localhost:3000/api/reconciliation/records/RC2024011500001/summary

# 4. 查看所有差异记录
curl http://localhost:3000/api/reconciliation/records/RC2024011500001/with-differences

# 5. 导出Excel报告
curl -o reconciliation-report.xlsx http://localhost:3000/api/reconciliation/export/excel/RC2024011500001
```

## API 接口

### 健康检查
```
GET /health
```

### 数据导入
```
POST /api/reconciliation/import/sample-data
```

### 对账管理
```
POST /api/reconciliation/reconcile                    # 执行对账
GET  /api/reconciliation/records/:reconciliationId   # 获取对账记录
GET  /api/reconciliation/records/:reconciliationId/summary  # 获取汇总
GET  /api/reconciliation/records/:reconciliationId/with-differences  # 获取差异记录
GET  /api/reconciliation/reconciliation-ids           # 获取所有对账编号
POST /api/reconciliation/recalculate/:reconciliationId  # 重新计算
```

### 复核管理
```
POST /api/reconciliation/review   # 批量复核
```

请求体示例:
```json
{
  "reconciliationId": "RC2024011500001",
  "recordIds": ["record-id-1", "record-id-2"],
  "status": "approved",
  "comment": "复核通过，情况属实",
  "operatorId": "admin001",
  "operatorName": "管理员"
}
```

### 人工修正
```
POST /api/reconciliation/correct
```

请求体示例:
```json
{
  "reconciliationId": "RC2024011500001",
  "recordId": "record-id",
  "newStatus": "normal",
  "reason": "系统设备故障导致签到延迟，实际正常出勤",
  "operatorId": "admin001",
  "operatorName": "管理员"
}
```

### 报告导出
```
GET /api/reconciliation/export/excel/:reconciliationId  # 导出Excel
GET /api/reconciliation/export/csv/:reconciliationId    # 导出CSV
```

## 样例数据说明

样例数据包含5名社区矫正对象：

| ID | 姓名 | 等级 | 情况说明 |
|----|------|------|----------|
| P001 | 张三 | A级 | 正常签到，定位正常 |
| P002 | 李四 | A级 | 签到超时，定位异常 |
| P003 | 王五 | B级 | 全天未签到，无定位 |
| P004 | 赵六 | B级 | 半天签到，有请假记录，定位正常 |
| P005 | 钱七 | C级 | 正常签到，定位轨迹不完整 |

## 差异类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| timeout_no_sign | 超时未签/未签退 | 高/中 |
| leave_overlap | 请假覆盖 | 低 |
| trace_gap | 轨迹缺口/不完整 | 高/中 |
| location_anomaly | 定位异常 | 中 |
| manual_correction | 人工修正 | 低 |

## 复核状态

- pending: 待复核
- approved: 已通过
- rejected: 已驳回
- need_supplement: 需补材料

## 项目结构

```
├── src/
│   ├── types/           # 类型定义
│   ├── store/           # 数据存储
│   ├── services/        # 业务服务
│   ├── routes/          # API路由
│   └── server.ts        # 服务入口
├── exports/             # 导出文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 构建和部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```
