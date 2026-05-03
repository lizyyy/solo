import { 
  Project, 
  Recipe, 
  ShoppingListItem, 
  PrepTask,
  StoredContainer,
  RiskWarning,
  ExportOptions
} from '@shared/types';

export function exportToMarkdown(
  project: Project,
  recipes: Recipe[],
  options: ExportOptions
): string {
  const lines: string[] = [];

  lines.push(`# ${project.name}`);
  lines.push('');
  
  if (project.description) {
    lines.push(project.description);
    lines.push('');
  }

  lines.push(`**备餐日期**: ${project.targetDate}`);
  lines.push(`**创建时间**: ${project.createdDate}`);
  lines.push('');

  lines.push('## 📋 菜谱清单');
  lines.push('');
  
  lines.push('| 菜谱名称 | 目标份数 | 备餐时间 | 烹饪时间 |');
  lines.push('|----------|----------|----------|----------|');
  
  for (const selected of project.selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (recipe) {
      lines.push(`| ${recipe.name} | ${selected.targetServings}份 | ${recipe.prepTimeMinutes}分钟 | ${recipe.cookTimeMinutes}分钟 |`);
    }
  }
  lines.push('');

  if (options.includeShoppingList) {
    lines.push('## 🛒 采购清单');
    lines.push('');
    
    const byCategory = new Map<string, ShoppingListItem[]>();
    for (const item of project.shoppingList) {
      if (!byCategory.has(item.category)) {
        byCategory.set(item.category, []);
      }
      byCategory.get(item.category)!.push(item);
    }

    for (const [category, items] of byCategory) {
      if (items.some(i => i.toPurchase > 0)) {
        lines.push(`### ${category}`);
        lines.push('');
        lines.push('| 食材名称 | 总需量 | 已有量 | 需采购 | 单位 | 备注 |');
        lines.push('|----------|--------|--------|--------|------|------|');
        
        for (const item of items) {
          if (item.toPurchase > 0) {
            lines.push(`| ${item.ingredientName} | ${item.totalQuantity} | ${item.existingQuantity} | ${item.toPurchase} | ${item.unit} | ${item.notes || '-'} |`);
          }
        }
        lines.push('');
      }
    }
  }

  if (options.includePrepSteps) {
    lines.push('## 👨‍🍳 备料步骤');
    lines.push('');

    const sortedTasks = [...project.prepTasks].sort((a, b) => a.stepNumber - b.stepNumber);
    let currentRecipe = '';

    for (const task of sortedTasks) {
      if (task.recipeName !== currentRecipe) {
        currentRecipe = task.recipeName;
        lines.push(`### ${currentRecipe}`);
        lines.push('');
      }

      const statusIcon = task.status === 'completed' ? '✅' : task.status === 'in_progress' ? '🔄' : '⏳';
      lines.push(`${statusIcon} **步骤 ${task.stepNumber}**: ${task.description}`);
      lines.push(`   - 预计耗时: ${task.estimatedMinutes} 分钟`);
      
      if (task.dependencies.length > 0) {
        const depTasks = project.prepTasks.filter(t => task.dependencies.includes(t.id));
        if (depTasks.length > 0) {
          lines.push(`   - 依赖: ${depTasks.map(d => `步骤 ${d.stepNumber}`).join(', ')}`);
        }
      }
      
      if (task.isBatchable) {
        lines.push(`   - 💡 可与其他菜谱的同类步骤合并处理`);
      }
      
      lines.push('');
    }

    if (project.batchGroups.length > 0) {
      lines.push('## 📦 合并处理建议');
      lines.push('');

      for (const group of project.batchGroups) {
        lines.push(`### ${group.name}`);
        lines.push('');
        lines.push(`- **涉及菜谱**: ${group.steps.map(stepId => {
          const task = project.prepTasks.find(t => t.id === stepId);
          return task ? task.recipeName : '';
        }).filter(Boolean).join('、')}`);
        lines.push(`- **涉及食材**: ${group.combinedIngredients.join('、')}`);
        lines.push(`- **预计节省时间**: 合并后约 ${group.estimatedMinutes} 分钟`);
        lines.push('');
      }
    }
  }

  if (options.includeStoragePlan) {
    lines.push('## 🧊 存储计划');
    lines.push('');

    const byStorageType = new Map<string, StoredContainer[]>();
    for (const container of project.storedContainers) {
      const slot = project.storageSlots.find(s => s.id === container.slotId);
      const storageType = slot ? slot.storageType : 'refrigerated';
      const typeName = storageType === 'frozen' ? '冷冻' : '冷藏';
      
      if (!byStorageType.has(typeName)) {
        byStorageType.set(typeName, []);
      }
      byStorageType.get(typeName)!.push(container);
    }

    for (const [storageType, containers] of byStorageType) {
      lines.push(`### ${storageType}`);
      lines.push('');
      lines.push('| 菜谱名称 | 份数 | 存入日期 | 有效期至 | 位置 |');
      lines.push('|----------|------|----------|----------|------|');

      for (const container of containers) {
        const slot = project.storageSlots.find(s => s.id === container.slotId);
        lines.push(`| ${container.recipeName} | ${container.portionCount} | ${container.storedDate} | ${container.expiryDate} | ${slot?.name || '未分配'} |`);
      }
      lines.push('');
    }
  }

  if (options.includeRisks && project.risks.length > 0) {
    lines.push('## ⚠️ 风险提示');
    lines.push('');

    const severityLabels = { high: '🔴 高', medium: '🟡 中', low: '🟢 低' };

    for (const risk of project.risks) {
      lines.push(`### ${severityLabels[risk.severity]}: ${risk.title}`);
      lines.push('');
      lines.push(risk.description);
      lines.push('');
      
      if (risk.suggestions && risk.suggestions.length > 0) {
        lines.push('**建议**:');
        for (const suggestion of risk.suggestions) {
          lines.push(`- ${suggestion}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

export function exportShoppingListToCSV(
  shoppingList: ShoppingListItem[]
): string {
  const headers = ['分类', '食材名称', '总需量', '已有量', '需采购', '单位', '备注'];
  const rows: string[][] = [headers];

  for (const item of shoppingList) {
    rows.push([
      item.category,
      item.ingredientName,
      item.totalQuantity.toString(),
      item.existingQuantity.toString(),
      item.toPurchase.toString(),
      item.unit,
      item.notes || ''
    ]);
  }

  return rows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

export function exportStorageLabelsToHTML(
  project: Project,
  recipes: Recipe[]
): string {
  const containers = project.storedContainers;
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分装标签 - ${project.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .labels-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .label {
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 20px;
      page-break-inside: avoid;
    }
    .label-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
    }
    .recipe-name {
      font-size: 1.2em;
      font-weight: bold;
      color: #333;
    }
    .storage-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .storage-frozen {
      background: #e3f2fd;
      color: #1976d2;
    }
    .storage-refrigerated {
      background: #e8f5e9;
      color: #388e3c;
    }
    .label-body {
      display: grid;
      gap: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      border-bottom: 1px dashed #eee;
    }
    .info-label {
      color: #666;
      font-size: 0.9em;
    }
    .info-value {
      font-weight: 600;
      color: #333;
    }
    .expiry-warning {
      margin-top: 15px;
      padding: 10px;
      background: #fff3e0;
      border-radius: 4px;
      border-left: 4px solid #ff9800;
    }
    .expiry-warning .warning-title {
      font-weight: bold;
      color: #e65100;
      margin-bottom: 5px;
    }
    .reheat-info {
      margin-top: 10px;
      padding: 10px;
      background: #f3e5f5;
      border-radius: 4px;
    }
    .reheat-info .reheat-title {
      font-weight: bold;
      color: #7b1fa2;
      margin-bottom: 5px;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .label {
        border: 1px solid #ccc;
        break-inside: avoid;
      }
      .labels-container {
        gap: 10px;
      }
    }
  </style>
</head>
<body>
  <h1 style="text-align: center; margin-bottom: 30px; color: #333;">${project.name} - 分装标签</h1>
  <div class="labels-container">
    ${containers.map(container => {
      const recipe = recipes.find(r => r.id === container.recipeId);
      const slot = project.storageSlots.find(s => s.id === container.slotId);
      const isFrozen = slot?.storageType === 'frozen';
      
      const expiryDate = new Date(container.expiryDate);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const showWarning = daysUntilExpiry <= 3;
      
      const reheatMethods: Record<string, string> = {
        'microwave': '微波炉',
        'stovetop': '炉灶',
        'oven': '烤箱',
        'none': '无需加热'
      };
      
      return `
      <div class="label">
        <div class="label-header">
          <span class="recipe-name">${container.recipeName}</span>
          <span class="storage-badge ${isFrozen ? 'storage-frozen' : 'storage-refrigerated'}">
            ${isFrozen ? '❄️ 冷冻' : '🌡️ 冷藏'}
          </span>
        </div>
        <div class="label-body">
          <div class="info-row">
            <span class="info-label">份数</span>
            <span class="info-value">${container.portionCount} 份</span>
          </div>
          <div class="info-row">
            <span class="info-label">存入日期</span>
            <span class="info-value">${container.storedDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">有效期至</span>
            <span class="info-value" style="color: ${showWarning ? '#d32f2f' : '#333'}">${container.expiryDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">位置</span>
            <span class="info-value">${slot?.name || '未分配'}</span>
          </div>
        </div>
        ${showWarning ? `
        <div class="expiry-warning">
          <div class="warning-title">⚠️ 临期提醒</div>
          <div>还有 ${daysUntilExpiry} 天过期，请尽快食用</div>
        </div>
        ` : ''}
        ${recipe ? `
        <div class="reheat-info">
          <div class="reheat-title">🔥 复热方式</div>
          <div>${reheatMethods[recipe.storageInstructions.reheatMethod] || '请查看菜谱'}</div>
          ${recipe.storageInstructions.notes ? `<div style="margin-top: 5px; font-size: 0.9em; color: #666;">💡 ${recipe.storageInstructions.notes}</div>` : ''}
        </div>
        ` : ''}
      </div>
      `;
    }).join('')}
  </div>
</body>
</html>`;

  return html;
}

export function exportProjectToJSON(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJSON(jsonString: string): Project {
  return JSON.parse(jsonString) as Project;
}
