import { Revision, Distribution, Musician, Part, CheckResult } from '../types';

export function checkRevisions(
  revisions: Revision[],
  distributions: Distribution[],
  musicians: Musician[],
  parts: Part[]
): CheckResult[] {
  const results: CheckResult[] = [];

  revisions.forEach((revision) => {
    const affectedMusicians = musicians.filter((m) =>
      revision.partIds.includes(m.partId)
    );

    if (affectedMusicians.length === 0) {
      results.push({
        id: `rev-${revision.id}-nomusicians`,
        type: 'revision',
        severity: 'info',
        revisionId: revision.id,
        message: `修订页「${revision.name}」：没有适用的乐手`,
        suggestion: '请检查修订页适用声部是否正确',
        status: 'open',
      });
      return;
    }

    const partNames = revision.partIds
      .map((id) => parts.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join('、');

    affectedMusicians.forEach((musician) => {
      const distribution = distributions.find(
        (d) => d.musicianId === musician.id
      );

      if (!distribution) {
        results.push({
          id: `rev-${revision.id}-${musician.id}-nodist`,
          type: 'revision',
          severity: 'error',
          revisionId: revision.id,
          musicianId: musician.id,
          partId: musician.partId,
          message: `修订页「${revision.name}」：${musician.name} 没有发放记录，无法确认是否收到`,
          suggestion: '请先创建该乐手的发放记录',
          status: 'open',
        });
        return;
      }

      if (!distribution.revisionIds.includes(revision.id)) {
        const part = parts.find((p) => p.id === musician.partId);
        results.push({
          id: `rev-${revision.id}-${musician.id}-missing`,
          type: 'revision',
          severity: 'error',
          revisionId: revision.id,
          musicianId: musician.id,
          partId: musician.partId,
          message: `修订页「${revision.name}」（${part?.name || '未知声部'}）：${musician.name} 未收到该修订页`,
          suggestion: `请确认是否已发放第 ${revision.pageNumber} 页`,
          status: 'open',
        });
      }
    });

    const receivedCount = affectedMusicians.filter((m) => {
      const dist = distributions.find((d) => d.musicianId === m.id);
      return dist?.revisionIds.includes(revision.id);
    }).length;

    if (receivedCount === affectedMusicians.length) {
      results.push({
        id: `rev-${revision.id}-complete`,
        type: 'revision',
        severity: 'info',
        revisionId: revision.id,
        message: `修订页「${revision.name}」（${partNames}）：已全部发放（${receivedCount}/${affectedMusicians.length}）`,
        suggestion: '无需处理',
        status: 'resolved',
      });
    } else {
      results.push({
        id: `rev-${revision.id}-summary`,
        type: 'revision',
        severity: 'warning',
        revisionId: revision.id,
        message: `修订页「${revision.name}」（${partNames}）：发放进度 ${receivedCount}/${affectedMusicians.length}，还有 ${affectedMusicians.length - receivedCount} 人未收到`,
        suggestion: '请查看详情并补发',
        status: 'open',
      });
    }
  });

  return results;
}
