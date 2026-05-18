# 考试记录文件补考资格扫描 CLI

批量扫描考试记录文件，自动判定可恢复补考资格人员，生成可复核报告。

## 业务规则

### 可补考资格条件（需同时满足）
1. **考试状态为不及格** (status = 'failed')
2. **证明未过期** (certDate 在有效期内，默认 365 天)
3. **未补考** (hasRetaken = false 且 retakeCount < 1)
4. **无科目冲突** (该科目没有其他通过记录)

### 不可补考原因分类
- 证明已过期
- 已补考
- 科目冲突（该科目已通过）
- 考试状态非不及格

## 安装

```bash
npm install
npm link  # 可选，全局安装 CLI
```

## 使用方法

### 基本用法
```bash
npm run scan ./samples
```

### 命令行选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 输出 JSON 格式报告 | 文本格式 |
| `--output <文件>` | 将报告写入指定文件 | 控制台输出 |
| `--date <YYYY-MM-DD>` | 指定当前日期，用于判定证明过期 | 系统日期 |
| `--cert-days <天数>` | 指定证明有效期天数 | 365 |
| `--help` | 显示帮助信息 | - |

### 示例

```bash
# 扫描样例目录
npm run scan ./samples

# 输出 JSON 格式
npm run scan ./samples -- --json

# 输出到文件
npm run scan ./samples -- --output report.txt

# 指定日期和有效期
npm run scan ./samples -- --date 2024-06-01 --cert-days 180
```

## 数据格式

支持 JSON 和 CSV 两种格式，字段如下：

| 字段 | 类型 | 说明 |
|------|------|------|
| examId | string | 考试记录编号 |
| studentId | string | 学号 |
| studentName | string | 姓名 |
| subject | string | 科目 |
| score | number | 分数 |
| status | string | 状态：'passed' / 'failed' |
| certDate | string | 证明日期 (YYYY-MM-DD) |
| retakeCount | number | 补考次数 |
| hasRetaken | boolean | 是否已补考 |

## 输出特点

1. **固定排序**：按学号 → 科目 → 考试编号排序，方便两次运行用 diff 直接比较
2. **原因分类**：不可补考人员按原因分组显示
3. **来源追踪**：每条记录显示来源文件名
4. **规则变更可见**：证明过期、已补考、科目冲突相关输出清晰标注

## 目录结构

```
.
├── bin/
│   └── exam-retake-scan.js    # CLI 入口
├── src/
│   └── scanner.js             # 核心扫描逻辑
├── samples/
│   ├── batch1.json            # JSON 样例数据
│   └── batch2.csv             # CSV 样例数据
├── tests/                     # 自动化测试
├── expected-output.txt        # 期望输出文件
├── package.json
└── README.md
```

## 运行测试

```bash
npm test
```

## 验收检查清单

- [ ] 正常路径：扫描 samples 目录，输出包含可补考列表
- [ ] 异常路径：空目录、不存在目录、无效文件
- [ ] 输出特征：显示"考试记录补考资格扫描报告"标题
- [ ] 字段验证：显示学号、姓名、科目、分数、来源文件等具体字段
- [ ] 原因分类：证明过期、已补考、科目冲突分别显示
- [ ] 排序稳定：两次运行结果可直接 diff 比较
