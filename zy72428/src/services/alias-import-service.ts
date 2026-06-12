import { dataStore } from '../store/data-store';
import { TrackAlias, ImportResult, MaterialSource, UserMessage } from '../types';
import { createWarningMessage, createInfoMessage } from '../utils/messages';

export interface AliasImportInput {
  canonicalName: string;
  aliases: string[];
  copyrightHolder: string;
  source: MaterialSource;
}

export class AliasImportService {
  importAliases(inputs: AliasImportInput[]): ImportResult<TrackAlias> {
    const batchId = dataStore.generateBatchId();
    const imported: TrackAlias[] = [];
    const reused: TrackAlias[] = [];
    const duplicates: TrackAlias[] = [];
    const errors: UserMessage[] = [];
    const warnings: UserMessage[] = [];

    for (const input of inputs) {
      const duplicate = dataStore.findDuplicateAlias(input.canonicalName, input.aliases);

      if (duplicate) {
        duplicates.push(duplicate);

        const isFullyReused =
          duplicate.canonicalName.trim().toLowerCase() === input.canonicalName.trim().toLowerCase() &&
          duplicate.copyrightHolder.trim().toLowerCase() === input.copyrightHolder.trim().toLowerCase();

        if (isFullyReused) {
          reused.push(duplicate);
          warnings.push(
            createInfoMessage(
              `曲目"${input.canonicalName}"复用已有记录（版权方：${duplicate.copyrightHolder}，别名：${duplicate.aliases.join('、')}）`
            )
          );
        } else {
          warnings.push(
            createWarningMessage(
              `曲目"${input.canonicalName}"已存在但信息不一致`,
              `现有标准名：${duplicate.canonicalName}，版权方：${duplicate.copyrightHolder}，别名：${duplicate.aliases.join('、')}。请确认是否需要更新`
            )
          );
        }
        continue;
      }

      const alias: TrackAlias = {
        id: dataStore.generateId(),
        canonicalName: input.canonicalName.trim(),
        aliases: input.aliases.map((a) => a.trim()).filter((a) => a.length > 0),
        copyrightHolder: input.copyrightHolder.trim(),
        lastUpdated: new Date(),
        source: input.source,
      };

      dataStore.saveTrackAlias(alias);
      imported.push(alias);
    }

    if (imported.length > 0) {
      warnings.push(
        createInfoMessage(`成功导入 ${imported.length} 条新曲目别名记录`)
      );
    }

    if (reused.length > 0) {
      warnings.push(
        createInfoMessage(`复用 ${reused.length} 条已有记录（内容完全一致）`)
      );
    }

    if (duplicates.length > reused.length) {
      warnings.push(
        createWarningMessage(
          `跳过 ${duplicates.length - reused.length} 条信息不一致的重复记录`,
          '请检查是否需要合并或更新现有记录'
        )
      );
    }

    return {
      success: errors.length === 0,
      imported,
      reused,
      duplicates,
      errors,
      warnings,
      batchId,
    };
  }

  updateAlias(id: string, updates: Partial<AliasImportInput>): TrackAlias | undefined {
    const existing = dataStore.getTrackAlias(id);
    if (!existing) {
      return undefined;
    }

    const updated: TrackAlias = {
      ...existing,
      canonicalName: updates.canonicalName?.trim() ?? existing.canonicalName,
      aliases: updates.aliases?.map((a) => a.trim()).filter((a) => a.length > 0) ?? existing.aliases,
      copyrightHolder: updates.copyrightHolder?.trim() ?? existing.copyrightHolder,
      lastUpdated: new Date(),
      source: updates.source ?? existing.source,
    };

    dataStore.saveTrackAlias(updated);
    return updated;
  }
}

export const aliasImportService = new AliasImportService();
