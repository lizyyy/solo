# 牙科器材库器械借用归还系统

## 功能特性

### 核心业务
- ✅ **单条人工处理**: 支持逐条登记借用、归还、消毒
- ✅ **批量补录**: 支持批量导入历史借还记录
- ✅ **智能校验**: 未消毒器械检测、借还明细一致性检查

### 数据导出
- ✅ **JSON格式**: 完整业务数据导出
- ✅ **CSV表格**: 可直接用Excel打开，便于台账核对
- ✅ **业务字段**: 全部使用中文业务字段，无需翻译

### 业务字段说明
| 字段 | 说明 |
|------|------|
| 器械编号 | 器械唯一标识 |
| 器械名称 | 如：高速手机、拔牙钳、刮治器等 |
| 器械类别 | 手机类/手术器械/检查器械/牙周器械等 |
| 规格型号 | 具体型号规格 |
| 借用人姓名 | 实际借用人姓名 |
| 借用科室 | 口腔修复科/正畸科/牙周科等 |
| 借用日期时间 | 借用发生时间 |
| 消毒状态 | 已消毒/未消毒 |
| 状态 | 借用中/已归还 |

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
node scripts/init-db.js
```

### 3. 启动API服务
```bash
npm start
```
服务地址: http://localhost:3000

### 4. 使用命令行工具
```bash
# 一致性检查
node cli.js check

# 导出数据(CSV)
node cli.js export csv

# 导出数据(JSON)
node cli.js export json

# 查看统计
node cli.js stats

# 列出借还明细
node cli.js list
```

## API接口文档

### 单条操作
| 方法 | 接口 | 说明 |
|------|------|------|
| POST | /api/borrow | 登记借用 |
| POST | /api/return | 登记归还 |
| POST | /api/sterilize | 登记消毒 |

### 批量操作
| 方法 | 接口 | 说明 |
|------|------|------|
| POST | /api/batch-import | 批量补录借还记录 |

### 校验检查
| 方法 | 接口 | 说明 |
|------|------|------|
| GET | /api/check-consistency | 借还明细一致性检查 |
| GET | /api/check-borrow/:器械编号 | 借用前置条件检查 |

### 数据导出
| 方法 | 接口 | 说明 |
|------|------|------|
| GET | /api/records | 查询借还明细 |
| GET | /api/export/json | 导出JSON格式 |
| GET | /api/export/csv | 导出CSV表格格式 |

### 数据查询
| 方法 | 接口 | 说明 |
|------|------|------|
| GET | /api/equipment | 器械列表 |
| GET | /api/equipment/:编号 | 器械详情及借还记录 |
| GET | /api/stats | 统计概览 |

## 借还一致性检查说明

系统会自动检测以下问题：
1. **器械档案状态与借还记录不一致**：档案显示借用中但无对应记录
2. **有借用记录但档案状态不匹配**：借还记录显示借用中但档案状态不是
3. **归还后超期未消毒**：归还超过1天仍未消毒

每个问题都会明确提示：
- 问题类型
- 问题描述
- 关键信息
- **下一步操作指引**
- **需要补充的材料**

## 项目结构
```
├── src/
│   ├── server.js          # 服务入口
│   ├── routes/
│   │   └── api.js         # API路由
│   ├── services/
│   │   ├── lending-service.js      # 借还业务逻辑
│   │   ├── validation-service.js   # 校验检查逻辑
│   │   └── export-service.js       # 数据导出逻辑
│   └── database/
│       ├── db.js          # 数据库连接
│       ├── init.js        # 表结构初始化
│       └── sample-data.js # 样例数据
├── scripts/
│   └── init-db.js         # 初始化脚本
├── cli.js                 # 命令行工具
├── package.json
└── README.md
```
