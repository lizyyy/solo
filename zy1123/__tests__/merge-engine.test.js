const MergeEngine = require('../src/modules/merge-engine');

describe('MergeEngine', () => {
    let mergeEngine;

    beforeEach(() => {
        mergeEngine = new MergeEngine();
    });

    describe('File Type Detection', () => {
        it('should detect markdown files', () => {
            expect(mergeEngine.detectFileType('test.md')).toBe('markdown');
            expect(mergeEngine.detectFileType('test.markdown')).toBe('markdown');
            expect(mergeEngine.detectFileType('docs/README.md')).toBe('markdown');
        });

        it('should detect JSON files', () => {
            expect(mergeEngine.detectFileType('config.json')).toBe('json');
            expect(mergeEngine.detectFileType('data/config.json')).toBe('json');
        });

        it('should use default for other files', () => {
            expect(mergeEngine.detectFileType('file.txt')).toBe('default');
            expect(mergeEngine.detectFileType('script.js')).toBe('default');
            expect(mergeEngine.detectFileType('styles.css')).toBe('default');
        });
    });

    describe('Three-Way Merge Basics', () => {
        it('should accept ours when theirs unchanged', () => {
            const base = 'Hello World';
            const theirs = 'Hello World';
            const ours = 'Hello Modified World';

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'test.txt');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CLEAN);
            expect(result.result).toBe(ours);
        });

        it('should accept theirs when ours unchanged', () => {
            const base = 'Hello World';
            const theirs = 'Hello Modified World';
            const ours = 'Hello World';

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'test.txt');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CLEAN);
            expect(result.result).toBe(theirs);
        });

        it('should accept either when both make identical changes', () => {
            const base = 'Hello World';
            const theirs = 'Hello Modified World';
            const ours = 'Hello Modified World';

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'test.txt');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CLEAN);
            expect(result.result).toBe(theirs);
        });
    });

    describe('Markdown Merge by Sections', () => {
        const baseMd = `# Project

## Overview

This is the base overview.

## Getting Started

1. Install
2. Configure
3. Run

## Configuration

Port: 3000
Host: localhost
`;

        it('should merge changes in different sections', () => {
            const theirsMd = `# Project

## Overview

This is the base overview.
Updated by person A.

## Getting Started

1. Install
2. Configure
3. Run
4. Verify

## Configuration

Port: 3000
Host: localhost
`;

            const oursMd = `# Project

## Overview

This is the base overview.

## Getting Started

1. Install dependencies
2. Configure environment
3. Run application

## Configuration

Port: 8080
Host: 0.0.0.0
Debug: true
`;

            const result = mergeEngine.threeWayMerge(baseMd, theirsMd, oursMd, 'README.md');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);
            expect(result.result).toContain('Updated by person A');
            expect(result.result).toContain('4. Verify');
            expect(result.result).toContain('Install dependencies');
            expect(result.result).toContain('Port: 8080');
            expect(result.result).toContain('Debug: true');
        });

        it('should detect conflict when both modify same section differently', () => {
            const theirsMd = `# Project

## Overview

**Person A's version**: This is completely rewritten.
New content here.

## Getting Started

1. Install
2. Configure
3. Run
`;

            const oursMd = `# Project

## Overview

**Person B's version**: Different rewrite entirely.
Other new content.

## Getting Started

1. Install
2. Configure
3. Run
`;

            const result = mergeEngine.threeWayMerge(baseMd, theirsMd, oursMd, 'README.md');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CONFLICT);
            expect(result.conflicts).toBeDefined();
            expect(result.conflicts.length).toBeGreaterThan(0);
            expect(result.requiresManualResolution).toBe(true);
        });

        it('should handle section reordering', () => {
            const theirsMd = `# Project

## Configuration

Port: 3000
Host: localhost

## Overview

This is the base overview.

## Getting Started

1. Install
2. Configure
3. Run
`;

            const result = mergeEngine.threeWayMerge(baseMd, theirsMd, baseMd, 'README.md');

            expect(result.result).toContain('## Configuration');
            expect(result.result).toContain('## Overview');
        });

        it('should handle new sections', () => {
            const theirsMd = baseMd + `
## New Section A

Added by person A.
`;

            const oursMd = baseMd + `
## New Section B

Added by person B.
`;

            const result = mergeEngine.threeWayMerge(baseMd, theirsMd, oursMd, 'README.md');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);
        });

        it('should detect conflict when adding same section title with different content', () => {
            const theirsMd = baseMd + `
## New Section

Person A's content for new section.
`;

            const oursMd = baseMd + `
## New Section

Person B's different content for same section title.
`;

            const result = mergeEngine.threeWayMerge(baseMd, theirsMd, oursMd, 'README.md');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CONFLICT);
        });
    });

    describe('JSON Merge by Path', () => {
        const baseJson = JSON.stringify({
            app: {
                name: 'my-app',
                version: '1.0.0',
                port: 3000
            },
            database: {
                host: 'localhost',
                port: 5432,
                name: 'app_db'
            },
            features: {
                enableAuth: true,
                enableLogging: false
            }
        }, null, 2);

        it('should merge changes in different paths', () => {
            const theirsJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 3000
                },
                database: {
                    host: 'db.example.com',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                }
            }, null, 2);

            const oursJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.1.0',
                    port: 8080
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false,
                    newFeature: true
                }
            }, null, 2);

            const result = mergeEngine.threeWayMerge(baseJson, theirsJson, oursJson, 'config.json');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);

            const merged = JSON.parse(result.result);
            expect(merged.database.host).toBe('db.example.com');
            expect(merged.app.version).toBe('1.1.0');
            expect(merged.app.port).toBe(8080);
            expect(merged.features.newFeature).toBe(true);
        });

        it('should detect conflict when both modify same path differently', () => {
            const theirsJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 4000
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                }
            }, null, 2);

            const oursJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 8000
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                }
            }, null, 2);

            const result = mergeEngine.threeWayMerge(baseJson, theirsJson, oursJson, 'config.json');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CONFLICT);
            expect(result.conflicts).toBeDefined();
            expect(result.conflicts.length).toBeGreaterThan(0);
            expect(result.conflicts.some(c => c.path === 'app.port')).toBe(true);
        });

        it('should handle nested object modifications', () => {
            const theirsJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 3000,
                    settings: {
                        debug: true
                    }
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                }
            }, null, 2);

            const oursJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 3000
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db',
                    credentials: {
                        username: 'admin',
                        password: 'secret'
                    }
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                }
            }, null, 2);

            const result = mergeEngine.threeWayMerge(baseJson, theirsJson, oursJson, 'config.json');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);

            const merged = JSON.parse(result.result);
            expect(merged.app.settings?.debug).toBe(true);
            expect(merged.database.credentials?.username).toBe('admin');
        });

        it('should handle array modifications', () => {
            const baseWithArray = JSON.stringify({
                items: ['a', 'b', 'c'],
                config: {
                    ports: [3000, 3001]
                }
            }, null, 2);

            const theirsWithArray = JSON.stringify({
                items: ['a', 'b', 'c', 'd'],
                config: {
                    ports: [3000, 3001]
                }
            }, null, 2);

            const oursWithArray = JSON.stringify({
                items: ['a', 'b', 'c'],
                config: {
                    ports: [3000, 3001, 3002]
                }
            }, null, 2);

            const result = mergeEngine.threeWayMerge(baseWithArray, theirsWithArray, oursWithArray, 'data.json');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);
        });

        it('should detect conflict when both modify same array', () => {
            const baseWithArray = JSON.stringify({
                items: ['a', 'b', 'c']
            }, null, 2);

            const theirsWithArray = JSON.stringify({
                items: ['x', 'y', 'z']
            }, null, 2);

            const oursWithArray = JSON.stringify({
                items: ['1', '2', '3']
            }, null, 2);

            const result = mergeEngine.threeWayMerge(baseWithArray, theirsWithArray, oursWithArray, 'data.json');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CONFLICT);
        });

        it('should handle addition of new keys', () => {
            const theirsJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 3000,
                    newKey: 'from-theirs'
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                }
            }, null, 2);

            const oursJson = JSON.stringify({
                app: {
                    name: 'my-app',
                    version: '1.0.0',
                    port: 3000
                },
                database: {
                    host: 'localhost',
                    port: 5432,
                    name: 'app_db'
                },
                features: {
                    enableAuth: true,
                    enableLogging: false
                },
                newRootKey: 'from-ours'
            }, null, 2);

            const result = mergeEngine.threeWayMerge(baseJson, theirsJson, oursJson, 'config.json');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);

            const merged = JSON.parse(result.result);
            expect(merged.app.newKey).toBe('from-theirs');
            expect(merged.newRootKey).toBe('from-ours');
        });
    });

    describe('Default Merge (Line-based)', () => {
        it('should handle simple changes', () => {
            const base = 'line1\nline2\nline3\nline4';
            const theirs = 'line1\nline2-modified\nline3\nline4';
            const ours = 'line1\nline2\nline3\nline4-added';

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'file.txt');

            expect(result.status).not.toBe(MergeEngine.MERGE_STATUS.CONFLICT);
        });

        it('should detect line-level conflicts', () => {
            const base = 'common line\nconflict line\nanother common';
            const theirs = 'common line\ntheirs version of conflict\nanother common';
            const ours = 'common line\nours version of conflict\nanother common';

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'file.txt');

            expect(result.status).toBe(MergeEngine.MERGE_STATUS.CONFLICT);
            expect(result.conflicts).toBeDefined();
        });
    });

    describe('Conflict Information', () => {
        it('should provide detailed conflict information for JSON', () => {
            const base = JSON.stringify({ key: 'value' }, null, 2);
            const theirs = JSON.stringify({ key: 'theirs-value' }, null, 2);
            const ours = JSON.stringify({ key: 'ours-value' }, null, 2);

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'config.json');

            expect(result.conflicts[0].path).toBe('key');
            expect(result.conflicts[0].base).toBe('value');
            expect(result.conflicts[0].theirs).toBe('theirs-value');
            expect(result.conflicts[0].ours).toBe('ours-value');
        });

        it('should mark conflict as requiring manual resolution', () => {
            const base = JSON.stringify({ key: 'value' }, null, 2);
            const theirs = JSON.stringify({ key: 'theirs' }, null, 2);
            const ours = JSON.stringify({ key: 'ours' }, null, 2);

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'config.json');

            expect(result.requiresManualResolution).toBe(true);
        });

        it('should include message about conflicts', () => {
            const base = JSON.stringify({ key: 'value' }, null, 2);
            const theirs = JSON.stringify({ key: 'theirs' }, null, 2);
            const ours = JSON.stringify({ key: 'ours' }, null, 2);

            const result = mergeEngine.threeWayMerge(base, theirs, ours, 'config.json');

            expect(result.message).toContain('conflict');
        });
    });

    describe('Merge Status Constants', () => {
        it('should export correct status constants', () => {
            expect(MergeEngine.MERGE_STATUS.CLEAN).toBe('clean');
            expect(MergeEngine.MERGE_STATUS.AUTO_MERGED).toBe('auto_merged');
            expect(MergeEngine.MERGE_STATUS.CONFLICT).toBe('conflict');
        });
    });
});
