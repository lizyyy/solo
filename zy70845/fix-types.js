const fs = require('fs');

// 修复 dataProcessor.ts
let dpPath = '/Users/lzy/pro/solo/workspaces/zy70845/api/services/dataProcessor.ts';
let dpContent = fs.readFileSync(dpPath, 'utf8');

const oldParseCsv = `export function parseCsv(content: string): unknown[] {
  const result = Papa.parse(content as unknown as NodeJS.ReadableStream, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
  }) as unknown as { data: unknown[] };
  return result.data;
}`;

const newParseCsv = `export function parseCsv(content: string): unknown[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (Papa as any).parse(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
  });
  return result.data as unknown[];
}`;

dpContent = dpContent.replace(oldParseCsv, newParseCsv);
fs.writeFileSync(dpPath, dpContent);

console.log('Fixed dataProcessor.ts');
