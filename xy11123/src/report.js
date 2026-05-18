const fs = require('fs').promises;
const path = require('path');
const { LEDGER_COLUMNS } = require('./processor');

class ReportGenerator {
  constructor(processor) {
    this.processor = processor;
  }

  async generate(reportPath) {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    
    const content = this.generateContent();
    await fs.writeFile(reportPath, content, 'utf-8');
  }

  generateContent() {
    const { stats, records, options } = this.processor;
    
    return `# 农资门店农资实名台账 - 数据处理报告

## 一、处理概览

| 指标 | 数量 | 说明 |
|------|------|------|
| 原始记录数 | ${stats.total} |  |
| 处理后记录数 | ${records.length} |  |
| 合并重复数 | ${stats.duplicates} | 反复修改同一条记录的次数 |
| 身份证尾号缺失 | ${stats.idCardMissing} | 需要补全的记录 |
| 退货记录 | ${stats.returns} | 退货或数量为负的记录 |

---

## 二、关键业务列说明

输出文件保留以下关键业务列（按稳定顺序）：

${LEDGER_COLUMNS.slice(0, -3).map((col, i) => `${i + 1}. **${col}**`).join('\n')}

附加列（便于追溯）：
- **_源文件**：记录来源文件名
- **_源行号**：记录在源文件中的行号
- **_修改次数**：该记录被修改的次数

---

## 三、问题记录详情

### 3.1 身份证尾号缺失记录

${this.generateIdCardSection()}

### 3.2 退货记录

${this.generateReturnsSection()}

### 3.3 被多次修改的记录

${this.generateModifiedSection()}

---

## 四、稳定排序说明

输出结果按以下优先级稳定排序：
1. **购买日期**（升序）
2. **购买人姓名**（拼音升序）
3. **农资名称**（拼音升序）

此排序确保两次运行结果可直接使用 \`diff\` 命令比较差异。

---

## 五、可复跑说明

| 功能模块 | 源文件 | 行号 |
|----------|--------|------|
| 核心处理逻辑 | [processor.js](file:///Users/mac/pro/solo/workspaces/xy11123/src/processor.js) | 83 |
| 记录合并逻辑 | [processor.js](file:///Users/mac/pro/solo/workspaces/xy11123/src/processor.js) | 136 |
| 问题检测逻辑 | [processor.js](file:///Users/mac/pro/solo/workspaces/xy11123/src/processor.js) | 160 |
| 稳定排序逻辑 | [processor.js](file:///Users/mac/pro/solo/workspaces/xy11123/src/processor.js) | 178 |
| 报告生成逻辑 | [report.js](file:///Users/mac/pro/solo/workspaces/xy11123/src/report.js) | 7 |
| CLI 入口 | [index.js](file:///Users/mac/pro/solo/workspaces/xy11123/src/index.js) | 1 |

---

## 六、使用建议

1. **简洁模式**（默认）：只显示关键统计信息
2. **详细模式**（\`-v\`）：显示每条记录的处理过程
3. **保留所有记录**（\`-k\`）：不合并重复记录，保留原始数据

### 命令示例：
\`\`\`bash
# 简洁模式
nongzi-ledger data/sample.csv

# 详细模式
nongzi-ledger data/sample.csv -v

# 保留所有记录
nongzi-ledger data/sample.csv -k

# 比较两次运行差异
diff output/ledger-cleaned.csv output/ledger-cleaned-old.csv
\`\`\`
`;
  }

  generateIdCardSection() {
    const records = this.processor.records.filter(r => r.hasIdCardTailMissing());
    
    if (records.length === 0) {
      return '无身份证尾号缺失记录。';
    }

    return `共 **${records.length}** 条记录存在身份证尾号缺失：

| 购买人姓名 | 身份证号 | 农资名称 | 购买日期 | 源文件 | 源行号 |
|------------|----------|----------|----------|--------|--------|
${records.map(r => `| ${r.data['购买人姓名']} | ${r.data['身份证号']} | ${r.data['农资名称']} | ${r.data['购买日期']} | ${r.sourceFile} | ${r.sourceLine} |`).join('\n')}
`;
  }

  generateReturnsSection() {
    const records = this.processor.records.filter(r => r.isReturnRecord());
    
    if (records.length === 0) {
      return '无退货记录。';
    }

    return `共 **${records.length}** 条退货记录：

| 购买人姓名 | 农资名称 | 数量 | 备注 | 源文件 | 源行号 |
|------------|----------|------|------|--------|--------|
${records.map(r => `| ${r.data['购买人姓名']} | ${r.data['农资名称']} | ${r.data['数量']} | ${r.data['备注'] || '-'} | ${r.sourceFile} | ${r.sourceLine} |`).join('\n')}
`;
  }

  generateModifiedSection() {
    const records = this.processor.records.filter(r => r.modifyCount > 1);
    
    if (records.length === 0) {
      return '无多次修改记录。';
    }

    return `共 **${records.length}** 条记录被多次修改（反复修改同一条记录）：

| 购买人姓名 | 农资名称 | 购买日期 | 修改次数 | 最终源文件 | 最终源行号 |
|------------|----------|----------|----------|------------|------------|
${records.map(r => `| ${r.data['购买人姓名']} | ${r.data['农资名称']} | ${r.data['购买日期']} | ${r.modifyCount} | ${r.sourceFile} | ${r.sourceLine} |`).join('\n')}

### 修改历史（每条记录的修改轨迹）：

${records.map(r => `
#### ${r.data['购买人姓名']} - ${r.data['农资名称']} (${r.data['购买日期']})

${r.modifyHistory.map((h, i) => `${i + 1}. 第${i + 1}次修改: [${h.sourceFile}:${h.sourceLine}] - 数量: ${h.data['数量']}, 金额: ${h.data['金额']}`).join('\n')}
`).join('\n')}
`;
  }
}

module.exports = ReportGenerator;