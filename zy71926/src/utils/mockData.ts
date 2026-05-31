import type { Registration, StatusHistory, Anomaly, RegistrationStatus } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 10);
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

const normalArtworks = [
  { name: '山水清音图', artist: '李明远', registrant: '张策展', contact: '13800138001' },
  { name: '都市印象系列之一', artist: '王建国', registrant: '李老师', contact: '13800138002' },
  { name: '静物·瓶花', artist: '陈艺琳', registrant: '王老师', contact: '13800138003' },
  { name: '晨雾中的渔村', artist: '刘海涛', registrant: '赵馆长', contact: '13800138004' },
  { name: '抽象几何 No.5', artist: '周雅琴', registrant: '钱助理', contact: '13800138005' },
  { name: '故乡的云', artist: '吴大山', registrant: '孙主任', contact: '13800138006' },
  { name: '霓虹夜曲', artist: '郑小雨', registrant: '周老师', contact: '13800138007' },
  { name: '时光回廊', artist: '冯子轩', registrant: '吴馆长', contact: '13800138008' },
  { name: '静谧的午后', artist: '陈雨晴', registrant: '郑老师', contact: '13800138009' },
  { name: '风过麦田', artist: '褚云飞', registrant: '冯助理', contact: '13800138010' },
  { name: '古城遗韵', artist: '卫清风', registrant: '陈主任', contact: '13800138011' },
  { name: '梦境边缘', artist: '蒋梦婷', registrant: '褚老师', contact: '13800138012' },
  { name: '秋日私语', artist: '沈博文', registrant: '卫馆长', contact: '13800138013' },
  { name: '海的记忆', artist: '韩江雪', registrant: '蒋老师', contact: '13800138014' },
  { name: '竹林深处', artist: '杨墨白', registrant: '沈助理', contact: '13800138015' },
];

