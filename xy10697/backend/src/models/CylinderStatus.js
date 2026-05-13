const CylinderStatus = {
  EMPTY: 'empty',
  FILLING: 'filling',
  FILLED: 'filled',
  DELIVERED: 'delivered',
  IN_USE: 'in_use',
  COLLECTED: 'collected',
  INSPECTING: 'inspecting',
  INSPECTION_PASS: 'inspection_pass',
  INSPECTION_FAIL: 'inspection_fail',
  OVERDUE: 'overdue',
  SCRAPPED: 'scrapped'
};

const StatusLabels = {
  [CylinderStatus.EMPTY]: '空瓶',
  [CylinderStatus.FILLING]: '充装中',
  [CylinderStatus.FILLED]: '已充装',
  [CylinderStatus.DELIVERED]: '已配送',
  [CylinderStatus.IN_USE]: '客户使用中',
  [CylinderStatus.COLLECTED]: '已回收',
  [CylinderStatus.INSPECTING]: '检验中',
  [CylinderStatus.INSPECTION_PASS]: '检验合格',
  [CylinderStatus.INSPECTION_FAIL]: '检验不合格',
  [CylinderStatus.OVERDUE]: '超期',
  [CylinderStatus.SCRAPPED]: '已报废'
};

const StatusTransitions = {
  [CylinderStatus.EMPTY]: [CylinderStatus.FILLING],
  [CylinderStatus.FILLING]: [CylinderStatus.FILLED],
  [CylinderStatus.FILLED]: [CylinderStatus.DELIVERED],
  [CylinderStatus.DELIVERED]: [CylinderStatus.IN_USE],
  [CylinderStatus.IN_USE]: [CylinderStatus.COLLECTED, CylinderStatus.OVERDUE],
  [CylinderStatus.COLLECTED]: [CylinderStatus.INSPECTING],
  [CylinderStatus.INSPECTING]: [CylinderStatus.INSPECTION_PASS, CylinderStatus.INSPECTION_FAIL],
  [CylinderStatus.INSPECTION_PASS]: [CylinderStatus.EMPTY, CylinderStatus.SCRAPPED],
  [CylinderStatus.INSPECTION_FAIL]: [CylinderStatus.SCRAPPED],
  [CylinderStatus.OVERDUE]: [CylinderStatus.COLLECTED, CylinderStatus.SCRAPPED],
  [CylinderStatus.SCRAPPED]: []
};

module.exports = { CylinderStatus, StatusLabels, StatusTransitions };
