import type { ObjectAlias } from '../types';

export class AliasResolver {
  private aliases: ObjectAlias[];
  private aliasMap: Map<string, string>;

  constructor(aliases: ObjectAlias[]) {
    this.aliases = aliases;
    this.aliasMap = new Map();
    this.buildAliasMap();
  }

  private buildAliasMap(): void {
    this.aliases.forEach((alias) => {
      this.aliasMap.set(this.normalize(alias.canonicalName), alias.canonicalName);
      alias.aliases.forEach((a) => {
        this.aliasMap.set(this.normalize(a), alias.canonicalName);
      });
    });
  }

  private normalize(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[()（）]/g, '')
      .replace(/\s+/g, '')
      .replace(/[-_]/g, '');
  }

  resolve(objectName: string): { canonicalName: string; isResolved: boolean; originalName: string } {
    const normalized = this.normalize(objectName);
    const canonicalName = this.aliasMap.get(normalized);
    
    if (canonicalName) {
      return {
        canonicalName,
        isResolved: canonicalName !== objectName,
        originalName: objectName
      };
    }
    
    return {
      canonicalName: objectName,
      isResolved: false,
      originalName: objectName
    };
  }

  getAllNames(): string[] {
    const names: string[] = [];
    this.aliases.forEach((alias) => {
      names.push(alias.canonicalName, ...alias.aliases);
    });
    return names;
  }

  addAlias(canonicalName: string, newAlias: string): void {
    const existing = this.aliases.find((a) => 
      this.normalize(a.canonicalName) === this.normalize(canonicalName)
    );
    
    if (existing) {
      if (!existing.aliases.some((a) => this.normalize(a) === this.normalize(newAlias))) {
        existing.aliases.push(newAlias);
        existing.updatedAt = new Date().toISOString();
        this.aliasMap.set(this.normalize(newAlias), existing.canonicalName);
      }
    } else {
      const newEntry: ObjectAlias = {
        id: `alias-${Date.now()}`,
        canonicalName,
        aliases: [newAlias],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.aliases.push(newEntry);
      this.aliasMap.set(this.normalize(canonicalName), canonicalName);
      this.aliasMap.set(this.normalize(newAlias), canonicalName);
    }
  }

  getAliasGroup(canonicalName: string): ObjectAlias | undefined {
    return this.aliases.find((a) => 
      this.normalize(a.canonicalName) === this.normalize(canonicalName)
    );
  }
}
