# 社区药房疫苗胰岛素库存管理CLI

解决社区药房疫苗和胰岛素到货后手工记录温度、签收人和破损情况的管理工具。

## 功能特性

- ✅ **温度检查**: 疫苗和胰岛素严格控制在2-8℃，超出范围自动拦截
- ✅ **批号重复检查**: 防止同一批号重复入库自动预警
- ✅ **照片凭证检查**: 缺少到货照片凭证自动拦截
- ✅ **库存管理**: 复核通过后自动更新库存
- ✅ **历史记录**: 所有记录持久化存储，命令间共享
- ✅ **多维度筛选**: 按负责人、时间、状态、异常类型筛选
- ✅ **CSV导出**: 导出查询结果可导出为CSV报表
- ✅ **原因追溯**: 每条记录都能看到拦截或放行的详细原因

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化存储

```bash
node src/index.js init
```

### 3. 导入到货记录

**正常记录示例:**
```bash
# 导入疫苗（温度正常，带照片）
node src/index.js import \
  -t vaccine \
  -n "新冠疫苗" \
  -b "VAC-2024-001" \
  -q 100 \
  -T 5 \
  -H "张药师" \
  -p "/photos/vac001.jpg"
```

**异常记录示例 - 温度越界:**
```bash
# 温度12℃，超出2-8℃安全范围
node src/index.js import \
  -t vaccine \
  -n "流感疫苗" \
  -b "VAC-2024-002" \
  -q 80 \
  -T 12 \
  -H "王药师" \
  -p "/photos/vac002.jpg"
```

**异常记录示例 - 缺少照片:**
```bash
node src/index.js import \
  -t insulin \
  -n "门冬胰岛素" \
  -b "INS-2024-002" \
  -q 30 \
  -T 6 \
  -H "赵药师"
```

### 4. 复核记录

**查看待复核列表:**
```bash
node src/index.js review -l
```

**通过复核:**
```bash
node src/index.js review -i <记录ID> -a
```

**驳回记录:**
```bash
node src/index.js review -i <记录ID> -r
```

### 5. 查询历史记录

**查询所有记录:
```bash
node src/index.js query
```

**按负责人筛选:**
```bash
node src/index.js query -H "张药师"
```

**按状态筛选:**
```bash
node src/index.js query -s approved
```

**按异常类型筛选:**
```bash
node src/index.js query -e "温度"
```

**按时间范围筛选:**
```bash
node src/index.js query --start "2024-01-01" --end "2024-12-31"
```

**查看统计摘要:**
```bash
node src/index.js query -S
```

### 6. 导出CSV报告

```bash
# 导出所有记录
node src/index.js export -o report.csv

# 导出张药师处理的记录
node src/index.js export -o report_zhang.csv -H "张药师"

# 导出已通过的记录
node src/index.js export -o report_approved.csv -s approved
```

### 7. 查看库存

```bash
node src/index.js inventory
```

## 一键运行样例

```bash
# 先初始化
node src/index.js init

# 运行样例数据脚本（包含正常和异常场景）
chmod +x samples.sh
./samples.sh
```

## 业务规则

| 规则 | 拦截条件 | 原因说明 |
|------|----------|----------|
| 温度检查 | 温度 < 2℃ 或 > 8℃ | 疫苗/胰岛素温度超出安全范围 |
| 批号重复 | 已存在相同批号的复核通过记录 | 该批号已入库，防止重复录入 |
| 照片凭证 | 未提供照片路径 | 缺少到货验收照片凭证必填 |
| 库存变更 | 复核通过后自动更新 | 库存数量增加 |

## 数据存储位置

- 记录数据: `data/records.json`
- 库存数据: `data/inventory.json`

## 命令参考

| 命令 | 说明 |
|------|------|
| `init` | 初始化存储系统 |
| `import` | 导入到货记录 |
| `review` | 复核待处理记录 |
| `query` | 查询历史记录 |
| `export` | 导出CSV报告 |
| `inventory` | 查看当前库存 |
