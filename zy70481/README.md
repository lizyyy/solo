# 证据链打包命令行工具

## 启动方式

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 查看帮助
```bash
python evidence_chain.py --help
```

### 3. 查看各命令帮助
```bash
python evidence_chain.py query --help
python evidence_chain.py add-record --help
```

---

## 样例来源

### 初始化样例数据
```bash
python evidence_chain.py init-sample
```

样例工单: **CS-2024-001 - 客服升级工单 - 服务版本不一致问题**

### 样例记录构成
| 来源系统 | 记录类型 | 说明 |
|---------|---------|------|
| customer_service | normal | 用户提交升级申请 |
| customer_service | normal | 客服审核通过 |
| version_control | **abnormal** | 检测到服务版本不一致（异常记录） |
| approval_flow | **manual_correction** | 人工修正（带备注，不覆盖系统判断） |
| cloud_resource | normal | 云资源申请批准 |
| cloud_resource | **manual_correction** | 补改云资源申请单（带改动理由） |
| customer_service | normal | 升级完成 |

---

## 主流程（成功路径）

### 1. 查询完整证据链
```bash
python evidence_chain.py query CS-2024-001
```

### 2. 流程说明
```
用户提交申请 → 客服审核 → [异常检测] → [人工修正备注] → 资源审批 → [资源补改] → 升级完成
```

**关键特性：**
- 异常记录（红色）和成功记录（绿色）在同一查询入口展示
- 人工修正保留独立记录（黄色），不覆盖原始异常记录
- 每次修改都有明确的来源系统标识

---

## 失败路径示例

### 场景：版本不一致导致升级失败

#### 1. 创建失败工单
```bash
python evidence_chain.py create-order CS-2024-002 "升级失败工单 - 版本不兼容"
```

#### 2. 添加失败记录
```bash
# 用户申请
python evidence_chain.py add-record CS-2024-002 "用户提交升级到企业版" -s customer_service -t normal -o user_002 --version-before v1.0-std

# 版本检测异常
python evidence_chain.py add-record CS-2024-002 "版本检测失败：依赖库版本不兼容" -s version_control -t abnormal -o system --version-before v1.0 --version-after v2.0

# 升级失败
python evidence_chain.py add-record CS-2024-002 "升级流程中止，版本不兼容无法继续" -s customer_service -t abnormal -o agent_wang
```

#### 3. 查询失败工单
```bash
python evidence_chain.py query CS-2024-002
```

---

## 清理与回滚机制

### 1. 生成候选清理清单
```bash
# 预览超过30天的工单
python evidence_chain.py cleanup-preview --days 30

# 预览超过7天的工单
python evidence_chain.py cleanup-preview --days 7
```

**设计原则：** 仅生成候选清单，不直接删除，避免误伤真实数据。

### 2. 批量删除（先预览）
```bash
# 预览模式（默认）- 只显示影响范围
python evidence_chain.py batch-delete CS-2024-001 CS-2024-002

# 确认执行 - 加上 --no-preview
python evidence_chain.py batch-delete CS-2024-002 --no-preview
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `init-sample` | 初始化样例数据 |
| `query [工单ID]` | 查询证据链 |
| `create-order <ID> <标题>` | 创建新工单 |
| `add-record <工单ID> <内容>` | 添加证据记录 |
| `cleanup-preview --days N` | 预览待清理工单 |
| `batch-delete <工单IDs>` | 批量删除（默认预览） |

---

## 记录类型说明

| 类型 | 颜色 | 说明 |
|------|------|------|
| normal | 绿色 | 正常记录 |
| abnormal | 红色 | 异常记录 |
| manual_correction | 黄色 | 人工修正/备注 |

## 来源系统说明

| 系统标识 | 说明 |
|---------|------|
| customer_service | 客服系统 |
| cloud_resource | 云资源系统 |
| version_control | 版本控制系统 |
| approval_flow | 审批流系统 |
