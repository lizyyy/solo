import type { Material, DiffChunk, MaterialVersion } from '../types';
import { computeHash, generateId } from '../utils/hash';
import { compareVersions, detectCaliberChange } from '../utils/diff';

export const versionHashService = {
  async computeHash(content: string): Promise<string> {
    return computeHash(content);
  },

  compareVersions(oldContent: string, newContent: string): DiffChunk[] {
    return compareVersions(oldContent, newContent);
  },

  detectCaliberChange(
    oldContent: string,
    newContent: string,
    threshold?: number
  ): boolean {
    return detectCaliberChange(oldContent, newContent, threshold);
  },

  async createMaterialVersion(
    material: Material,
    newContent: string
  ): Promise<{ version: MaterialVersion; hasChanged: boolean; hasCaliberChanged: boolean }> {
    const newHash = await this.computeHash(newContent);

    if (newHash === material.contentHash) {
      return {
        version: material.versions[material.versions.length - 1],
        hasChanged: false,
        hasCaliberChanged: false,
      };
    }

    const diff = this.compareVersions(material.content, newContent);
    const caliberChanged = this.detectCaliberChange(material.content, newContent);

    const version: MaterialVersion = {
      id: generateId(),
      materialId: material.id,
      version: material.version + 1,
      content: newContent,
      contentHash: newHash,
      diff,
      createdBy: '系统',
      timestamp: Date.now(),
      createdAt: Date.now(),
    };

    return {
      version,
      hasChanged: true,
      hasCaliberChanged: caliberChanged,
    };
  },

  async createNewMaterial(
    sessionId: string,
    type: Material['type'],
    content: string,
    name: string
  ): Promise<Material> {
    const contentHash = await this.computeHash(content);
    const now = Date.now();

    const initialVersion: MaterialVersion = {
      id: generateId(),
      materialId: '',
      version: 1,
      content,
      contentHash,
      diff: [],
      createdBy: '系统',
      timestamp: now,
      createdAt: now,
    };

    const material: Material = {
      id: generateId(),
      sessionId,
      type,
      content,
      contentHash,
      version: 1,
      versions: [initialVersion],
      hasCaliberChanged: false,
      name,
      createdAt: now,
      updatedAt: now,
    };

    initialVersion.materialId = material.id;

    return material;
  },

  async updateMaterialContent(
    material: Material,
    newContent: string
  ): Promise<Material> {
    const result = await this.createMaterialVersion(material, newContent);

    if (!result.hasChanged) {
      return material;
    }

    return {
      ...material,
      content: newContent,
      contentHash: result.version.contentHash,
      version: material.version + 1,
      versions: [...material.versions, result.version],
      hasCaliberChanged: material.hasCaliberChanged || result.hasCaliberChanged,
      updatedAt: Date.now(),
    };
  },

  getVersionDiff(material: Material, versionIndex: number): string {
    if (versionIndex === 0 || versionIndex >= material.versions.length) {
      return material.versions[0]?.diff ? this.formatDiff(material.versions[0].diff) : material.content;
    }

    const version = material.versions[versionIndex];
    return this.formatDiff(version.diff);
  },

  formatDiff(chunks: DiffChunk[]): string {
    return chunks
      .map((chunk) => {
        switch (chunk.type) {
          case 'added':
            return `[+${chunk.value}]`;
          case 'removed':
            return `[-${chunk.value}]`;
          case 'modified':
            return `[*${chunk.oldValue} → ${chunk.value}]`;
          default:
            return chunk.value;
        }
      })
      .join(' ');
  },

  getVersionSummary(material: Material): string {
    if (material.versions.length <= 1) {
      return '初始版本';
    }

    const changeCount = material.versions.filter((v) => v.diff.length > 0).length;
    return `共 ${changeCount} 次变更`;
  },
};
