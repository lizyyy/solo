import { 
  TicketExport, 
  AudioFileRemark, 
  LessonVerification, 
  AnomalyRecord,
  SplitStatus,
  NextActionOwner,
  ChangeHistory
} from '../models';
import { dataStore } from './dataStore';
import { processTicketWithAudio } from './anomalyDetector';

export interface ReviewContext {
  ticket: TicketExport;
  audioRemark: AudioFileRemark | undefined;
  verification: LessonVerification | undefined;
  anomalies: AnomalyRecord[];
  changeHistories: ChangeHistory[];
}

export function getReviewContext(ticketId: string): ReviewContext | null {
  const ticket = dataStore.getTicket(ticketId);
  if (!ticket) return null;

  const audioRemark = dataStore.getAudioRemarkByTicket(ticketId);
  const verification = dataStore.getVerificationByTicket(ticketId);
  const anomalies = dataStore.getAnomaliesByTicket(ticketId);
  const changeHistories = dataStore.getChangeHistoriesByTicket(ticketId);

  return { ticket, audioRemark, verification, anomalies, changeHistories };
}

export function managerReview(
  ticketId: string,
  action: 'approve' | 'escalate_to_audio',
  reviewNotes: string
): { success: boolean; message: string; verification?: LessonVerification } {
  const context = getReviewContext(ticketId);
  if (!context) {
    return { success: false, message: `未找到票单 ${ticketId}` };
  }

  const { ticket, verification, anomalies } = context;
  if (!verification) {
    return { success: false, message: `票单 ${ticketId} 暂无课时核销单` };
  }

  if (action === 'approve') {
    const unresolvedAnomalies = anomalies.filter(a => !a.resolved);
    if (unresolvedAnomalies.length > 0) {
      return { 
        success: false, 
        message: `票单 ${ticketId} 存在 ${unresolvedAnomalies.length} 条未解决的异常（${unresolvedAnomalies.map(a => a.id).join(', ')}），无法直接通过。请先让录音师小段补录后再复核。` 
      };
    }

    const updatedVerification = dataStore.updateVerification(
      verification.verificationNo,
      {
        status: 'verified',
        reviewedBy: '店长',
        nextAction: NextActionOwner.SYSTEM,
        actionNotes: `店长复核通过：${reviewNotes}`,
        verifiedAt: new Date().toISOString()
      },
      { changedBy: '店长', changeReason: reviewNotes }
    );

    ticket.status = SplitStatus.MANAGER_REVIEWED;
    dataStore.addTicket(ticket, { changedBy: '店长', changeReason: reviewNotes });

    return { 
      success: true, 
      message: `票单 ${ticketId} 复核通过，课时核销单已确认（状态：已核销）`,
      verification: updatedVerification
    };
  }

  if (action === 'escalate_to_audio') {
    const updatedVerification = dataStore.updateVerification(
      verification.verificationNo,
      {
        nextAction: NextActionOwner.AUDIO_ENGINEER,
        actionNotes: `店长复核意见：${reviewNotes}。已转交录音师小段补录音频文件备注。`
      },
      { changedBy: '店长', changeReason: reviewNotes }
    );

    return { 
      success: true, 
      message: `票单 ${ticketId} 已转交录音师小段处理（下一步：录音师小段）`,
      verification: updatedVerification
    };
  }

  return { success: false, message: '未知操作' };
}

export function createSampleAudioRemarks(): AudioFileRemark[] {
  const remarks: AudioFileRemark[] = [
    {
      id: `AUD-${Date.now()}-1`,
      audioFileId: 'AUD20250601001',
      ticketId: 'TK20250601001',
      musicianName: '张小北',
      actualAuthorizedCities: ['北京', '上海', '广州', '深圳'],
      audioDuration: 7200,
      qualityCheck: 'pass',
      remark: '音频质量正常，授权地区与票务一致',
      updatedBy: '系统导入',
      updatedAt: new Date().toISOString()
    },
    {
      id: `AUD-${Date.now()}-2`,
      audioFileId: 'AUD20250601002',
      ticketId: 'TK20250601002',
      musicianName: '李南风',
      actualAuthorizedCities: ['北京', '上海', '杭州'],
      audioDuration: 5400,
      qualityCheck: 'pass',
      remark: '音频正常，注意：实际授权地区包含杭州，票务表中可能遗漏',
      updatedBy: '系统导入',
      updatedAt: new Date().toISOString()
    },
    {
      id: `AUD-${Date.now()}-3`,
      audioFileId: 'AUD20250602001',
      ticketId: 'TK20250602001',
      musicianName: '王夕阳',
      actualAuthorizedCities: ['北京', '上海', '广州', '深圳', '成都'],
      audioDuration: 8100,
      qualityCheck: 'pass',
      remark: '音频质量良好，授权地区有新增：深圳、成都',
      updatedBy: '系统导入',
      updatedAt: new Date().toISOString()
    },
    {
      id: `AUD-${Date.now()}-4`,
      audioFileId: 'AUD20250602002',
      ticketId: 'TK20250602002',
      musicianName: '陈星辰',
      actualAuthorizedCities: ['北京'],
      audioDuration: 3600,
      qualityCheck: 'pass',
      remark: '音频正常，授权地区一致',
      updatedBy: '系统导入',
      updatedAt: new Date().toISOString()
    },
    {
      id: `AUD-${Date.now()}-5`,
      audioFileId: 'AUD20250603001',
      ticketId: 'TK20250603001',
      musicianName: '赵云端',
      actualAuthorizedCities: ['北京', '上海', '广州', '深圳', '杭州', '武汉'],
      audioDuration: 10800,
      qualityCheck: 'pass',
      remark: '音频质量优秀，注意：武汉地区授权可能未在票务表中登记',
      updatedBy: '系统导入',
      updatedAt: new Date().toISOString()
    }
  ];

  for (const remark of remarks) {
    dataStore.addAudioRemark(remark);
  }

  return remarks;
}

