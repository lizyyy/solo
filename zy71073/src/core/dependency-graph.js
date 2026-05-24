const { FormulaParser } = require('./formula-parser');

class DependencyGraph {
  constructor() {
    this.formulaParser = new FormulaParser();
    this.nodes = new Map();
    this.edges = [];
    this.cellMap = new Map();
    this.circularReferences = [];
  }

  build(workbookData) {
    const { sheets } = workbookData;

    sheets.forEach(sheet => {
      sheet.cells.forEach(cell => {
        this.cellMap.set(cell.address, cell);
        this.nodes.set(cell.address, {
          address: cell.address,
          sheetName: cell.sheetName,
          cell: cell.cell,
          hasFormula: !!cell.formula,
          formula: cell.formula,
          value: cell.value,
          dependencies: [],
          dependents: [],
        });
      });
    });

    sheets.forEach(sheet => {
      sheet.formulas.forEach(cell => {
        const dependencies = this.formulaParser.parseDependencies(
          cell.formula,
          sheet.name
        );

        const node = this.nodes.get(cell.address);
        if (node) {
          dependencies.forEach(dep => {
            if (this.nodes.has(dep)) {
              node.dependencies.push(dep);
              this.edges.push({ from: dep, to: cell.address });

              const depNode = this.nodes.get(dep);
              if (depNode) {
                depNode.dependents.push(cell.address);
              }
            }
          });
        }
      });
    });

    this._detectCircularReferences();

    return this.getGraph();
  }

  _detectCircularReferences() {
    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (nodeAddress) => {
      if (recStack.has(nodeAddress)) {
        const cycleStartIndex = path.indexOf(nodeAddress);
        if (cycleStartIndex !== -1) {
          const cycle = path.slice(cycleStartIndex);
          cycle.push(nodeAddress);
          this.circularReferences.push(cycle);
        }
        return;
      }

      if (visited.has(nodeAddress)) {
        return;
      }

      visited.add(nodeAddress);
      recStack.add(nodeAddress);
      path.push(nodeAddress);

      const node = this.nodes.get(nodeAddress);
      if (node) {
        node.dependencies.forEach(dep => {
          dfs(dep);
        });
      }

      path.pop();
      recStack.delete(nodeAddress);
    };

    this.nodes.forEach((_, address) => {
      if (!visited.has(address)) {
        dfs(address);
      }
    });
  }

  getImpactPath(startCell) {
    const visited = new Set();
    const path = [];
    const impact = new Set();

    const traverse = (cellAddress, depth = 0) => {
      if (visited.has(cellAddress)) return;
      visited.add(cellAddress);

      const node = this.nodes.get(cellAddress);
      if (!node) return;

      impact.add(cellAddress);

      node.dependents.forEach(dep => {
        traverse(dep, depth + 1);
      });
    };

    traverse(startCell);

    return {
      startCell,
      impactedCells: Array.from(impact),
      impactedSheets: this._getImpactedSheets(Array.from(impact)),
      totalImpacted: impact.size - 1,
    };
  }

  getDependencyPath(endCell) {
    const visited = new Set();
    const dependencies = new Set();

    const traverse = (cellAddress) => {
      if (visited.has(cellAddress)) return;
      visited.add(cellAddress);

      const node = this.nodes.get(cellAddress);
      if (!node) return;

      dependencies.add(cellAddress);

      node.dependencies.forEach(dep => {
        traverse(dep);
      });
    };

    traverse(endCell);

    return {
      endCell,
      dependencyCells: Array.from(dependencies),
      dependencySheets: this._getImpactedSheets(Array.from(dependencies)),
      totalDependencies: dependencies.size - 1,
    };
  }

  _getImpactedSheets(cells) {
    const sheets = new Map();
    cells.forEach(cell => {
      const sheetName = cell.split('!')[0];
      if (!sheets.has(sheetName)) {
        sheets.set(sheetName, []);
      }
      sheets.get(sheetName).push(cell);
    });

    const result = [];
    sheets.forEach((cells, sheetName) => {
      result.push({ sheetName, cells, count: cells.length });
    });

    return result.sort((a, b) => b.count - a.count);
  }

  getSheetImpact(sheetName) {
    const sheetCells = Array.from(this.nodes.keys()).filter(
      addr => addr.startsWith(`${sheetName}!`)
    );

    const allImpacted = new Set();

    sheetCells.forEach(cell => {
      const impact = this.getImpactPath(cell);
      impact.impactedCells.forEach(c => allImpacted.add(c));
    });

    const crossSheetImpact = Array.from(allImpacted).filter(
      c => !c.startsWith(`${sheetName}!`)
    );

    return {
      sheetName,
      totalCells: sheetCells.length,
      impactedCells: Array.from(allImpacted),
      crossSheetImpact,
      crossSheetImpactCount: crossSheetImpact.length,
      impactedSheets: this._getImpactedSheets(crossSheetImpact),
    };
  }

  getInputCells() {
    const inputCells = [];

    this.nodes.forEach((node, address) => {
      if (!node.hasFormula && node.dependents.length > 0) {
        inputCells.push({
          address,
          sheetName: node.sheetName,
          value: node.value,
          dependentCount: node.dependents.length,
          directDependents: node.dependents.slice(0, 10),
        });
      }
    });

    return inputCells.sort((a, b) => b.dependentCount - a.dependentCount);
  }

  getGraph() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      circularReferences: this.circularReferences,
      hasCircularReferences: this.circularReferences.length > 0,
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
    };
  }

  getFormulaCells() {
    return Array.from(this.nodes.values()).filter(n => n.hasFormula);
  }

  getNode(address) {
    return this.nodes.get(address);
  }

  getTopDependents(limit = 10) {
    return Array.from(this.nodes.values())
      .filter(n => n.dependents.length > 0)
      .sort((a, b) => b.dependents.length - a.dependents.length)
      .slice(0, limit)
      .map(n => ({
        address: n.address,
        sheetName: n.sheetName,
        dependentCount: n.dependents.length,
        hasFormula: n.hasFormula,
      }));
  }

  getTopDependencies(limit = 10) {
    return Array.from(this.nodes.values())
      .filter(n => n.dependencies.length > 0)
      .sort((a, b) => b.dependencies.length - a.dependencies.length)
      .slice(0, limit)
      .map(n => ({
        address: n.address,
        sheetName: n.sheetName,
        dependencyCount: n.dependencies.length,
        formula: n.formula,
      }));
  }
}

module.exports = { DependencyGraph };
