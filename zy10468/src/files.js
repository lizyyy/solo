import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export async function scanSourceFiles(packages, config) {
  const allFiles = [];

  for (const pkg of packages) {
    const pattern = config.extensions.length === 1 
      ? `**/*${config.extensions[0]}` 
      : `**/*{${config.extensions.join(',')}}`;
    const files = await glob(pattern, {
      cwd: pkg.path,
      absolute: true,
      ignore: config.ignore,
      nodir: true,
    });

    for (const file of files) {
      allFiles.push({
        path: file,
        relativePath: path.relative(process.cwd(), file),
        package: pkg,
      });
    }
  }

  return allFiles;
}

export async function readFileWithLineNumbers(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  return lines.map((line, index) => ({
    number: index + 1,
    content: line,
  }));
}
