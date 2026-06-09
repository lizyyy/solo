import type { HistoryEvent, Material, VersionNode, Zone } from '@/types';

export const VERSIONS: VersionNode[] = [
  {
    tag: 'v2024.03.01',
    label: '设计院初版',
    releasedAt: '2024-03-01T09:00:00+08:00',
    note: '设计院提交的初始消防分区图纸，含B1-F2共20个分区',
    zonesWithDelta: ['B1-A01', 'B1-A02', 'B1-A03', 'B1-B01', 'B1-B02', 'F1-A01', 'F1-A02', 'F1-A03', 'F1-B01', 'F1-B02', 'F1-C01', 'F1-C02', 'F2-A01', 'F2-A02', 'F2-B01', 'F2-B02', 'F2-C01', 'F2-C02', 'F2-D01', 'F2-D02'],
    coordinateOffset: 0,
    missingMaterials: [],
  },
  {
    tag: 'v2024.03.18',
    label: '审图意见修订',
    releasedAt: '2024-03-18T14:30:00+08:00',
    note: '根据审图公司意见调整F1-C01/C02和F2-B01边界',
    zonesWithDelta: ['F1-C01', 'F1-C02', 'F2-B01'],
    coordinateOffset: 0,
    missingMaterials: [],
  },
  {
    tag: 'v2024.04.20',
    label: '现场变更·坐标偏移',
    releasedAt: '2024-04-20T11:00:00+08:00',
    note: '施工队反馈B1层结构柱位偏移，本次提交版本未含CAD对齐文件，坐标整体偏移35mm',
    zonesWithDelta: ['B1-A01', 'B1-A02', 'B1-A03', 'B1-B01', 'B1-B02'],
    coordinateOffset: 35,
    missingMaterials: [
      '① B1层结构柱位现场测量记录（全站仪导出CSV）',
      '② 设计院CAD基准对齐文件（.dwg带坐标系）',
      '③ 偏移前后分区边界对比截图（带坐标标注）',
    ],
  },
  {
    tag: 'v2024.05.08',
    label: '补对齐·后补备注版',
    releasedAt: '2024-05-08T16:20:00+08:00',
    note: '补入B1层对齐文件和现场测量记录，同时附加3条后补备注',
    zonesWithDelta: ['B1-A01', 'B1-A03', 'B1-B02', 'F2-A02'],
    coordinateOffset: 0,
    missingMaterials: [],
  },
  {
    tag: 'v2024.05.28',
    label: '最新版·含口头备注',
    releasedAt: '2024-05-28T10:15:00+08:00',
    note: '早会讨论后的最新版，含阿乔口头追加的F1和F2共4条备注，部分分区结论待定',
    zonesWithDelta: ['F1-A02', 'F1-B01', 'F2-B02', 'F2-C01', 'F2-D01'],
    coordinateOffset: 0,
    missingMaterials: [],
  },
];

const mkMat = (
  id: string,
  source: Material['source'],
  title: string,
  content: string,
  recordedAt: string,
  operator: string,
  affectsConclusion: boolean
): Material => ({ id, source, title, content, recordedAt, operator, affectsConclusion });

