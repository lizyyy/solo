# 知识库失效链接 CLI

本地可运行的知识库迁移后链接检查工具，用于检查失效链接、权限链接、重复页面和负责人归属。

## 功能特性

- ✅ **失效链接检查**: 检测 404、重定向、权限受限链接
- ✅ **重复页面检测**: 发现内容重复、标题重复、版本重复的页面
- ✅ **负责人归属**: 追踪文档负责人，识别离职人员负责的文档
- ✅ **按负责人修复清单**: 自动分配修复任务给对应负责人
- ✅ **迁移风险评估**: 整体风险打分，帮助判断业务是否闭环
- ✅ **历史记录追踪**: 完整记录所有操作，支持幂等执行
- ✅ **多格式输出**: 支持 text、JSON、Markdown 三种报告格式

## 命令列表

| 命令 | 说明 |
|------|------|
| `kbcheck init` | 初始化工作区 |
| `kbcheck import` | 导入文档和负责人信息 |
| `kbcheck check` | 执行检查（链接/重复/负责人） |
| `kbcheck detail` | 查看详情、历史记录和失败原因 |
| `kbcheck report` | 生成完整报告 |

## 快速开始

### 1. 安装

```bash
cd kb-link-checker
pip install -e .
```

### 2. 初始化工作区

```bash
mkdir my-kb-project
cd my-kb-project
kbcheck init
```

### 3. 使用内置样例数据（推荐）

```bash
kbcheck import --sample
```

这会生成完整的演示数据，包括：
- 10 份文档（制度/技术/培训三类）
- 20+ 个链接（含多种错误类型）
- 5 位负责人（含 1 位离职人员）
- 2 组重复页面

### 4. 执行检查

```bash
kbcheck check
```

检查类型可选：
```bash
kbcheck check --check-type links      # 仅检查链接
kbcheck check --check-type duplicates # 仅检测重复页面
kbcheck check --check-type owners     # 仅分析负责人
```

### 5. 查看详情

```bash
kbcheck detail                    # 查看全部检查结果
kbcheck detail --status failed    # 仅看失败的
kbcheck detail --check-id <ID>    # 查看特定检查的详情
kbcheck detail --doc-id <ID>      # 查看特定文档的问题
kbcheck detail --history          # 查看操作历史
```

### 6. 生成报告

```bash
kbcheck report                    # 总览报告
kbcheck report --by-owner         # 按负责人的修复清单
kbcheck report --risks            # 迁移风险评估
kbcheck report --ignore-list      # 人工忽略记录

kbcheck report --format json --output report.json      # JSON 格式
kbcheck report --format markdown --output report.md    # Markdown 格式
```

## 主要演示路径

### 演示路径 1：完整流程

```bash
# 1. 初始化
kbcheck init

# 2. 导入样例数据
kbcheck import --sample

# 3. 执行完整检查
kbcheck check

# 4. 查看失败链接详情
kbcheck detail --status failed

# 5. 查看某个具体问题
kbcheck detail --check-id <从上面复制的check_id>

# 6. 生成修复清单
kbcheck report --by-owner

# 7. 查看整体风险
kbcheck report --risks

# 8. 查看操作历史
kbcheck detail --history
```

### 演示路径 2：按负责人闭环

```bash
kbcheck init
kbcheck import --sample
kbcheck check

# 生成各负责人的修复清单
kbcheck report --by-owner

# 查看某文档的具体问题
kbcheck detail --doc-id doc_tech_002

# 查看操作历史，确认所有变更都有记录
kbcheck detail --history
```

## 失败路径演示

### 场景：未初始化直接操作

```bash
# 会提示工作区未初始化
kbcheck import --sample
# 输出: 工作区未初始化，请先运行 kbcheck init
```

### 场景：重复初始化

```bash
kbcheck init
kbcheck init  # 第二次运行
# 输出: 工作区已存在，使用 --force 可重新初始化
```

### 场景：未导入数据直接检查

```bash
kbcheck init
kbcheck check
# 输出: 没有找到文档，请先运行 kbcheck import
```

## 检查规则

### 链接检查规则

| 错误类型 | 说明 | 严重程度 |
|---------|------|---------|
| 404 | 页面不存在或已删除 | Critical |
| redirect | 需要重定向到新地址 | Medium |
| permission | 权限受限，仅部分角色可见 | Medium |
| owner_inactive | 目标页面负责人已离职 | High |
| duplicate_reference | 同一链接多处引用 | Low |
| attachment_missing | 附件引用可能失效 | Medium |

### 重复页面判定

- **exact_match**: 内容哈希完全相同（100% 相似）
- **title_match**: 标题完全相同（90% 相似）
- **path_similarity**: 路径暗示的版本重复（如 v2、copy）

### 风险评分机制

```
总分 = min(失效链接数 × 10, 40)
     + min(警告链接数 × 3, 30)
     + min(重复页面组数 × 5, 15)
     + min(离职负责人 × 8, 15)

高风险: 70-100 分
中风险: 40-69 分
低风险: 0-39 分
```

### 业务闭环标准

✓ 失效链接 = 0  
✓ 离职负责人数 = 0  
✓ 所有警告已处理或记录忽略原因  

## 幂等性保证

- 重复运行 `kbcheck check` 不会重复检查已检查的链接
- 使用 `--recheck` 可强制重新检查
- 所有操作都有历史记录，可追溯
- 导入同一文档会按 doc_id 覆盖，不会产生重复

## 人工修正记录

人工修正时需要：
- 记录操作者
- 保存修正前快照
- 保存修正后快照
- 注明修正原因（修复或忽略）

## 数据存储

所有数据存储在工作区的 `.kbcheck/` 目录：

```
.kbcheck/
├── documents.json      # 文档元数据
├── links.json          # 提取的链接
├── check_results.json  # 检查结果
├── owners.json         # 负责人信息
├── duplicates.json     # 重复页面信息
├── history.json        # 操作历史
├── corrections.json    # 人工修正记录
└── meta.json           # 元数据
```

## 导入真实数据

### 导入文档目录

```bash
kbcheck import --docs /path/to/your/docs --default-owner owner_001
```

### 导入负责人信息

创建 `owners.json`：

```json
[
  {
    "owner_id": "owner_001",
    "name": "张三",
    "email": "zhangsan@company.com",
    "department": "技术部",
    "roles": ["engineering", "tech-lead"],
    "is_active": true
  }
]
```

然后导入：

```bash
kbcheck import --owners owners.json
```

## 支持的文档格式

- **Markdown (.md)**: 支持 `[text](url)`, `![alt](url)`, 引用式链接, `<url>`
- **HTML (.html)**: 支持 `<a href>`, `<img src>`, `<area href>`

## 权限模型

文档可见性：
- `public`: 公开
- `internal`: 内部可见
- `confidential`: 机密

当低权限文档引用高权限文档时会产生警告。

## 内置样例数据

样例数据包含以下场景：

| 场景 | 说明 |
|------|------|
| 404 链接 | 已删除/归档的页面 |
| 重定向链接 | 旧知识库地址需要重定向 |
| 权限链接 | 仅特定角色可访问的页面 |
| 离职负责人 | 王芳（技术部）文档无人维护 |
| 重复页面 | 考勤管理制度 (副本) |
| 版本重复 | API 开发指南 v1/v2 |
| 多处引用 | 同一链接在 4 处出现 |
| 附件引用 | 合同附件 PDF |
| 跨权限引用 | 内部文档引用机密文档 |
