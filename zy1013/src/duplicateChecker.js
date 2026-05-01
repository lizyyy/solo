class DuplicateChecker {
  static async check(photos) {
    const duplicates = [];
    const hashMap = new Map();
    const sizeMap = new Map();
    const dimensionMap = new Map();

    for (const photo of photos) {
      if (hashMap.has(photo.hash)) {
        duplicates.push({
          type: 'exact',
          confidence: 100,
          photos: [hashMap.get(photo.hash), photo],
          reason: '文件哈希完全相同'
        });
      } else {
        hashMap.set(photo.hash, photo);
      }

      const sizeKey = `${photo.fileSize}_${photo.width}_${photo.height}`;
      if (sizeMap.has(sizeKey)) {
        const existing = sizeMap.get(sizeKey);
        if (existing.id !== photo.id && photo.hash !== existing.hash) {
          duplicates.push({
            type: 'suspected',
            confidence: 80,
            photos: [existing, photo],
            reason: '文件大小和尺寸相同，可能是不同格式或压缩版本'
          });
        }
      } else {
        sizeMap.set(sizeKey, photo);
      }

      const dimensionKey = `${photo.width}_${photo.height}`;
      if (dimensionMap.has(dimensionKey)) {
        const existingGroup = dimensionMap.get(dimensionKey);
        for (const existing of existingGroup) {
          if (existing.id !== photo.id && photo.hash !== existing.hash) {
            const sizeDiff = Math.abs(photo.fileSize - existing.fileSize);
            const sizeRatio = Math.max(photo.fileSize, existing.fileSize) / 
                             Math.min(photo.fileSize, existing.fileSize);
            
            if (sizeRatio < 1.5) {
              duplicates.push({
                type: 'suspected',
                confidence: 60,
                photos: [existing, photo],
                reason: `尺寸相同，文件大小相近 (比例: ${sizeRatio.toFixed(2)})`
              });
            }
          }
        }
        existingGroup.push(photo);
      } else {
        dimensionMap.set(dimensionKey, [photo]);
      }
    }

    const uniqueDuplicates = this.removeDuplicateEntries(duplicates);
    return uniqueDuplicates;
  }

  static removeDuplicateEntries(duplicates) {
    const seen = new Set();
    const result = [];

    for (const dup of duplicates) {
      const photoIds = dup.photos.map(p => p.id).sort().join('|');
      const key = `${dup.type}_${photoIds}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        result.push(dup);
      }
    }

    return result;
  }

  static groupByHash(photos) {
    const groups = new Map();
    
    for (const photo of photos) {
      if (!groups.has(photo.hash)) {
        groups.set(photo.hash, []);
      }
      groups.get(photo.hash).push(photo);
    }
    
    return Array.from(groups.entries())
      .filter(([hash, photos]) => photos.length > 1)
      .map(([hash, photos]) => ({ hash, photos }));
  }

  static findNearDuplicates(photos, threshold = 0.9) {
    const nearDuplicates = [];
    
    for (let i = 0; i < photos.length; i++) {
      for (let j = i + 1; j < photos.length; j++) {
        const p1 = photos[i];
        const p2 = photos[j];
        
        if (p1.hash === p2.hash) continue;
        
        let similarity = 0;
        
        if (p1.width === p2.width && p1.height === p2.height) {
          similarity += 0.4;
        } else if (p1.width === p2.height && p1.height === p2.width) {
          similarity += 0.2;
        }
        
        const sizeRatio = Math.min(p1.fileSize, p2.fileSize) / Math.max(p1.fileSize, p2.fileSize);
        similarity += sizeRatio * 0.3;
        
        const p1Name = p1.fileName.toLowerCase().replace(/\.[^.]+$/, '');
        const p2Name = p2.fileName.toLowerCase().replace(/\.[^.]+$/, '');
        if (p1Name === p2Name || p1Name.includes(p2Name) || p2Name.includes(p1Name)) {
          similarity += 0.3;
        }
        
        if (similarity >= threshold) {
          nearDuplicates.push({
            type: 'near_duplicate',
            confidence: Math.round(similarity * 100),
            photos: [p1, p2],
            reason: `相似度 ${Math.round(similarity * 100)}%`
          });
        }
      }
    }
    
    return nearDuplicates;
  }
}

module.exports = DuplicateChecker;
