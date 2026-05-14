# JSON Schema Diff CLI

> 灰度物流拦截专用 JSON Schema 差异比较命令行工具

## 功能特性

### 1. Schema 差异比较
- 检测字段新增、删除、修改
- 嵌套结构差异比较
- 关键差异（删除、类型变更）识别

### 2. 物流拦截处理
- 补偿动作缺失检测（关键失败路径）
- 灰度发布失败检测
- 拦截时间缺失检测
- 按失败原因分组统计

### 3. 批量处理
- 预览影响范围再执行
- 失败项分组过滤
- 湖仓分区识别

### 4. 结果复用与冲突检测
- 相同内容再次提交自动复用旧结果
- Schema 变更与人工备注冲突检测

### 5. 人工备注系统
- 失败项添加人工审核备注
- 不直接覆盖系统判断

### 6. 失败项持久化
- 失败项单独存储
- 按失败分组查询
- 方便接手人查看原因

### 7. 湖仓分区管理
- 分区列表人工确认
- 未确认分区筛选

## 安装

```bash
npm install
npm run build
npm link
```

## 使用方法

### 生成示例数据
```bash
jsdiff generate-sample
```

### 预览批量处理
```bash
jsdiff preview
jsdiff preview -f sample-data.json
```

### 执行批量处理
```bash
jsdiff execute
jsdiff execute -f sample-data.json -o operator-name
jsdiff execute --skip-preview
```

### 查看失败项
```bash
jsdiff failures
jsdiff failures --list-groups
jsdiff failures -g COMPENSATION_MISSING
```

### 添加人工备注
```bash
jsdiff remark
jsdiff remark -i <result-id> -r "已人工审核" -o admin
```

### 管理湖仓分区
```bash
jsdiff partitions --list
jsdiff partitions --unconfirmed
jsdiff partitions --confirm "date=2024-01-01/gray=true" -o admin
```

### 运行自检
```bash
npm run self-check
```

## 测试覆盖的边界情况

1. **Schema 差异**
   - 新增字段
   - 删除字段
   - 修改字段值
   - 嵌套结构差异

2. **补偿动作**
   - 全部补偿动作执行
   - 部分补偿动作未执行
   - 补偿动作数量不足

3. **灰度发布**
   - 正常拦截状态
   - 拦截失败状态
   - 非灰度发布记录

4. **结果复用**
   - 相同内容首次提交
   - 相同内容再次提交（自动跳过）

5. **冲突检测**
   - Schema 变更但有人工备注

6. **湖仓分区**
   - 添加分区
   - 确认分区
   - 筛选未确认分区

## 项目结构

```
.
├── src/
│   ├── types.ts          # 类型定义
│   ├── schema-diff.ts    # Schema 差异比较
│   ├── logistics-processor.ts  # 物流拦截处理器
│   ├── result-store.ts   # 结果存储与管理
│   ├── batch-processor.ts # 批量处理器
│   ├── cli.ts           # 命令行入口
│   └── self-check.ts    # 自检脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 失败分组说明

| 分组名称 | 说明 |
|---------|------|
| `COMPENSATION_MISSING` | 补偿动作缺失或未执行 |
| `GRAY_RELEASE_FAILED` | 灰度发布失败 |
| `INTERCEPTION_TIME_MISSING` | 拦截时间缺失 |
| `SCHEMA_CRITICAL_DIFF` | Schema 存在关键差异 |
