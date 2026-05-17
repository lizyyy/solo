class Grouper {
  constructor(options = {}) {
    this.options = {
      groupBy: options.groupBy || 'name',
      ignoreExtension: options.ignoreExtension || false,
      caseSensitive: options.caseSensitive !== false,
      minGroupSize: options.minGroupSize || 2,
    };
  }

  groupFiles(files) {
    const groups = new Map();
    const ungrouped = [];

    for (const file of files) {
      const key = this._getGroupKey(file);
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key).push(file);
    }

    const result = {
      groups: [],
      ungrouped,
      stats: {
        totalGroups: 0,
        totalFiles: files.length,
        totalDuplicateGroups: 0,
        totalDuplicateFiles: 0,
      },
    };

    for (const [key, groupFiles] of groups) {
      if (groupFiles.length >= this.options.minGroupSize) {
        const group = this._analyzeGroup(key, groupFiles);
        result.groups.push(group);
        result.stats.totalGroups++;
        
        if (group.hasDuplicates) {
          result.stats.totalDuplicateGroups++;
          result.stats.totalDuplicateFiles += groupFiles.length;
        }
      } else {
        ungrouped.push(...groupFiles);
      }
    }

    return result;
  }

  _getGroupKey(file) {
    let key;
    
    if (this.options.ignoreExtension) {
      key = file.nameWithoutExt;
    } else {
      key = file.name;
    }
    
    if (!this.options.caseSensitive) {
      key = key.toLowerCase();
    }
    
    return key;
  }

  _analyzeGroup(key, files) {
    const sortedFiles = [...files].sort((a, b) => 
      new Date(b.modified) - new Date(a.modified)
    );

    const hashGroups = new Map();
    for (const file of sortedFiles) {
      const hash = file.hash || file.quickHash;
      if (hash) {
        if (!hashGroups.has(hash)) {
          hashGroups.set(hash, []);
        }
        hashGroups.get(hash).push(file);
      }
    }

    const hashVariants = [];
    let hasDuplicates = false;

    for (const [hash, hashFiles] of hashGroups) {
      const variant = {
        hash,
        count: hashFiles.length,
        files: hashFiles,
        isDuplicate: hashFiles.length > 1,
        totalSize: hashFiles.reduce((sum, f) => sum + f.size, 0),
        redundantSize: (hashFiles.length - 1) * hashFiles[0].size,
      };
      
      if (variant.isDuplicate) {
        hasDuplicates = true;
      }
      
      hashVariants.push(variant);
    }

    return {
      id: `group_${Buffer.from(key).toString('base64url')}`,
      key,
      files: sortedFiles,
      count: sortedFiles.length,
      hashVariants,
      hashVariantCount: hashVariants.length,
      hasDuplicates,
      totalSize: sortedFiles.reduce((sum, f) => sum + f.size, 0),
      redundantSize: hashVariants.reduce((sum, v) => sum + (v.redundantSize || 0), 0),
      newestFile: sortedFiles[0],
      oldestFile: sortedFiles[sortedFiles.length - 1],
    };
  }
}

module.exports = { Grouper };