const locations = ['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'B-03', 'C-01', 'C-02', 'C-03', 'D-01', 'D-02'];

const statuses: RegistrationStatus[] = ['pending', 'confirmed', 'arrived', 'confirmed', 'confirmed'];

export function generateMockData(): {
  registrations: Registration[];
  statusHistories: StatusHistory[];
  anomalies: Anomaly[];
} {
  const registrations: Registration[] = [];
  const statusHistories: StatusHistory[] = [];
  const anomalies: Anomaly[] = [];

  normalArtworks.forEach((art, index) => {
    const id = generateId();
    const createdAt = daysAgo(7 - index);
    const status = statuses[index % statuses.length];
    const location = locations[index % locations.length];

    const reg: Registration = {
      id,
      artworkName: art.name,
      artist: art.artist,
      registrant: art.registrant,
      contact: art.contact,
      status,
      location,
      notes: `作品${index + 1}号`,
      attachmentUrl: `attachment_${id}.pdf`,
      attachmentReceivedAt: createdAt,
      source: 'manual',
      createdAt,
      updatedAt: status !== 'pending' ? hoursAgo(index * 2) : createdAt,
    };
    registrations.push(reg);

    statusHistories.push({
      id: generateId(),
      registrationId: id,
      fromStatus: null,
      toStatus: 'pending',
      operator: art.registrant,
      reason: '初始录入',
      createdAt,
    });

    if (status !== 'pending') {
      statusHistories.push({
        id: generateId(),
        registrationId: id,
        fromStatus: 'pending',
        toStatus: status,
        operator: '策展人审核',
        reason: '信息核对无误',
        createdAt: hoursAgo(index * 2 + 1),
      });
    }
  });

  const dupId1 = generateId();
  const dupId2 = generateId();
  registrations.push(
    {
      id: dupId1,
      artworkName: '重复作品·春山图',
      artist: '赵雷同',
      registrant: '重复报名人A',
      contact: '13900139001',
      status: 'pending',
      location: 'E-01',
      notes: '第一次报名',
      attachmentUrl: `dup_${dupId1}.pdf`,
      attachmentReceivedAt: daysAgo(3),
      source: 'import',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: dupId2,
      artworkName: '重复作品·春山图',
      artist: '赵雷同',
      registrant: '重复报名人B',
      contact: '13900139001',
      status: 'confirmed',
      location: 'E-02',
      notes: '重复报名，联系方式相同',
      attachmentUrl: `dup_${dupId2}.pdf`,
      attachmentReceivedAt: daysAgo(2),
      source: 'import',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    }
  );

  [dupId1, dupId2].forEach((id, i) => {
    anomalies.push({
      id: generateId(),
      registrationId: id,
      type: 'duplicate',
      severity: 'high',
      description: `与另一条记录作品名+艺术家完全匹配，且联系电话重复`,
      rule: '作品名 + 艺术家完全匹配，或联系电话重复',
      suggestion: '核实两条记录的真实性，合并或删除重复项',
      detectedAt: hoursAgo(12),
    });
    statusHistories.push({
      id: generateId(),
      registrationId: id,
      fromStatus: null,
      toStatus: i === 0 ? 'pending' : 'confirmed',
      operator: i === 0 ? '重复报名人A' : '重复报名人B',
      reason: '导入报名数据',
      createdAt: daysAgo(3 - i),
    });
  });

  const tripId1 = generateId();
  const tripId2 = generateId();
  const tripId3 = generateId();
  registrations.push(
    {
      id: tripId1,
      artworkName: '三重重复·夏荷',
      artist: '钱朵朵',
      registrant: '报名人1',
      contact: '13700137001',
      status: 'confirmed',
      location: 'F-01',
      source: 'import',
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: tripId2,
      artworkName: '三重重复·夏荷',
      artist: '钱朵朵',
      registrant: '报名人2',
      contact: '13700137002',
      status: 'pending',
      location: 'F-02',
      source: 'manual',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      id: tripId3,
      artworkName: '三重重复·夏荷',
      artist: '钱朵朵',
      registrant: '报名人3',
      contact: '13700137001',
      status: 'arrived',
      location: 'F-03',
      source: 'correction',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
    }
  );

  [tripId1, tripId2, tripId3].forEach((id) => {
    anomalies.push({
      id: generateId(),
      registrationId: id,
      type: 'duplicate',
      severity: 'high',
      description: '三条记录作品名+艺术家完全匹配，存在三重重复',
      rule: '作品名 + 艺术家完全匹配，或联系电话重复',
      suggestion: '核实三条记录来源，保留正确的一条，删除其余重复项',
      detectedAt: hoursAgo(6),
    });
  });

  const lateIds = [generateId(), generateId(), generateId(), generateId()];
  const lateArtworks = [
    { name: '晚到附件·秋雨', artist: '孙迟来', registrant: '李策展', contact: '13600136001' },
    { name: '晚到附件·冬梅', artist: '周慢慢', registrant: '王老师', contact: '13600136002' },
    { name: '晚到附件·星空', artist: '吴拖拖', registrant: '赵馆长', contact: '13600136003' },
    { name: '晚到附件·海洋', artist: '郑缓缓', registrant: '钱助理', contact: '13600136004' },
  ];

  lateIds.forEach((id, i) => {
    const createdAt = daysAgo(4 + i);
    const confirmedAt = daysAgo(3 + i);
    const attachmentAt = hoursAgo(25 + i * 2);

    registrations.push({
      id,
      artworkName: lateArtworks[i].name,
      artist: lateArtworks[i].artist,
      registrant: lateArtworks[i].registrant,
      contact: lateArtworks[i].contact,
      status: 'confirmed',
      location: `G-0${i + 1}`,
      attachmentUrl: `late_${id}.pdf`,
      attachmentReceivedAt: attachmentAt,
      source: 'manual',
      createdAt,
      updatedAt: attachmentAt,
    });

    anomalies.push({
      id: generateId(),
      registrationId: id,
      type: 'late_attachment',
      severity: 'medium',
      description: `报名已于${confirmedAt.slice(0, 10)}确认，但附件在${Math.round((now.getTime() - new Date(confirmedAt).getTime()) / 3600000)}小时后才上传`,
      rule: '报名确认后附件上传时间超过24小时',
      suggestion: '核实附件内容是否有效，联系报名人确认延迟原因',
      detectedAt: attachmentAt,
    });

    statusHistories.push(
      {
        id: generateId(),
        registrationId: id,
        fromStatus: null,
        toStatus: 'pending',
        operator: lateArtworks[i].registrant,
        reason: '报名录入，附件待上传',
        createdAt,
      },
      {
        id: generateId(),
        registrationId: id,
        fromStatus: 'pending',
        toStatus: 'confirmed',
        operator: '策展人审核',
        reason: '先确认报名，附件后续补交',
        createdAt: confirmedAt,
      },
      {
        id: generateId(),
        registrationId: id,
        fromStatus: 'confirmed',
        toStatus: 'confirmed',
        operator: lateArtworks[i].registrant,
        reason: '补交附件材料',
        createdAt: attachmentAt,
      }
    );
  });

  const missingIds = [generateId(), generateId(), generateId()];
  const missingArtworks = [
    { name: '缺失信息·无题01', artist: '', registrant: '缺艺术家', contact: '13500135001', missing: '艺术家' },
    { name: '', artist: '无名氏', registrant: '缺作品名', contact: '13500135002', missing: '作品名' },
    { name: '缺失信息·无题03', artist: '有作品', registrant: '', contact: '', missing: '报名人+联系方式' },
  ];

  missingIds.forEach((id, i) => {
    const createdAt = daysAgo(2 + i);
    registrations.push({
      id,
      artworkName: missingArtworks[i].name,
      artist: missingArtworks[i].artist,
      registrant: missingArtworks[i].registrant,
      contact: missingArtworks[i].contact,
      status: 'pending',
      location: `H-0${i + 1}`,
      source: 'import',
      createdAt,
      updatedAt: createdAt,
    });

    anomalies.push({
      id: generateId(),
      registrationId: id,
      type: 'missing_info',
      severity: 'high',
      description: `必填字段缺失：${missingArtworks[i].missing}`,
      rule: '作品名、艺术家、报名人、联系方式均为必填项，不能为空',
      suggestion: '联系报名人补充缺失信息，否则无法确认报名',
      detectedAt: createdAt,
    });

    statusHistories.push({
      id: generateId(),
      registrationId: id,
      fromStatus: null,
      toStatus: 'pending',
      operator: '批量导入',
      reason: '导入报名数据，信息不完整待补充',
      createdAt,
    });
  });

  const swapId1 = generateId();
  const swapId2 = generateId();

  registrations.push({
    id: swapId1,
    artworkName: '调换后作品·新晨曦',
    artist: '王调换',
    registrant: '孙策展',
    contact: '13400134001',
    status: 'swapped',
    location: 'I-01',
    notes: '原作品「旧黄昏」因损坏调换',
    attachmentUrl: `swap_${swapId1}.pdf`,
    attachmentReceivedAt: daysAgo(1),
    source: 'correction',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  });

  statusHistories.push(
    {
      id: generateId(),
      registrationId: swapId1,
      fromStatus: null,
      toStatus: 'pending',
      operator: '孙策展',
      reason: '初始报名：作品「旧黄昏」',
      createdAt: daysAgo(5),
    },
    {
      id: generateId(),
      registrationId: swapId1,
      fromStatus: 'pending',
      toStatus: 'confirmed',
      operator: '策展人审核',
      reason: '信息核对无误',
      createdAt: daysAgo(4),
    },
    {
      id: generateId(),
      registrationId: swapId1,
      fromStatus: 'confirmed',
      toStatus: 'swapped',
      operator: '李策展',
      reason: '运输途中作品损坏，经与艺术家协商同意调换',
      swapFrom: '旧黄昏',
      swapTo: '新晨曦',
      attachmentUrl: `swap_agreement_${swapId1}.pdf`,
      createdAt: daysAgo(1),
    }
  );

  anomalies.push({
    id: generateId(),
    registrationId: swapId1,
    type: 'swap_record',
    severity: 'medium',
    description: '作品已调换：旧黄昏 → 新晨曦',
    rule: '所有经历过状态变更为「已调换」的记录永久标记',
    suggestion: '布展和保险需特别注意，该作品与原报名信息不符',
    detectedAt: daysAgo(1),
  });

  registrations.push({
    id: swapId2,
    artworkName: '调换后作品·新山水',
    artist: '陈更换',
    registrant: '周老师',
    contact: '13400134002',
    status: 'arrived',
    location: 'I-02',
    notes: '原作品「旧水墨」尺寸不符调换',
    attachmentUrl: `swap_${swapId2}.pdf`,
    attachmentReceivedAt: hoursAgo(10),
    source: 'correction',
    createdAt: daysAgo(6),
    updatedAt: hoursAgo(10),
  });

  statusHistories.push(
    {
      id: generateId(),
      registrationId: swapId2,
      fromStatus: null,
      toStatus: 'pending',
      operator: '周老师',
      reason: '初始报名：作品「旧水墨」',
      createdAt: daysAgo(6),
    },
    {
      id: generateId(),
      registrationId: swapId2,
      fromStatus: 'pending',
      toStatus: 'confirmed',
      operator: '策展人审核',
      reason: '信息核对无误',
      createdAt: daysAgo(5),
    },
    {
      id: generateId(),
      registrationId: swapId2,
      fromStatus: 'confirmed',
      toStatus: 'swapped',
      operator: '王策展',
      reason: '原作品尺寸超出展位限制，调换为尺寸合适的作品',
      swapFrom: '旧水墨',
      swapTo: '新山水',
      createdAt: daysAgo(2),
    },
    {
      id: generateId(),
      registrationId: swapId2,
      fromStatus: 'swapped',
      toStatus: 'arrived',
      operator: '布展工人A',
      reason: '作品已到场，核对无误',
      createdAt: hoursAgo(10),
    }
  );

  anomalies.push({
    id: generateId(),
    registrationId: swapId2,
    type: 'swap_record',
    severity: 'medium',
    description: '作品已调换：旧水墨 → 新山水',
    rule: '所有经历过状态变更为「已调换」的记录永久标记',
    suggestion: '布展和保险需特别注意，该作品与原报名信息不符',
    detectedAt: daysAgo(2),
  });

  const conflictId1 = generateId();
  const conflictId2 = generateId();

  registrations.push(
    {
      id: conflictId1,
      artworkName: '冲突作品·争夺A位上',
      artist: '甲艺术家',
      registrant: '甲方',
      contact: '13300133001',
      status: 'confirmed',
      location: 'J-01',
      source: 'manual',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
    },
    {
      id: conflictId2,
      artworkName: '冲突作品·争夺A位下',
      artist: '乙艺术家',
      registrant: '乙方',
      contact: '13300133002',
      status: 'confirmed',
      location: 'J-01',
      source: 'manual',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    }
  );

  [conflictId1, conflictId2].forEach((id, i) => {
    anomalies.push({
      id: generateId(),
      registrationId: id,
      type: 'conflict',
      severity: 'high',
      description: `展位 J-01 被多个作品分配，存在冲突`,
      rule: '同一展位不能同时分配给多个作品',
      suggestion: '立即协调调整展位，避免布展现场混乱',
      detectedAt: hoursAgo(8),
    });
    statusHistories.push({
      id: generateId(),
      registrationId: id,
      fromStatus: null,
      toStatus: 'pending',
      operator: i === 0 ? '甲方' : '乙方',
      reason: '报名录入',
      createdAt: daysAgo(4 - i),
    });
    statusHistories.push({
      id: generateId(),
      registrationId: id,
      fromStatus: 'pending',
      toStatus: 'confirmed',
      operator: '策展人审核',
      reason: '信息核对无误',
      createdAt: daysAgo(3 - i),
    });
  });

  return { registrations, statusHistories, anomalies };
}
