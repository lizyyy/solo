import {
  addRecord,
  putRecord,
  getRecord,
  getAllRecords,
  getFromIndex,
} from '../utils/idb';
import { generateId, deepClone, isValidJSON, readFileAsText, downloadFile } from '../utils/helpers';
import { FriendlyError } from '../utils/errorMessages';
import { detectCheating, checkDuplicateScore, createAnomalyDetail } from './AnomalyService';
import type {
  PlayerScore,
  OperationHistory,
  DataVersion,
  ViewState,
  ExportReport,
  OperationType,
  TargetType,
} from '../types/data';
import type { GameState, LevelConfig } from '../types/game';
import { syncExportRange, generateExportFilename } from '../utils/viewSync';

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export async function importLevelConfig(data: unknown): Promise<LevelConfig> {
  if (!data || typeof data !== 'object') {
    throw new FriendlyError('IMPORT_FORMAT_INVALID');
  }

  const levelData = data as LevelConfig;

  if (!levelData.id || !levelData.name || !Array.isArray(levelData.products)) {
    throw new FriendlyError('IMPORT_FORMAT_INVALID');
  }

  const existing = await getRecord('level_config', levelData.id);
  if (existing) {
    levelData.version = incrementVersion(existing.version);
    levelData.updatedAt = Date.now();
  } else {
    levelData.createdAt = Date.now();
    levelData.updatedAt = Date.now();
  }

  await putRecord('level_config', levelData);
  await recordOperation(
    'import',
    'level',
    levelData.id,
    existing || null,
    levelData,
    '导入关卡配置'
  );

  return levelData;
}

export async function importPlayerScores(data: unknown): Promise<ImportResult> {
  if (!Array.isArray(data)) {
    throw new FriendlyError('IMPORT_FORMAT_INVALID');
  }

  const result: ImportResult = {
    success: true,
    imported: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < data.length; i++) {
    try {
      const scoreData = data[i] as PlayerScore;
      if (!scoreData.playerName || !scoreData.levelId || !scoreData.score) {
        result.failed++;
        result.errors.push(`第${i + 1}条数据缺少必要字段`);
        continue;
      }

      scoreData.id = scoreData.id || generateId();
      scoreData.source = 'import';
      scoreData.status = scoreData.status || 'pending';
      scoreData.createdAt = scoreData.createdAt || Date.now();
      scoreData.updatedAt = Date.now();

      await putRecord('player_score', scoreData);
      await createDataVersion('player_score', scoreData.id, scoreData);
      result.imported++;
    } catch (error) {
      result.failed++;
      result.errors.push(`第${i + 1}条数据导入失败: ${(error as Error).message}`);
    }
  }

  await recordOperation(
    'import',
    'score',
    'batch',
    null,
    { imported: result.imported, failed: result.failed },
    '批量导入玩家分数'
  );

  result.success = result.failed === 0;
  return result;
}

export async function importFromFile(file: File): Promise<ImportResult> {
  try {
    const content = await readFileAsText(file);
    if (!isValidJSON(content)) {
      throw new FriendlyError('IMPORT_FORMAT_INVALID');
    }

    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return await importPlayerScores(data);
    } else if (data && typeof data === 'object' && 'products' in data) {
      await importLevelConfig(data);
      return { success: true, imported: 1, failed: 0, errors: [] };
    } else if (data && typeof data === 'object' && 'records' in data) {
      return await importPlayerScores((data as { records: unknown[] }).records);
    } else {
      throw new FriendlyError('IMPORT_FORMAT_INVALID');
    }
  } catch (error) {
    if (error instanceof FriendlyError) {
      throw error;
    }
    throw new FriendlyError('IMPORT_FORMAT_INVALID', error as Error);
  }
}

