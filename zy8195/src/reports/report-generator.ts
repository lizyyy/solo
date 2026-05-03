import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import {
  ValidationIssue,
  RotationPlanItem,
  TrustGraph,
  TrustGraphNode,
  TrustGraphEdge,
  CertInventoryItem,
  TrustBundles,
  ServiceGraph,
  ValidationSeverity,
} from '../types';

export class ReportGenerator {
  async generateIssuesCsv(
    issues: ValidationIssue[],
    outputPath: string
  ): Promise<void> {
    const rows = issues.map((issue) => ({
      id: issue.id,
      service_name: issue.serviceName,
      type: issue.type,
      severity: issue.severity,
      description: issue.description,
      recommendation: issue.recommendation,
      metadata: JSON.stringify(issue.metadata, null, 2),
    }));

    const csvContent = stringify(rows, {
      header: true,
      columns: [
        'id',
        'service_name',
        'type',
        'severity',
        'description',
        'recommendation',
        'metadata',
      ],
    });

    await this.ensureDirectory(outputPath);
    await fs.promises.writeFile(outputPath, csvContent, 'utf-8');
  }

  async generateRotationPlanMarkdown(
    issues: ValidationIssue[],
    inventory: CertInventoryItem[],
    serviceGraph: ServiceGraph,
    outputPath: string
  ): Promise<void> {
    const planItems = this.buildRotationPlan(issues, inventory, serviceGraph);
    
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const highCount = issues.filter((i) => i.severity === 'high').length;
    const mediumCount = issues.filter((i) => i.severity === 'medium').length;
    const lowCount = issues.filter((i) => i.severity === 'low').length;

    const immediateItems = planItems.filter((i) => i.priority === 'immediate');
    const nextItems = planItems.filter((i) => i.priority === 'next');
    const laterItems = planItems.filter((i) => i.priority === 'later');

    const markdown = `# mTLS 证书轮换风险预检报告

## 执行摘要

生成时间: ${new Date().toISOString()}

### 问题统计

| 严重级别 | 数量 |
|----------|------|
| Critical (致命) | ${criticalCount} |
| High (高) | ${highCount} |
| Medium (中) | ${mediumCount} |
| Low (低) | ${lowCount} |
| **总计** | **${issues.length}** |

---

## 轮换计划

### 优先级: Immediate (立即处理)

${immediateItems.length > 0 
  ? immediateItems.map((item) => this.formatRotationItem(item)).join('\\n\\n')
  : '无需要立即处理的服务'}

### 优先级: Next (下一批次)

${nextItems.length > 0 
  ? nextItems.map((item) => this.formatRotationItem(item)).join('\\n\\n')
  : '无下一批次服务'}

### 优先级: Later (稍后处理)

${laterItems.length > 0 
  ? laterItems.map((item) => this.formatRotationItem(item)).join('\\n\\n')
  : '无稍后处理的服务'}

---

## 问题详情

### Critical (致命) 问题

${this.formatIssuesBySeverity(issues, 'critical')}

### High (高) 问题

${this.formatIssuesBySeverity(issues, 'high')}

### Medium (中) 问题

${this.formatIssuesBySeverity(issues, 'medium')}

### Low (低) 问题

${this.formatIssuesBySeverity(issues, 'low')}

---

## 附录

### 服务清单

| 服务名 | 轮换批次 | 证书文件 |
|--------|----------|----------|
${inventory.map((item) => `| ${item.serviceName} | ${item.rotationBatch} | ${path.basename(item.certFilePath)} |`).join('\\n')}

### 服务依赖图

基于服务调用关系，建议轮换顺序:

${this.formatDependencyOrder(serviceGraph)}
`;

    await this.ensureDirectory(outputPath);
    await fs.promises.writeFile(outputPath, markdown, 'utf-8');
  }

  async generateTrustGraphHtml(
    trustGraph: TrustGraph,
    outputPath: string
  ): Promise<void> {
    const html = this.createInteractiveGraphHtml(trustGraph);
    
    await this.ensureDirectory(outputPath);
    await fs.promises.writeFile(outputPath, html, 'utf-8');
  }

