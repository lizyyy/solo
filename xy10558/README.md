# 售前方案版本管理 CLI

一个用于管理售前方案版本一致性的命令行工具，帮助团队在给客户发送方案前，核对客户需求、报价表、技术附件和评审意见是否为同一版本。

## 核心功能

- **版本一致性检查**：自动检测需求清单、报价表、技术附件的版本是否一致
- **评审意见追踪**：管理所有评审意见的关闭状态
- **附件完整性验证**：确保必要的技术附件齐全
- **人工覆盖机制**：支持人工标记覆盖阻断项，全程留痕
- **审计日志**：记录所有操作的前后差异和操作者
- **报告生成**：自动生成 Markdown/JSON 格式的方案报告

## 本地启动

### 环境要求
- Python 3.9+
- pip

### 安装步骤

```bash
# 1. 进入项目目录
cd /path/to/project

# 2. 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate

# 3. 安装 CLI 工具
pip install -e .

# 4. 验证安装
presale --help
```

## 项目结构

```
.
├── presale_version_cli/    # CLI 源码
│   ├── __init__.py
│   ├── cli.py              # 命令行入口
│   ├── models.py           # 数据模型
│   ├── config.py           # 配置管理
│   ├── storage.py          # 状态存储
│   ├── checker.py          # 检查规则引擎
│   └── reporter.py         # 报告生成
├── samples/                # 内置样例数据
│   ├── v1_*.txt            # v1.0.0 版本（有问题版本）
│   └── v2_*.txt            # v2.0.0 版本（修复版本）
└── pyproject.toml          # 项目配置
```

## 内置样例数据说明

项目包含两套完整的样例数据，覆盖完整的版本演进流程：

### v1.0.0（初版，有问题）
- ✅ 需求清单存在
- ⚠️ 报价表有旧版本（v0.9.0）和正确版本（v1.0.0）
- ✅ 技术附件齐全（技术架构、部署方案、接口清单）
- ❌ 评审意见未关闭（5条待处理）

### v2.0.0（最终版，全部修复）
- ✅ 需求清单更新（新增语音功能、满意度评价）
- ✅ 报价表版本一致（v2.0.0）
- ✅ 技术附件齐全并更新
- ✅ 所有评审意见已处理完毕

## 主要演示路径（成功路径）

演示：模拟从初版到最终版的完整演进流程

### 步骤 1：初始化项目

```bash
# 创建演示目录
mkdir -p demo-project
cd demo-project

# 初始化项目
presale init "智能客服系统一期"
```

预期输出：
- 显示项目初始化完成
- 项目版本：v1.0.0

### 步骤 2：导入 v1 版本文档（有问题的版本）

```bash
# 导入需求清单
presale import --requirements ../samples/v1_requirements.txt

# 导入正确版本的报价表（v1.0.0）
presale import --quotation ../samples/v1_quotation.txt

# 导入技术附件（逐个导入，指定分类）
presale import --attachment ../samples/v1_arch_tech.txt --category "技术架构"
presale import --attachment ../samples/v1_deploy_plan.txt --category "部署方案"
presale import --attachment ../samples/v1_api_list.txt --category "接口清单"

# 导入评审意见（会自动解析 5 条意见）
presale import --review ../samples/v1_review.txt
```

### 步骤 3：检查 v1 版本（会发现问题）

```bash
presale check
```

预期输出：
- ✅ REQ_EXISTS: 通过（需求清单存在）
- ✅ QUOT_EXISTS: 通过（报价表存在）
- ✅ QUOT_VERSION: 通过（报价表版本一致）
- ✅ ATT_REQUIRED: 通过（必要附件齐全）
- ❌ REV_CLOSED: **失败**（存在 5 条未关闭的评审意见）
- ⚠️ VERSIONS_CONSISTENT: 警告
- ❌ 存在阻断项，方案暂不可发送

### 步骤 4：查看详情和历史

```bash
# 查看项目概览
presale detail

# 列出评审意见
presale list-review

# 查看审计日志
presale detail --audit
```

### 步骤 5：处理评审意见

```bash
# 关闭所有评审意见（逐个关闭）
presale close-review 1 --assignee "张三"
presale close-review 2 --assignee "李四"
presale close-review 3 --assignee "王五"
presale close-review 4 --assignee "赵六"
presale close-review 5 --assignee "钱七"

# 再次检查
presale check
```

预期输出：
- ✅ 所有检查通过
- ✅ 无阻断项，方案可发送

### 步骤 6：升级到 v2 版本

```bash
# 升级版本号
presale bump-version --major --description "根据评审意见完成修订"

# 查看版本历史
presale detail --history

# 导入 v2 版本的更新文档
presale import --requirements ../samples/v2_requirements.txt --version "v2.0.0"
presale import --quotation ../samples/v2_quotation.txt --version "v2.0.0"
presale import --attachment ../samples/v2_arch_tech.txt --category "技术架构" --version "v2.0.0"
presale import --attachment ../samples/v2_deploy_plan.txt --category "部署方案" --version "v2.0.0"
presale import --attachment ../samples/v2_api_list.txt --category "接口清单" --version "v2.0.0"

# 检查 v2 版本
presale check
```

### 步骤 7：生成最终报告

```bash
# 生成 Markdown 报告
presale report --output final-report.md

# 查看报告内容
cat final-report.md
```

### 步骤 8：查看完整审计轨迹

```bash
presale detail --audit
```

预期输出：
- 显示所有操作记录
- 包含：操作类型、操作者、时间、描述、前后差异