export async function submitPlayerScore(
  playerName: string,
  levelId: string,
  gameState: GameState
): Promise<PlayerScore> {
  const isDuplicate = await checkDuplicateScore(playerName, levelId);
  if (isDuplicate) {
    throw new FriendlyError('SCORE_DUPLICATE');
  }

  const detection = await detectCheating(gameState.score, levelId, gameState);

  const playerScore: PlayerScore = {
    id: generateId(),
    playerName,
    levelId,
    score: gameState.score,
    satisfaction: gameState.satisfaction,
    gameData: deepClone(gameState),
    source: 'local',
    status: detection.isCheating ? 'pending' : 'normal',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (detection.isCheating) {
    playerScore.anomalyType = 'score_cheat';
    playerScore.anomalyDetail = createAnomalyDetail(detection);
  }

  await putRecord('player_score', playerScore);
  await createDataVersion('player_score', playerScore.id, playerScore);
  await recordOperation(
    'import',
    'score',
    playerScore.id,
    null,
    playerScore,
    detection.isCheating ? '提交分数（异常待复核）' : '提交分数'
  );

  return playerScore;
}

export async function reviewScore(
  scoreId: string,
  isApproved: boolean,
  reviewer: string,
  note: string
): Promise<PlayerScore> {
  const score = await getRecord('player_score', scoreId);
  if (!score) {
    throw new FriendlyError('DATA_CORRUPTED');
  }

  if (score.status !== 'pending') {
    throw new FriendlyError('INVALID_OPERATION');
  }

  const beforeData = deepClone(score);
  score.status = isApproved ? 'normal' : 'rejected';
  score.reviewedBy = reviewer;
  score.reviewedAt = Date.now();
  score.reviewNote = note;
  score.updatedAt = Date.now();

  if (isApproved && score.anomalyType) {
    delete score.anomalyType;
    delete score.anomalyDetail;
  }

  await putRecord('player_score', score);
  await createDataVersion('player_score', score.id, score);
  await recordOperation(
    'review',
    'score',
    scoreId,
    beforeData,
    score,
    note || (isApproved ? '复核通过' : '复核驳回')
  );

  return score;
}

export async function correctScore(
  scoreId: string,
  newScore: number,
  newSatisfaction: number,
  corrector: string,
  reason: string
): Promise<PlayerScore> {
  const score = await getRecord('player_score', scoreId);
  if (!score) {
    throw new FriendlyError('DATA_CORRUPTED');
  }

  const beforeData = deepClone(score);
  score.score = newScore;
  score.satisfaction = newSatisfaction;
  score.status = 'corrected';
  score.reviewedBy = corrector;
  score.reviewedAt = Date.now();
  score.reviewNote = reason;
  score.updatedAt = Date.now();

  await putRecord('player_score', score);
  await createDataVersion('player_score', score.id, score);
  await recordOperation(
    'correct',
    'score',
    scoreId,
    beforeData,
    score,
    reason
  );

  return score;
}

export async function getScoresByFilters(
  filters: ViewState['filters']
): Promise<PlayerScore[]> {
  let scores = await getAllRecords('player_score');

  if (filters.levelId) {
    scores = scores.filter((s) => s.levelId === filters.levelId);
  }

  if (filters.playerName) {
    const searchLower = filters.playerName.toLowerCase();
    scores = scores.filter((s) =>
      s.playerName.toLowerCase().includes(searchLower)
    );
  }

  if (filters.status?.length) {
    scores = scores.filter((s) => filters.status!.includes(s.status));
  }

  if (filters.timeRange) {
    const [start, end] = filters.timeRange;
    scores = scores.filter((s) => s.createdAt >= start && s.createdAt <= end);
  }

  return scores.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOperationHistory(
  targetType?: TargetType,
  targetId?: string
): Promise<OperationHistory[]> {
  let history = await getAllRecords('operation_history');

  if (targetType && targetId) {
    history = history.filter(
      (h) => h.targetType === targetType && h.targetId === targetId
    );
  } else if (targetType) {
    history = history.filter((h) => h.targetType === targetType);
  }

  return history.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDataVersions(
  entityType: string,
  entityId: string
): Promise<DataVersion[]> {
  const versions = await getFromIndex('data_version', 'by-entity', [entityType, entityId]);
  return versions.sort((a, b) => b.version - a.version);
}

export async function exportReport(page: string, exportedBy: string): Promise<void> {
  const filters = await syncExportRange(page);
  const records = await getScoresByFilters(filters);

  if (records.length === 0) {
    throw new FriendlyError('EXPORT_NO_DATA');
  }

  const scores = records.map((r) => r.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const anomalyCount = records.filter((r) => r.status === 'pending').length;
  const pendingReviewCount = records.filter(
    (r) => r.status === 'pending' || r.anomalyType
  ).length;

  const viewState = await getFromIndex('view_state', 'by-page', page);
  const viewport = viewState[0]?.viewport || {
    scrollTop: 0,
    scrollLeft: 0,
    selectedColumns: [],
  };

  const report: ExportReport = {
    generatedAt: Date.now(),
    filters,
    summary: {
      totalRecords: records.length,
      avgScore: Math.round(avgScore),
      maxScore,
      anomalyCount,
      pendingReviewCount,
    },
    records,
    exportMetadata: {
      exportedBy,
      viewportSnapshot: viewport,
    },
  };

  const filename = generateExportFilename(page, filters);
  downloadFile(JSON.stringify(report, null, 2), filename, 'application/json');

  await recordOperation(
    'export',
    'score',
    'batch',
    null,
    { recordCount: records.length, filters },
    `导出活动复盘报告（${records.length}条记录）`
  );
}

export async function getLevelConfig(levelId: string): Promise<LevelConfig | undefined> {
  return await getRecord('level_config', levelId);
}

export async function getAllLevelConfigs(): Promise<LevelConfig[]> {
  return await getAllRecords('level_config');
}

async function recordOperation(
  operationType: OperationType,
  targetType: TargetType,
  targetId: string,
  beforeData: unknown,
  afterData: unknown,
  reason: string
): Promise<void> {
  const history: OperationHistory = {
    id: generateId(),
    operator: '当前用户',
    operationType,
    targetType,
    targetId,
    beforeData,
    afterData,
    reason,
    createdAt: Date.now(),
  };
  await addRecord('operation_history', history);
}

async function createDataVersion(
  entityType: string,
  entityId: string,
  snapshot: unknown
): Promise<void> {
  const existingVersions = await getFromIndex('data_version', 'by-entity', [entityType, entityId]);
  const nextVersion = existingVersions.length > 0
    ? Math.max(...existingVersions.map((v) => v.version)) + 1
    : 1;

  const version: DataVersion = {
    id: generateId(),
    entityType,
    entityId,
    version: nextVersion,
    snapshot: deepClone(snapshot),
    createdAt: Date.now(),
  };
  await addRecord('data_version', version);
}

function incrementVersion(version: string): string {
  const parts = version.split('.').map((n) => parseInt(n, 10));
  parts[parts.length - 1]++;
  return parts.join('.');
}

export async function initDefaultLevelIfNeeded(): Promise<LevelConfig> {
  const levels = await getAllLevelConfigs();
  if (levels.length > 0) {
    return levels[0];
  }

  const { createDefaultLevel } = await import('../game/GameEngine');
  const defaultLevel = createDefaultLevel();
  await putRecord('level_config', defaultLevel);
  return defaultLevel;
}
