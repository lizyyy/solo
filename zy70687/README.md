# 母婴店寄存商品效期转赠审批排查系统

本地命令行工具，用于管理母婴店寄存商品，包括客户管理、寄存记录、领用记录、转赠审批和效期提醒。

## 核心功能

### 1. 客户管理
- 添加客户（姓名、手机号）
- 手机号唯一性校验

### 2. 寄存商品管理
- 商品分类：奶粉、尿裤、其他
- 批次号、效期日期管理
- 自动效期检查：过期商品不能领用/转赠
- 库存扣减

### 3. 领用管理
- 领用数量校验（不超过库存）
- 过期商品禁止领用
- 领用记录留痕

### 4. 转赠审批
- 创建转赠申请
- 审批通过/拒绝
- 转赠成功后自动划转库存

### 5. 效期提醒
- 查询即将过期商品（可配置天数）
- 查询已过期商品

### 6. 报告导出
支持三种格式：
- **JSON**：机器可读，适合系统集成
- **CSV**：表格格式，适合Excel打开
- **Human**：人读格式，便于门店查看

## 命令列表

```bash
# 查看帮助
python3 cli.py -h

# 客户管理
python3 cli.py add-customer --name "张小明" --phone 13800138000
python3 cli.py list-customers

# 寄存管理
python3 cli.py add-storage --customer-id <ID> --product "爱他美" --category "奶粉" --batch "AP202405" --expiry "2025-12-31" --quantity 6 --unit "罐"
python3 cli.py list-storage
python3 cli.py list-storage --customer-id <ID>

# 领用
python3 cli.py use --storage-id <ID> --quantity 2 --notes "宝宝满月领用"

# 转赠审批
python3 cli.py transfer-request --from-customer <转出ID> --to-customer <转入ID> --storage-id <ID> --quantity 1
python3 cli.py pending-transfers
python3 cli.py approve-transfer --transfer-id <ID> --approver "店长"
python3 cli.py reject-transfer --transfer-id <ID> --approver "店长"

# 报告生成
python3 cli.py report-storage --format human
python3 cli.py report-expiry --days 30 --format json
python3 cli.py report-transfer --format csv
```

## 测试样例

运行完整测试（包含正常流程、脏数据、边界冲突、空结果、报告一致性）：

```bash
python3 test_samples.py
```

测试场景：
1. **正常流程**：添加客户→添加寄存→领用→转赠→审批→生成报告
2. **脏数据**：空姓名、无效手机号、重复手机号、无效日期、负数数量
3. **边界冲突**：超库存领用、过期商品操作、自转转赠、不存在ID操作
4. **空结果**：空数据下的各类报告输出
5. **一致性**：验证JSON报告与人读报告数据一致性

## 数据存储

所有数据保存在 `data/` 目录下的JSON文件：
- `customers.json` - 客户数据
- `storage_items.json` - 寄存商品
- `usage_records.json` - 领用记录
- `transfer_requests.json` - 转赠申请

## 文件结构

```
.
├── cli.py          # 命令行入口
├── models.py       # 数据模型和存储
├── service.py      # 业务逻辑
├── report.py       # 报告生成
└── test_samples.py # 测试脚本
```
