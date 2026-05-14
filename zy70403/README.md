# 错误复现包命令行工具

审计数据管理命令行工具，用于管理离线证书、白名单、异常样本和班车预约等数据。

## 功能特性

### ✅ 数据实体
- **离线证书签发** - 存储离线审批的访问证书，包含完整审批链和原始材料
- **临时白名单** - 专门预留未撤销记录用于复核
- **异常样本** - 单独留存异常记录，可追溯原始数据
- **班车预约** - 人工备注完整入库，按原始行号可追溯

### ✅ 核心功能
1. **批量操作预览** - 执行前先显示候选清单，确认后再执行
2. **历史查询过滤** - 按批次、操作者、风险类型筛选操作日志
3. **清理/回滚候选清单** - 避免误删真实数据
4. **一键复核** - 快速处理待撤销白名单和待处理异常

## 安装使用

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 全局安装（可选）
npm link
```

## 命令说明

### 初始化演示数据
```bash
audit init-demo
```
生成贴近真实场景的演示数据，包含：
- 3份离线签发证书（含审批链附件）
- 4条白名单（含1条未撤销的临时白名单）
- 4条异常样本（含完整原始证据）
- 8条班车预约记录（含4条人工备注）

### 查询数据
```bash
# 查看离线证书
audit list certs
audit list certs --batch <批次ID>
audit list certs --raw           # 显示原始JSON数据

# 查看白名单
audit list whitelist
audit list whitelist --temp      # 仅临时白名单
audit list whitelist --unrevoked # 未撤销的临时白名单（复核用）

# 查看异常样本
audit list anomalies
audit list anomalies --risk "权限异常"
audit list anomalies --status pending
audit list anomalies --raw

# 查看班车预约
audit list bus
audit list bus --with-notes      # 仅显示带备注的记录
audit list bus --batch <批次ID>

# 查看操作日志
audit list logs
audit list logs --operator "张三"
audit list logs --type "导入离线证书"
audit list logs --batch <批次ID>
```

### 批量操作
```bash
# 批量撤销白名单（带预览确认）
audit revoke-whitelist --all-temp
audit revoke-whitelist --ids "1,2,3"

# 清理数据（生成候选清单）
audit cleanup --batch <批次ID> --preview  # 仅预览
audit cleanup --batch <批次ID>            # 执行清理

# 一键复核待处理事项
audit review
```

## 数据结构

### 离线证书
- 证书编号、申请人、部门、签发日期、有效期
- 完整审批链、附件信息（存储在 originalData 字段）
- 支持按批次追溯

### 白名单
- 员工信息、部门、申请原因
- 临时/永久标识、撤销状态
- 操作人、创建时间、批次号

### 异常样本
- 风险类型（权限异常、数据泄露、未授权访问等）
- 描述、来源、发现人、状态
- 完整原始证据数据（可回溯调查）

### 班车预约
- 原始Excel行号（关键！可追溯原始文件）
- 员工信息、线路、日期
- 人工备注完整保留

## 操作日志
所有批量操作都会记录日志，包含：
- 操作类型、操作人、批次号
- 影响数据条数、描述
- 执行时间、是否为回滚操作

## 安全特性
1. **预览确认机制** - 所有批量操作先显示候选清单
2. **原始数据保留** - 异常样本和证书保留完整原始材料
3. **操作留痕** - 所有操作记录日志，可审计
4. **防误删** - 清理操作先预览，确认后执行
