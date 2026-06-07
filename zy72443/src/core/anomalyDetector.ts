import { 
  AnomalyRecord, 
  AnomalyType, 
  AudioFileRemark, 
  TicketExport,
  LessonVerification,
  NextActionOwner,
  SplitStatus
} from '../models';
import { dataStore } from './dataStore';

const STANDARD_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '重庆', '西安'];

export function detectMissingCities(
  ticket: TicketExport,
  audioRemark: AudioFileRemark
): string[] {
  const ticketCities = new Set(ticket.authorizedCities);
  const audioCities = new Set(audioRemark.actualAuthorizedCities);
  
  const missingInTicket: string[] = [];
  
  for (const city of audioCities) {
    if (!ticketCities.has(city)) {
      missingInTicket.push(city);
    }
  }
  
  return missingInTicket;
}

export function createMissingCityAnomaly(
  ticket: TicketExport,
  audioRemark: AudioFileRemark,
  missingCities: string[]
): AnomalyRecord {
  return {
    id: `ANM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ticketId: ticket.ticketId,
    type: AnomalyType.MISSING_AUTHORIZED_CITY,
    description: `票务导出表授权地区缺少城市：${missingCities.join('、')}。音频文件备注中包含这些城市，但票务表未记录。`,
    severity: 'high',
    detectedAt: new Date().toISOString(),
    detectedBy: '系统自动检测',
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNotes: null,
    sourceData: {
      source: 'ticket_export',
      fieldName: 'authorizedCities',
      originalValue: ticket.authorizedCities.join('、'),
      expectedValue: [...ticket.authorizedCities, ...missingCities].join('、')
    }
  };
}

export function createInitialVerification(ticket: TicketExport): LessonVerification {
  return {
    id: `VER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    verificationNo: `HX${ticket.ticketId.replace('TK', '')}`,
    ticketId: ticket.ticketId,
    musicianName: ticket.musicianName,
    liveDate: ticket.liveDate,
    totalTips: ticket.totalTips,
    finalRevenue: ticket.expectedRevenue,
    authorizedCities: [...ticket.authorizedCities],
    status: 'pending',
    reservedReason: '',
    missingMaterials: [],
    nextAction: NextActionOwner.SYSTEM,
    actionNotes: '票务数据已导入，等待音频文件备注校验',
    reviewedBy: null,
    verifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function flagVerificationAsReserved(
  verification: LessonVerification,
  anomaly: AnomalyRecord,
  missingCities: string[]
): LessonVerification {
  return {
    ...verification,
    status: 'reserved',
    reservedReason: `授权地区不完整，缺少城市：${missingCities.join('、')}`,
    missingMaterials: [
      '完整的授权地区列表',
      '音频文件备注与票务导出表的一致性确认'
    ],
    nextAction: NextActionOwner.MANAGER,
    actionNotes: '系统检测到授权地区异常，已标记为"预留"状态，请店长复核后决定是否转交录音师小段补全音频文件备注',
    updatedAt: new Date().toISOString()
  };
}

export function processTicketWithAudio(
  ticket: TicketExport,
  audioRemark: AudioFileRemark
): { 
  verification: LessonVerification; 
  anomalies: AnomalyRecord[] 
} {
  const verification = createInitialVerification(ticket);
  dataStore.addVerification(verification);
  
  const missingCities = detectMissingCities(ticket, audioRemark);
  const anomalies: AnomalyRecord[] = [];
  
  if (missingCities.length > 0) {
    const anomaly = createMissingCityAnomaly(ticket, audioRemark, missingCities);
    dataStore.addAnomaly(anomaly);
    anomalies.push(anomaly);
    
    const updatedVerification = flagVerificationAsReserved(verification, anomaly, missingCities);
    dataStore.updateVerification(verification.verificationNo, updatedVerification);
    
    ticket.status = SplitStatus.ANOMALY_DETECTED;
    dataStore.addTicket(ticket);
    
    return { verification: updatedVerification, anomalies };
  }
  
  ticket.status = SplitStatus.AUDIO_CHECKED;
  dataStore.addTicket(ticket);
  
  const cleanVerification: LessonVerification = {
    ...verification,
    status: 'pending',
    nextAction: NextActionOwner.MANAGER,
    actionNotes: '数据校验通过，等待店长复核',
    updatedAt: new Date().toISOString()
  };
  dataStore.updateVerification(verification.verificationNo, cleanVerification);
  
  return { verification: cleanVerification, anomalies };
}

export function getStandardCities(): string[] {
  return [...STANDARD_CITIES];
}