  private buildRotationPlan(
    issues: ValidationIssue[],
    inventory: CertInventoryItem[],
    serviceGraph: ServiceGraph
  ): RotationPlanItem[] {
    const plan: RotationPlanItem[] = [];

    for (const service of inventory) {
      const serviceIssues = issues.filter((i) => i.serviceName === service.serviceName);
      
      const hasCritical = serviceIssues.some((i) => i.severity === 'critical');
      const hasHigh = serviceIssues.some((i) => i.severity === 'high');
      
      let priority: 'immediate' | 'next' | 'later' = 'later';
      if (hasCritical) {
        priority = 'immediate';
      } else if (hasHigh) {
        priority = 'next';
      }

      const dependencies = this.findDependencies(service.serviceName, serviceGraph);
      const recommendedAction = this.generateRecommendedAction(serviceIssues);

      plan.push({
        serviceName: service.serviceName,
        batch: service.rotationBatch,
        issues: serviceIssues.map((i) => i.type),
        priority,
        dependencies,
        recommendedAction,
      });
    }

    return plan.sort((a, b) => {
      const priorityOrder: Record<string, number> = { immediate: 0, next: 1, later: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private findDependencies(serviceName: string, serviceGraph: ServiceGraph): string[] {
    const dependencies: string[] = [];
    
    for (const rel of serviceGraph.relationships) {
      if (rel.client === serviceName) {
        dependencies.push(rel.server);
      }
    }
    
    return [...new Set(dependencies)];
  }

  private generateRecommendedAction(issues: ValidationIssue[]): string {
    if (issues.length === 0) {
      return '证书配置正确，无需立即轮换';
    }

    const actions: string[] = [];
    
    const hasExpired = issues.some((i) => i.type === 'expired');
    const hasMissingIntermediate = issues.some((i) => i.type === 'missing_intermediate');
    const hasWeakAlgorithm = issues.some((i) => i.type === 'weak_algorithm');
    const hasSANMismatch = issues.some((i) => i.type === 'san_mismatch');
    const hasTrustMismatch = issues.some((i) => i.type === 'trust_root_mismatch');
    const hasExpiringSoon = issues.some((i) => i.type === 'expiring_soon');

    if (hasExpired) {
      actions.push('立即轮换过期证书');
    }
    if (hasMissingIntermediate) {
      actions.push('安装缺失的中间证书');
    }
    if (hasWeakAlgorithm) {
      actions.push('使用强算法重新签发证书 (SHA256+ RSA 2048+ 或 ECDSA)');
    }
    if (hasSANMismatch) {
      actions.push('重新签发包含正确 SAN 的证书');
    }
    if (hasTrustMismatch) {
      actions.push('确保证书链接到正确的信任根');
    }
    if (hasExpiringSoon && !hasExpired) {
      actions.push('在近期维护窗口中安排轮换');
    }

    return actions.length > 0 ? actions.join('; ') : '检查配置并轮换证书';
  }

  private formatRotationItem(item: RotationPlanItem): string {
    const issuesList = item.issues.length > 0 
      ? `\\n  - 问题类型: ${item.issues.join(', ')}`
      : '';
    const depsList = item.dependencies.length > 0 
      ? `\\n  - 依赖服务: ${item.dependencies.join(', ')}`
      : '';

    return `**${item.serviceName}**
  - 批次: ${item.batch}
  - 优先级: ${item.priority}${issuesList}${depsList}
  - 建议操作: ${item.recommendedAction}`;
  }

  private formatIssuesBySeverity(
    issues: ValidationIssue[],
    severity: ValidationSeverity
  ): string {
    const filtered = issues.filter((i) => i.severity === severity);
    
    if (filtered.length === 0) {
      return '无此级别的问题';
    }

    return filtered
      .map(
        (issue) => `
#### ${issue.serviceName} - ${issue.type}

**描述**: ${issue.description}

**建议**: ${issue.recommendation}
`
      )
      .join('\\n---\\n');
  }

  private formatDependencyOrder(serviceGraph: ServiceGraph): string {
    if (serviceGraph.relationships.length === 0) {
      return '无服务依赖关系定义';
    }

    const lines: string[] = [];
    
    for (const rel of serviceGraph.relationships) {
      const mtlsIndicator = rel.requiresMtls ? ' (需要 mTLS)' : '';
      lines.push(`- ${rel.client} → ${rel.server} (${rel.protocol})${mtlsIndicator}`);
    }

    return lines.join('\\n');
  }

  private createInteractiveGraphHtml(trustGraph: TrustGraph): string {
    const nodesJson = JSON.stringify(trustGraph.nodes, null, 2);
    const edgesJson = JSON.stringify(trustGraph.edges, null, 2);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mTLS 信任关系图</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
    }
    header {
      background: #16213e;
      padding: 1rem 2rem;
      border-bottom: 1px solid #0f3460;
    }
    h1 {
      font-size: 1.5rem;
      color: #e94560;
    }
    .controls {
      padding: 1rem 2rem;
      background: #0f3460;
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #533483;
      background: #16213e;
      color: #eee;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      background: #e94560;
      border-color: #e94560;
    }
    .legend {
      display: flex;
      gap: 1rem;
      margin-left: auto;
      align-items: center;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .legend-circle {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .circle-service { background: #4ecca3; }
    .circle-root { background: #e94560; }
    .circle-intermediate { background: #ffd460; }
    #graph-container {
      position: relative;
      width: 100%;
      height: calc(100vh - 200px);
    }
    .node-label {
      font-size: 12px;
      pointer-events: none;
      text-anchor: middle;
      fill: #eee;
      font-weight: 500;
    }
    .tooltip {
      position: absolute;
      background: #16213e;
      border: 1px solid #533483;
      padding: 0.75rem;
      border-radius: 8px;
      pointer-events: none;
      z-index: 1000;
      max-width: 300px;
      font-size: 0.875rem;
      display: none;
    }
    .tooltip h4 {
      color: #e94560;
      margin-bottom: 0.5rem;
    }
    .tooltip p {
      margin: 0.25rem 0;
    }
    .zoom-controls {
      position: absolute;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      z-index: 100;
    }
    .zoom-btn {
      width: 40px;
      height: 40px;
      border: 1px solid #533483;
      background: #16213e;
      color: #eee;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .zoom-btn:hover {
      background: #e94560;
      border-color: #e94560;
    }
  </style>
</head>
<body>
  <header>
    <h1>mTLS 信任关系可视化</h1>
  </header>
  <div class="controls">
    <button class="filter-btn active" data-filter="all">全部</button>
    <button class="filter-btn" data-filter="service">仅服务</button>
    <button class="filter-btn" data-filter="root">仅根证书</button>
    <button class="filter-btn" data-filter="intermediate">仅中间证书</button>
    <div class="legend">
      <div class="legend-item">
        <div class="legend-circle circle-service"></div>
        <span>服务</span>
      </div>
      <div class="legend-item">
        <div class="legend-circle circle-root"></div>
        <span>根证书</span>
      </div>
      <div class="legend-item">
        <div class="legend-circle circle-intermediate"></div>
        <span>中间证书</span>
      </div>
    </div>
  </div>
  <div id="graph-container">
    <svg id="graph-svg" width="100%" height="100%"></svg>
    <div class="tooltip" id="tooltip"></div>
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoom-in">+</button>
      <button class="zoom-btn" id="zoom-out">−</button>
      <button class="zoom-btn" id="zoom-reset">⟲</button>
    </div>
  </div>

  <script>
    const nodes = ${nodesJson};
    const edges = ${edgesJson};
    
    const svg = document.getElementById('graph-svg');
    const container = document.getElementById('graph-container');
    const tooltip = document.getElementById('tooltip');
    
    let currentZoom = 1;
    let currentFilter = 'all';
    let svgGroup = null;
    
    const nodeColors = {
      service: '#4ecca3',
      root: '#e94560',
      intermediate: '#ffd460'
    };
    
    const edgeColors = {
      trusts: '#533483',
      uses: '#4ecca3',
      signs: '#e94560'
    };

    function initGraph() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      svg.innerHTML = '';
      svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      svgGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
      svg.appendChild(svgGroup);
      
      const positions = calculatePositions(width, height);
      
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const arrowMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      arrowMarker.setAttribute('id', 'arrowhead');
      arrowMarker.setAttribute('viewBox', '0 0 10 10');
      arrowMarker.setAttribute('refX', '10');
      arrowMarker.setAttribute('refY', '5');
      arrowMarker.setAttribute('markerWidth', '6');
      arrowMarker.setAttribute('markerHeight', '6');
      arrowMarker.setAttribute('orient', 'auto');
      
      const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      arrowPath.setAttribute('fill', '#533483');
      arrowMarker.appendChild(arrowPath);
      defs.appendChild(arrowMarker);
      svgGroup.appendChild(defs);
      
      const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode && isVisible(edge, sourceNode, targetNode)) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', positions[edge.source].x);
          line.setAttribute('y1', positions[edge.source].y);
          line.setAttribute('x2', positions[edge.target].x);
          line.setAttribute('y2', positions[edge.target].y);
          line.setAttribute('stroke', edgeColors[edge.type] || '#533483');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('marker-end', 'url(#arrowhead)');
          line.setAttribute('opacity', '0.6');
          line.dataset.edgeId = edge.id;
          edgeGroup.appendChild(line);
        }
      });
      
      nodes.forEach(node => {
        if (isNodeVisible(node)) {
          const pos = positions[node.id];
          
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', pos.x);
          circle.setAttribute('cy', pos.y);
          circle.setAttribute('r', node.type === 'service' ? 25 : 30);
          circle.setAttribute('fill', nodeColors[node.type]);
          circle.setAttribute('stroke', '#fff');
          circle.setAttribute('stroke-width', '2');
          circle.style.cursor = 'pointer';
          circle.dataset.nodeId = node.id;
          
          circle.addEventListener('mouseenter', (e) => showTooltip(e, node));
          circle.addEventListener('mouseleave', hideTooltip);
          
          nodeGroup.appendChild(circle);
          
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', pos.x);
          text.setAttribute('y', pos.y + 45);
          text.setAttribute('class', 'node-label');
          text.textContent = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label;
          nodeGroup.appendChild(text);
        }
      });
      
      svgGroup.appendChild(edgeGroup);
      svgGroup.appendChild(nodeGroup);
    }

    function calculatePositions(width, height) {
      const positions = {};
      const centerX = width / 2;
      const centerY = height / 2;
      
      const services = nodes.filter(n => n.type === 'service');
      const roots = nodes.filter(n => n.type === 'root');
      const intermediates = nodes.filter(n => n.type === 'intermediate');
      
      roots.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / Math.max(roots.length, 1) - Math.PI / 2;
        positions[node.id] = {
          x: centerX + Math.cos(angle) * (centerY * 0.7),
          y: centerY + Math.sin(angle) * (centerY * 0.7)
        };
      });
      
      intermediates.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / Math.max(intermediates.length, 1);
        positions[node.id] = {
          x: centerX + Math.cos(angle) * (centerY * 0.45),
          y: centerY + Math.sin(angle) * (centerY * 0.45)
        };
      });
      
