const fs = require('fs');
const path = require('path');

class JsonReporter {
  generate(result, outputPath, options = {}) {
    const { workbook, graph, analyzedAt } = result;

    const report = {
      metadata: {
        version: '1.0.0',
        generatedAt: analyzedAt,
        sourceFile: workbook.filePath,
        options: options,
      },
      workbook: {
        filePath: workbook.filePath,
        sheetCount: workbook.sheets.length,
        sheets: workbook.sheets.map(sheet => ({
          name: sheet.name,
          index: sheet.index,
          isHidden: sheet.isHidden,
          isVeryHidden: sheet.isVeryHidden,
          cellCount: sheet.cellCount,
          formulaCount: sheet.formulaCount,
        })),
        namedRanges: workbook.namedRanges,
        externalLinks: workbook.externalLinks,
      },
      dependencyGraph: {
        nodeCount: graph.nodeCount,
        edgeCount: graph.edgeCount,
        hasCircularReferences: graph.hasCircularReferences,
        circularReferences: graph.circularReferences,
        nodes: this._summarizeNodes(graph.nodes),
        edges: this._summarizeEdges(graph.edges),
      },
      statistics: this._generateStatistics(result),
    };

    this._writeFile(outputPath, report);
    return outputPath;
  }

  generateImpact(impact, result, outputPath) {
    const report = {
      metadata: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        sourceFile: result.workbook.filePath,
        type: 'impact-analysis',
      },
      targetCell: {
        address: impact.startCell,
        node: result.graphInstance.getNode(impact.startCell),
      },
      impact: {
        totalImpactedCells: impact.totalImpacted,
        impactedCells: impact.impactedCells,
        impactedSheets: impact.impactedSheets.map(sheet => ({
          sheetName: sheet.sheetName,
          cellCount: sheet.count,
          cells: sheet.cells,
        })),
      },
    };

    this._writeFile(outputPath, report);
    return outputPath;
  }

  _summarizeNodes(nodes) {
    return nodes.map(node => ({
      address: node.address,
      sheetName: node.sheetName,
      cell: node.cell,
      hasFormula: node.hasFormula,
      dependencyCount: node.dependencies.length,
      dependentCount: node.dependents.length,
    }));
  }

  _summarizeEdges(edges) {
    return edges.map(edge => ({
      from: edge.from,
      to: edge.to,
    }));
  }

  _generateStatistics(result) {
    const { workbook, graph, graphInstance } = result;

    const formulaCells = graph.nodes.filter(n => n.hasFormula).length;
    const inputCells = graph.nodes.filter(n => !n.hasFormula && n.dependents.length > 0).length;

    const sheetStats = {};
    workbook.sheets.forEach(sheet => {
      const sheetNodes = graph.nodes.filter(n => n.sheetName === sheet.name);
      const sheetFormulas = sheetNodes.filter(n => n.hasFormula).length;
      const sheetDependencies = sheetNodes.reduce((sum, n) => sum + n.dependencies.length, 0);
      const sheetDependents = sheetNodes.reduce((sum, n) => sum + n.dependents.length, 0);

      sheetStats[sheet.name] = {
        cells: sheetNodes.length,
        formulas: sheetFormulas,
        totalDependencies: sheetDependencies,
        totalDependents: sheetDependents,
        isHidden: sheet.isHidden,
      };
    });

    const crossSheetEdges = graph.edges.filter(edge => {
      const fromSheet = edge.from.split('!')[0];
      const toSheet = edge.to.split('!')[0];
      return fromSheet !== toSheet;
    });

    return {
      totalCells: graph.nodeCount,
      formulaCells,
      inputCells,
      averageDependenciesPerFormula: formulaCells > 0
        ? (graph.edgeCount / formulaCells).toFixed(2)
        : 0,
      crossSheetReferences: crossSheetEdges.length,
      sheetStats,
      topDependents: graphInstance.getTopDependents(10),
      topDependencies: graphInstance.getTopDependencies(10),
    };
  }

  _writeFile(outputPath, data) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

module.exports = { JsonReporter };
