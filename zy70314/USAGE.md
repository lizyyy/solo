# 多区域缓存失效 CLI 使用手册

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 查看帮助

```bash
python cache_invalidator_cli.py --help
```

### 3. 列出可用模板

```bash
python cache_invalidator_cli.py list-templates
```

---

## 常用命令

### 预检配置

执行预检，检查配置文件格式、区域可达性和任务完整性：

```bash
python cache_invalidator_cli.py precheck \
  --regions config/regions.yaml \
  --templates config/templates.yaml \
  --tasks examples/tasks.yaml \
  --mock-cache examples/mock_cache.json
```

**输出含义：**
- `✓ 信息`: 正常状态
- `⚠ 警告`: 不影响执行但需要关注
- `✗ 错误`: 必须修复后才能执行

### 执行缓存失效

执行完整的缓存失效流程：

```bash
python cache_invalidator_cli.py execute \
  --regions config/regions.yaml \
  --templates config/templates.yaml \
  --tasks examples/tasks.yaml \
  --mock-cache examples/mock_cache.json \
  --max-retries 3 \
  --retry-delay 1.0 \
  --output-dir reports \
  --yes
```

**常用参数：**
- `--max-retries`: 失败重试次数（默认3次）
- `--retry-delay`: 重试间隔秒数（默认1秒）
- `--skip-precheck`: 跳过预检（不推荐）
- `--yes`: 自动确认执行

### 验证缓存一致性

执行后的复查，确认所有区域缓存已失效：

```bash
python cache_invalidator_cli.py verify \
  --regions config/regions.yaml \
  --templates config/templates.yaml \
  --tasks examples/tasks.yaml \
  --mock-cache examples/mock_cache.json
```

### 重试特定任务

针对失败的任务单独重试：

```bash
python cache_invalidator_cli.py retry price-task-001 \
  --template product_price \
  --variable product_id=P001 \
  --mock-cache examples/mock_cache.json
```

---

## 配置文件说明

### 1. 区域配置 (config/regions.yaml)

定义需要管理的缓存区域：

```yaml
regions:
  - id: cn-north
    name: 华北
    endpoint: http://localhost:6379
    type: redis
    timeout: 5
```

**字段说明：**
- `id`: 区域唯一标识
- `name`: 区域显示名称
- `endpoint`: 缓存服务地址
- `type`: 缓存类型（当前支持 mock）
- `timeout`: 连接超时时间

### 2. 模板配置 (config/templates.yaml)

定义缓存键的生成规则：

```yaml
templates:
  product_price:
    pattern: "product:{product_id}:price"
    variables:
      - name: product_id
        required: true
        description: 商品ID
    description: 商品价格缓存
```

**支持的模板：**
| 模板名 | 用途 | 必需变量 |
|--------|------|----------|
| product_price | 商品价格缓存 | product_id |
| product_inventory | 商品库存缓存 | product_id, warehouse_id |
| member_benefit | 会员权益缓存 | member_id, level |

### 3. 任务清单 (examples/tasks.yaml)

定义需要失效的缓存任务：

```yaml
tasks:
  - id: price-task-001
    template: product_price
    variables:
      product_id: P001
    expected_value: '{"price": 199.99, "currency": "CNY"}'
    skip_regions:
      - cn-west
    skip_reason: 华西区域正在维护
```

**字段说明：**
- `id`: 任务唯一标识（重复会被检测）
- `template`: 使用的模板名称
- `variables`: 模板变量值
- `expected_value`: 期望值（用于一致性检查）
- `skip_regions`: 需要跳过的区域列表
- `skip_reason`: 跳过原因（强烈建议提供）

---

## 报告解读

### 终端输出

执行后终端会显示：
1. 预检结果（信息、警告、错误）
2. 每个任务的处理状态
3. 每个区域的详细情况（状态、重试次数、失败原因、跳过原因）
4. 执行汇总

### 生成的报告

报告保存在 `reports/` 目录下，包含两种格式：

**1. 文本报告 (.txt)**
- 适合值班人员快速阅读
- 包含完整的执行日志
- 详细列出每个区域的旧值残留
- 提供明确的下一步建议

**2. JSON报告 (.json)**
- 适合程序处理
- 包含完整的结构化数据
- 可用于自动化分析

### 状态说明

| 状态 | 颜色 | 说明 |
|------|------|------|
| 成功 | 绿色 | 失效成功且复查通过 |
| 失败 | 红色 | 失效操作失败 |
| 跳过 | 黄色 | 任务明确跳过 |
| 不一致 | 紫色 | 失效成功但复查仍有旧值 |
| 重复 | 青色 | 同一任务重复执行 |

---

## 典型场景

### 场景1: 价格发布后缓存不一致

**问题：** 价格发布后，部分区域用户仍看到旧价格

**操作步骤：**
1. 准备任务清单，列出需要失效的商品价格缓存
2. 执行预检：`python cache_invalidator_cli.py precheck`
3. 执行失效：`python cache_invalidator_cli.py execute --yes`
4. 查看报告，确认所有区域处理状态
5. 执行验证：`python cache_invalidator_cli.py verify`

