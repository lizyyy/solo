import { nanoid } from 'nanoid';
import type {
  Artwork,
  ArtworkDetail,
  Valuation,
  LoanContract,
  TransportNode,
  InsuranceClause,
  RecordStatus,
} from '../../shared/types.js';
import { getDb } from '../db/index.js';
import { trackChange } from './changeTrackerService.js';
import { checkGapsForArtwork } from './gapDetectorService.js';
import { convertCurrency } from './currencyService.js';

const DEFAULT_OPERATOR = '策展助理-李娜';

export const getArtworkList = async (params?: {
  status?: RecordStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ artworks: Artwork[]; total: number }> => {
  const db = await getDb();
  let artworks = [...db.data.artworks];

  if (params?.status) {
    artworks = artworks.filter(a => a.status === params.status);
  }

  if (params?.search) {
    const searchLower = params.search.toLowerCase();
    artworks = artworks.filter(
      a =>
        a.name.toLowerCase().includes(searchLower) ||
        a.artworkNo.toLowerCase().includes(searchLower) ||
        a.artist.toLowerCase().includes(searchLower)
    );
  }

  artworks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const total = artworks.length;

  if (params?.page && params?.pageSize) {
    const start = (params.page - 1) * params.pageSize;
    artworks = artworks.slice(start, start + params.pageSize);
  }

  return { artworks, total };
};

export const getArtworkDetail = async (artworkId: string): Promise<ArtworkDetail | null> => {
  const db = await getDb();

  const artwork = db.data.artworks.find(a => a.id === artworkId);
  if (!artwork) {
    return null;
  }

  const valuations = db.data.valuations.filter(v => v.artworkId === artworkId);
  const contracts = db.data.loanContracts.filter(c => c.artworkId === artworkId);
  const transportNodes = db.data.transportNodes.filter(t => t.artworkId === artworkId);
  const insuranceClauses = db.data.insuranceClauses.filter(i => i.artworkId === artworkId);
  const changeLogs = db.data.changeLogs.filter(c => c.recordId === artworkId);

  const gapResult = await checkGapsForArtwork(artworkId);

  return {
    ...artwork,
    valuations,
    contracts,
    transportNodes,
    insuranceClauses,
    changeLogs,
    gapAlerts: gapResult.alerts,
  };
};

export const createArtwork = async (data: Omit<Artwork, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Artwork> => {
  const db = await getDb();

  const artwork: Artwork = {
    ...data,
    id: `art-${nanoid(8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'pending',
  };

  db.data.artworks.unshift(artwork);
  await db.write();

  await trackChange({
    recordId: artwork.id,
    fieldName: 'created',
    oldValue: null,
    newValue: artwork,
    operator: DEFAULT_OPERATOR,
    reason: '新建作品记录',
  });

  await checkGapsForArtwork(artwork.id);

  return artwork;
};

export const updateArtwork = async (
  artworkId: string,
  data: Partial<Omit<Artwork, 'id' | 'createdAt'>>,
  operator: string = DEFAULT_OPERATOR
): Promise<Artwork | null> => {
  const db = await getDb();
  const artwork = db.data.artworks.find(a => a.id === artworkId);

  if (!artwork) {
    return null;
  }

  const oldValues = { ...artwork };

  Object.assign(artwork, data, {
    updatedAt: new Date().toISOString(),
  });

  for (const [key, value] of Object.entries(data)) {
    await trackChange({
      recordId: artworkId,
      fieldName: key,
      oldValue: oldValues[key as keyof Artwork],
      newValue: value,
      operator,
    });
  }

  await db.write();
  await checkGapsForArtwork(artworkId);

  return artwork;
};

export const updateArtworkStatus = async (
  artworkId: string,
  status: RecordStatus,
  reason?: string,
  operator: string = DEFAULT_OPERATOR
): Promise<Artwork | null> => {
  return updateArtwork(artworkId, { status }, operator);
};

export const upsertValuation = async (
  data: Omit<Valuation, 'id' | 'createdAt'>,
  operator: string = DEFAULT_OPERATOR
): Promise<Valuation> => {
  const db = await getDb();

  const convertedAmount = await convertCurrency(data.amount, data.currency, data.convertedCurrency || 'CNY');

  const existing = db.data.valuations.find(
    v => v.artworkId === data.artworkId && v.valuationDate === data.valuationDate
  );

  let valuation: Valuation;

  if (existing) {
    const oldValue = { ...existing };
    Object.assign(existing, data, { convertedAmount });
    valuation = existing;

    for (const [key, value] of Object.entries(data)) {
      if (oldValue[key as keyof Valuation] !== value) {
        await trackChange({
          recordId: data.artworkId,
          fieldName: `valuation.${key}`,
          oldValue: oldValue[key as keyof Valuation],
          newValue: value,
          operator,
        });
      }
    }
  } else {
    valuation = {
      ...data,
      id: `val-${nanoid(8)}`,
      convertedAmount,
      createdAt: new Date().toISOString(),
    };
    db.data.valuations.push(valuation);

    await trackChange({
      recordId: data.artworkId,
      fieldName: 'valuation',
      oldValue: null,
      newValue: valuation,
      operator,
      reason: '新增估值信息',
    });
  }

  await db.write();
  await checkGapsForArtwork(data.artworkId);

  return valuation;
};

export const addContractVersion = async (
  data: Omit<LoanContract, 'id' | 'createdAt' | 'isLatest'>,
  operator: string = DEFAULT_OPERATOR
): Promise<LoanContract> => {
  const db = await getDb();

  db.data.loanContracts
    .filter(c => c.artworkId === data.artworkId)
    .forEach(c => {
      c.isLatest = false;
    });

  const contract: LoanContract = {
    ...data,
    id: `cnt-${nanoid(8)}`,
    isLatest: true,
    createdAt: new Date().toISOString(),
  };

  db.data.loanContracts.push(contract);

  await trackChange({
    recordId: data.artworkId,
    fieldName: 'contract',
    oldValue: null,
    newValue: contract,
    operator,
    reason: `新增合同版本 ${data.version}`,
  });

  await db.write();
  await checkGapsForArtwork(data.artworkId);

  return contract;
};

export const compareContractVersions = async (contractId: string) => {
  const db = await getDb();
  const current = db.data.loanContracts.find(c => c.id === contractId);

  if (!current) {
    return null;
  }

  const allVersions = db.data.loanContracts
    .filter(c => c.artworkId === current.artworkId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const currentIndex = allVersions.findIndex(c => c.id === contractId);
  const previous = currentIndex < allVersions.length - 1 ? allVersions[currentIndex + 1] : null;

  const differences: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

  if (previous) {
    const fields: (keyof LoanContract)[] = ['version', 'lender', 'lenderContact', 'startDate', 'endDate', 'specialTerms'];
    for (const field of fields) {
      if (previous[field] !== current[field]) {
        differences.push({
          field,
          oldValue: previous[field],
          newValue: current[field],
        });
      }
    }
  }

  return {
    current,
    previous,
    allVersions,
    differences,
  };
};

export const upsertTransportNode = async (
  data: Omit<TransportNode, 'id'>,
  operator: string = DEFAULT_OPERATOR
): Promise<TransportNode> => {
  const db = await getDb();

  const existing = db.data.transportNodes.find(
    t => t.artworkId === data.artworkId && t.nodeType === data.nodeType
  );

  let node: TransportNode;

  if (existing) {
    const oldValue = { ...existing };
    Object.assign(existing, data);
    node = existing;

    for (const [key, value] of Object.entries(data)) {
      if (oldValue[key as keyof TransportNode] !== value) {
        await trackChange({
          recordId: data.artworkId,
          fieldName: `transport.${data.nodeType}.${key}`,
          oldValue: oldValue[key as keyof TransportNode],
          newValue: value,
          operator,
        });
      }
    }
  } else {
    node = {
      ...data,
      id: `trn-${nanoid(8)}`,
    };
    db.data.transportNodes.push(node);

    await trackChange({
      recordId: data.artworkId,
      fieldName: `transport.${data.nodeType}`,
      oldValue: null,
      newValue: node,
      operator,
      reason: `新增运输节点: ${data.location}`,
    });
  }

  await db.write();
  await checkGapsForArtwork(data.artworkId);

  return node;
};

export const updateTransportStatus = async (
  nodeId: string,
  status: TransportNode['status'],
  timestamp?: string,
  operator: string = DEFAULT_OPERATOR
): Promise<TransportNode | null> => {
  const db = await getDb();
  const node = db.data.transportNodes.find(t => t.id === nodeId);

  if (!node) {
    return null;
  }

  const oldStatus = node.status;
  node.status = status;
  if (timestamp) {
    node.timestamp = timestamp;
  } else if (status === 'delivered' || status === 'arrived') {
    node.timestamp = new Date().toISOString();
  }

  await trackChange({
    recordId: node.artworkId,
    fieldName: `transport.${node.nodeType}.status`,
    oldValue: oldStatus,
    newValue: status,
    operator,
    reason: `运输状态更新: ${node.location}`,
  });

  await db.write();
  await checkGapsForArtwork(node.artworkId);

  return node;
};

export const upsertInsuranceClause = async (
  data: Omit<InsuranceClause, 'id' | 'createdAt'>,
  operator: string = DEFAULT_OPERATOR
): Promise<InsuranceClause> => {
  const db = await getDb();

  const existing = db.data.insuranceClauses.find(i => i.artworkId === data.artworkId);

  let clause: InsuranceClause;

  if (existing) {
    const oldValue = { ...existing };
    Object.assign(existing, data);
    clause = existing;

    for (const [key, value] of Object.entries(data)) {
      if (oldValue[key as keyof InsuranceClause] !== value) {
        await trackChange({
          recordId: data.artworkId,
          fieldName: `insurance.${key}`,
          oldValue: oldValue[key as keyof InsuranceClause],
          newValue: value,
          operator,
        });
      }
    }
  } else {
    clause = {
      ...data,
      id: `ins-${nanoid(8)}`,
      createdAt: new Date().toISOString(),
    };
    db.data.insuranceClauses.push(clause);

    await trackChange({
      recordId: data.artworkId,
      fieldName: 'insurance',
      oldValue: null,
      newValue: clause,
      operator,
      reason: '新增保险条款',
    });
  }

  await db.write();
  await checkGapsForArtwork(data.artworkId);

  return clause;
};
