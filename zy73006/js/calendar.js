const Calendar = (function () {
  function parseDate(s) {
    return new Date(s + 'T00:00:00');
  }
  function diffDays(a, b) {
    const ms = parseDate(b) - parseDate(a);
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }
  function addDays(dateStr, n) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function formatDate(s) {
    const d = parseDate(s);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /* 区间 [a,b] 是否与 [c,d] 有交集 */
  function rangeOverlap(a, b, c, d) {
    return !(parseDate(b) < parseDate(c) || parseDate(d) < parseDate(a));
  }

  /* 计算寄养记录跨哪些节假日，返回影响列表 */
  function getBoardingHolidayImpact(boarding) {
    const holidays = Storage.getHolidays();
    const impacts = [];
    for (const h of holidays) {
      if (rangeOverlap(boarding.startDate, boarding.endDate, h.start, h.end)) {
        /* 实际重叠区间 */
        const overlapStart = parseDate(boarding.startDate) > parseDate(h.start)
          ? boarding.startDate : h.start;
        const overlapEnd = parseDate(boarding.endDate) < parseDate(h.end)
          ? boarding.endDate : h.end;
        const overlapDays = diffDays(overlapStart, overlapEnd) + 1;
        const totalBoardingDays = diffDays(boarding.startDate, boarding.endDate) + 1;
        impacts.push({
          holidayName: h.name,
          holidayStart: h.start,
          holidayEnd: h.end,
          overlapStart,
          overlapEnd,
          overlapDays,
          totalBoardingDays,
          overlapRatio: overlapDays / totalBoardingDays,
        });
      }
    }
    return impacts;
  }

  /* 获取所有存在跨节假日寄养的犬只列表 */
  function getAllHolidayBoardings() {
    const out = [];
    for (const b of Storage.getBoardings()) {
      const impacts = getBoardingHolidayImpact(b);
      if (impacts.length > 0) {
        const dog = Storage.getDog(b.dogId);
        out.push({
          boarding: b,
          dog: dog ? { id: dog.id, name: dog.name } : { id: b.dogId, name: '(未知)' },
          impacts,
        });
      }
    }
    return out;
  }

  return {
    parseDate, diffDays, addDays, formatDate,
    getBoardingHolidayImpact, getAllHolidayBoardings,
  };
})();