      services.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / Math.max(services.length, 1);
        positions[node.id] = {
          x: centerX + Math.cos(angle) * (centerY * 0.25),
          y: centerY + Math.sin(angle) * (centerY * 0.25)
        };
      });
      
      return positions;
    }

    function isNodeVisible(node) {
      if (currentFilter === 'all') return true;
      return node.type === currentFilter;
    }

    function isVisible(edge, sourceNode, targetNode) {
      if (currentFilter === 'all') return true;
      return sourceNode.type === currentFilter || targetNode.type === currentFilter;
    }

    function showTooltip(e, node) {
      tooltip.style.display = 'block';
      tooltip.innerHTML = \`
        <h4>\${node.label}</h4>
        <p><strong>类型:</strong> \${node.type}</p>
        <p><strong>ID:</strong> \${node.id}</p>
        \${Object.keys(node.metadata || {}).length > 0 ? 
          '<p><strong>元数据:</strong></p><pre>' + JSON.stringify(node.metadata, null, 2) + '</pre>' : 
          ''}
      \`;
      
      const rect = svg.getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
      tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
    }

    function hideTooltip() {
      tooltip.style.display = 'none';
    }

    function setZoom(scale) {
      currentZoom = scale;
      const transform = \`translate(\${container.clientWidth * (1 - scale) / 2}, \${container.clientHeight * (1 - scale) / 2}) scale(\${scale})\`;
      svgGroup.setAttribute('transform', transform);
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        initGraph();
      });
    });

    document.getElementById('zoom-in').addEventListener('click', () => {
      setZoom(Math.min(currentZoom + 0.2, 3));
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      setZoom(Math.max(currentZoom - 0.2, 0.3));
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
      setZoom(1);
    });

    window.addEventListener('resize', () => {
      setZoom(1);
      initGraph();
    });

    initGraph();
  </script>
</body>
</html>`;
  }

  private async ensureDirectory(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
  }

  buildTrustGraph(
    inventory: CertInventoryItem[],
    trustBundles: TrustBundles,
    serviceGraph: ServiceGraph,
    allCertificates: Map<string, { subjectCN: string; isCa: boolean }>
  ): TrustGraph {
    const nodes: TrustGraphNode[] = [];
    const edges: TrustGraphEdge[] = [];
    const nodeIds = new Set<string>();

    for (const service of inventory) {
      const serviceId = `service:${service.serviceName}`;
      if (!nodeIds.has(serviceId)) {
        nodes.push({
          id: serviceId,
          label: service.serviceName,
          type: 'service',
          metadata: {
            rotationBatch: service.rotationBatch,
            expectedSANs: service.expectedSANs,
          },
        });
        nodeIds.add(serviceId);
      }
    }

    for (const [bundleName, bundle] of Object.entries(trustBundles)) {
      for (const rootPath of bundle.rootCerts) {
        const rootCert = allCertificates.get(rootPath);
        if (rootCert) {
          const rootId = `root:${rootCert.subjectCN || rootPath}`;
          if (!nodeIds.has(rootId)) {
            nodes.push({
              id: rootId,
              label: rootCert.subjectCN || path.basename(rootPath),
              type: 'root',
              metadata: {
                trustBundle: bundleName,
                isCa: rootCert.isCa,
              },
            });
            nodeIds.add(rootId);
          }

          for (const serviceName of bundle.services) {
            const serviceId = `service:${serviceName}`;
            if (nodeIds.has(serviceId)) {
              edges.push({
                id: `trusts:${serviceName}:${rootCert.subjectCN}`,
                source: serviceId,
                target: rootId,
                type: 'trusts',
                metadata: { trustBundle: bundleName },
              });
            }
          }
        }
      }

      for (const intermediatePath of bundle.intermediateCerts) {
        const intermediateCert = allCertificates.get(intermediatePath);
        if (intermediateCert) {
          const intId = `intermediate:${intermediateCert.subjectCN || intermediatePath}`;
          if (!nodeIds.has(intId)) {
            nodes.push({
              id: intId,
              label: intermediateCert.subjectCN || path.basename(intermediatePath),
              type: 'intermediate',
              metadata: {
                trustBundle: bundleName,
                isCa: intermediateCert.isCa,
              },
            });
            nodeIds.add(intId);
          }

          for (const serviceName of bundle.services) {
            const serviceId = `service:${serviceName}`;
            if (nodeIds.has(serviceId)) {
              edges.push({
                id: `uses:${serviceName}:${intermediateCert.subjectCN}`,
                source: serviceId,
                target: intId,
                type: 'uses',
                metadata: { trustBundle: bundleName },
              });
            }
          }
        }
      }
    }

    for (const rel of serviceGraph.relationships) {
      const clientId = `service:${rel.client}`;
      const serverId = `service:${rel.server}`;
      
      if (nodeIds.has(clientId) && nodeIds.has(serverId)) {
        edges.push({
          id: `calls:${rel.client}:${rel.server}`,
          source: clientId,
          target: serverId,
          type: rel.requiresMtls ? 'uses' : 'trusts',
          metadata: {
            protocol: rel.protocol,
            requiresMtls: rel.requiresMtls,
          },
        });
      }
    }

    return { nodes, edges };
  }
}
