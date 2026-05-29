import { Distribution, Musician, Part, CheckResult } from '../types';

export function checkDistributions(
  distributions: Distribution[],
  musicians: Musician[],
  parts: Part[]
): CheckResult[] {
  const results: CheckResult[] = [];

  musicians.forEach((musician) => {
    const distribution = distributions.find((d) => d.musicianId === musician.id);
    const part = parts.find((p) => p.id === musician.partId);

    if (!distribution) {
      results.push({
        id: `dist-${musician.id}-missing`,
        type: 'distribution',
        severity: 'error',
        musicianId: musician.id,
        partId: musician.partId,
        message: `${musician.name}（${part?.name || '未知声部'}）：没有发放记录`,
        suggestion: '请补充该乐手的乐谱发放记录',
        status: 'open',
      });
      return;
    }

    if (distribution.partId !== musician.partId) {
      const actualPart = parts.find((p) => p.id === distribution.partId);
      results.push({
        id: `dist-${musician.id}-wrong`,
        type: 'distribution',
        severity: 'error',
        musicianId: musician.id,
        partId: musician.partId,
        message: `${musician.name}：声部混淆，应发 ${part?.name}，实际发放 ${actualPart?.name}`,
        suggestion: '请核对乐谱声部是否正确',
        status: 'open',
      });
    }

    if (part) {
      const pagesReceived = distribution.pagesReceived.map((p) => parseInt(p)).filter((p) => !isNaN(p));
      const uniquePages = [...new Set(pagesReceived)];
      
      if (uniquePages.length < part.totalPages) {
        const missingPages = [];
        for (let i = 1; i <= part.totalPages; i++) {
          if (!uniquePages.includes(i)) {
            missingPages.push(i);
          }
        }
        if (missingPages.length > 0) {
          results.push({
            id: `dist-${musician.id}-pages`,
            type: 'distribution',
            severity: 'error',
            musicianId: musician.id,
            partId: musician.partId,
            message: `${musician.name}（${part.name}）：缺少第 ${missingPages.slice(0, 5).join(', ')}${missingPages.length > 5 ? '...' : ''} 页，共缺少 ${missingPages.length} 页`,
            suggestion: `请补充发放缺失的页码`,
            status: 'open',
          });
        }
      }

      if (uniquePages.length > part.totalPages) {
        const extraPages = uniquePages.filter((p) => p > part.totalPages);
        results.push({
          id: `dist-${musician.id}-extra`,
          type: 'distribution',
          severity: 'warning',
          musicianId: musician.id,
          partId: musician.partId,
          message: `${musician.name}（${part.name}）：发放了额外页码 ${extraPages.join(', ')}`,
          suggestion: '请确认是否为修订页或发放错误',
          status: 'open',
        });
      }
    }
  });

  const partMusicianCount: Record<string, number> = {};
  musicians.forEach((m) => {
    partMusicianCount[m.partId] = (partMusicianCount[m.partId] || 0) + 1;
  });

  const partDistCount: Record<string, number> = {};
  distributions.forEach((d) => {
    partDistCount[d.partId] = (partDistCount[d.partId] || 0) + 1;
  });

  parts.forEach((part) => {
    const expected = partMusicianCount[part.id] || 0;
    const actual = partDistCount[part.id] || 0;
    if (expected !== actual) {
      results.push({
        id: `dist-part-${part.id}-count`,
        type: 'distribution',
        severity: actual > expected ? 'warning' : 'error',
        partId: part.id,
        message: `${part.name}：应发放 ${expected} 份，实际发放 ${actual} 份`,
        suggestion: actual > expected ? '存在额外发放，请确认' : '存在未发放的乐手',
        status: 'open',
      });
    }
  });

  return results;
}