**预期结果：**
- 所有区域状态为「成功」
- 验证命令返回 0 退出码
- 报告中无「不一致」状态

### 场景2: 库存更新后部分区域未同步

**问题：** 库存更新后，某些区域显示的库存数量不正确

**操作步骤：**
1. 检查任务清单，确认 warehouse_id 变量正确
2. 执行预检，检查区域可达性
3. 执行失效任务
4. 查看报告中的「旧值残留区域」部分
5. 对失败区域单独重试：`python cache_invalidator_cli.py retry`

### 场景3: 会员权益变更后生效延迟

**问题：** 会员等级变更后，权益计算仍然使用旧规则

**操作步骤：**
1. 确认任务清单包含正确的 member_id 和 level
2. 执行预检和失效
3. 查看报告中的「下一步建议」
4. 如有不一致，按建议手动检查缓存写入逻辑

---

## 错误处理

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 全部成功 |
| 1 | 预检错误或验证发现旧值 |
| 2 | 执行过程中存在失败或不一致 |

### 常见问题

**Q: 预检时发现「区域不可达」**
A: 检查区域配置中的 endpoint 是否正确，网络是否通畅

**Q: 发现「缓存键缺少必要变量」**
A: 检查任务清单中的 variables 字段，确保包含所有必需变量

**Q: 报告显示「不一致」状态**
A: 可能存在缓存写入 race condition，建议：
   1. 检查应用是否在失效后立即回写旧值
   2. 手动检查缓存服务中的实际键值
   3. 联系开发排查缓存更新逻辑

**Q: 同一任务重复执行会怎样？**
A: 系统会检测到重复并标记为「重复」状态，不会重复执行失效操作

---

## 补充说明

### 主要边界

1. **区域边界**
   - 必须在 regions.yaml 中定义所有区域
   - 未定义的区域无法被访问
   - 每个区域独立处理，互不影响

2. **任务边界**
   - 任务ID在同一执行会话中不能重复
   - 重复任务会被检测并跳过
   - 每个任务必须指定有效的模板

3. **模板边界**
   - 模板必须在 templates.yaml 中定义
   - 所有必需变量必须提供值
   - 缓存键构建失败会导致任务失败

4. **执行边界**
   - 最大重试次数：默认3次（可配置）
   - 重试间隔：默认1秒（可配置）
   - 跳过的区域必须提供原因（否则警告）

### 一个失败路径

**路径描述：** 区域不可达导致失效失败

**触发条件：**
1. 区域配置中的 endpoint 错误
2. 网络分区导致无法连接缓存服务
3. 缓存服务宕机

**执行流程：**
1. 预检阶段检测到区域不可达
2. 执行阶段尝试连接失败
3. 按配置次数重试（每次间隔 retry_delay）
4. 标记该区域为「失败」状态
5. 记录失败原因：「区域不可达」
6. 继续处理其他区域

**报告显示：**
- 区域状态：失败（红色）
- 失败原因：区域不可达: {region_id}
- 重试次数：达到配置的最大次数
- 下一步建议：检查缓存服务状态、网络连通性、权限配置

### 一次重复执行路径

**路径描述：** 同一任务ID和缓存键被重复执行

**触发条件：**
1. 任务清单中存在相同的 task_id
2. 同一 CLI 会话中多次执行相同任务

**执行流程：**
1. 首次执行：正常处理所有区域
2. 记录执行历史：task_id -> [cache_key]
3. 第二次执行：检测到重复
4. 所有非跳过区域标记为「重复」状态
5. 跳过原因：任务重复执行
6. 任务整体状态：部分成功

**报告显示：**
- 区域状态：重复（青色）
- 跳过原因：任务重复执行
- 任务警告：任务 {task_id} 已执行过相同缓存键 {cache_key}
- 下一步建议：存在重复任务或配置警告，请检查任务清单避免重复执行

---

## 附录

### 命令速查表

```bash
# 预检
python cache_invalidator_cli.py precheck

# 执行（自动确认）
python cache_invalidator_cli.py execute --yes

# 执行（自定义重试）
python cache_invalidator_cli.py execute --max-retries 5 --retry-delay 2 --yes

# 验证
python cache_invalidator_cli.py verify

# 重试特定任务
python cache_invalidator_cli.py retry <task_id> --template <template> -v key1=value1 -v key2=value2

# 查看模板
python cache_invalidator_cli.py list-templates
```

### 目录结构

```
.
├── cache_invalidator/          # 核心模块
│   ├── __init__.py
│   ├── config.py              # 配置加载
│   ├── templates.py           # 模板管理
│   ├── cache_client.py        # 缓存客户端
│   ├── executor.py            # 执行引擎
│   └── reporter.py            # 报告生成
├── cache_invalidator_cli.py   # CLI 入口
├── config/
│   ├── regions.yaml           # 区域配置
│   └── templates.yaml         # 模板配置
├── examples/
│   ├── tasks.yaml             # 任务清单样例
│   └── mock_cache.json        # 模拟缓存数据
├── reports/                   # 报告输出目录
├── requirements.txt           # 依赖清单
├── test_run.py                # 验证脚本
└── USAGE.md                   # 本文档
```
