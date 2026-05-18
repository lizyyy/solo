# 乡镇客运站客运班次退款 CLI 工具

专门为乡镇客运站设计的客运班次退款批量处理工具，支持跨人交接留痕、儿童票特殊处理、改签后退票特殊规则和断点续跑功能。

## 安装

```bash
npm install

# 全局安装（推荐）
npm link
```

安装后可直接使用 `bus-refund` 命令。

## 快速开始

### 1. 生成示例文件

```bash
bus-refund example
```

会生成 `example-input.csv`，包含乡镇客运站真实业务场景的示例数据。

### 2. 处理退款文件

```bash
bus-refund process example-input.csv -o results.csv
```

### 3. 查看处理状态

```bash
bus-refund status
```

## 核心功能特点

### 1. 儿童票特殊处理
- **全额退款**：儿童票不扣任何手续费
- 备注中自动标注"儿童票全额退款"

示例输出：
```
退款金额: 12.50
退款比例: 100%
备注: 儿童票全额退款
```

### 2. 改签后退票特殊处理
- 在原有退款比例基础上额外扣 5%
- 最低退款比例不低于 80%
- 备注中自动标注"改签后退票额外扣5%，最低80%"

示例：
- 原应退 95% → 改签后退 90%
- 原应退 90% → 改签后退 85%
- 原应退 85% → 改签后退 80%（下限保护）

### 3. 可复跑输出（断点续跑）
- 自动保存处理进度到 `.refund-process-log.json`
- 使用 `--continue` 参数跳过已处理文件
- 使用 `--reset` 参数重置处理日志

```bash
# 第一次处理
bus-refund process batch1.csv -o results.csv

# 处理中断后继续
bus-refund process batch1.csv batch2.csv -o results.csv --continue
```

### 4. 结果排序（方便 diff）
- 优先按 **班次编号** 升序排序
- 同班次内按 **订单编号** 升序排序
- 确保输出稳定，便于版本对比

## 命令详解

### process - 处理退款文件

```bash
bus-refund process <files...> [options]
```

参数：
- `files...`: 一个或多个输入CSV文件路径

选项：
- `-o, --output <file>`: 输出文件路径，默认 `refund-results.csv`
- `-c, --continue`: 断点续跑模式，跳过已处理文件
- `-r, --reset`: 重置处理日志，重新开始

示例：

```bash
# 处理单个文件
bus-refund process data/2024-05-01.csv -o may-refunds.csv

# 批量处理多个文件
bus-refund process data/*.csv -o all-refunds.csv

# 断点续跑
bus-refund process data/*.csv -o all-refunds.csv --continue

# 重置并重新处理
bus-refund process data/*.csv -o all-refunds.csv --reset
```

### status - 查看处理状态

```bash
bus-refund status
```

输出示例：
```
=== 处理状态 ===
已处理文件数: 3
失败文件数: 1
已处理记录数: 156

失败文件:
  - data/bad.csv: 第5行: 缺少列: 身份证号
```

### example - 生成示例文件

```bash
bus-refund example [-o output.csv]
```

## 输入文件格式

CSV文件必须包含以下列：

| 列名 | 说明 | 示例 |
|------|------|------|
| 订单编号 | 唯一订单号 | DD202405010001 |
| 班次编号 | 班次标识 | BC-XZ-001 |
| 乘客姓名 | 乘客姓名 | 张三 |
| 身份证号 | 身份证号码 | 440101199001011234 |
| 联系电话 | 手机号 | 13800138001 |
| 发车时间 | YYYY-MM-DD HH:mm:ss | 2024-05-02 08:30:00 |
| 终点站 | 目的地站点 | 县城汽车站 |
| 票价 | 车票价格 | 25.00 |
| 票种 | 成人票/儿童票 | 儿童票 |
| 购票时间 | 购票时间 | 2024-05-01 10:00:00 |
| 是否改签 | 是/否 | 是 |
| 原订单编号 | 改签前订单号 | DD202404280005 |
| 退款申请时间 | 申请退款时间 | 2024-05-01 14:00:00 |
| 处理状态 | 待处理 | 待处理 |

## 退款规则详解

### 成人票退款比例
| 退票时间 | 退款比例 | 手续费 |
|----------|----------|--------|
| 购票后2小时内 | 90% | 10% |
| 购票后2-24小时内 | 95% | 5% |
| 购票24小时后 | 100% | 0% |

### 儿童票退款比例
- **统一 100% 退款**，不扣手续费
- 不受退票时间影响

### 改签后退票
- 在上述比例基础上 **额外扣 5%**
- 最低退款比例 **不低于 80%**（下限保护）

## 完整使用示例

### 示例1：基础退款处理

```bash
# 1. 生成示例文件
bus-refund example -o test-data.csv

# 2. 查看文件内容
cat test-data.csv

# 3. 处理退款
bus-refund process test-data.csv -o test-results.csv

# 4. 查看结果
cat test-results.csv
```

预期输出：
```
处理文件: test-data.csv
  成功处理 3 条记录

结果已写入: test-results.csv
总计处理: 3 条记录
```

### 示例2：断点续跑场景

```bash
# 场景：有3个批次文件需要处理
# 批次1：上午班次
bus-refund process batch-morning.csv -o final.csv

# 批次2：下午班次（假设处理到一半中断）
bus-refund process batch-afternoon.csv -o final.csv --continue

# 批次3：晚上班次（继续处理）
bus-refund process batch-evening.csv -o final.csv --continue

# 查看整体状态
bus-refund status
```

### 示例3：使用diff对比结果

```bash
# 第一次处理
bus-refund process data.csv -o v1.csv --reset

# 修改数据后第二次处理
bus-refund process data-updated.csv -o v2.csv --reset

# 对比差异（排序保证结果稳定）
diff v1.csv v2.csv
```

## 错误处理

### 常见错误类型

1. **缺少列**
   ```
   第5行: 缺少列: 身份证号, 联系电话
   ```

2. **重复订单**
   ```
   第8行: 重复订单 DD202405010001
   ```

3. **空文件**
   ```
   空文件: empty.csv
   ```

4. **文件不存在**
   ```
   文件不存在: not-found.csv
   ```

### 部分失败继续处理
- 单个文件失败不影响其他文件处理
- 失败文件记录在处理日志中
- 修复后可使用 `--continue` 重新处理

## 运行测试

```bash
npm test
```

测试覆盖以下场景：
- ✅ 正常数据处理
- ✅ 儿童票全额退款
- ✅ 改签后退票额外扣费
- ✅ 空文件处理
- ✅ 缺少列处理
- ✅ 重复行处理
- ✅ 断点续跑
- ✅ 结果排序
- ✅ status命令
- ✅ example命令

## 处理日志说明

处理进度保存在 `.refund-process-log.json` 文件中，结构如下：

```json
{
  "processedFiles": ["batch1.csv", "batch2.csv"],
  "failedFiles": [
    {
      "filePath": "bad.csv",
      "error": "缺少列: 身份证号",
      "timestamp": "2024-05-01T12:00:00.000Z"
    }
  ],
  "records": [...]
}
```

## 业务场景说明

本工具专门针对乡镇客运站业务特点设计：

1. **跨人交接留痕**：完整处理日志，交接班时查看 `bus-refund status` 即可了解进度
2. **儿童票占比高**：乡镇线路儿童乘客多，单独处理全额退款规则
3. **改签频繁**：支持改签后退票的特殊计费规则
4. **网络不稳定**：断点续跑功能适应乡镇网络环境
5. **批量处理**：支持一次性处理多天/多班次的退款申请