export function engineerUpdateAudioRemark(
  ticketId: string,
  updatedCities: string[],
  remark: string
): { 
  success: boolean; 
  message: string; 
  audioRemark?: AudioFileRemark; 
  verification?: LessonVerification;
  resolvedAnomalies?: AnomalyRecord[];
} {
  const context = getReviewContext(ticketId);
  if (!context) {
    return { success: false, message: `未找到票单 ${ticketId}` };
  }

  const { ticket, audioRemark, verification } = context;
  if (!audioRemark) {
    return { success: false, message: `票单 ${ticketId} 暂无音频文件备注` };
  }
  if (!verification) {
    return { success: false, message: `票单 ${ticketId} 暂无课时核销单` };
  }

  const oldCities = [...verification.authorizedCities];
  const oldRemark = audioRemark.remark;

  const updatedAudioRemark: AudioFileRemark = {
    ...audioRemark,
    actualAuthorizedCities: updatedCities,
    remark,
    updatedBy: '录音师小段',
    updatedAt: new Date().toISOString()
  };
  dataStore.addAudioRemark(updatedAudioRemark, { 
    changedBy: '录音师小段', 
    changeReason: remark 
  });

  dataStore.updateVerification(
    verification.verificationNo,
    { authorizedCities: [...updatedCities] },
    { changedBy: '录音师小段', changeReason: remark }
  );

  const result = processTicketWithAudio(ticket, updatedAudioRemark, { isRecheck: true });

  const hasUnresolved = result.anomalies.some(a => !a.resolved);
  const updatedVerification = dataStore.updateVerification(
    verification.verificationNo,
    {
      nextAction: NextActionOwner.MANAGER,
      actionNotes: hasUnresolved
        ? `录音师小段已更新音频备注（原：${oldCities.join('、')} → 新：${updatedCities.join('、')}，原备注："${oldRemark}"），但仍存在异常，请店长再次复核。最新备注：${remark}`
        : `录音师小段已补全音频备注（原：${oldCities.join('、')} → 新：${updatedCities.join('、')}，原备注："${oldRemark}"），异常已解决，请店长复核。备注：${remark}`,
      reservedReason: hasUnresolved ? result.verification.reservedReason : '',
      missingMaterials: hasUnresolved ? result.verification.missingMaterials : [],
      status: hasUnresolved ? 'reserved' : 'pending'
    },
    { changedBy: '录音师小段', changeReason: remark }
  );

  ticket.status = SplitStatus.AUDIO_FIXED;
  dataStore.addTicket(ticket, { changedBy: '录音师小段', changeReason: remark });

  return {
    success: true,
    message: hasUnresolved
      ? `票单 ${ticketId} 音频备注已更新（${oldCities.join('、')} → ${updatedCities.join('、')}），但仍有异常待店长复核`
      : `票单 ${ticketId} 音频备注已更新（${oldCities.join('、')} → ${updatedCities.join('、')}），异常已解决，等待店长最终复核`,
    audioRemark: updatedAudioRemark,
    verification: updatedVerification,
    resolvedAnomalies: result.newlyResolvedAnomalies
  };
}

export function resolveAnomalyByManager(
  anomalyId: string,
  resolutionNotes: string
): { success: boolean; message: string; anomaly?: AnomalyRecord } {
  const anomaly = dataStore.resolveAnomaly(anomalyId, '店长', resolutionNotes);
  if (!anomaly) {
    return { success: false, message: `未找到异常记录 ${anomalyId}` };
  }

  const verification = dataStore.getVerificationByTicket(anomaly.ticketId);
  if (verification) {
    const remainingAnomalies = dataStore.getAnomaliesByTicket(anomaly.ticketId).filter(a => !a.resolved);
    
    if (remainingAnomalies.length === 0) {
      dataStore.updateVerification(verification.verificationNo, {
        status: 'pending',
        reservedReason: '',
        missingMaterials: [],
        nextAction: NextActionOwner.MANAGER,
        actionNotes: `异常已处理：${resolutionNotes}。等待店长最终复核。`
      }, { changedBy: '店长', changeReason: resolutionNotes });
    }
  }

  return {
    success: true,
    message: `异常 ${anomalyId} 已标记为解决`,
    anomaly
  };
}

export function runFullDemoWorkflow(forceReset: boolean = true): {
  tickets: TicketExport[];
  audioRemarks: AudioFileRemark[];
  verifications: LessonVerification[];
  anomalies: AnomalyRecord[];
} {
  if (forceReset) {
    dataStore.clear();
  } else if (dataStore.hasData()) {
    return {
      tickets: dataStore.getAllTickets(),
      audioRemarks: dataStore.getAllAudioRemarks(),
      verifications: dataStore.getAllVerifications(),
      anomalies: dataStore.getAllAnomalies()
    };
  }
  
  const { importSampleTickets } = require('./ticketImporter');
  const tickets = importSampleTickets();
  const audioRemarks = createSampleAudioRemarks();

  for (const ticket of tickets) {
    const audioRemark = dataStore.getAudioRemark(ticket.audioFileId);
    if (audioRemark) {
      processTicketWithAudio(ticket, audioRemark);
    }
  }

  return {
    tickets: dataStore.getAllTickets(),
    audioRemarks: dataStore.getAllAudioRemarks(),
    verifications: dataStore.getAllVerifications(),
    anomalies: dataStore.getAllAnomalies()
  };
}