## 失败路径演示

### 场景 1：导入旧版报价表

```bash
# 新建项目
mkdir demo-fail && cd demo-fail
presale init "测试报价表版本"

# 导入旧版报价表
presale import --requirements ../samples/v1_requirements.txt
presale import --quotation ../samples/v1_quotation_old.txt  # v0.9.0 旧版本
presale import --attachment ../samples/v1_arch_tech.txt --category "技术架构"
presale import --attachment ../samples/v1_deploy_plan.txt --category "部署方案"
presale import --attachment ../samples/v1_api_list.txt --category "接口清单"

# 检查（会检测到报价表版本不一致）
presale check
```

预期输出：
- ❌ QUOT_VERSION: **失败**（报价表版本与方案版本不一致）
- 详情显示：报价表是 v0.9.0，方案是 v1.0.0

### 场景 2：缺失必要附件

```bash
# 新建项目
mkdir demo-missing && cd demo-missing
presale init "测试附件缺失"
```bash
# 只导入部分附件（缺少接口清单）
presale import-doc --requirements ../samples/v1_requirements.txt
presale import-doc --quotation ../samples/v1_quotation.txt
presale import-doc --attachment ../samples/v1_arch_tech.txt --category "技术架构"
presale import-doc --attachment ../samples/v1_deploy_plan.txt --category "部署方案"
```
# 检查（会检测到缺失附件）
presale check
```

预期输出：
- ❌ ATT_REQUIRED: **失败**（缺失必要附件）
- 详情显示：缺少「接口清单」

### 场景 3：人工覆盖阻断项

```bash
# 继续场景 2 的项目
# 使用人工覆盖功能
presale override ATT_REQUIRED --reason "接口清单将在后续补充，客户已确认可先发送方案"

# 再次检查
presale check
```

预期输出：
- ATT_REQUIRED 显示为 **OVERRIDDEN**（已覆盖）
- 详情显示覆盖原因和操作者
- 审计日志记录本次操作的前后差异

## 命令大全

| 命令 | 说明 | 示例 |
|------|------|------|
| `presale init <名称>` | 初始化项目 | `presale init "项目名称"` |
| `presale import` | 导入文档 | `presale import --requirements req.txt` |
| `presale check` | 检查版本一致性 | `presale check` |
| `presale detail` | 查看详情 | `presale detail --audit` |
| `presale report` | 生成报告 | `presale report -o report.md` |
| `presale override` | 人工覆盖阻断项 | `presale override REV_CLOSED -r "原因"` |
| `presale list-review` | 列出评审意见 | `presale list-review` |
| `presale close-review` | 关闭评审意见 | `presale close-review 1` |
| `presale bump-version` | 升级版本号 | `presale bump-version --major` |

## 检查规则说明

| 规则ID | 名称 | 说明 | 阻断性 |
|--------|------|------|--------|
| REQ_EXISTS | 需求清单存在性 | 检查是否存在需求清单 | ✅ 阻断 |
| QUOT_EXISTS | 报价表存在性 | 检查是否存在报价表 | ✅ 阻断 |
| QUOT_VERSION | 报价表版本一致性 | 检查报价表版本是否匹配 | ✅ 阻断 |
| ATT_REQUIRED | 必要附件完整性 | 检查技术附件是否齐全 | ✅ 阻断 |
| REV_CLOSED | 评审意见关闭状态 | 检查所有评审是否已关闭 | ✅ 阻断 |
| MULTI_SCHEME | 方案集唯一性 | 检查是否多套方案混放 | ⚠️ 非阻断 |
| VERSIONS_CONSISTENT | 文档版本一致性 | 检查所有文档版本号 | ⚠️ 非阻断 |

## 幂等性说明

本 CLI 工具的所有操作都保证幂等性：

1. **重复 init**：不会报错，会更新项目信息
2. **重复 import**：相同内容的文件会被跳过（通过 checksum 检测）
3. **重复 check**：多次执行结果一致
4. **重复 close-review**：已关闭的意见不会重复处理
5. **重复 override**：已覆盖的规则保持覆盖状态

## 数据存储

所有项目数据存储在方案目录的 `.presale/` 目录下：

```
.presale/
├── state.json      # 项目状态（文档、评审、检查结果等）
├── audit.json      # 审计日志
└── cache/          # 缓存目录
```

## 常见问题

### Q: 如何查看特定文档的详细信息？
A: `presale detail --document "文档名称关键字"`

### Q: 如何查看所有历史版本？
A: `presale detail --history`

### Q: 如何导出审计日志？
A: `presale report --format json` 会包含完整的审计信息

### Q: 人工覆盖后可以取消吗？
A: 目前不支持取消覆盖，设计上人工覆盖是严肃操作，会永久记录在审计日志中。如果需要重新检查，建议重新导入正确的文档。

## 业务闭环判断

通过以下方式判断业务是否真的闭环：

1. **运行 `presale check`**
   - 无阻断项：显示「✓ 无阻断项，方案可发送」
   - 有阻断项：显示「❌ 存在阻断项，方案暂不可发送」

2. **查看 `presale detail`**
   - 发送状态：可发送/不可发送
   - 文档数量：活动/总数
   - 评审意见：已关闭/总数

3. **检查报告 `presale report`**
   - 发送状态一目了然
   - 阻断项清晰列出
   - 所有文档清单可见

不看源码的人也能通过这三个命令的输出，快速判断方案是否可以发给客户。