const MATERIALS_BANK: Record<string, Material[]> = {
  'B1-A01': [
    mkMat('m_b1a01_1', 'cad_old', '2024-03 B1层CAD图层（初版）', '初版分区边界，防火卷帘位置Q轴-12轴，与2024.04.20偏移版本不一致', '2024-03-01T09:00:00+08:00', '设计院·李工', true),
    mkMat('m_b1a01_2', 'note_added', '补录：B1柱位测量对齐说明', '全站仪测量记录附件显示，偏移35mm后Q轴向北平移，卷帘位置需重新核对', '2024-05-08T10:00:00+08:00', '施工·阿乔', true),
    mkMat('m_b1a01_3', 'note_oral', '早会口头：分区面积误差±1.2%', '阿乔口述，待CAD复核后录入正式备注，目前不计入结论', '2024-05-28T10:15:00+08:00', '施工·阿乔', false),
  ],
  'B1-A02': [
    mkMat('m_b1a02_1', 'cad_old', '2024-03 B1层CAD图层（初版）', '排烟机房边界位于P轴，偏移版本与结构柱冲突', '2024-03-01T09:00:00+08:00', '设计院·李工', true),
    mkMat('m_b1a02_2', 'note_oral', '现场口头：柱位已浇筑', '阿乔口述，B1-A02北侧柱已浇筑，无法调整，需设计院确认', '2024-04-20T11:00:00+08:00', '施工·阿乔', true),
  ],
  'B1-A03': [
    mkMat('m_b1a03_1', 'cad_old', '2024-03 B1层CAD图层（初版）', '配电室防火分区面积72㎡，符合规范', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_b1a03_2', 'note_added', '补录：柴油发电机房划入B1-A03', '2024.05.08补入发电机房，面积增加22㎡，分区总面积94㎡，仍符合甲级防火门分隔要求', '2024-05-08T11:30:00+08:00', '设计院·王工', true),
  ],
  'B1-B01': [
    mkMat('m_b1b01_1', 'cad_old', '2024-03 B1层CAD图层（初版）', '车库防火分区I，面积3850㎡，设自动喷淋，符合≤4000要求', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_b1b01_2', 'note_oral', '口头：车位增加12个', '施工队现场反馈车位调整，边界不变，面积不变，不影响分区结论', '2024-04-20T11:00:00+08:00', '施工·阿乔', false),
  ],
  'B1-B02': [
    mkMat('m_b1b02_1', 'cad_old', '2024-03 B1层CAD图层（初版）', '车库防火分区II，面积3920㎡，临近规范上限', '2024-03-01T09:00:00+08:00', '设计院·李工', true),
    mkMat('m_b1b02_2', 'note_added', '补录：增设设备间面积+45㎡', '2024.05.08后补设备间，总面积3965㎡，自动喷淋下仍符合≤4000', '2024-05-08T13:00:00+08:00', '设计院·王工', true),
  ],
  'F1-A01': [
    mkMat('m_f1a01_1', 'cad_old', '2024-03 F1层CAD图层', '大堂防火分区，面积1280㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f1a01_2', 'note_added', '后补：增设玻璃防火隔断', '2024.03.18审图意见后加，分隔大堂与走廊，分区面积不变', '2024-03-18T14:30:00+08:00', '设计院·王工', false),
  ],
  'F1-A02': [
    mkMat('m_f1a02_1', 'cad_old', '2024-03 F1层CAD图层', '商业区A，面积1650㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f1a02_2', 'note_added', '后补：商铺隔油池位置', '2024.03.18补入，位置不影响分区边界', '2024-03-18T14:30:00+08:00', '设计院·王工', false),
    mkMat('m_f1a02_3', 'note_oral', '口头：5月底加开疏散门', '阿乔早会口述，F1-A02西侧新增疏散门通往F1-B01，边界需微调，待设计院出图后确认', '2024-05-28T10:20:00+08:00', '施工·阿乔', true),
  ],
  'F1-A03': [
    mkMat('m_f1a03_1', 'cad_old', '2024-03 F1层CAD图层', '商业区B，面积1580㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
  ],
  'F1-B01': [
    mkMat('m_f1b01_1', 'cad_old', '2024-03 F1层CAD图层', '办公区A，面积1720㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f1b01_2', 'note_oral', '口头：机房占用办公区', '阿乔口述，弱电/消防控制室占用F1-B01东北角约60㎡，需从该分区划出单独分区，待补CAD', '2024-05-28T10:25:00+08:00', '施工·阿乔', true),
  ],
  'F1-B02': [
    mkMat('m_f1b02_1', 'cad_old', '2024-03 F1层CAD图层', '办公区B，面积1680㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f1b02_2', 'note_added', '后补：茶水间调整', '2024.03.18审图意见后移茶水间位置，边界不变', '2024-03-18T14:30:00+08:00', '设计院·王工', false),
  ],
  'F1-C01': [
    mkMat('m_f1c01_1', 'cad_old', '2024-03 F1层CAD图层（初版边界）', '仓库区，初版面积920㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', true),
    mkMat('m_f1c01_2', 'cad_old', '2024-03.18 F1层CAD图层（修订）', '审图修订版：仓库与走廊边界向北移2m，面积860㎡，丙类仓库≤1000㎡，符合', '2024-03-18T14:30:00+08:00', '设计院·王工', true),
  ],
  'F1-C02': [
    mkMat('m_f1c02_1', 'cad_old', '2024-03 F1层CAD图层（初版边界）', '设备用房，初版面积与仓库共用疏散', '2024-03-01T09:00:00+08:00', '设计院·李工', true),
    mkMat('m_f1c02_2', 'note_added', '后补：独立疏散楼梯说明', '2024.03.18修订后独立疏散楼梯，不再与F1-C01共用，分区合规', '2024-03-18T14:30:00+08:00', '设计院·王工', true),
  ],
  'F2-A01': [
    mkMat('m_f2a01_1', 'cad_old', '2024-03 F2层CAD图层', '客房区A，面积2250㎡，高层客房防火分区≤2500', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
  ],
  'F2-A02': [
    mkMat('m_f2a02_1', 'cad_old', '2024-03 F2层CAD图层', '客房区B，面积2380㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f2a02_2', 'note_added', '补录：服务间+布草间合并', '2024.05.08补充，面积+15㎡，总2395㎡，仍≤2500', '2024-05-08T14:10:00+08:00', '设计院·王工', false),
  ],
  'F2-B01': [
    mkMat('m_f2b01_1', 'cad_old', '2024-03 F2层CAD图层（初版）', '餐饮区初版边界，与客房F2-A02防火卷帘位置错位1.2m', '2024-03-01T09:00:00+08:00', '设计院·李工', true),
    mkMat('m_f2b01_2', 'cad_old', '2024-03.18 F2层CAD图层（修订）', '卷帘位置对齐，餐饮区面积2180㎡', '2024-03-18T14:30:00+08:00', '设计院·王工', true),
    mkMat('m_f2b01_3', 'note_oral', '口头：厨房排油烟井改位', '阿乔口述，油烟井位置不影响分区边界', '2024-05-28T10:30:00+08:00', '施工·阿乔', false),
  ],
  'F2-B02': [
    mkMat('m_f2b02_1', 'cad_old', '2024-03 F2层CAD图层', '会议室A，面积1680㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f2b02_2', 'note_oral', '口头：活动隔断可合并到F2-C01', '早会讨论，若举办大型活动可通过活动隔断与F2-C01连通，消防分区边界仍按固定墙', '2024-05-28T10:32:00+08:00', '施工·阿乔', false),
  ],
  'F2-C01': [
    mkMat('m_f2c01_1', 'cad_old', '2024-03 F2层CAD图层', '会议室B，面积1720㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f2c01_2', 'note_oral', '口头：疏散出口数量质疑', '阿乔口述，F2-C01南侧疏散门距离相邻分区门距离不足5m，需设计院复核，待CAD出图确认', '2024-05-28T10:35:00+08:00', '施工·阿乔', true),
  ],
  'F2-C02': [
    mkMat('m_f2c02_1', 'cad_old', '2024-03 F2层CAD图层', '行政办公，面积1580㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
  ],
  'F2-D01': [
    mkMat('m_f2d01_1', 'cad_old', '2024-03 F2层CAD图层', '健身区，面积1350㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
    mkMat('m_f2d01_2', 'note_oral', '口头：泳池区域划入', '阿乔口述，室内泳池原在独立分区，现与健身区合并，面积+420㎡=1770㎡，但需甲级防火分隔与储氯间，待设计院出图', '2024-05-28T10:40:00+08:00', '施工·阿乔', true),
  ],
  'F2-D02': [
    mkMat('m_f2d02_1', 'cad_old', '2024-03 F2层CAD图层', 'SPA区，面积1420㎡', '2024-03-01T09:00:00+08:00', '设计院·李工', false),
  ],
};

const FLOOR_HEIGHT = 4;

const ZONE_LAYOUT: Record<string, { floor: number; pos: [number, number, number]; size: [number, number, number]; name: string; status: Zone['status'] }> = {
  'B1-A01': { floor: -1, pos: [-6, 0, -6], size: [5, FLOOR_HEIGHT, 5], name: 'B1·变配电室', status: 'pending' },
  'B1-A02': { floor: -1, pos: [0, 0, -6], size: [5, FLOOR_HEIGHT, 5], name: 'B1·排烟机房', status: 'rejected' },
  'B1-A03': { floor: -1, pos: [6, 0, -6], size: [5, FLOOR_HEIGHT, 5], name: 'B1·发电机房', status: 'passed' },
  'B1-B01': { floor: -1, pos: [-6, 0, 0], size: [5, FLOOR_HEIGHT, 5], name: 'B1·车库I', status: 'passed' },
  'B1-B02': { floor: -1, pos: [0, 0, 0], size: [5, FLOOR_HEIGHT, 5], name: 'B1·车库II', status: 'pending' },
  'F1-A01': { floor: 1, pos: [-6, FLOOR_HEIGHT * 1.5, -6], size: [5, FLOOR_HEIGHT, 5], name: 'F1·大堂', status: 'passed' },
  'F1-A02': { floor: 1, pos: [0, FLOOR_HEIGHT * 1.5, -6], size: [5, FLOOR_HEIGHT, 5], name: 'F1·商业A', status: 'pending' },
  'F1-A03': { floor: 1, pos: [6, FLOOR_HEIGHT * 1.5, -6], size: [5, FLOOR_HEIGHT, 5], name: 'F1·商业B', status: 'passed' },
  'F1-B01': { floor: 1, pos: [-6, FLOOR_HEIGHT * 1.5, 0], size: [5, FLOOR_HEIGHT, 5], name: 'F1·办公A', status: 'pending' },
  'F1-B02': { floor: 1, pos: [0, FLOOR_HEIGHT * 1.5, 0], size: [5, FLOOR_HEIGHT, 5], name: 'F1·办公B', status: 'passed' },
  'F1-C01': { floor: 1, pos: [6, FLOOR_HEIGHT * 1.5, 0], size: [5, FLOOR_HEIGHT, 5], name: 'F1·仓库', status: 'passed' },
  'F1-C02': { floor: 1, pos: [-6, FLOOR_HEIGHT * 1.5, 6], size: [5, FLOOR_HEIGHT, 5], name: 'F1·设备用房', status: 'passed' },
  'F2-A01': { floor: 2, pos: [-6, FLOOR_HEIGHT * 3, -6], size: [5, FLOOR_HEIGHT, 5], name: 'F2·客房A', status: 'passed' },
  'F2-A02': { floor: 2, pos: [0, FLOOR_HEIGHT * 3, -6], size: [5, FLOOR_HEIGHT, 5], name: 'F2·客房B', status: 'passed' },
  'F2-B01': { floor: 2, pos: [6, FLOOR_HEIGHT * 3, -6], size: [5, FLOOR_HEIGHT, 5], name: 'F2·餐饮', status: 'passed' },
  'F2-B02': { floor: 2, pos: [-6, FLOOR_HEIGHT * 3, 0], size: [5, FLOOR_HEIGHT, 5], name: 'F2·会议A', status: 'passed' },
  'F2-C01': { floor: 2, pos: [0, FLOOR_HEIGHT * 3, 0], size: [5, FLOOR_HEIGHT, 5], name: 'F2·会议B', status: 'pending' },
  'F2-C02': { floor: 2, pos: [6, FLOOR_HEIGHT * 3, 0], size: [5, FLOOR_HEIGHT, 5], name: 'F2·行政办公', status: 'passed' },
  'F2-D01': { floor: 2, pos: [-6, FLOOR_HEIGHT * 3, 6], size: [5, FLOOR_HEIGHT, 5], name: 'F2·健身区', status: 'pending' },
  'F2-D02': { floor: 2, pos: [0, FLOOR_HEIGHT * 3, 6], size: [5, FLOOR_HEIGHT, 5], name: 'F2·SPA', status: 'passed' },
};

const ALL_VERSION_TAGS = VERSIONS.map((v) => v.tag);

export const ZONES: Zone[] = Object.keys(MATERIALS_BANK).map((id) => {
  const layout = ZONE_LAYOUT[id];
  const floor = id.startsWith('B1') ? -1 : id.startsWith('F1') ? 1 : 2;
  const firstAppearIdx = Math.max(
    0,
    VERSIONS.findIndex((v) => v.zonesWithDelta.includes(id) || v.tag === 'v2024.03.01')
  );
  const versionTagsFromFirst = ALL_VERSION_TAGS.slice(firstAppearIdx >= 0 ? firstAppearIdx : 0);
  return {
    id,
    name: layout.name,
    floor,
    position: layout.pos,
    size: layout.size,
    status: layout.status,
    materials: MATERIALS_BANK[id],
    versionTags: versionTagsFromFirst,
  };
});

export const HISTORY_EVENTS: HistoryEvent[] = [
  {
    id: 'h_001',
    at: '2024-03-18T15:00:00+08:00',
    zoneId: 'F1-C01',
    oldConclusion: 'pending',
    newConclusion: 'passed',
    oldMaterialsSnapshot: [MATERIALS_BANK['F1-C01'][0]],
    newNote: '审图修订版边界北移2m，面积由920→860㎡，丙类仓库≤1000㎡符合',
    reason: 'CAD旧版（初版）面积接近上限，审图修订版后合规',
    operator: '设计院·王工',
    relatedVersionTag: 'v2024.03.18',
  },
  {
    id: 'h_002',
    at: '2024-03-18T15:10:00+08:00',
    zoneId: 'F1-C02',
    oldConclusion: 'rejected',
    newConclusion: 'passed',
    oldMaterialsSnapshot: [MATERIALS_BANK['F1-C02'][0]],
    newNote: '后补独立疏散楼梯说明，不再与F1-C01共用',
    reason: 'CAD旧版共用疏散违反规范，后补备注修订后独立疏散合规',
    operator: '设计院·王工',
    relatedVersionTag: 'v2024.03.18',
  },
  {
    id: 'h_003',
    at: '2024-04-20T11:20:00+08:00',
    zoneId: 'B1-A02',
    oldConclusion: 'pending',
    newConclusion: 'rejected',
    oldMaterialsSnapshot: [MATERIALS_BANK['B1-A02'][0]],
    newNote: '口头备注：B1-A02北侧柱已浇筑，边界与结构柱冲突',
    reason: 'CAD旧版与现场实际不符，口头备注坐实柱位冲突导致驳回',
    operator: '施工·阿乔',
    relatedVersionTag: 'v2024.04.20',
  },
  {
    id: 'h_004',
    at: '2024-05-08T10:15:00+08:00',
    zoneId: 'B1-A01',
    oldConclusion: 'rejected',
    newConclusion: 'pending',
    oldMaterialsSnapshot: [MATERIALS_BANK['B1-A01'][0]],
    newNote: '后补备注：B1柱位测量对齐说明，偏移35mm后卷帘位置重新核对中',
    reason: 'CAD旧版边界偏移，后补测量记录后问题明确，待设计院出最终图',
    operator: '施工·阿乔',
    relatedVersionTag: 'v2024.05.08',
  },
  {
    id: 'h_005',
    at: '2024-05-08T11:40:00+08:00',
    zoneId: 'B1-A03',
    oldConclusion: 'passed',
    newConclusion: 'passed',
    oldMaterialsSnapshot: [MATERIALS_BANK['B1-A03'][0]],
    newNote: '后补备注：发电机房划入，面积+22㎡仍合规',
    reason: '补录材料不改变结论，仅增加材料完整性',
    operator: '设计院·王工',
    relatedVersionTag: 'v2024.05.08',
  },
  {
    id: 'h_006',
    at: '2024-05-28T10:22:00+08:00',
    zoneId: 'F1-A02',
    oldConclusion: 'passed',
    newConclusion: 'pending',
    oldMaterialsSnapshot: [MATERIALS_BANK['F1-A02'][0], MATERIALS_BANK['F1-A02'][1]],
    newNote: '口头备注：5月底西侧新增疏散门通往F1-B01，边界微调待CAD',
    reason: '口头备注新增疏散门影响分区边界，待设计院确认',
    operator: '施工·阿乔',
    relatedVersionTag: 'v2024.05.28',
  },
  {
    id: 'h_007',
    at: '2024-05-28T10:38:00+08:00',
    zoneId: 'F2-C01',
    oldConclusion: 'passed',
    newConclusion: 'pending',
    oldMaterialsSnapshot: [MATERIALS_BANK['F2-C01'][0]],
    newNote: '口头备注：南侧疏散门与相邻分区门距离不足5m',
    reason: '口头备注指出疏散距离问题，需设计院CAD复核',
    operator: '施工·阿乔',
    relatedVersionTag: 'v2024.05.28',
  },
  {
    id: 'h_008',
    at: '2024-05-28T10:42:00+08:00',
    zoneId: 'F2-D01',
    oldConclusion: 'passed',
    newConclusion: 'pending',
    oldMaterialsSnapshot: [MATERIALS_BANK['F2-D01'][0]],
    newNote: '口头备注：泳池与健身区合并，+420㎡及储氯间防火分隔待确认',
    reason: '口头备注改变分区面积与分隔方式，需CAD及甲级防火门确认',
    operator: '施工·阿乔',
    relatedVersionTag: 'v2024.05.28',
  },
];
