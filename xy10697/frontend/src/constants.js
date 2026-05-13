export const STATUS_LABELS = {
  empty: '空瓶',
  filling: '充装中',
  filled: '已充装',
  delivered: '已配送',
  in_use: '使用中',
  collected: '已回收',
  inspecting: '检验中',
  inspection_pass: '检验合格',
  inspection_fail: '检验不合格',
  overdue: '超期',
  scrapped: '已报废'
};

export const STATUS_TRANSITIONS = {
  empty: ['filling'],
  filling: ['filled'],
  filled: ['delivered'],
  delivered: ['in_use'],
  in_use: ['collected', 'overdue'],
  collected: ['inspecting'],
  inspecting: ['inspection_pass', 'inspection_fail'],
  inspection_pass: ['empty', 'scrapped'],
  inspection_fail: ['scrapped'],
  overdue: ['collected', 'scrapped'],
  scrapped: []
};

export const ALL_STATUSES = [
  'empty', 'filling', 'filled', 'delivered', 'in_use',
  'collected', 'inspecting', 'inspection_pass',
  'inspection_fail', 'overdue', 'scrapped'
];
