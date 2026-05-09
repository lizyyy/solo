OVERFLOW_THRESHOLD = 0.85

CAPACITY_L = {
    'A': 240,
    'B': 120,
    'C': 60
}

GARBAGE_TYPES = ['可回收', '厨余', '有害', '其他']

HOLIDAY_MULTIPLIER = 2.5
WEEKEND_MULTIPLIER = 1.5
WORKDAY_MULTIPLIER = 1.0

PREDICTION_WINDOW_DAYS = 3

HOLIDAYS_2026 = {
    '2026-01-01': '元旦',
    '2026-02-17': '春节', '2026-02-18': '春节', '2026-02-19': '春节', '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
    '2026-04-06': '清明',
    '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节', '2026-05-04': '劳动节', '2026-05-05': '劳动节',
    '2026-06-19': '端午', '2026-06-20': '端午', '2026-06-21': '端午',
    '2026-09-27': '中秋', '2026-09-28': '中秋',
    '2026-10-01': '国庆', '2026-10-02': '国庆', '2026-10-03': '国庆', '2026-10-04': '国庆', '2026-10-05': '国庆', '2026-10-06': '国庆', '2026-10-07': '国庆'
}

BINS_META = [
    {'bin_id': 'BIN-001', 'type': '可回收', 'model': 'A', 'community': '阳光花园', 'zone': '东一区', 'last_clean': '2026-04-28'},
    {'bin_id': 'BIN-002', 'type': '厨余', 'model': 'A', 'community': '阳光花园', 'zone': '东一区', 'last_clean': '2026-04-29'},
    {'bin_id': 'BIN-003', 'type': '其他', 'model': 'A', 'community': '阳光花园', 'zone': '东一区', 'last_clean': '2026-04-28'},
    {'bin_id': 'BIN-004', 'type': '可回收', 'model': 'B', 'community': '阳光花园', 'zone': '西二区', 'last_clean': '2026-04-29'},
    {'bin_id': 'BIN-005', 'type': '厨余', 'model': 'B', 'community': '阳光花园', 'zone': '西二区', 'last_clean': '2026-04-29'},
    {'bin_id': 'BIN-006', 'type': '有害', 'model': 'C', 'community': '阳光花园', 'zone': '中心区', 'last_clean': '2026-04-25'},
    {'bin_id': 'BIN-007', 'type': '可回收', 'model': 'A', 'community': '幸福里', 'zone': '北区', 'last_clean': '2026-04-28'},
    {'bin_id': 'BIN-008', 'type': '厨余', 'model': 'A', 'community': '幸福里', 'zone': '北区', 'last_clean': '2026-04-29'},
    {'bin_id': 'BIN-009', 'type': '厨余', 'model': 'B', 'community': '幸福里', 'zone': '南区', 'last_clean': '2026-04-29'},
    {'bin_id': 'BIN-010', 'type': '其他', 'model': 'A', 'community': '幸福里', 'zone': '南区', 'last_clean': '2026-04-28'},
]
