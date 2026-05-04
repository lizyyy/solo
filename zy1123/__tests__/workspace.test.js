const fs = require('fs');
const path = require('path');
const os = require('os');

const Workspace = require('../src/modules/workspace');

describe('Workspace', () => {
    let tempDir;
    let testWorkspacePath;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-guard-test-'));
        testWorkspacePath = path.join(tempDir, 'test-workspace');
        fs.mkdirSync(testWorkspacePath, { recursive: true });
    });

    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Initialization', () => {
        it('should create a new workspace', () => {
            const ws = new Workspace(testWorkspacePath);
            expect(ws.exists()).toBe(false);

            const meta = ws.init();

            expect(ws.exists()).toBe(true);
            expect(meta).toBeDefined();
            expect(meta.id).toBeDefined();
            expect(meta.createdAt).toBeDefined();
            expect(fs.existsSync(path.join(testWorkspacePath, '.doc-guard'))).toBe(true);
        });

        it('should throw error when initializing existing workspace', () => {
            const ws = new Workspace(testWorkspacePath);
            ws.init();

            expect(() => ws.init()).toThrow('Workspace already initialized');
        });

        it('should read workspace metadata', () => {
            const ws = new Workspace(testWorkspacePath);
            ws.init({ defaultLeaseDuration: 600 });

            const meta = ws.getMeta();

            expect(meta.options.defaultLeaseDuration).toBe(600);
            expect(meta.options.autoMergeEnabled).toBe(true);
        });
    });

    describe('Revision Management', () => {
        let ws;

        beforeEach(() => {
            ws = new Workspace(testWorkspacePath);
            ws.init();
        });

        it('should create a revision for a new file', () => {
            const content = '# Test Document\n\nHello World!';
            const result = ws.createRevision('docs/test.md', content, 'test-author', 'Initial version');

            expect(result.isNew).toBe(true);
            expect(result.revision).toBeDefined();
            expect(result.revision.author).toBe('test-author');
            expect(result.revision.relativePath).toBe('docs/test.md');
            expect(result.revision.message).toBe('Initial version');
        });

        it('should not create duplicate revision for same content', () => {
            const content = '# Test Document\n\nHello World!';
            const first = ws.createRevision('docs/test.md', content, 'test-author');
            const second = ws.createRevision('docs/test.md', content, 'another-author');

            expect(first.isNew).toBe(true);
            expect(second.isNew).toBe(false);
            expect(second.revision.id).toBe(first.revision.id);
        });

        it('should track parent revision', () => {
            const v1 = ws.createRevision('docs/test.md', 'Version 1', 'author1');
            const v2 = ws.createRevision('docs/test.md', 'Version 2', 'author2');

            expect(v2.revision.parentRevisionId).toBe(v1.revision.id);
        });

        it('should get file revision', () => {
            ws.createRevision('docs/test.md', 'Content', 'author');

            const revision = ws.getFileRevision('docs/test.md');

            expect(revision).toBeDefined();
            expect(revision.relativePath).toBe('docs/test.md');
        });

        it('should get all revisions', () => {
            ws.createRevision('docs/a.md', 'A1', 'author');
            ws.createRevision('docs/b.md', 'B1', 'author');
            ws.createRevision('docs/a.md', 'A2', 'author');

            const revisions = ws.getAllRevisions();

            expect(revisions.length).toBe(3);
        });

        it('should list tracked files', () => {
            ws.createRevision('docs/a.md', 'A', 'author');
            ws.createRevision('config/b.json', '{}', 'author');

            const files = ws.listTrackedFiles();

            expect(files).toContain('docs/a.md');
            expect(files).toContain('config/b.json');
            expect(files.length).toBe(2);
        });

        it('should get file history', () => {
            ws.createRevision('docs/test.md', 'V1', 'author');
            ws.createRevision('docs/test.md', 'V2', 'author');
            ws.createRevision('docs/test.md', 'V3', 'author');

            const history = ws.getFileHistory('docs/test.md');

            expect(history.length).toBe(3);
        });
    });

    describe('Content Storage', () => {
        let ws;

        beforeEach(() => {
            ws = new Workspace(testWorkspacePath);
            ws.init();
        });

        it('should save and load file content', () => {
            const originalContent = '# Test\n\nContent here.';
            const result = ws.createRevision('docs/test.md', originalContent, 'author');

            const loadedContent = ws._loadSnapshot(result.revision.hash);

            expect(loadedContent).toBe(originalContent);
        });

        it('should compute consistent hash', () => {
            const content = 'test content';
            const hash1 = ws._computeHash(content);
            const hash2 = ws._computeHash(content);

            expect(hash1).toBe(hash2);
        });

        it('should compute different hash for different content', () => {
            const hash1 = ws._computeHash('content A');
            const hash2 = ws._computeHash('content B');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Audit Log', () => {
        let ws;

        beforeEach(() => {
            ws = new Workspace(testWorkspacePath);
            ws.init();
        });

        it('should log initialization', () => {
            const logs = ws.getAuditLog();

            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].action).toBe('workspace_init');
        });

        it('should log revision creation', () => {
            ws.createRevision('docs/test.md', 'content', 'author');

            const logs = ws.getAuditLog(null, null, 'revision_create');

            expect(logs.length).toBe(1);
            expect(logs[0].details.revision.relativePath).toBe('docs/test.md');
        });

        it('should filter logs by action', () => {
            ws.createRevision('a.md', 'a', 'author');
            ws.createRevision('b.md', 'b', 'author');

            const createLogs = ws.getAuditLog(null, null, 'revision_create');
            const initLogs = ws.getAuditLog(null, null, 'workspace_init');

            expect(createLogs.length).toBe(2);
            expect(initLogs.length).toBe(1);
        });
    });

    describe('Working Files', () => {
        let ws;

        beforeEach(() => {
            ws = new Workspace(testWorkspacePath);
            ws.init();
        });

        it('should write working file', () => {
            const content = 'working content';
            ws.writeWorkingFile('docs/work.md', content);

            const filePath = path.join(testWorkspacePath, 'docs/work.md');
            expect(fs.existsSync(filePath)).toBe(true);
            expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
        });

        it('should get file content from working directory', () => {
            const content = 'working file content';
            ws.writeWorkingFile('test.md', content);

            const loaded = ws.getFileContent('test.md');

            expect(loaded).toBe(content);
        });

        it('should get file content by revision id', () => {
            const content = 'revision content';
            const result = ws.createRevision('docs/test.md', content, 'author');

            const loaded = ws.getFileContent('docs/test.md', result.revision.id);

            expect(loaded).toBe(content);
        });
    });
});
