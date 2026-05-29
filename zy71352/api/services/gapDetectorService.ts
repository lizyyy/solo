import { nanoid } from 'nanoid';
import type { GapAlert, ArtworkDetail, AlertSeverity } from '../../shared/types.js';
import { getDb } from '../db/index.js';

interface GapCheckResult {
  alerts: GapAlert[];
  isComplete: boolean;
}

export const checkGapsForArtwork = async (artworkId: string): Promise<GapCheckResult> => {
  const db = await getDb();
  const alerts: GapAlert[] = [];

  const valuations = db.data.valuations.filter(v => v.artworkId === artworkId);
  const contracts = db.data.loanContracts.filter(c => c.artworkId === artworkId);
  const transportNodes = db.data.transportNodes.filter(t => t.artworkId === artworkId);
  const insuranceClauses = db.data.insuranceClauses.filter(i => i.artworkId === artworkId);

  if (valuations.length === 0) {
    alerts.push(createAlert(artworkId, 'valuation', 'error', '估值信息缺失，请补充估值报告', 'valuations'));
  } else {
    const latestValuation = valuations[valuations.length - 1];
    if (!latestValuation.amount || latestValuation.amount <= 0) {
      alerts.push(createAlert(artworkId, 'valuation', 'error', '估值金额无效', 'valuations[0].amount'));
    }
    if (!latestValuation.valuationDate) {
      alerts.push(createAlert(artworkId, 'valuation', 'warning', '估值日期未填写', 'valuations[0].valuationDate'));
    }
    if (!latestValuation.institution) {
      alerts.push(createAlert(artworkId, 'valuation', 'warning', '估值机构未填写', 'valuations[0].institution'));
    }
  }

  if (contracts.length === 0) {
    alerts.push(createAlert(artworkId, 'contract', 'error', '借展合同缺失，请补充合同信息', 'contracts'));
  } else {
    const latestContract = contracts.find(c => c.isLatest) || contracts[contracts.length - 1];
    if (!latestContract.lender) {
      alerts.push(createAlert(artworkId, 'contract', 'error', '出借方信息缺失', 'contracts[0].lender'));
    }
    if (!latestContract.startDate || !latestContract.endDate) {
      alerts.push(createAlert(artworkId, 'contract', 'error', '出借期限不完整', 'contracts[0].startDate'));
    }
    if (!latestContract.specialTerms) {
      alerts.push(createAlert(artworkId, 'contract', 'warning', '合同特殊条款未填写', 'contracts[0].specialTerms'));
    }
    if (!latestContract.signedDate) {
      alerts.push(createAlert(artworkId, 'contract', 'warning', '合同签署日期未填写', 'contracts[0].signedDate'));
    }
  }

  const hasOrigin = transportNodes.some(t => t.nodeType === 'origin');
  const hasDestination = transportNodes.some(t => t.nodeType === 'destination');

  if (!hasOrigin) {
    alerts.push(createAlert(artworkId, 'transport', 'error', '缺少起运地节点', 'transportNodes.origin'));
  }
  if (!hasDestination) {
    alerts.push(createAlert(artworkId, 'transport', 'error', '缺少目的地节点', 'transportNodes.destination'));
  }

  transportNodes.forEach((node, index) => {
    if (!node.handler) {
      alerts.push(createAlert(artworkId, 'transport', 'error', `运输节点（${node.location}）承运方信息缺失`, `transportNodes[${index}].handler`));
    }
    if (!node.timestamp && (node.status === 'delivered' || node.status === 'arrived')) {
      alerts.push(createAlert(artworkId, 'transport', 'warning', `运输节点（${node.location}）时间戳未填写`, `transportNodes[${index}].timestamp`));
    }
  });

  if (insuranceClauses.length === 0) {
    alerts.push(createAlert(artworkId, 'insurance', 'error', '保险条款未录入，请补充投保信息', 'insuranceClauses'));
  } else {
    const latestInsurance = insuranceClauses[insuranceClauses.length - 1];
    if (!latestInsurance.coverageAmount || latestInsurance.coverageAmount <= 0) {
      alerts.push(createAlert(artworkId, 'insurance', 'error', '保险金额无效', 'insuranceClauses[0].coverageAmount'));
    }
    if (!latestInsurance.effectiveDate || !latestInsurance.expiryDate) {
      alerts.push(createAlert(artworkId, 'insurance', 'error', '保险期限不完整', 'insuranceClauses[0].effectiveDate'));
    }
    if (!latestInsurance.insurer) {
      alerts.push(createAlert(artworkId, 'insurance', 'warning', '承保机构未填写', 'insuranceClauses[0].insurer'));
    }
  }

  const existingAlerts = db.data.gapAlerts.filter(a => a.artworkId === artworkId);
  db.data.gapAlerts = db.data.gapAlerts.filter(a => a.artworkId !== artworkId);

  alerts.forEach(alert => {
    const existing = existingAlerts.find(
      e => e.field === alert.field && e.message === alert.message
    );
    if (existing) {
      alert.id = existing.id;
      alert.createdAt = existing.createdAt;
    }
    db.data.gapAlerts.push(alert);
  });

  await db.write();

  const isComplete = alerts.every(a => a.severity !== 'error');

  return { alerts, isComplete };
};

export const checkGapsBatch = async (artworkIds?: string[]): Promise<GapCheckResult[]> => {
  const db = await getDb();
  const ids = artworkIds || db.data.artworks.map(a => a.id);
  const results: GapCheckResult[] = [];

  for (const id of ids) {
    const result = await checkGapsForArtwork(id);
    results.push(result);
  }

  return results;
};

export const resolveAlert = async (alertId: string): Promise<GapAlert | null> => {
  const db = await getDb();
  const alert = db.data.gapAlerts.find(a => a.id === alertId);

  if (!alert) {
    return null;
  }

  alert.resolved = true;
  await db.write();

  return alert;
};

export const getAlertsForArtwork = async (artworkId: string): Promise<GapAlert[]> => {
  const db = await getDb();
  return db.data.gapAlerts.filter(a => a.artworkId === artworkId);
};

function createAlert(
  artworkId: string,
  type: GapAlert['type'],
  severity: AlertSeverity,
  message: string,
  field?: string
): GapAlert {
  return {
    id: `gap-${nanoid(8)}`,
    artworkId,
    type,
    severity,
    message,
    field,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
}
