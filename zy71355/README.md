# 摄影棚器材归还管理CLI工具

一个可重复执行的命令行工具，用于摄影棚器材归还验收流程管理。

## 功能特性

- ✅ **器材清点流程** - 按分类清点镜头、灯架、电池、配件，支持租借单核对
- 📸 **损伤留痕记录** - 记录器材损伤部位、严重程度、照片参考、预估费用
- 💰 **押金试算** - 自动计算扣款，支持人工调整
- 🚫 **重复归还拦截** - 检测重复记录，冲突处理（跳过/覆盖/追加
- 📄 **报告导出** - 支持JSON和TXT格式导出
- 👀 **人工核对区** - 留出人工确认位置，确保数据准确

## 安装

```bash
npm install
```

## 使用方法

### 开始新的归还流程

```bash
# 交互式启动
npm start -- new

# 指定租借单号
npm start -- new --rental-id RENT-2024-001

# 指定冲突处理模式
npm start -- new -c skip    # 跳过重复
npm start -- new -c overwrite  # 覆盖重复
npm start -- new -c append   # 追加记录
```

### 查看归还记录

```bash
# 列出所有记录
npm start -- list

# 查看摘要
npm start -- view <returnId>

# 查看详细明细
npm start -- view <returnId> --detail
```

### 导出报告

```bash
# 导出TXT格式
npm start -- export <returnId>

# 导出JSON格式
npm start -- export <returnId> --format json

# 导出全部格式
npm start -- export <returnId> -f all
```

### 继续未完成的流程

```bash
npm start -- resume <returnId>
```

### 导入租借单

```bash
npm start -- import examples/sample-rental.json
```

## 工作流程

```
1. 输入租借单号 → 检测重复 → 录入租借单物品 → 分类清点器材
   ↓
2. 记录损伤 → 押金试算 → 人工调整扣款
   ↓
3. 人工核对确认 → 生成摘要报告 → 导出报告
```

## 数据存储

- 数据文件存储在 `data/returns/ 目录下
- 报告导出到 `reports/ 目录下

## 目录结构

```
.
├── src/
│   ├── index.js      # CLI主入口
│   ├── storage.js    # 数据存储
│   ├── checklist.js # 清点流程
│   ├── deposit.js   # 押金计算
│   ├── report.js    # 报告生成
│   └── duplicate.js # 重复检测
├── data/              # 数据目录
├── reports/           # 报告目录
└── examples/         # 示例文件
```
