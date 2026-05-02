const fs = require('fs');
const path = require('path');

const MIGRATION_PATTERN = /^(\d+).*\.sql$/i;

function parseMigrationNumber(filename) {
  const match = filename.match(MIGRATION_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

function readSchemaFile(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    return {
      exists: false,
      content: '',
      statements: []
    };
  }

  const content = fs.readFileSync(schemaPath, 'utf-8');
  const statements = splitSQLStatements(content);

  return {
    exists: true,
    content,
    statements: statements.filter(s => s.trim())
  };
}

function readMigrationsDirectory(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    return {
      exists: false,
      files: [],
      orderedFiles: []
    };
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.toLowerCase().endsWith('.sql'))
    .map(filename => {
      const fullPath = path.join(migrationsDir, filename);
      const number = parseMigrationNumber(filename);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const statements = splitSQLStatements(content);

      return {
        filename,
        fullPath,
        number,
        hasValidNumber: number !== null,
        content,
        statements: statements.filter(s => s.trim())
      };
    });

  const validNumberFiles = files.filter(f => f.hasValidNumber);
  const invalidNumberFiles = files.filter(f => !f.hasValidNumber);

  const orderedFiles = [...validNumberFiles].sort((a, b) => a.number - b.number);

  return {
    exists: true,
    files,
    validNumberFiles,
    invalidNumberFiles,
    orderedFiles
  };
}

function splitSQLStatements(content) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBlockComment = false;
  let inLineComment = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

function checkMigrationOrdering(migrationsData) {
  const issues = [];
  const { validNumberFiles, orderedFiles } = migrationsData;

  if (!validNumberFiles || validNumberFiles.length === 0) {
    return issues;
  }

  const numbers = orderedFiles.map(f => f.number);
  const uniqueNumbers = new Set();

  for (let i = 0; i < numbers.length; i++) {
    const num = numbers[i];
    const file = orderedFiles[i];

    if (uniqueNumbers.has(num)) {
      issues.push({
        type: 'duplicate_number',
        severity: 'error',
        migration: file.filename,
        message: `迁移编号 ${num} 重复`,
        suggestion: '请检查迁移文件编号，确保每个编号唯一'
      });
    }
    uniqueNumbers.add(num);
  }

  const sortedUnique = [...new Set(numbers)].sort((a, b) => a - b);
  const min = sortedUnique[0];
  const max = sortedUnique[sortedUnique.length - 1];

  for (let expected = min; expected <= max; expected++) {
    if (!sortedUnique.includes(expected)) {
      issues.push({
        type: 'missing_number',
        severity: 'warning',
        message: `迁移编号 ${expected} 跳号`,
        suggestion: '建议检查是否漏掉了某个迁移文件，或者重新编号保持连续'
      });
    }
  }

  if (migrationsData.invalidNumberFiles && migrationsData.invalidNumberFiles.length > 0) {
    for (const file of migrationsData.invalidNumberFiles) {
      issues.push({
        type: 'invalid_filename',
        severity: 'warning',
        migration: file.filename,
        message: `文件 "${file.filename}" 不符合命名规范（应以数字开头）`,
        suggestion: '建议使用 "数字_描述.sql" 格式，如 "001_create_users.sql"'
      });
    }
  }

  return issues;
}

module.exports = {
  parseMigrationNumber,
  readSchemaFile,
  readMigrationsDirectory,
  splitSQLStatements,
  checkMigrationOrdering
};
