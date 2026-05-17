import fs from 'fs';
import path from 'path';
import os from 'os';
import { CommentParser } from './parser.js';
import { ThreadAnalyzer } from './analyzer.js';
import { ReportGenerator } from './reporter.js';
import { Comment, Thread, CATEGORIES } from './models.js';

export class SelfTest {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      ...options
    };
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghcs-test-'));
  }

  log(message) {
    if (this.options.verbose) {
      console.log(`  ${message}`);
    }
  }

  async runAll() {
    const results = {};

    results['数据模型测试'] = await this.testModels();
    results['解析器基础测试'] = await this.testParserBasic();
    results['边界样本测试'] = await this.testEdgeCases();
    results['分析器分类测试'] = await this.testAnalyzer();
    results['报告生成测试'] = await this.testReporter();
    results['坏行保留测试'] = await this.testErrorHandling();

    await this.cleanup();
    return results;
  }

  async testModels() {
    try {
      this.log('测试 Comment 模型...');
      const comment = new Comment({
        id: 1,
        author: 'testuser',
        body: 'This is a blocking comment must fix',
        filePath: 'src/test.js',
        line: 42
      });

      if (!comment.isBlocking()) {
        return { passed: false, message: '阻塞关键词检测失败' };
      }

      this.log('测试 Thread 模型...');
      const thread = new Thread({ id: 't1' });
      thread.addComment(comment);

      if (thread.getCommentCount() !== 1) {
        return { passed: false, message: '线程评论计数失败' };
      }

      if (!thread.isBlocking()) {
        return { passed: false, message: '线程阻塞检测失败' };
      }

      return { passed: true, message: '数据模型功能正常' };
    } catch (error) {
      return { passed: false, message: error.message };
    }
  }

  async testParserBasic() {
    try {
      this.log('创建测试 JSON 文件...');
      const testData = [
        {
          id: 1,
          author: 'alice',
          body: 'Good implementation',
          filePath: 'src/file1.js',
          line: 10,
          createdAt: '2024-01-01T10:00:00Z'
        },
        {
          id: 2,
          author: 'bob',
          body: 'This is blocking - must fix immediately',
          filePath: 'src/file1.js',
          line: 10,
          createdAt: '2024-01-01T11:00:00Z'
        }
      ];

      const testFile = path.join(this.tempDir, 'test-comments.json');
      await fs.promises.writeFile(testFile, JSON.stringify(testData), 'utf-8');

      this.log('解析测试文件...');
      const parser = new CommentParser();
      const { threads, comments, parseErrors } = await parser.parseFile(testFile);

      if (comments.length !== 2) {
        return { passed: false, message: `评论解析数量错误: 期望 2, 实际 ${comments.length}` };
      }

      if (threads.length !== 1) {
        return { passed: false, message: `线程归并数量错误: 期望 1, 实际 ${threads.length}` };
      }

      if (parseErrors.length !== 0) {
        return { passed: false, message: `不应该有解析错误: ${parseErrors.length}` };
      }

      return { passed: true, message: `成功解析 ${comments.length} 条评论, ${threads.length} 个线程` };
    } catch (error) {
      return { passed: false, message: error.message };
    }
  }

  async testEdgeCases() {
    try {
      const edgeCases = [
        { name: '空文件', data: '', expectedComments: 0, expectedErrors: true },
        { name: '空数组', data: '[]', expectedComments: 0, expectedErrors: false },
        { name: '缺少必填字段', data: '[{"body":"only body"}]', expectedComments: 1, expectedErrors: false },
        { name: '无效 JSON', data: '{"invalid": json [}', expectedComments: 0, expectedErrors: true },
        { name: '空评论内容', data: '[{"id":1,"author":"test","body":""}]', expectedComments: 1, expectedErrors: false },
        { name: '非常大的数字', data: '[{"id":999999999999,"author":"test","body":"big id"}]', expectedComments: 1, expectedErrors: false },
        { name: '特殊字符', data: '[{"id":1,"author":"test","body":"🌍 中文 日本語 @#$%^&*()"}]', expectedComments: 1, expectedErrors: false }
      ];

      let passedCount = 0;
      const failures = [];

      for (const testCase of edgeCases) {
        this.log(`测试边界样本: ${testCase.name}...`);
        const testFile = path.join(this.tempDir, `edge-${testCase.name.replace(/\s/g, '-')}.json`);
        await fs.promises.writeFile(testFile, testCase.data, 'utf-8');

        const parser = new CommentParser();
        const { comments, parseErrors } = await parser.parseFile(testFile);

        if (comments.length !== testCase.expectedComments) {
          failures.push(`${testCase.name}: 期望 ${testCase.expectedComments} 条评论, 实际 ${comments.length}`);
          continue;
        }

        if (testCase.expectedErrors && parseErrors.length === 0) {
          failures.push(`${testCase.name}: 期望有解析错误`);
          continue;
        }

        if (!testCase.expectedErrors && parseErrors.length > 0 && testCase.data.length > 0) {
          this.log(`  注意: ${testCase.name} 有 ${parseErrors.length} 个解析错误 (可能是预期的)`);
        }

        passedCount++;
      }

      if (failures.length > 0) {
        return { passed: false, message: failures.join('; ') };
      }

      return { passed: true, message: `${passedCount}/${edgeCases.length} 个边界样本通过` };
    } catch (error) {
      return { passed: false, message: error.message };
    }
  }

  async testAnalyzer() {
    try {
      this.log('测试分析器分类功能...');
      
      const blockingComment = new Comment({
        id: 1,
        author: 'reviewer1',
        body: 'This is blocking must fix this issue immediately',
        filePath: 'src/important.js',
        line: 100
      });

      const nonBlockingComment = new Comment({
        id: 2,
        author: 'reviewer2',
        body: 'Nice code looks good',
        filePath: 'src/normal.js',
        line: 50
      });

      const resolvedComment = new Comment({
        id: 3,
        author: 'reviewer3',
        body: 'Already fixed this issue',
        filePath: 'src/fixed.js',
        line: 25,
        isResolved: true,
        state: 'RESOLVED'
      });

      const duplicate1 = new Comment({
        id: 4,
        author: 'reviewer4',
        body: 'Please add error handling here',
        filePath: 'src/a.js',
        line: 1
      });

      const duplicate2 = new Comment({
        id: 5,
        author: 'reviewer5',
        body: 'Please add error handling here too',
        filePath: 'src/b.js',
        line: 2
      });

      const allComments = [blockingComment, nonBlockingComment, resolvedComment, duplicate1, duplicate2];
      
      const threads = [];
      for (const comment of allComments) {
        const thread = new Thread({ id: `thread-${comment.id}` });
        thread.addComment(comment);
        if (comment.isResolved) {
          thread.isResolved = true;
          thread.status = 'resolved';
        }
        threads.push(thread);
      }

      const analyzer = new ThreadAnalyzer({
        enableDuplicateDetection: true,
        duplicateThreshold: 0.7
      });

      const result = analyzer.analyze(threads, allComments, []);

      const failures = [];
      const jsonResult = result.toJSON();

      if (jsonResult.summary.blockingThreads < 1) {
        failures.push('阻塞线程检测失败');
      }

      if (jsonResult.summary.resolvedThreads < 1) {
        failures.push('已解决线程检测失败');
      }

      if (result.duplicateGroups.length < 1) {
        failures.push('重复讨论检测失败');
      }

      if (jsonResult.summary.totalComments !== 5) {
        failures.push(`评论总数错误: 期望 5, 实际 ${jsonResult.summary.totalComments}`);
      }

      if (failures.length > 0) {
        return { passed: false, message: failures.join('; ') };
      }

      return { passed: true, message: '分析器分类功能正常' };
    } catch (error) {
      return { passed: false, message: error.message };
    }
  }

  async testReporter() {
    try {
      this.log('测试报告生成器...');

      const testComment = new Comment({
        id: 1,
        author: 'tester',
        body: 'Test comment body',
        filePath: 'test.js',
        line: 1
      });

      const testThread = new Thread({ id: 't1' });
      testThread.addComment(testComment);

      const analyzer = new ThreadAnalyzer();
      const result = analyzer.analyze([testThread], [testComment], []);

      const reporter = new ReportGenerator({ outputDir: this.tempDir });

      this.log('生成控制台摘要...');
      const consoleOutput = reporter.generateConsoleSummary(result);
      if (!consoleOutput || consoleOutput.length === 0) {
        return { passed: false, message: '控制台摘要生成失败' };
      }

      this.log('生成 JSON 输出...');
      const jsonOutput = reporter.generateJSON(result);
      if (!jsonOutput || jsonOutput.length === 0) {
        return { passed: false, message: 'JSON 输出生成失败' };
      }

      this.log('生成 Markdown 报告...');
      const mdOutput = reporter.generateMarkdown(result);
      if (!mdOutput || mdOutput.length === 0) {
        return { passed: false, message: 'Markdown 报告生成失败' };
      }

      this.log('写入文件测试...');
      const jsonPath = await reporter.writeToFile(result, 'json', 'test-output.json');
      if (!fs.existsSync(jsonPath)) {
        return { passed: false, message: 'JSON 文件写入失败' };
      }

      const mdPath = await reporter.writeToFile(result, 'markdown', 'test-output.md');
      if (!fs.existsSync(mdPath)) {
        return { passed: false, message: 'Markdown 文件写入失败' };
      }

      return { passed: true, message: '报告生成器功能正常' };
    } catch (error) {
      return { passed: false, message: error.message };
    }
  }

  async testErrorHandling() {
    try {
      this.log('测试坏行保留功能...');

      const badData = `{
  "comments": [
    {"id": 1, "author": "good", "body": "this is valid"},
    {"id": 2, "author": null, "body": "missing author field"},
    {"invalid json line with no closing},
    {"id": 4, "author": "bad structure", body: "missing quotes on key"}
  ]
}`;

      const testFile = path.join(this.tempDir, 'bad-lines.json');
      await fs.promises.writeFile(testFile, badData, 'utf-8');

      const parser = new CommentParser({ strictMode: false, keepRaw: true });
      const { comments, parseErrors } = await parser.parseFile(testFile);

      if (parseErrors.length === 0) {
        return { passed: false, message: '应该检测到解析错误' };
      }

      for (const error of parseErrors) {
        if (!error.lineNumber || !error.raw) {
          return { passed: false, message: '解析错误信息不完整，缺少行号或原始内容' };
        }
      }

      return { 
        passed: true, 
        message: `成功保留 ${parseErrors.length} 个坏行的原始位置和原因` 
      };
    } catch (error) {
      return { passed: false, message: error.message };
    }
  }

  async cleanup() {
    try {
      await fs.promises.rm(this.tempDir, { recursive: true, force: true });
    } catch (e) {
    }
  }
}

export default SelfTest;
