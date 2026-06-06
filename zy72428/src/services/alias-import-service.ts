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
    const duplicates: TrackAlias[] = [];
    const errors: UserMessage[] = [];
    const warnings: UserMessage[] = [];

    for (const input of inputs) {
      const duplicate = dataStore.findDuplicateAlias(input.canonicalName, input.aliases);

      if (duplicate) {
        duplicates.push(duplicate);
        warnings.push(
          createWarningMessage(
            `曲目"${input.canonicalName}"已存在（标准名或别名重复）`,
            `现有标准名：${duplicate.canonicalName}，别名：${duplicate.aliases.join('、')}`
          )
        );
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
        createInfoMessage(`成功导入 ${imported.length} 条曲目别名记录`)
      );
    }

    if (duplicates.length > 0) {
      warnings.push(
        createWarningMessage(
          `跳过 ${duplicates.length} 条重复记录`,
          '请检查是否需要合并或更新现有记录'
        )
      );
    }

    return {
      success: errors.length === 0,
      imported,
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
