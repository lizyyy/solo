const fs = require('fs');
const path = require('path');
const os = require('os');

const { WorkbookParser } = require('./workbook-parser');
const { DependencyGraph } = require('./dependency-graph');
const { FormulaParser } = require('./formula-parser');
const { JsonReporter } = require('../reporters/json-reporter');
const { MarkdownReporter } = require('../reporters/markdown-reporter');

class SelfTester {
  constructor() {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-dep-test-'));
    this.tests = [];
    this.sampleFile = path.join(__dirname, '..', '..', 'test', 'data', 'financial-model.xlsx');
  }

  async runAll(verbose = false) {
    this.verbose = verbose;
    this.tests = [];

    try {
      await this._testFormulaParser();
      await this._testWithSampleFile();
      await this._testImpactAnalysis();
      await this._testInputCellDetection();
      await this._testWorkbookParserValidation();
      await this._testDependencyPath();
      await this._testReporterOutput();
    } catch (error) {
      this.tests.push({
        name: '自检执行异常',
        passed: false,
        error: error.message,
      });
    }

    const passed = this.tests.filter(t => t.passed).length;
    const failed = this.tests.filter(t => !t.passed).length;

    this._cleanup();

    return {
      tests: this.tests,
      totalTests: this.tests.length,
      passedCount: passed,
      failedCount: failed,
      passed: failed === 0,
    };
  }

  _addTest(name, passed, error = null) {
    this.tests.push({ name, passed, error });
  }

  async _testFormulaParser() {
    const parser = new FormulaParser();

    try {
      const deps1 = parser.parseDependencies('A1+B1', 'Sheet1');
      const hasA1 = deps1.includes('Sheet1!A1');
      const hasB1 = deps1.includes('Sheet1!B1');
      this._addTest('公式解析 - 单表引用', hasA1 && hasB1 && deps1.length === 2,
        !hasA1 ? '缺少A1' : !hasB1 ? '缺少B1' : `数量不符: ${deps1.length}`);
    } catch (e) {
      this._addTest('公式解析 - 单表引用', false, e.message);
    }

    try {
      const deps2 = parser.parseDependencies('Sheet2!A1+Sheet2!B1', 'Sheet1');
      const hasA1 = deps2.includes('Sheet2!A1');
      const hasB1 = deps2.includes('Sheet2!B1');
      this._addTest('公式解析 - 跨表引用', hasA1 && hasB1 && deps2.length === 2,
        !hasA1 ? '缺少Sheet2!A1' : !hasB1 ? '缺少Sheet2!B1' : `数量不符: ${deps2.length}`);
    } catch (e) {
      this._addTest('公式解析 - 跨表引用', false, e.message);
    }

    try {
      const deps3 = parser.parseDependencies('SUM(A1:A3)', 'Sheet1');
      const expected = ['Sheet1!A1', 'Sheet1!A2', 'Sheet1!A3'];
      const allFound = expected.every(d => deps3.includes(d));
      this._addTest('公式解析 - 区域展开', allFound && deps3.length === 3,
        `期望: ${expected.join(', ')}, 实际: ${deps3.join(', ')}`);
    } catch (e) {
      this._addTest('公式解析 - 区域展开', false, e.message);
    }

    try {
      const deps4 = parser.parseDependencies('SUM($A$1:$B$2)', 'Sheet1');
      const hasNoDollar = !deps4.some(d => d.includes('$'));
      this._addTest('公式解析 - 绝对引用转换', hasNoDollar && deps4.length === 4,
        `存在$符号或数量不对: ${deps4.join(', ')}`);
    } catch (e) {
      this._addTest('公式解析 - 绝对引用转换', false, e.message);
    }

    try {
      const deps5 = parser.parseDependencies('假设条件!B2+收入!C4', '利润表');
      const has1 = deps5.includes('假设条件!B2');
      const has2 = deps5.includes('收入!C4');
      this._addTest('公式解析 - 中文工作表名', has1 && has2,
        `期望包含假设条件!B2和收入!C4，实际: ${deps5.join(', ')}`);
    } catch (e) {
      this._addTest('公式解析 - 中文工作表名', false, e.message);
    }

    try {
      const namedRanges = [
        { name: 'Revenue_Input', reference: 'Sheet1!B1:B3', sheetName: 'Sheet1' },
        { name: 'GrowthRate', reference: 'Sheet1!B2', sheetName: 'Sheet1' },
      ];
      const deps6 = parser.parseDependencies('SUM(Revenue_Input)+GrowthRate', 'Sheet2', namedRanges);
      const hasB1 = deps6.includes('Sheet1!B1');
      const hasB2 = deps6.includes('Sheet1!B2');
      const hasB3 = deps6.includes('Sheet1!B3');
      this._addTest('公式解析 - 命名区域', hasB1 && hasB2 && hasB3 && deps6.length === 3,
        `期望包含Sheet1!B1,B2,B3共3个依赖，实际: ${deps6.join(', ')}`);
    } catch (e) {
      this._addTest('公式解析 - 命名区域', false, e.message);
    }
  }

