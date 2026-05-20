# 档案室借阅对账服务

后端对账服务，整合CSV/JSON导入、自动比对、人工复核、重新计算和报告下载功能。

## 功能特性

### 1. 数据导入
- 支持CSV格式的借阅记录导入
- 支持JSON格式的案件信息导入
- 支持JSON格式的人员权限导入
- 自动数据校验和错误提示

### 2. 自动对账比对
- **超期未还检测**: 自动识别超期借阅，按超期时长分级
- **密级权限匹配**: 检查借阅人是否有对应案件密级的访问权限
- **续借次数超限**: 检测超出最大续借次数的记录
- **权限异常识别**: 识别用户不存在或账号已停用的情况

### 3. 人工复核流程
- **批准例外**: 对特殊情况授权放行，记录审批原因
- **退回借阅**: 强制归还不符合规定的借阅
- **要求补充材料**: 要求借阅人补充相关审批文件
- **人工修正**: 修正系统录入错误（如续借次数、归还日期等）

### 4. 报告生成
- 生成详细的对账报告数据（JSON）
- 导出PDF格式报告（可打印存档）
- 导出Excel格式报告（便于数据处理）
- 包含复核痕迹和审批记录

## 项目结构

```
.
├── src/
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── services/           # 核心业务服务
│   │   ├── ImportService.ts         # 数据导入服务
│   │   ├── ReconciliationEngine.ts  # 对账引擎
│   │   ├── ReviewService.ts         # 复核服务
│   │   └── ReportService.ts         # 报告服务
│   └── index.ts            # API服务入口
├── sample-data/            # 样例数据
│   ├── cases.json          # 案件数据（含不同密级）
│   ├── borrow-records.csv  # 借阅记录（含异常情况）
│   └── permissions.json    # 人员权限配置
├── demo.js                 # 演示脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译代码

```bash
npm run build
```

### 3. 运行演示

```bash
node demo.js
```

### 4. 启动API服务

```bash
npm run dev
```

服务将在 http://localhost:3000 启动

## API接口说明

### 健康检查
```
GET /health
```

### 数据导入
```
POST /api/import/cases           - 导入案件JSON文件
POST /api/import/borrow-records  - 导入借阅CSV文件
POST /api/import/permissions     - 导入人员权限JSON文件
```

### 数据操作
```
POST /api/load-data              - 加载数据到对账引擎
POST /api/reconcile              - 执行对账
```

### 复核操作
```
POST /api/review/approve         - 批准例外
POST /api/review/reject          - 退回借阅
POST /api/review/request-info    - 要求补充材料
POST /api/review/manual-correction - 人工修正
GET  /api/review/logs            - 获取复核记录
```

### 报告下载
```
GET  /api/report                 - 获取报告数据
GET  /api/report/pdf             - 下载PDF报告
GET  /api/report/excel           - 下载Excel报告
```

### 数据查询
```
GET  /api/data/cases             - 获取案件列表
GET  /api/data/borrow-records    - 获取借阅记录
GET  /api/data/permissions       - 获取人员权限
```

## 样例数据说明

本项目提供的样例数据包含以下典型场景：

### 1. 案件密级
- **CASE-001**: 公开级 - 公开信息汇总报告
- **CASE-002**: 内部级 - 内部人员调整方案
- **CASE-003**: 机密级 - 机密项目可行性研究
- **CASE-004**: 绝密级 - 绝密级核心技术文档
- **CASE-005**: 公开级 - 普通业务合同存档

### 2. 异常借阅场景（需要人工复核）
- **REC-003（王芳）**: 借阅CASE-003（机密），续借2次，已超期
- **REC-004（张伟）**: 借阅CASE-004（绝密），但仅拥有内部级权限
- **REC-006（刘强）**: 续借3次，超出最大2次限制，且超期
- **REC-007（李明）**: 借阅CASE-003（机密），但仅拥有内部级权限（需要特殊审批）

## 对账差异类型

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| overdue | 超期未还 | 高/中/低（按超期天数） |
| classification_mismatch | 密级权限不匹配 | 高 |
| renewal_limit_exceeded | 续借次数超限 | 中 |
| permission_denied | 权限问题（无用户或已停用） | 高 |

## 复核操作示例

### 批准例外（放行）
```javascript
// 李明作为项目组成员，临时授权查看机密文件
POST /api/review/approve
{
  "discrepancyId": "xxx",
  "reviewerId": "USER-006",
  "reviewerName": "周经理",
  "reason": "特殊审批：李明为项目组成员，临时授权查看机密文件"
}
```

### 人工修正记录
```javascript
// 系统录入错误，续借次数应为2次
POST /api/review/manual-correction
{
  "recordId": "REC-006",
  "reviewerId": "USER-006",
  "reviewerName": "周经理",
  "updates": { "renewalCount": 2 },
  "reason": "系统录入错误，实际续借次数为2次，已核实纸质签字"
}
```

### 要求补充材料
```javascript
// 绝密文件借阅需要审批单和保密协议
POST /api/review/request-info
{
  "recordId": "REC-004",
  "reviewerId": "USER-006",
  "reviewerName": "周经理",
  "infoRequest": "请补充绝密文件借阅审批单和保密协议签署证明"
}
```

## 数据格式说明

### 案件数据 (JSON)
```json
{
  "caseId": "CASE-001",
  "caseNumber": "A-2024-001",
  "title": "案件标题",
  "classification": "public|internal|confidential|top_secret",
  "createDate": "2024-01-15",
  "handler": "经办人",
  "description": "说明"
}
```

### 借阅记录 (CSV)
```csv
recordId,caseId,borrowerId,borrowerName,borrowDate,dueDate,returnDate,status,renewalCount,handlerSignature,remarks
REC-001,CASE-001,USER-001,李明,2024-10-01,2024-10-31,,borrowed,0,张三,正常借阅
```

### 人员权限 (JSON)
```json
{
  "userId": "USER-001",
  "userName": "李明",
  "department": "业务一部",
  "allowedClassifications": ["public", "internal"],
  "maxBorrowDays": 30,
  "maxRenewals": 2,
  "isActive": true
}
```

## 业务流程

1. **数据导入**: 档案室管理员导入CSV借阅记录、案件JSON、人员权限表
2. **自动对账**: 系统自动检测超期、密级不匹配、续借超限等问题
3. **差异展示**: 列出所有异常记录，标注差异类型和严重程度
4. **人工复核**:
   - 查看每条异常的详细说明
   - 根据纸质签字和审批情况决定处理方式
   - 选择批准例外、退回借阅、要求补材料或人工修正
   - 记录复核意见和原因
5. **重新计算**: 复核完成后系统重新计算对账结果
6. **报告导出**: 生成PDF/Excel对账报告，包含复核痕迹和处理说明

## 技术栈

- **Node.js** - 运行环境
- **TypeScript** - 类型安全
- **Express** - Web框架
- **csv-parser** - CSV解析
- **pdfkit** - PDF生成
- **exceljs** - Excel生成
- **multer** - 文件上传

## 注意事项

1. 人工修正操作必须填写详细原因，便于后续审计
2. 所有复核操作都将记录日志，包含操作人、时间、操作类型和说明
3. 报告中将包含完整的复核痕迹，可追溯每条异常的处理过程
4. 建议定期导出对账报告进行纸质存档
