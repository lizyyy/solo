export class RuleValidator {
  static validate(instruments, tray, rules) {
    const warnings = [];
    
    if (rules.rules.find(r => r.id === 'HEIGHT_LIMIT' && r.enabled)) {
      instruments.forEach(inst => {
        const totalHeight = inst.position.z + inst.height;
        if (totalHeight > tray.maxHeight) {
          warnings.push({
            type: 'ERROR',
            rule: 'HEIGHT_LIMIT',
            message: `器械 ${inst.name} (${inst.id}) 超高: ${totalHeight}mm > ${tray.maxHeight}mm`,
            instrumentId: inst.id
          });
        }
      });
    }
    
    if (rules.rules.find(r => r.id === 'NO_OVERLAP' && r.enabled)) {
      for (let i = 0; i < instruments.length; i++) {
        for (let j = i + 1; j < instruments.length; j++) {
          if (this.checkOverlap(instruments[i], instruments[j])) {
            warnings.push({
              type: 'ERROR',
              rule: 'NO_OVERLAP',
              message: `器械 ${instruments[i].name} 与 ${instruments[j].name} 重叠遮挡`,
              instrumentId: instruments[i].id
            });
          }
        }
      }
    }
    
    if (rules.rules.find(r => r.id === 'MIN_GAP' && r.enabled)) {
      for (let i = 0; i < instruments.length; i++) {
        for (let j = i + 1; j < instruments.length; j++) {
          const gap = this.calculateGap(instruments[i], instruments[j]);
          if (gap < rules.minGap) {
            warnings.push({
              type: 'WARNING',
              rule: 'MIN_GAP',
              message: `器械 ${instruments[i].name} 与 ${instruments[j].name} 间距不足: ${gap.toFixed(1)}mm < ${rules.minGap}mm`,
              instrumentId: instruments[i].id
            });
          }
        }
      }
    }
    
    if (rules.rules.find(r => r.id === 'MUST_LAYER' && r.enabled)) {
      instruments.forEach(inst => {
        if (inst.mustLayer && inst.position.z > 0.1) {
          warnings.push({
            type: 'ERROR',
            rule: 'MUST_LAYER',
            message: `器械 ${inst.name} (${inst.id}) 必须放置在底层`,
            instrumentId: inst.id
          });
        }
      });
    }
    
    return warnings;
  }
  
  static checkOverlap(a, b) {
    const aMinX = a.position.x - a.width / 2;
    const aMaxX = a.position.x + a.width / 2;
    const aMinY = a.position.y - a.depth / 2;
    const aMaxY = a.position.y + a.depth / 2;
    const aMinZ = a.position.z;
    const aMaxZ = a.position.z + a.height;
    
    const bMinX = b.position.x - b.width / 2;
    const bMaxX = b.position.x + b.width / 2;
    const bMinY = b.position.y - b.depth / 2;
    const bMaxY = b.position.y + b.depth / 2;
    const bMinZ = b.position.z;
    const bMaxZ = b.position.z + b.height;
    
    return !(aMaxX < bMinX || aMinX > bMaxX ||
             aMaxY < bMinY || aMinY > bMaxY ||
             aMaxZ < bMinZ || aMinZ > bMaxZ);
  }
  
  static calculateGap(a, b) {
    const aMinX = a.position.x - a.width / 2;
    const aMaxX = a.position.x + a.width / 2;
    const aMinY = a.position.y - a.depth / 2;
    const aMaxY = a.position.y + a.depth / 2;
    
    const bMinX = b.position.x - b.width / 2;
    const bMaxX = b.position.x + b.width / 2;
    const bMinY = b.position.y - b.depth / 2;
    const bMaxY = b.position.y + b.depth / 2;
    
    const dx = Math.max(0, aMinX - bMaxX, bMinX - aMaxX);
    const dy = Math.max(0, aMinY - bMaxY, bMinY - aMaxY);
    
    return Math.sqrt(dx * dx + dy * dy);
  }
}