  async _testWithSampleFile() {
    try {
      const parser = new WorkbookParser(this.sampleFile);
      const workbook = parser.parse();
      const graph = new DependencyGraph();
      const result = graph.build(workbook);

      this._addTest('样例文件解析 - 工作表数量', workbook.sheets.length === 4,
        `期望4个工作表，实际: ${workbook.sheets.length}`);

      const totalFormulas = workbook.sheets.reduce((sum, s) => sum + s.formulaCount, 0);
      this._addTest('样例文件解析 - 公式数量', totalFormulas > 0,
        `期望至少1个公式，实际: ${totalFormulas}`);

      this._addTest('依赖图构建 - 节点数量', result.nodeCount > 0,
        `期望至少1个节点，实际: ${result.nodeCount}`);

      this._addTest('依赖图构建 - 边数量', result.edgeCount > 0,
        `期望至少1条边，实际: ${result.edgeCount}`);

      this._addTest('依赖图构建 - 无循环引用', !result.hasCircularReferences,
        `期望无循环引用，实际: ${result.circularReferences.length}个`);

      const crossSheetEdges = result.edges.filter(e => {
        const fromSheet = e.from.split('!')[0];
        const toSheet = e.to.split('!')[0];
        return fromSheet !== toSheet;
      });
      this._addTest('依赖图构建 - 跨表引用', crossSheetEdges.length > 0,
        `期望至少1个跨表引用，实际: ${crossSheetEdges.length}`);
    } catch (e) {
      this._addTest('样例文件解析', false, e.message);
    }
  }

  async _testImpactAnalysis() {
    try {
      const parser = new WorkbookParser(this.sampleFile);
      const workbook = parser.parse();
      const graph = new DependencyGraph();
      graph.build(workbook);

      const impact = graph.getImpactPath('假设条件!B2');
      this._addTest('影响分析 - 目标单元格包含',
        impact.impactedCells.includes('假设条件!B2'),
        '影响列表应包含目标单元格');

      this._addTest('影响分析 - 跨表影响',
        impact.impactedSheets.length > 1,
        `期望影响多个工作表，实际: ${impact.impactedSheets.length}`);

      this._addTest('影响分析 - 影响数量正确',
        impact.totalImpacted === impact.impactedCells.length - 1,
        `影响数量不匹配: totalImpacted=${impact.totalImpacted}, cells-1=${impact.impactedCells.length - 1}`);
    } catch (e) {
      this._addTest('影响分析', false, e.message);
    }
  }

  async _testInputCellDetection() {
    try {
      const parser = new WorkbookParser(this.sampleFile);
      const workbook = parser.parse();
      const graph = new DependencyGraph();
      graph.build(workbook);

      const inputs = graph.getInputCells();
      this._addTest('输入项检测 - 返回数组', Array.isArray(inputs), '应返回数组');

      if (inputs.length > 0) {
        const firstInput = inputs[0];
        this._addTest('输入项检测 - 有依赖计数',
          firstInput.dependentCount !== undefined,
          '输入项应有dependentCount属性');

        this._addTest('输入项检测 - 输入项无公式',
          !graph.getNode(firstInput.address)?.hasFormula,
          '输入项不应是公式');
      }
    } catch (e) {
      this._addTest('输入项检测', false, e.message);
    }
  }

  async _testWorkbookParserValidation() {
    try {
      const parser = new WorkbookParser('nonexistent.xlsx');
      let threw = false;
      try {
        parser.validate();
      } catch (e) {
        threw = true;
      }
      this._addTest('文件校验 - 不存在文件', threw, '应该抛出文件不存在错误');
    } catch (e) {
      this._addTest('文件校验 - 不存在文件', false, e.message);
    }

    try {
      const badPath = path.join(this.tempDir, 'test.txt');
      fs.writeFileSync(badPath, 'not an excel file');
      const parser = new WorkbookParser(badPath);
      let threw = false;
      try {
        parser.validate();
      } catch (e) {
        threw = true;
      }
      this._addTest('文件校验 - 格式错误', threw, '应该抛出格式错误');
    } catch (e) {
      this._addTest('文件校验 - 格式错误', false, e.message);
    }
  }

  async _testDependencyPath() {
    try {
      const parser = new WorkbookParser(this.sampleFile);
      const workbook = parser.parse();
      const graph = new DependencyGraph();
      graph.build(workbook);

      const deps = graph.getDependencyPath('汇总!B5');
      this._addTest('依赖链分析 - 目标单元格包含',
        deps.dependencyCells.includes('汇总!B5'),
        '依赖列表应包含目标单元格');

      this._addTest('依赖链分析 - 数量正确',
        deps.totalDependencies === deps.dependencyCells.length - 1,
        `依赖数量不匹配: totalDependencies=${deps.totalDependencies}, cells-1=${deps.dependencyCells.length - 1}`);
    } catch (e) {
      this._addTest('依赖链分析', false, e.message);
    }
  }

  async _testReporterOutput() {
    try {
      const parser = new WorkbookParser(this.sampleFile);
      const workbook = parser.parse();
      const graph = new DependencyGraph();
      const graphData = graph.build(workbook);

      const result = {
        workbook,
        graph: graphData,
        graphInstance: graph,
        analyzedAt: new Date().toISOString(),
      };

      const jsonPath = path.join(this.tempDir, 'report.json');
      const jsonReporter = new JsonReporter();
      jsonReporter.generate(result, jsonPath);
      this._addTest('报告生成 - JSON文件存在', fs.existsSync(jsonPath), 'JSON报告文件应存在');

      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      this._addTest('报告生成 - JSON有效', jsonContent !== null, 'JSON内容应有效');

      const mdPath = path.join(this.tempDir, 'report.md');
      const mdReporter = new MarkdownReporter();
      mdReporter.generate(result, mdPath);
      this._addTest('报告生成 - Markdown文件存在', fs.existsSync(mdPath), 'Markdown报告文件应存在');

      const mdContent = fs.readFileSync(mdPath, 'utf-8');
      this._addTest('报告生成 - Markdown有内容', mdContent.length > 0, 'Markdown内容不应为空');
    } catch (e) {
      this._addTest('报告生成', false, e.message);
    }
  }

  _cleanup() {
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch (e) {
    }
  }
}

module.exports = { SelfTester };
