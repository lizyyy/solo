import { parseImports, resolveImportPath } from './imports.js';
import { findPackageForFilePath } from './packages.js';

export async function buildDependencyGraph(files, packages) {
  const nodes = new Map();
  const edges = [];

  for (const file of files) {
    const fileNode = {
      id: file.path,
      type: 'file',
      path: file.path,
      relativePath: file.relativePath,
      package: file.package,
      imports: [],
    };
    nodes.set(file.path, fileNode);

    const imports = await parseImports(file.path);
    for (const imp of imports) {
      const resolved = resolveImportPath(imp.path, file.path, packages);
      
      const importInfo = {
        ...imp,
        resolved,
      };
      fileNode.imports.push(importInfo);

      if (resolved.type === 'internal' && resolved.package) {
        const targetPackage = resolved.package;
        const sourcePackage = findPackageForFilePath(file.path, packages);

        if (sourcePackage && sourcePackage.name !== targetPackage.name) {
          edges.push({
            from: sourcePackage.name,
            to: targetPackage.name,
            file: file.path,
            relativeFile: file.relativePath,
            line: imp.line,
            column: imp.column,
            importPath: imp.path,
            source: imp.source,
          });
        }
      }
    }
  }

  return {
    nodes: Object.fromEntries(nodes),
    edges,
    packages: buildPackageDependencyGraph(edges, packages),
  };
}

function buildPackageDependencyGraph(edges, packages) {
  const packageEdges = new Map();
  const packageNames = packages.map(p => p.name);

  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    if (!packageEdges.has(key)) {
      packageEdges.set(key, {
        from: edge.from,
        to: edge.to,
        count: 0,
        examples: [],
      });
    }
    const pkgEdge = packageEdges.get(key);
    pkgEdge.count++;
    if (pkgEdge.examples.length < 3) {
      pkgEdge.examples.push({
        file: edge.relativeFile,
        line: edge.line,
        importPath: edge.importPath,
      });
    }
  }

  return {
    nodes: packageNames,
    edges: Array.from(packageEdges.values()),
  };
}

export function detectCycles(packageGraph) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  const path = [];

  const adjacencyList = new Map();
  for (const node of packageGraph.nodes) {
    adjacencyList.set(node, []);
  }
  for (const edge of packageGraph.edges) {
    adjacencyList.get(edge.from).push(edge.to);
  }

  function dfs(node) {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart);
        cycle.push(node);
        cycles.push(cycle);
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of adjacencyList.get(node) || []) {
      dfs(neighbor);
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const node of packageGraph.nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}
