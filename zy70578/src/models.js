export const COMMENT_TYPES = {
  ISSUE_COMMENT: 'issue_comment',
  REVIEW_COMMENT: 'review_comment',
  REVIEW: 'review'
};

export const THREAD_STATUSES = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  OUTDATED: 'outdated',
  DISMISSED: 'dismissed'
};

export const CATEGORIES = {
  BLOCKING: 'blocking',
  NON_BLOCKING: 'non_blocking',
  DUPLICATE: 'duplicate',
  RESOLVED: 'resolved'
};

export class Comment {
  constructor(data = {}) {
    this.id = data.id || null;
    this.type = data.type || COMMENT_TYPES.ISSUE_COMMENT;
    this.threadId = data.threadId || data.thread_id || data.pull_request_review_thread_id || null;
    this.reviewId = data.reviewId || data.review_id || data.pull_request_review_id || null;
    this.author = data.author || data.user?.login || 'unknown';
    this.authorAssociation = data.authorAssociation || data.author_association || 'NONE';
    this.body = data.body || '';
    this.createdAt = data.createdAt || data.created_at || new Date().toISOString();
    this.updatedAt = data.updatedAt || data.updated_at || this.createdAt;
    this.filePath = data.filePath || data.file_path || data.path || null;
    this.position = data.position || null;
    this.originalPosition = data.originalPosition || data.original_position || null;
    this.diffHunk = data.diffHunk || data.diff_hunk || null;
    this.line = data.line || null;
    this.originalLine = data.originalLine || data.original_line || null;
    this.htmlUrl = data.htmlUrl || data.html_url || null;
    this.state = data.state || null;
    this.isResolved = data.isResolved || data.is_resolved || false;
    this.isOutdated = data.isOutdated || data.is_outdated || false;
    this.reactions = data.reactions || data.reactions || {};
    this._raw = data._raw || null;
    this._lineNumber = data._lineNumber || null;
    this._parseError = data._parseError || null;
  }

  isBlocking() {
    if (!this.body) return false;
    const blockingKeywords = [
      /blocking/i,
      /must (fix|change|address)/i,
      /needs? to (fix|change|address)/i,
      /cannot merge/i,
      /won't merge/i,
      /request changes/i,
      /这是阻塞/i,
      /必须(修复|修改|解决)/i,
      /不能合并/i,
      /需要(修复|修改|解决)/i,
      /blocker/i
    ];
    return blockingKeywords.some(regex => regex.test(this.body));
  }

  getText() {
    return this.body || '';
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      threadId: this.threadId,
      reviewId: this.reviewId,
      author: this.author,
      authorAssociation: this.authorAssociation,
      body: this.body,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      filePath: this.filePath,
      position: this.position,
      line: this.line,
      htmlUrl: this.htmlUrl,
      state: this.state,
      isResolved: this.isResolved,
      isOutdated: this.isOutdated,
      isBlocking: this.isBlocking(),
      _lineNumber: this._lineNumber,
      _parseError: this._parseError
    };
  }
}

export class Thread {
  constructor(data = {}) {
    this.id = data.id || null;
    this.comments = [];
    this.filePath = data.filePath || data.path || null;
    this.status = data.status || THREAD_STATUSES.ACTIVE;
    this.isResolved = data.isResolved || false;
    this.resolvedBy = data.resolvedBy || null;
    this.originalLine = data.originalLine || data.original_line || null;
    this.line = data.line || null;
    this._raw = data._raw || null;
  }

  addComment(comment) {
    this.comments.push(comment);
    if (!this.filePath && comment.filePath) {
      this.filePath = comment.filePath;
    }
  }

  getAuthors() {
    return [...new Set(this.comments.map(c => c.author))];
  }

  getCommentCount() {
    return this.comments.length;
  }

  isBlocking() {
    return this.comments.some(c => c.isBlocking());
  }

  hasKeyword(keyword) {
    return this.comments.some(c => c.body && c.body.toLowerCase().includes(keyword.toLowerCase()));
  }

  getFirstComment() {
    return this.comments[0] || null;
  }

  getLastComment() {
    return this.comments[this.comments.length - 1] || null;
  }

  toJSON() {
    return {
      id: this.id,
      filePath: this.filePath,
      status: this.status,
      isResolved: this.isResolved,
      isBlocking: this.isBlocking(),
      resolvedBy: this.resolvedBy,
      line: this.line,
      commentCount: this.getCommentCount(),
      authors: this.getAuthors(),
      comments: this.comments.map(c => c.toJSON())
    };
  }
}

export class CategoryResult {
  constructor(category) {
    this.category = category;
    this.threads = [];
    this.comments = [];
  }

  addThread(thread) {
    this.threads.push(thread);
  }

  addComment(comment) {
    this.comments.push(comment);
  }

  getCount() {
    return Math.max(this.threads.length, this.comments.length);
  }

  toJSON() {
    return {
      category: this.category,
      threadCount: this.threads.length,
      commentCount: this.comments.length,
      threads: this.threads.map(t => t.toJSON()),
      comments: this.comments.map(c => c.toJSON())
    };
  }
}

export class AnalysisResult {
  constructor() {
    this.totalComments = 0;
    this.totalThreads = 0;
    this.categories = {
      [CATEGORIES.BLOCKING]: new CategoryResult(CATEGORIES.BLOCKING),
      [CATEGORIES.NON_BLOCKING]: new CategoryResult(CATEGORIES.NON_BLOCKING),
      [CATEGORIES.DUPLICATE]: new CategoryResult(CATEGORIES.DUPLICATE),
      [CATEGORIES.RESOLVED]: new CategoryResult(CATEGORIES.RESOLVED)
    };
    this.duplicateGroups = [];
    this.parseErrors = [];
    this.authors = {};
    this.files = {};
    this.metadata = {
      generatedAt: new Date().toISOString(),
      inputFile: null,
      version: '1.0.0'
    };
  }

  addParseError(error) {
    this.parseErrors.push(error);
  }

  incrementAuthorCount(author) {
    this.authors[author] = (this.authors[author] || 0) + 1;
  }

  incrementFileCount(filePath) {
    if (filePath) {
      this.files[filePath] = (this.files[filePath] || 0) + 1;
    }
  }

  getCategory(category) {
    return this.categories[category];
  }

  toJSON() {
    return {
      metadata: this.metadata,
      summary: {
        totalComments: this.totalComments,
        totalThreads: this.totalThreads,
        blockingThreads: this.categories[CATEGORIES.BLOCKING].threads.length,
        duplicateThreads: this.categories[CATEGORIES.DUPLICATE].threads.length,
        resolvedThreads: this.categories[CATEGORIES.RESOLVED].threads.length,
        nonBlockingThreads: this.categories[CATEGORIES.NON_BLOCKING].threads.length,
        parseErrors: this.parseErrors.length,
        uniqueAuthors: Object.keys(this.authors).length,
        affectedFiles: Object.keys(this.files).length
      },
      categories: Object.fromEntries(
        Object.entries(this.categories).map(([k, v]) => [k, v.toJSON()])
      ),
      duplicateGroups: this.duplicateGroups,
      parseErrors: this.parseErrors,
      authors: this.authors,
      files: this.files
    };
  }
}

export default {
  COMMENT_TYPES,
  THREAD_STATUSES,
  CATEGORIES,
  Comment,
  Thread,
  CategoryResult,
  AnalysisResult
};