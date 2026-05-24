# 透析耗材召回 API

本地后端服务，用于透析室耗材召回追溯管理。

## 技术栈
- Go 1.21+
- Gin Web 框架
- GORM ORM
- SQLite 数据库
- Excelize 报告导出

## 核心功能

### 闭环流程
1. **材料入库** - 耗材信息录入（批号、名称、规格、效期等）
2. **规则命中** - 召回公告发布后自动追溯匹配患者
3. **人工改判** - 支持多种状态转换的状态机
4. **结果回写** - 所有操作留痕，复核记录完整
5. **历史查看** - 完整的操作历史审计
6. **报告下载** - Excel格式多Sheet追溯报告

### 数据模型
- **Material** 耗材
- **Patient** 患者
- **DialysisShift** 透析班次
- **ConsumptionRecord** 领用记录
- **RecallNotice** 召回公告
- **TraceResult** 追溯结果
- **ReviewRecord** 复核记录
- **TraceHistory** 操作历史

### 召回状态机
- `pending` 待确认 - 初始状态，系统自动识别
- `confirmed` 已确认 - 人工确认受影响
- `rejected` 已驳回 - 数据有误或排除
- `resolved` 已解决 - 处理完成
- `withdrawn` 已撤回 - 召回撤销

## 快速开始

### 安装依赖
```bash
go mod download
```

### 启动服务
```bash
go run main.go
```

服务启动在 `http://localhost:8080`

### 健康检查
```bash
curl http://localhost:8080/health
```

## API 接口

### 基础数据
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/materials | 材料入库 |
| GET | /api/v1/materials | 获取耗材列表 |
| GET | /api/v1/patients | 获取患者列表 |
| GET | /api/v1/shifts | 获取班次列表 |

### 领用管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/consumptions | 创建领用记录 |
| GET | /api/v1/consumptions | 获取领用记录 |

### 召回管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/recalls | 创建召回公告 |
| GET | /api/v1/recalls | 获取召回列表 |
| POST | /api/v1/recalls/:id/trace | 执行追溯（幂等） |
| GET | /api/v1/recalls/:id/results | 追溯结果 |
| GET | /api/v1/recalls/:id/history | 操作历史 |
| POST | /api/v1/recalls/:id/withdraw | 撤回召回 |
| GET | /api/v1/recalls/:id/report | 下载报告 |

### 追溯结果管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/trace/:id/override | 人工改判 |
| GET | /api/v1/trace/:id/reviews | 复核记录 |

## 测试场景

运行完整场景测试：
```bash
cd samples
go run scenarios.go
```

### 场景说明
1. **正常召回流程** - 创建召回→执行追溯→确认结果（验证幂等性）
2. **冲突样本** - 替代耗材自动标记冲突→人工复核驳回
3. **召回撤回** - 创建召回→执行追溯→核实误报→撤回
4. **人工改判** - 完整状态机流转演示
5. **跨班次追溯** - 同一患者多班次使用召回批次

## 设计特点

### 幂等性保证
- 重复执行追溯不会产生重复记录
- 使用 `FirstOrCreate` 确保数据唯一性
- 人工改判记录有完整历史可追溯

### 冲突检测
- 替代耗材自动标记冲突
- 批号不一致警告
- 跨班次领用聚合展示

### 数据完整性
- 所有状态变更记录复核日志
- 操作历史完整审计
- 报告导出包含所有维度数据
