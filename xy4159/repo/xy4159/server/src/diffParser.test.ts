import { diffParser } from './diffParser';

const sampleDiff = `diff --git a/src/main.ts b/src/main.ts
index abc123..def456 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,5 +1,8 @@
 import * as fs from 'fs';
+import * as path from 'path';
+
 const config = {
-  port: 3000
+  port: 38765,
+  debug: true
 };
 
 console.log('Hello World');
diff --git a/src/utils.ts b/src/utils.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world';
+}
`;

describe('diffParser', () => {
  it('should parse multi-file diff', () => {
    const files = diffParser.parse(sampleDiff);
    expect(files.length).toBe(2);
    expect(files[0].filePath).toBe('src/main.ts');
    expect(files[0].isNew).toBe(false);
    expect(files[0].isDeleted).toBe(false);
    expect(files[1].filePath).toBe('src/utils.ts');
    expect(files[1].isNew).toBe(true);
  });

  it('should extract hunks correctly', () => {
    const files = diffParser.parse(sampleDiff);
    const mainFile = files[0];
    expect(mainFile.hunks.length).toBe(1);
    expect(mainFile.hunks[0].oldStart).toBe(1);
    expect(mainFile.hunks[0].newStart).toBe(1);
  });

  it('should extract added lines', () => {
    const files = diffParser.parse(sampleDiff);
    const addedLines = diffParser.getAddedLines(files);
    expect(addedLines.length).toBeGreaterThan(0);
    
    const mainAdded = addedLines.filter(l => l.filePath === 'src/main.ts');
    expect(mainAdded.length).toBeGreaterThan(0);
  });

  it('should extract changed files', () => {
    const files = diffParser.parse(sampleDiff);
    const changedFiles = diffParser.getChangedFiles(files);
    expect(changedFiles).toEqual(['src/main.ts', 'src/utils.ts']);
  });
});
