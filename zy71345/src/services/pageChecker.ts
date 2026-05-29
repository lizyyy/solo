import { Part, CheckResult } from '../types';

export function checkPageContinuity(parts: Part[]): CheckResult[] {
  const results: CheckResult[] = [];

  parts.forEach((part) => {
    const pages = [...part.pages].sort((a, b) => a - b);
    
    if (pages.length === 0) {
      results.push({
        id: `page-${part.id}-empty`,
        type: 'page',
        severity: 'error',
        partId: part.id,
        message: `${part.name}：没有页码数据`,
        suggestion: '请检查声部谱数据是否正确导入',
        status: 'open',
      });
      return;
    }

    const minPage = pages[0];
    const maxPage = pages[pages.length - 1];

    if (minPage !== 1) {
      results.push({
        id: `page-${part.id}-start`,
        type: 'page',
        severity: 'warning',
        partId: part.id,
        message: `${part.name}：页码起始值为 ${minPage}，应为 1`,
        suggestion: '请检查第一页是否遗漏',
        status: 'open',
      });
    }

    for (let i = 0; i < pages.length - 1; i++) {
      const current = pages[i];
      const next = pages[i + 1];
      const expected = current + 1;
      
      if (next > expected) {
        const missingPages = [];
        for (let p = expected; p < next; p++) {
          missingPages.push(p);
        }
        results.push({
          id: `page-${part.id}-gap-${current}`,
          type: 'page',
          severity: 'error',
          partId: part.id,
          message: `${part.name}：页码 ${current} 和 ${next} 之间存在跳号，缺少第 ${missingPages.join(', ')} 页`,
          suggestion: `请确认第 ${missingPages.join(', ')} 页是否发放`,
          status: 'open',
        });
      } else if (next === current) {
        results.push({
          id: `page-${part.id}-dup-${current}`,
          type: 'page',
          severity: 'warning',
          partId: part.id,
          message: `${part.name}：页码 ${current} 重复`,
          suggestion: '请检查是否有重复发放的页码',
          status: 'open',
        });
      }
    }

    if (pages.length !== part.totalPages) {
      results.push({
        id: `page-${part.id}-count`,
        type: 'page',
        severity: 'error',
        partId: part.id,
        message: `${part.name}：实际页数 ${pages.length} 与应发页数 ${part.totalPages} 不符`,
        suggestion: `缺少 ${part.totalPages - pages.length} 页，请核对`,
        status: 'open',
      });
    }
  });

  return results;
}
