import fs from 'fs';
import readline from 'readline';
import { Comment, Thread, COMMENT_TYPES } from './models.js';

export class CommentParser {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode || false,
      encoding: options.encoding || 'utf-8',
      ...options
    };
    this.comments = [];
    this.threads = new Map();
    this.parseErrors = [];
    this.lineNumber = 0;
  }

  async parseFile(filePath) {
    this.comments = [];
    this.threads = new Map();
    this.parseErrors = [];
    this.lineNumber = 0;

    const ext = filePath.toLowerCase().split('.').pop();

    try {
      if (ext === 'json') {
        await this.parseJSONFile(filePath);
      } else if (ext === 'csv') {
        await this.parseCSVFile(filePath);
      } else {
        await this.parseTextFile(filePath);
      }
    } catch (error) {
      this.parseErrors.push({
        lineNumber: this.lineNumber,
        error: error.message,
        raw: 'FILE_ERROR',
        reason: '文件读取或解析失败'
      });
    }

    return {
      comments: this.comments,
      threads: Array.from(this.threads.values()),
      parseErrors: this.parseErrors
    };
  }

  async parseJSONFile(filePath) {
    const content = await fs.promises.readFile(filePath, this.options.encoding);
    
    try {
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          this.lineNumber = i + 1;
          try {
            this.processCommentData(data[i]);
          } catch (error) {
            this.handleParseError(data[i], error.message, 'JSON条目解析失败');
          }
        }
      } else if (data.comments || data.review_comments || data.threads) {
        await this.parseGitHubExportFormat(data);
      } else {
        this.lineNumber = 1;
        this.processCommentData(data);
      }
    } catch (error) {
      if (error.name === 'SyntaxError') {
        this.lineNumber = this.guessErrorLine(error.message, content);
        this.handleParseError(content.substring(0, 100), error.message, 'JSON语法错误');
      } else {
        throw error;
      }
    }
  }

  guessErrorLine(message, content) {
    const match = message.match(/position (\d+)/);
    if (match) {
      const position = parseInt(match[1]);
      const lines = content.substring(0, position).split('\n');
      return lines.length;
    }
    return 1;
  }

  async parseCSVFile(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let headers = null;
    let isFirstLine = true;

    for await (const line of rl) {
      this.lineNumber++;
      
      if (isFirstLine) {
        headers = this.parseCSVLine(line);
        isFirstLine = false;
        continue;
      }

      try {
        const values = this.parseCSVLine(line);
        const data = {};
        
        headers.forEach((header, index) => {
          data[header.trim()] = values[index] || '';
        });

        this.processCommentData(data);
      } catch (error) {
        this.handleParseError(line, error.message, 'CSV行解析失败');
      }
    }
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  async parseTextFile(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentComment = null;
    let currentBody = [];
    let inBody = false;

    for await (const line of rl) {
      this.lineNumber++;

      if (line.match(/^\s*\{/)) {
        if (currentComment) {
          this.processTextComment(currentComment, currentBody.join('\n'));
        }
        currentComment = { line };
        currentBody = [line];
        inBody = true;
        continue;
      }

      if (inBody) {
        currentBody.push(line);
      }

      if (line.match(/\}\s*$/) && currentComment) {
        try {
          const jsonStr = currentBody.join('\n');
          const data = JSON.parse(jsonStr);
          this.processCommentData(data);
        } catch (error) {
          this.handleParseError(currentBody.join('\n'), error.message, '文本中JSON解析失败');
        }
        currentComment = null;
        currentBody = [];
        inBody = false;
      }
    }

    if (currentComment && currentBody.length > 0) {
      this.processTextComment(currentComment, currentBody.join('\n'));
    }
  }

  processTextComment(commentData, rawText) {
    try {
      const data = JSON.parse(rawText);
      this.processCommentData(data);
    } catch (error) {
      this.handleParseError(rawText, error.message, '文本JSON解析失败');
    }
  }

  processCommentData(data) {
    const comment = new Comment({
      ...data,
      _lineNumber: this.lineNumber,
      _raw: this.options.keepRaw ? data : null
    });

    if (!comment.id && !this.options.strictMode) {
      comment.id = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    if (!comment.author && !this.options.strictMode) {
      comment.author = 'unknown';
    }

    this.comments.push(comment);
    this.organizeThread(comment);
  }

  organizeThread(comment) {
    const threadId = comment.threadId || comment.reviewId || `default_${comment.filePath || 'global'}`;
    
    if (!this.threads.has(threadId)) {
      const thread = new Thread({
        id: threadId,
        filePath: comment.filePath,
        line: comment.line || comment.originalLine
      });
      this.threads.set(threadId, thread);
    }

    const thread = this.threads.get(threadId);
    thread.addComment(comment);

    if (comment.state === 'RESOLVED' || comment.isResolved) {
      thread.isResolved = true;
      thread.status = 'resolved';
    }
    if (comment.isOutdated) {
      thread.status = 'outdated';
    }
  }

  handleParseError(raw, error, reason) {
    this.parseErrors.push({
      lineNumber: this.lineNumber,
      error: String(error),
      raw: String(raw).substring(0, 500),
      reason: reason
    });
  }

  async parseGitHubExportFormat(data) {
    if (data.review_comments && Array.isArray(data.review_comments)) {
      for (let i = 0; i < data.review_comments.length; i++) {
        this.lineNumber = i + 1;
        try {
          this.processCommentData({
            ...data.review_comments[i],
            type: COMMENT_TYPES.REVIEW_COMMENT
          });
        } catch (error) {
          this.handleParseError(data.review_comments[i], error.message, 'review_comment解析失败');
        }
      }
    }

    if (data.comments && Array.isArray(data.comments)) {
      for (let i = 0; i < data.comments.length; i++) {
        this.lineNumber = i + 1;
        try {
          this.processCommentData({
            ...data.comments[i],
            type: COMMENT_TYPES.ISSUE_COMMENT
          });
        } catch (error) {
          this.handleParseError(data.comments[i], error.message, 'issue_comment解析失败');
        }
      }
    }

    if (data.reviews && Array.isArray(data.reviews)) {
      for (let i = 0; i < data.reviews.length; i++) {
        this.lineNumber = i + 1;
        try {
          const review = data.reviews[i];
          this.processCommentData({
            ...review,
            body: review.body || '',
            type: COMMENT_TYPES.REVIEW,
            state: review.state
          });
        } catch (error) {
          this.handleParseError(data.reviews[i], error.message, 'review解析失败');
        }
      }
    }
  }

  static async parse(filePath, options = {}) {
    const parser = new CommentParser(options);
    return await parser.parseFile(filePath);
  }
}

export default CommentParser;