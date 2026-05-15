import { LiveSample, DuplicateGroup, DuplicateItem } from './types';
import * as crypto from 'crypto';

export class DuplicateDetector {
  private truncationThreshold: number = 0.7;

  detect(samples: LiveSample[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    
    groups.push(...this.detectByProductId(samples));
    groups.push(...this.detectBySku(samples));
    groups.push(...this.detectByNameSimilarity(samples));
    
    return this.mergeOverlappingGroups(groups);
  }

  private detectByProductId(samples: LiveSample[]): DuplicateGroup[] {
    const productMap = new Map<string, LiveSample[]>();
    
    samples.forEach(sample => {
      if (!productMap.has(sample.productId)) {
        productMap.set(sample.productId, []);
      }
      productMap.get(sample.productId)!.push(sample);
    });

    const groups: DuplicateGroup[] = [];
    for (const [productId, items] of productMap) {
      if (items.length > 1) {
        groups.push(this.createGroup(items, 'productId', productId));
      }
    }
    
    return groups;
  }

  private detectBySku(samples: LiveSample[]): DuplicateGroup[] {
    const skuMap = new Map<string, LiveSample[]>();
    
    samples.forEach(sample => {
      if (!skuMap.has(sample.sku)) {
        skuMap.set(sample.sku, []);
      }
      skuMap.get(sample.sku)!.push(sample);
    });

    const groups: DuplicateGroup[] = [];
    for (const [sku, items] of skuMap) {
      if (items.length > 1) {
        groups.push(this.createGroup(items, 'sku', sku));
      }
    }
    
    return groups;
  }

  private detectByNameSimilarity(samples: LiveSample[]): DuplicateGroup[] {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < samples.length; i++) {
      if (processed.has(samples[i].id)) continue;
      
      const similarItems: LiveSample[] = [samples[i]];
      processed.add(samples[i].id);

      for (let j = i + 1; j < samples.length; j++) {
        if (processed.has(samples[j].id)) continue;
        
        const similarity = this.calculateSimilarity(
          samples[i].productName,
          samples[j].productName
        );

        if (similarity > 0.8) {
          similarItems.push(samples[j]);
          processed.add(samples[j].id);
        }
      }

      if (similarItems.length > 1) {
        groups.push(this.createGroup(similarItems, 'name', samples[i].productName));
      }
    }

    return groups;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    if (longer.startsWith(shorter) || shorter.startsWith(longer)) {
      return 0.95;
    }

    const editDistance = this.levenshteinDistance(str1, str2);
    return 1 - editDistance / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }

  private detectTruncation(sample: LiveSample, allSamples: LiveSample[]): { isTruncated: boolean; fields: string[] } {
    const truncationFields: string[] = [];
    
    const sameProductSamples = allSamples.filter(
      s => s.productId === sample.productId && s.id !== sample.id
    );

    for (const other of sameProductSamples) {
      if (sample.productName.length < other.productName.length &&
          other.productName.startsWith(sample.productName)) {
        truncationFields.push('productName');
        break;
      }
    }

    return {
      isTruncated: truncationFields.length > 0,
      fields: truncationFields
    };
  }

  private calculateRiskLevel(items: LiveSample[]): 'high' | 'medium' | 'low' {
    const criticalFields = ['productId', 'sku', 'productName'];
    let matchScore = 0;

    for (let i = 0; i < items.length - 1; i++) {
      for (const field of criticalFields) {
        if (items[i][field] === items[i + 1][field]) {
          matchScore++;
        }
      }
    }

    const maxScore = criticalFields.length * (items.length - 1);
    const ratio = matchScore / maxScore;

    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'medium';
    return 'low';
  }

  private createGroup(samples: LiveSample[], keyType: DuplicateGroup['keyType'], key: string): DuplicateGroup {
    const items: DuplicateItem[] = samples.map(sample => {
      const truncation = this.detectTruncation(sample, samples);
      return {
        sample,
        isTruncated: truncation.isTruncated,
        truncationFields: truncation.fields,
        confidence: truncation.isTruncated ? 0.6 : 0.95
      };
    });

    return {
      groupId: `GRP-${crypto.randomUUID().slice(0, 8)}`,
      key,
      keyType,
      items,
      riskLevel: this.calculateRiskLevel(samples),
      detectedAt: new Date().toISOString()
    };
  }

  private mergeOverlappingGroups(groups: DuplicateGroup[]): DuplicateGroup[] {
    if (groups.length <= 1) return groups;

    const merged: DuplicateGroup[] = [];
    const processedItemIds = new Set<string>();

    for (const group of groups) {
      const itemIds = new Set(group.items.map(item => item.sample.id));
      let hasOverlap = false;

      for (let i = 0; i < merged.length; i++) {
        const mergedItemIds = new Set(merged[i].items.map(item => item.sample.id));
        const intersection = [...itemIds].filter(id => mergedItemIds.has(id));
        
        if (intersection.length > 0) {
          hasOverlap = true;
          const allItems = [...group.items, ...merged[i].items];
          const uniqueItems = allItems.filter((item, index, self) =>
            index === self.findIndex(t => t.sample.id === item.sample.id)
          );
          
          merged[i] = {
            ...merged[i],
            keyType: 'composite',
            items: uniqueItems,
            riskLevel: this.calculateRiskLevel(uniqueItems.map(i => i.sample))
          };
          break;
        }
      }

      if (!hasOverlap) {
        merged.push(group);
      }
    }

    return merged;
  }
}
