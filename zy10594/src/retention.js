class RetentionEngine {
  constructor(options = {}) {
    this.options = {
      strategy: options.strategy || 'newest',
      keepPerHash: options.keepPerHash || 1,
      keepPerGroup: options.keepPerGroup || null,
      preferDirectories: options.preferDirectories || [],
      excludeDirectories: options.excludeDirectories || [],
      preservePatterns: options.preservePatterns || [],
    };
  }

  applyRules(groups) {
    const results = {
      recommendations: [],
      stats: {
        totalGroups: groups.length,
        totalFiles: 0,
        filesToKeep: 0,
        filesToDelete: 0,
        totalSize: 0,
        redundantSize: 0,
        potentialSavings: 0,
      },
    };

    for (const group of groups) {
      const groupRecommendation = this._processGroup(group);
      results.recommendations.push(groupRecommendation);

      results.stats.totalFiles += group.count;
      results.stats.totalSize += group.totalSize;
      results.stats.redundantSize += group.redundantSize;
      results.stats.filesToKeep += groupRecommendation.keep.length;
      results.stats.filesToDelete += groupRecommendation.delete.length;
      results.stats.potentialSavings += groupRecommendation.potentialSavings;
    }

    return results;
  }

  _processGroup(group) {
    const keep = [];
    const deleteFiles = [];
    const decisions = [];

    for (const variant of group.hashVariants) {
      const variantDecision = this._decideHashVariant(variant, group);
      decisions.push(variantDecision);
      keep.push(...variantDecision.keep);
      deleteFiles.push(...variantDecision.delete);
    }

    const finalKeep = this._applyGroupLevelConstraints(keep, group);
    const finalDelete = group.files.filter(f => !finalKeep.find(k => k.id === f.id));

    return {
      groupId: group.id,
      groupKey: group.key,
      fileCount: group.count,
      hashVariantCount: group.hashVariantCount,
      keep: finalKeep,
      delete: finalDelete,
      potentialSavings: finalDelete.reduce((sum, f) => sum + f.size, 0),
      decisions,
    };
  }

  _decideHashVariant(variant, group) {
    const result = {
      hash: variant.hash,
      keep: [],
      delete: [],
      reason: '',
    };

    const sortedFiles = this._sortFilesByPriority(variant.files);
    const filesToPreserve = sortedFiles.filter(f => this._isPreserved(f));

    if (filesToPreserve.length > 0) {
      result.keep.push(...filesToPreserve);
      result.reason = `保留 ${filesToPreserve.length} 个被保护的文件`;

      const remaining = sortedFiles.filter(f => !filesToPreserve.find(p => p.id === f.id));
      const keepCount = Math.max(0, this.options.keepPerHash - filesToPreserve.length);
      
      if (keepCount > 0) {
        result.keep.push(...remaining.slice(0, keepCount));
      }
      
      result.delete.push(...remaining.slice(keepCount));
    } else {
      result.keep.push(...sortedFiles.slice(0, this.options.keepPerHash));
      result.delete.push(...sortedFiles.slice(this.options.keepPerHash));
      result.reason = `保留最新的 ${this.options.keepPerHash} 个文件`;
    }

    return result;
  }

  _sortFilesByPriority(files) {
    return [...files].sort((a, b) => {
      const aPrefDir = this._isPreferredDirectory(a);
      const bPrefDir = this._isPreferredDirectory(b);
      
      if (aPrefDir && !bPrefDir) return -1;
      if (!aPrefDir && bPrefDir) return 1;

      if (this.options.strategy === 'newest') {
        return new Date(b.modified) - new Date(a.modified);
      } else if (this.options.strategy === 'oldest') {
        return new Date(a.modified) - new Date(b.modified);
      } else if (this.options.strategy === 'largest') {
        return b.size - a.size;
      } else if (this.options.strategy === 'smallest') {
        return a.size - b.size;
      }
      
      return new Date(b.modified) - new Date(a.modified);
    });
  }

  _isPreferredDirectory(file) {
    return this.options.preferDirectories.some(dir => 
      file.directory.includes(dir) || file.path.includes(dir)
    );
  }

  _isPreserved(file) {
    if (this.options.excludeDirectories.some(dir => 
      file.directory.includes(dir) || file.path.includes(dir)
    )) {
      return false;
    }

    return this.options.preservePatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return file.name.includes(pattern) || file.path.includes(pattern);
      }
      return pattern.test(file.name) || pattern.test(file.path);
    });
  }

  _applyGroupLevelConstraints(keepFiles, group) {
    if (this.options.keepPerGroup && keepFiles.length > this.options.keepPerGroup) {
      return this._sortFilesByPriority(keepFiles).slice(0, this.options.keepPerGroup);
    }
    return keepFiles;
  }
}

module.exports = { RetentionEngine };
