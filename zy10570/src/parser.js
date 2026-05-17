const fs = require('fs');
const path = require('path');

class DDLSyntaxError extends Error {
  constructor(message, line, column, filePath) {
    super(message);
    this.name = 'DDLSyntaxError';
    this.line = line;
    this.column = column;
    this.filePath = filePath;
  }
}

function findDDLFiles(inputPath) {
  const results = [];
  const stat = fs.statSync(inputPath);
  
  if (stat.isFile()) {
    if (path.extname(inputPath).toLowerCase() === '.sql' || 
        inputPath.toLowerCase().endsWith('.ddl')) {
      results.push(inputPath);
    }
  } else if (stat.isDirectory()) {
    const items = fs.readdirSync(inputPath);
    for (const item of items) {
      const fullPath = path.join(inputPath, item);
      const itemStat = fs.statSync(fullPath);
      if (itemStat.isFile()) {
        if (path.extname(fullPath).toLowerCase() === '.sql' || 
            fullPath.toLowerCase().endsWith('.ddl')) {
          results.push(fullPath);
        }
      } else if (itemStat.isDirectory()) {
        results.push(...findDDLFiles(fullPath));
      }
    }
  }
  
  return results;
}

function parseDDLFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const tables = [];
  const badLines = [];
  
  let currentTable = null;
  let inCreateTable = false;
  let braceDepth = 0;
  let lineNumber = 0;
  
  const createTableRegex = /CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`([^`]+)`|"([^"]+)"|([\w.]+))\s*\(/i;
  const columnRegex = /^\s*(?:`([^`]+)`|"([^"]+)"|([\w]+))\s+[\w()]+.*?(?:COMMENT\s+(?:`([^`]+)`|"([^"]+)"|'([^']+)'))?/i;
  const commentRegex = /COMMENT\s+(?:`([^`]+)`|"([^"]+)"|'([^']+)')/i;
  const tableCommentRegex = /COMMENT\s*=\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)')/i;
  
  for (let i = 0; i < lines.length; i++) {
    lineNumber = i + 1;
    let line = lines[i];
    
    const trimmedLine = line.trim();
    
    if (trimmedLine === '' || trimmedLine.startsWith('--') || trimmedLine.startsWith('#')) {
      continue;
    }
    
    let matched = false;
    
    try {
      const createMatch = line.match(createTableRegex);
      if (createMatch) {
        inCreateTable = true;
        matched = true;
        braceDepth = 1;
        const tableName = createMatch[1] || createMatch[2] || createMatch[3];
        currentTable = {
          name: tableName,
          filePath: filePath,
          startLine: lineNumber,
          columns: [],
          comment: null
        };
        continue;
      }
      
      if (inCreateTable) {
        matched = true;
        braceDepth += (line.match(/\(/g) || []).length;
        braceDepth -= (line.match(/\)/g) || []).length;
        
        if (trimmedLine.startsWith(')') || braceDepth <= 0) {
          const tableCommentMatch = line.match(tableCommentRegex) || line.match(commentRegex);
          if (tableCommentMatch && currentTable) {
            currentTable.comment = tableCommentMatch[1] || tableCommentMatch[2] || tableCommentMatch[3] || null;
          }
          if (currentTable) {
            currentTable.endLine = lineNumber;
            tables.push(currentTable);
          }
          inCreateTable = false;
          currentTable = null;
          continue;
        }
        
        const columnMatch = line.match(columnRegex);
        if (columnMatch && currentTable) {
          const columnName = columnMatch[1] || columnMatch[2] || columnMatch[3];
          let comment = columnMatch[4] || columnMatch[5] || columnMatch[6] || null;
          
          if (!comment) {
            const commentMatch = line.match(commentRegex);
            if (commentMatch) {
              comment = commentMatch[1] || commentMatch[2] || commentMatch[3] || null;
            }
          }
          
          currentTable.columns.push({
            name: columnName,
            comment: comment,
            line: lineNumber,
            raw: line.trim()
          });
        }
      }
      
      if (!matched && trimmedLine !== '' && !trimmedLine.startsWith('--') && !trimmedLine.startsWith('#')) {
        badLines.push({
          filePath: filePath,
          line: lineNumber,
          content: line,
          reason: '无法识别的SQL语法'
        });
      }
    } catch (error) {
      badLines.push({
        filePath: filePath,
        line: lineNumber,
        content: line,
        reason: error.message
      });
    }
  }
  
  return { tables, badLines };
}

function parseAllFiles(paths) {
  const allTables = [];
  const allBadLines = [];
  
  for (const inputPath of paths) {
    try {
      const files = findDDLFiles(inputPath);
      for (const file of files) {
        const result = parseDDLFile(file);
        allTables.push(...result.tables);
        allBadLines.push(...result.badLines);
      }
    } catch (error) {
      allBadLines.push({
        filePath: inputPath,
        line: 0,
        content: '',
        reason: error.message
      });
    }
  }
  
  return { tables: allTables, badLines: allBadLines };
}

module.exports = {
  parseDDLFile,
  parseAllFiles,
  findDDLFiles,
  DDLSyntaxError
};
