import { differenceInDays, parseISO } from 'date-fns';
import type { SamplePack, Credential, Track, RiskAlert } from '@/types';

const generateId = (): string => {
  return `risk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const detectExpiryRisk = (samplePack: SamplePack): RiskAlert | null => {
  if (samplePack.licenseType === 'perpetual' || !samplePack.expiryDate) {
    return null;
  }

  const today = new Date();
  const expiryDate = parseISO(samplePack.expiryDate);
  const daysUntilExpiry = differenceInDays(expiryDate, today);

  if (daysUntilExpiry <= 0) {
    return {
      id: generateId(),
      type: 'expiry',
      severity: 'error',
      title: '授权已过期',
      message: `「${samplePack.name}」的授权已经过期 ${Math.abs(daysUntilExpiry)} 天了，使用该采样包的所有曲目都存在版权风险，请立即联系供应商续约。`,
      relatedEntityId: samplePack.id,
      relatedEntityType: 'samplePack',
    };
  }

  if (daysUntilExpiry <= 30) {
    return {
      id: generateId(),
      type: 'expiry',
      severity: 'warning',
      title: '授权即将到期',
      message: `「${samplePack.name}」还有 ${daysUntilExpiry} 天就要过期了，建议尽快联系供应商续费，不然后面使用了这个采样包的曲子都有版权风险。`,
      relatedEntityId: samplePack.id,
      relatedEntityType: 'samplePack',
    };
  }

  return null;
};

export const detectMultiUseRisk = (samplePack: SamplePack, tracks: Track[]): RiskAlert | null => {
  const usingTracks = tracks.filter((t) => t.samplePackIds.includes(samplePack.id));
  
  if (usingTracks.length >= 2) {
    const trackNames = usingTracks.map((t) => `《${t.title}》`).join('、');
    return {
      id: generateId(),
      type: 'multi-use',
      severity: 'warning',
      title: '采样包被多首曲目使用',
      message: `「${samplePack.name}」被 ${usingTracks.length} 首曲目（${trackNames}）同时使用了。如果是单曲授权的话可能需要额外购买许可，最好跟法务确认一下。`,
      relatedEntityId: samplePack.id,
      relatedEntityType: 'samplePack',
    };
  }

  return null;
};

export const detectMissingCredentialRisk = (
  samplePack: SamplePack,
  credentials: Credential[]
): RiskAlert | null => {
  const packCredentials = credentials.filter((c) => c.samplePackId === samplePack.id);

  if (packCredentials.length === 0) {
    return {
      id: generateId(),
      type: 'missing-credential',
      severity: 'error',
      title: '授权凭证完全缺失',
      message: `「${samplePack.name}」还没有上传任何授权凭证，审计的时候肯定会被问起，赶紧去找一下发票或者邮件确认记录吧。`,
      relatedEntityId: samplePack.id,
      relatedEntityType: 'samplePack',
    };
  }

  const hasInvoice = packCredentials.some((c) => c.type === 'invoice' || c.type === 'contract');
  if (!hasInvoice) {
    return {
      id: generateId(),
      type: 'missing-credential',
      severity: 'warning',
      title: '缺少正式凭证',
      message: `「${samplePack.name}」只有订单截图或邮件确认，正式发票还没找到。审计的时候可能会被问起，要不要补开一下？`,
      relatedEntityId: samplePack.id,
      relatedEntityType: 'samplePack',
    };
  }

  return null;
};

export const detectAllRisks = (
  samplePacks: SamplePack[],
  credentials: Credential[],
  tracks: Track[]
): RiskAlert[] => {
  const risks: RiskAlert[] = [];

  for (const pack of samplePacks) {
    const expiryRisk = detectExpiryRisk(pack);
    if (expiryRisk) risks.push(expiryRisk);

    const multiUseRisk = detectMultiUseRisk(pack, tracks);
    if (multiUseRisk) risks.push(multiUseRisk);

    const credentialRisk = detectMissingCredentialRisk(pack, credentials);
    if (credentialRisk) risks.push(credentialRisk);
  }

  return risks.sort((a, b) => {
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
};

export const calculateSamplePackStatus = (
  samplePack: SamplePack,
  credentials: Credential[],
  tracks: Track[]
): SamplePack['status'] => {
  const expiryRisk = detectExpiryRisk(samplePack);
  const credentialRisk = detectMissingCredentialRisk(samplePack, credentials);

  if (credentialRisk?.severity === 'error') {
    return 'incomplete';
  }

  if (expiryRisk?.severity === 'error') {
    return 'expired';
  }

  if (expiryRisk?.severity === 'warning') {
    return 'expiring';
  }

  return 'active';
};
