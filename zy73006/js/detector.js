const Detector = (function () {
  const TODAY = '2026-06-08';

  function getSettings() {
    return Storage.getSettings() || {};
  }

  function collectSources(dogId, extraWeights = [], extraVaccines = [], extraBoardings = []) {
    const sources = [];
    for (const w of Storage.getWeightsByDog(dogId)) {
      sources.push({
        type: 'weight',
        id: w.id,
        date: w.date,
        label: `体重 ${w.weight}kg（${w.source}）`,
        withdrawn: !!w.withdrawn,
        withdrawnReason: w.withdrawnReason || '',
        raw: w,
      });
    }
    for (const v of Storage.getVaccinesByDog(dogId)) {
      sources.push({
        type: 'vaccine',
        id: v.id,
        date: v.date,
        label: `接种 ${v.name}（${v.doctor || ''}）`,
        withdrawn: false,
        raw: v,
      });
    }
    for (const b of Storage.getBoardingsByDog(dogId)) {
      sources.push({
        type: 'boarding',
        id: b.id,
        date: b.startDate,
        label: `寄养 ${b.startDate}~${b.endDate}（${b.sourceLine || ''}）`,
        withdrawn: false,
        sourceLine: b.sourceLine,
        raw: b,
      });
    }
    for (const w of extraWeights) sources.push(w);
    for (const v of extraVaccines) sources.push(v);
    for (const b of extraBoardings) sources.push(b);
    sources.sort((a, b) => Calendar.parseDate(a.date) - Calendar.parseDate(b.date));
    return sources;
  }

  function hasWithdrawn(dogId) {
    return Storage.getWeightsByDog(dogId).some(w => w.withdrawn);
  }

  /* 规则1：疫苗后30天体重跌幅 >= 阈值 */
  function checkR1(dog, weights, vaccines, settings) {
    const alerts = [];
    const threshold = settings.thresholds.weightLossAfterVaccinePercent;
    const activeWeights = weights.filter(w => !w.withdrawn);
    for (const v of vaccines) {
      const vDate = v.date;
      /* 疫苗前最近一次体重 */
      const before = [...activeWeights].reverse().find(w => w.date <= vDate);
      /* 疫苗后 30 天内的体重（取最低点） */
      const afterList = activeWeights.filter(w => {
        const diff = Calendar.diffDays(vDate, w.date);
        return diff > 0 && diff <= 30;
      });
      if (!before || afterList.length === 0) continue;
      const lowestAfter = afterList.reduce((a, b) => a.weight < b.weight ? a : b);
      const dropPct = ((before.weight - lowestAfter.weight) / before.weight) * 100;
      if (dropPct >= threshold) {
        alerts.push({
          ruleKey: 'R1',
          level: 'high',
          title: `疫苗后体重异常下跌 ${dropPct.toFixed(1)}%`,
          reason: `犬只「${dog.name}」于 <b>${vDate}</b> 接种 <b>${v.name}</b>，疫苗前体重 <b>${before.weight}kg</b>（${before.date}），30天内最低跌至 <b>${lowestAfter.weight}kg</b>（${lowestAfter.date}），跌幅 <b>${dropPct.toFixed(1)}%</b>，超过阈值 ${threshold}%。`,
          highlights: {
            vaccineId: v.id,
            beforeWeightId: before.id,
            afterWeightId: lowestAfter.id,
            dropPct: dropPct.toFixed(1),
            threshold,
          },
        });
      }
    }
    return alerts;
  }

  /* 规则2：疫苗后7天体重增幅 >= 阈值（水肿） */
  function checkR2(dog, weights, vaccines, settings) {
    const alerts = [];
    const threshold = settings.thresholds.weightGainAfterVaccinePercent;
    const activeWeights = weights.filter(w => !w.withdrawn);
    for (const v of vaccines) {
      const vDate = v.date;
      const before = [...activeWeights].reverse().find(w => w.date <= vDate);
      const afterList = activeWeights.filter(w => {
        const diff = Calendar.diffDays(vDate, w.date);
        return diff > 0 && diff <= 7;
      });
      if (!before || afterList.length === 0) continue;
      const highestAfter = afterList.reduce((a, b) => a.weight > b.weight ? a : b);
      const gainPct = ((highestAfter.weight - before.weight) / before.weight) * 100;
      if (gainPct >= threshold) {
        alerts.push({
          ruleKey: 'R2',
          level: 'mid',
          title: `疫苗后短期体重异常上涨 ${gainPct.toFixed(1)}%（水肿可疑）`,
          reason: `犬只「${dog.name}」于 <b>${vDate}</b> 接种 <b>${v.name}</b>，疫苗前体重 <b>${before.weight}kg</b>，7天内最高达 <b>${highestAfter.weight}kg</b>（${highestAfter.date}），涨幅 <b>${gainPct.toFixed(1)}%</b>，超过阈值 ${threshold}%，怀疑接种部位水肿或一过性反应。`,
          highlights: {
            vaccineId: v.id,
            beforeWeightId: before.id,
            afterWeightId: highestAfter.id,
            gainPct: gainPct.toFixed(1),
            threshold,
          },
        });
      }
    }
    return alerts;
  }

  /* 规则3：年度免疫超期 */
  function checkR3(dog, weights, vaccines, settings) {
    const alerts = [];
    if (vaccines.length === 0) return alerts;
    const latest = vaccines[vaccines.length - 1];
    const overdueDays = Calendar.diffDays(latest.nextDate, TODAY);
    if (overdueDays > 0) {
      alerts.push({
        ruleKey: 'R3',
        level: 'high',
        title: `年度免疫已超期 ${overdueDays} 天`,
        reason: `犬只「${dog.name}」最近一次接种 <b>${latest.name}</b> 为 <b>${latest.date}</b>，下次应接种为 <b>${latest.nextDate}</b>，截至今日（${TODAY}）已超期 <b>${overdueDays}</b> 天。`,
        highlights: {
          vaccineId: latest.id,
          nextDate: latest.nextDate,
          overdueDays,
        },
      });
    }
    return alerts;
  }

  /* 规则4：年度免疫即将到期 */
  function checkR4(dog, weights, vaccines, settings) {
    const alerts = [];
    if (vaccines.length === 0) return alerts;
    const threshold = settings.thresholds.vaccineDueSoonDays;
    const latest = vaccines[vaccines.length - 1];
    const daysLeft = -Calendar.diffDays(latest.nextDate, TODAY);
    if (daysLeft >= 0 && daysLeft <= threshold) {
      alerts.push({
        ruleKey: 'R4',
        level: 'mid',
        title: `年度免疫还有 ${daysLeft} 天到期`,
        reason: `犬只「${dog.name}」的 <b>${latest.name}</b> 免疫将于 <b>${latest.nextDate}</b> 到期，距离今日（${TODAY}）仅剩 <b>${daysLeft}</b> 天，请安排接种。`,
        highlights: {
          vaccineId: latest.id,
          nextDate: latest.nextDate,
          daysLeft,
        },
      });
    }
    return alerts;
  }

  /* 规则5：体重记录点数不足 */
  function checkR5(dog, weights, vaccines, settings) {
    const alerts = [];
    const threshold = settings.thresholds.minWeightPoints;
    const activeCount = weights.filter(w => !w.withdrawn).length;
    if (activeCount < threshold) {
      alerts.push({
        ruleKey: 'R5',
        level: 'low',
        title: `体重记录仅 ${activeCount} 条，数据不足`,
        reason: `犬只「${dog.name}」有效体重记录 <b>${activeCount}</b> 条（要求 ${threshold} 条及以上），无法建立可靠体重曲线，疫苗异常判定置信度不足。建议补录常规称重。`,
        highlights: { activeCount, threshold },
      });
    }
    return alerts;
  }

  /* 规则6：疫苗记录完全缺失 */
  function checkR6(dog, weights, vaccines, settings) {
    if (vaccines.length === 0) {
      return [{
        ruleKey: 'R6',
        level: 'high',
        title: '未找到任何疫苗接种记录',
        reason: `犬只「${dog.name}」档案中 <b>没有接种记录</b>，无法判断免疫状态。需要补录疫苗本或联系主人确认。`,
        highlights: {},
      }];
    }
    return [];
  }

  /* 规则7：寄养跨节假日 + 接回后体重下降 */
  function checkR7(dog, weights, vaccines, settings) {
    const alerts = [];
    const threshold = settings.thresholds.boardingWeightDropPercent;
    const activeWeights = weights.filter(w => !w.withdrawn);
    for (const b of Storage.getBoardingsByDog(dog.id)) {
      const impacts = Calendar.getBoardingHolidayImpact(b);
      if (impacts.length === 0) continue;
      /* 寄养前最近体重 */
      const before = [...activeWeights].reverse().find(w => w.date <= b.startDate);
      /* 接回后 7 天内最近体重 */
      const after = activeWeights.find(w => {
        const diff = Calendar.diffDays(b.endDate, w.date);
        return diff >= 0 && diff <= 7;
      });
      if (!before || !after) continue;
      const dropPct = ((before.weight - after.weight) / before.weight) * 100;
      if (dropPct >= threshold) {
        const impactStr = impacts.map(i =>
          `${i.holidayName}（重叠 ${i.overlapDays}/${i.totalBoardingDays} 天）`
        ).join('、');
        alerts.push({
          ruleKey: 'R7',
          level: 'mid',
          title: `跨节假日寄养后体重下降 ${dropPct.toFixed(1)}%`,
          reason: `犬只「${dog.name}」寄养期 <b>${b.startDate}~${b.endDate}</b>，跨节假日：<b>${impactStr}</b>。寄养前体重 <b>${before.weight}kg</b>，接回后 <b>${after.weight}kg</b>，降幅 <b>${dropPct.toFixed(1)}%</b> 超过阈值 ${threshold}%。来源行：${b.sourceLine || '未标注'}。`,
          highlights: {
            boardingId: b.id,
            sourceLine: b.sourceLine,
            holidayImpact: impacts,
            dropPct: dropPct.toFixed(1),
          },
        });
      }
    }
    return alerts;
  }

  /* 汇总运行全部规则 */
  function run() {
    const settings = getSettings();
    if (!settings.thresholds) {
      return { alerts: [], calcVersion: 'error', calcRules: [] };
    }
    const dogs = Storage.getDogs();
    const alerts = [];

    for (const dog of dogs) {
      const weights = Storage.getWeightsByDog(dog.id);
      const vaccines = Storage.getVaccinesByDog(dog.id);
      const ruleChecks = [checkR1, checkR2, checkR3, checkR4, checkR5, checkR6, checkR7];
      for (const fn of ruleChecks) {
        const results = fn(dog, weights, vaccines, settings);
        for (const r of results) {
          const alertId = Storage.uid('alt');
          alerts.push({
            id: alertId,
            dogId: dog.id,
            dog,
            createdAt: new Date().toISOString(),
            calcVersion: settings.calcRuleVersion,
            hasWithdrawnSource: hasWithdrawn(dog.id),
            sources: collectSources(dog.id),
            boardingImpact: Calendar.getBoardingHolidayImpact,
            ...r,
          });
        }
      }
    }

    /* 按级别排序：高>中>低 */
    const levelOrder = { high: 0, mid: 1, low: 2 };
    alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

    Storage.setAlerts(alerts);
    return {
      alerts,
      calcVersion: settings.calcRuleVersion,
      calcRules: settings.calcRules,
      thresholds: settings.thresholds,
    };
  }

  return { run, collectSources, TODAY };
})();
