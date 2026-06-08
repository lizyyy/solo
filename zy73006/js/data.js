const DataGenerator = (function () {
  function d(offsetDays) {
    const base = new Date('2026-05-20');
    base.setDate(base.getDate() + offsetDays);
    return base.toISOString().slice(0, 10);
  }

  function buildDogs() {
    return [
      { id: 'dog_001', name: '大黄', breed: '金毛寻回犬', age: 3, gender: '公', owner: '陈女士', phone: '138****1234' },
      { id: 'dog_002', name: '豆豆', breed: '比熊', age: 5, gender: '母', owner: '李先生', phone: '139****5678' },
      { id: 'dog_003', name: '旺财', breed: '柴犬', age: 2, gender: '公', owner: '张先生', phone: '137****9012' },
      { id: 'dog_004', name: '小白', breed: '萨摩耶', age: 4, gender: '母', owner: '王女士', phone: '136****3456' },
      { id: 'dog_005', name: '黑贝', breed: '德国牧羊犬', age: 6, gender: '公', owner: '赵先生', phone: '135****7890' },
    ];
  }

  function buildWeights() {
    return [
      /* ===== 大黄 - 体重在疫苗后出现异常下跌 ===== */
      { id: 'w_001_1', dogId: 'dog_001', date: d(-120), weight: 27.5, source: '常规体检', withdrawn: false },
      { id: 'w_001_2', dogId: 'dog_001', date: d(-90), weight: 28.1, source: '常规体检', withdrawn: false },
      { id: 'w_001_3', dogId: 'dog_001', date: d(-60), weight: 28.6, source: '常规体检', withdrawn: false },
      { id: 'w_001_4', dogId: 'dog_001', date: d(-30), weight: 28.8, source: '疫苗前称重', withdrawn: false },
      { id: 'w_001_5', dogId: 'dog_001', date: d(-15), weight: 28.3, source: '回访称重', withdrawn: false },
      { id: 'w_001_6', dogId: 'dog_001', date: d(-7), weight: 26.9, source: '异常回访', withdrawn: false },
      { id: 'w_001_7', dogId: 'dog_001', date: d(-2), weight: 25.8, source: '复查', withdrawn: false },

      /* ===== 豆豆 - 体重稳步上升但疫苗间隔过久（已超期） ===== */
      { id: 'w_002_1', dogId: 'dog_002', date: d(-300), weight: 5.1, source: '常规体检', withdrawn: false },
      { id: 'w_002_2', dogId: 'dog_002', date: d(-200), weight: 5.4, source: '常规体检', withdrawn: false },
      { id: 'w_002_3', dogId: 'dog_002', date: d(-100), weight: 5.7, source: '常规体检', withdrawn: false },
      { id: 'w_002_4', dogId: 'dog_002', date: d(-40), weight: 6.0, source: '常规体检', withdrawn: false },

      /* ===== 旺财 - 疫苗后体重短期暴涨（水肿可疑） ===== */
      { id: 'w_003_1', dogId: 'dog_003', date: d(-80), weight: 9.2, source: '常规体检', withdrawn: false },
      { id: 'w_003_2', dogId: 'dog_003', date: d(-50), weight: 9.3, source: '疫苗前称重', withdrawn: false },
      { id: 'w_003_3', dogId: 'dog_003', date: d(-47), weight: 10.5, source: '疫苗后3天', withdrawn: false },
      { id: 'w_003_4', dogId: 'dog_003', date: d(-45), weight: 10.8, source: '疫苗后5天', withdrawn: false },
      { id: 'w_003_5', dogId: 'dog_003', date: d(-40), weight: 9.5, source: '消退后', withdrawn: false },
      /* 撤回的一条：曾经录入错误的数据 */
      { id: 'w_003_99', dogId: 'dog_003', date: d(-46), weight: 12.0, source: '误录入', withdrawn: true, withdrawnReason: '录入错误-实际为9.8kg', withdrawnAt: d(-44) },

      /* ===== 小白 - 寄养跨五一假期，体重下降 + 疫苗到期临近 ===== */
      { id: 'w_004_1', dogId: 'dog_004', date: d(-80), weight: 21.0, source: '寄养前', withdrawn: false },
      { id: 'w_004_2', dogId: 'dog_004', date: d(-50), weight: 21.3, source: '常规', withdrawn: false },
      { id: 'w_004_3', dogId: 'dog_004', date: d(-25), weight: 20.1, source: '寄养接回', withdrawn: false },
      { id: 'w_004_4', dogId: 'dog_004', date: d(-10), weight: 19.8, source: '回访', withdrawn: false },

      /* ===== 黑贝 - 资料不齐：体重点少 + 疫苗本记录缺失 ===== */
      { id: 'w_005_1', dogId: 'dog_005', date: d(-250), weight: 32.0, source: '首次建档', withdrawn: false },
      { id: 'w_005_2', dogId: 'dog_005', date: d(-40), weight: 31.5, source: '仅一条', withdrawn: false },
    ];
  }

  function buildVaccines() {
    return [
      /* 大黄：八联疫苗 + 狂犬，接种后出现体重异常下降 */
      { id: 'v_001_1', dogId: 'dog_001', date: d(-30), name: '犬八联疫苗', batch: 'V2026A012', nextDate: d(335), source: '本院接种', doctor: '刘医生' },
      { id: 'v_001_2', dogId: 'dog_001', date: d(-30), name: '狂犬疫苗', batch: 'R2026B034', nextDate: d(335), source: '本院接种', doctor: '刘医生' },

      /* 豆豆：上一次疫苗在 400 天前，年度免疫已超期 */
      { id: 'v_002_1', dogId: 'dog_002', date: d(-400), name: '犬八联疫苗', batch: 'V2025A119', nextDate: d(-35), source: '本院接种', doctor: '王医生' },

      /* 旺财：疫苗后 3-5 天体重骤增 */
      { id: 'v_003_1', dogId: 'dog_003', date: d(-50), name: '犬六联疫苗', batch: 'V2026A088', nextDate: d(315), source: '本院接种', doctor: '陈医生' },

      /* 小白：疫苗即将到期，寄养期间体重下降 */
      { id: 'v_004_1', dogId: 'dog_004', date: d(-340), name: '犬八联疫苗', batch: 'V2025A201', nextDate: d(25), source: '本院接种', doctor: '李医生' },
      { id: 'v_004_2', dogId: 'dog_004', date: d(-340), name: '狂犬疫苗', batch: 'R2025B076', nextDate: d(25), source: '本院接种', doctor: '李医生' },

      /* 黑贝：没有找到疫苗记录，待补件 */
      /* （故意不添加疫苗记录 - 模拟材料不齐） */
    ];
  }

  function buildBoardings() {
    return [
      /* 小白：五一假期寄养（5.1-5.5） - 跨法定节假日 */
      {
        id: 'b_004_1', dogId: 'dog_004',
        startDate: '2026-05-01', endDate: '2026-05-05',
        source: '寄养登记-前台小温录入',
        sourceLine: '寄养登记表#2026-05-001 第3行',
      },
      /* 大黄：清明假期前寄养 */
      {
        id: 'b_001_1', dogId: 'dog_001',
        startDate: '2026-04-02', endDate: '2026-04-04',
        source: '寄养登记',
        sourceLine: '寄养登记表#2026-04-002 第1行',
      },
    ];
  }

  function buildHolidays() {
    return [
      { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
      { name: '春节', start: '2026-02-16', end: '2026-02-22' },
      { name: '清明节', start: '2026-04-04', end: '2026-04-06' },
      { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
      { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
      { name: '国庆中秋', start: '2026-10-01', end: '2026-10-08' },
    ];
  }

  function buildSettings() {
    return {
      calcRuleVersion: 'v1.0-202605评审版',
      calcRules: [
        { key: 'R1', text: '疫苗后30天内体重跌幅≥7% → 高风险异常' },
        { key: 'R2', text: '疫苗后7天内体重增幅≥10% → 中风险异常（水肿可疑）' },
        { key: 'R3', text: '年度免疫间隔>365天 → 高风险（已超期）' },
        { key: 'R4', text: '年度免疫剩余≤30天 → 中风险（即将到期）' },
        { key: 'R5', text: '同犬体重记录点数<3 → 低风险（数据不足，需补件）' },
        { key: 'R6', text: '疫苗接种记录完全缺失 → 高风险（需补疫苗本）' },
        { key: 'R7', text: '寄养跨法定节假日+接回体重下降≥5% → 中风险' },
        { key: 'R8', text: '存在已撤回原始记录 → 卡片上标注来源' },
      ],
      thresholds: {
        weightLossAfterVaccinePercent: 7,
        weightGainAfterVaccinePercent: 10,
        minWeightPoints: 3,
        vaccineOverdueDays: 365,
        vaccineDueSoonDays: 30,
        boardingWeightDropPercent: 5,
      },
    };
  }

  function initIfNeeded() {
    if (Storage.isInitialized()) return false;
    Storage.setDogs(buildDogs());
    Storage.setWeights(buildWeights());
    Storage.setVaccines(buildVaccines());
    Storage.setBoardings(buildBoardings());
    Storage.setHolidays(buildHolidays());
    Storage.setSettings(buildSettings());
    Storage.markInitialized();
    return true;
  }

  return { initIfNeeded, d };
})();
