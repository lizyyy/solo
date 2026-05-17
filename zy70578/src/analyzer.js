import { AnalysisResult, CATEGORIES } from './models.js';

export class ThreadAnalyzer {
  constructor(options = {}) {
    this.options = {
      duplicateThreshold: options.duplicateThreshold || 0.7,
      minCommentLength: options.minCommentLength || 10,
      enableDuplicateDetection: options.enableDuplicateDetection !== false,
      ...options
    };
  }

  analyze(threads, comments, parseErrors = []) {
    const result = new AnalysisResult();
    result.totalComments = comments.length;
    result.totalThreads = threads.length;
    result.parseErrors = parseErrors;

    for (const error of parseErrors) {
      result.addParseError(error);
    }

    for (const comment of comments) {
      result.incrementAuthorCount(comment.author);
      result.incrementFileCount(comment.filePath);
    }

    const categorized = this.categorizeThreads(threads);
    
    for (const [category, threadList] of Object.entries(categorized)) {
      const categoryResult = result.getCategory(category);
      for (const thread of threadList) {
        categoryResult.addThread(thread);
        for (const comment of thread.comments) {
          categoryResult.addComment(comment);
        }
      }
    }

    if (this.options.enableDuplicateDetection) {
      result.duplicateGroups = this.detectDuplicates(threads);
      
      for (const group of result.duplicateGroups) {
        const duplicateCategory = result.getCategory(CATEGORIES.DUPLICATE);
        for (const thread of group.threads) {
          if (!duplicateCategory.threads.includes(thread)) {
            duplicateCategory.addThread(thread);
            for (const comment of thread.comments) {
              duplicateCategory.addComment(comment);
            }
          }
        }
      }
    }

    return result;
  }

  categorizeThreads(threads) {
    const categorized = {
      [CATEGORIES.BLOCKING]: [],
      [CATEGORIES.NON_BLOCKING]: [],
      [CATEGORIES.RESOLVED]: [],
      [CATEGORIES.DUPLICATE]: []
    };

    for (const thread of threads) {
      if (thread.isResolved || thread.status === 'resolved') {
        categorized[CATEGORIES.RESOLVED].push(thread);
      } else if (thread.isBlocking()) {
        categorized[CATEGORIES.BLOCKING].push(thread);
      } else {
        categorized[CATEGORIES.NON_BLOCKING].push(thread);
      }
    }

    return categorized;
  }

  detectDuplicates(threads) {
    const groups = [];
    const processed = new Set();

    const threadSignatures = threads.map(thread => ({
      thread,
      signature: this.getThreadSignature(thread)
    })).filter(t => t.signature.length >= this.options.minCommentLength);

    for (let i = 0; i < threadSignatures.length; i++) {
      if (processed.has(threadSignatures[i].thread.id)) continue;

      const currentGroup = {
        id: `dup_${Date.now()}_${i}`,
        threads: [threadSignatures[i].thread],
        similarity: 1.0,
        representative: threadSignatures[i].signature
      };

      for (let j = i + 1; j < threadSignatures.length; j++) {
        if (processed.has(threadSignatures[j].thread.id)) continue;

        const similarity = this.calculateSimilarity(
          threadSignatures[i].signature,
          threadSignatures[j].signature
        );

        if (similarity >= this.options.duplicateThreshold) {
          currentGroup.threads.push(threadSignatures[j].thread);
          currentGroup.similarity = Math.min(currentGroup.similarity, similarity);
          processed.add(threadSignatures[j].thread.id);
        }
      }

      if (currentGroup.threads.length > 1) {
        groups.push(currentGroup);
      }

      processed.add(threadSignatures[i].thread.id);
    }

    return groups;
  }

  getThreadSignature(thread) {
    const texts = thread.comments
      .map(c => this.normalizeText(c.getText()))
      .filter(t => t.length > 0);
    
    return texts.join(' ');
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\u4e00-\u9fff]/g, '')
      .trim();
  }

  calculateSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    if (text1 === text2) return 1;

    const maxLen = Math.max(text1.length, text2.length);
    if (maxLen === 0) return 1;

    const distance = this.levenshteinDistance(text1, text2);
    return 1 - (distance / maxLen);
  }

  levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  static analyze(threads, comments, parseErrors, options = {}) {
    const analyzer = new ThreadAnalyzer(options);
    return analyzer.analyze(threads, comments, parseErrors);
  }
}

export default ThreadAnalyzer;