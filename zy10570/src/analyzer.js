function analyzeTables(tables) {
  const missingComments = {
    tables: [],
    columns: []
  };
  const duplicateComments = {
    tables: [],
    columns: []
  };
  const conflictingComments = {
      tables: [],
      columns: []
    };
    
  const tableCommentMap = new Map();
  const columnCommentMap = new Map();
  
  for (const table of tables) {
    if (!table.comment || table.comment.trim() === '') {
      missingComments.tables.push({
        table: table.name,
        filePath: table.filePath,
        line: table.startLine
      });
    } else {
      const commentKey = table.comment.toLowerCase().trim();
      if (!tableCommentMap.has(commentKey)) {
        tableCommentMap.set(commentKey, []);
      }
      tableCommentMap.get(commentKey).push({
        table: table.name,
        filePath: table.filePath,
        comment: table.comment
      });
    }
    
    const tableColumnMap = new Map();
    
    for (const column of table.columns) {
      if (!column.comment || column.comment.trim() === '') {
        missingComments.columns.push({
          table: table.name,
          column: column.name,
          filePath: table.filePath,
          line: column.line
        });
      } else {
        const columnKey = `${table.name}.${column.name}`;
        const commentKey = column.comment.toLowerCase().trim();
        
        if (!columnCommentMap.has(commentKey)) {
          columnCommentMap.set(commentKey, []);
        }
        columnCommentMap.get(commentKey).push({
          column: columnKey,
          filePath: table.filePath,
          comment: column.comment
        });
        
        if (!tableColumnMap.has(columnKey)) {
          tableColumnMap.set(columnKey, []);
        }
        tableColumnMap.get(columnKey).push({
          column: column.name,
          comment: column.comment,
          line: column.line
        });
      }
    }
  }
  
  for (const [comment, tables] of tableCommentMap.entries()) {
    if (tables.length > 1 && comment.length > 0) {
      duplicateComments.tables.push({
        comment: tables[0].comment,
        tables: tables
      });
    }
  }
  
  for (const [comment, columns] of columnCommentMap.entries()) {
    if (columns.length > 1 && comment.length > 0) {
      duplicateComments.columns.push({
        comment: columns[0].comment,
        columns: columns
      });
    }
  }
  
  const columnNameMap = new Map();
  for (const table of tables) {
    for (const column of table.columns) {
      const columnKey = `${table.name}.${column.name}`;
      if (!columnNameMap.has(columnKey)) {
        columnNameMap.set(columnKey, []);
      }
      if (column.comment) {
        columnNameMap.get(columnKey).push({
          comment: column.comment,
          filePath: table.filePath,
          line: column.line
        });
      }
    }
  }
  
  for (const [columnKey, comments] of columnNameMap.entries()) {
    if (comments.length > 1) {
      const uniqueComments = [...new Set(comments.map(c => c.comment.toLowerCase().trim()))];
      if (uniqueComments.length > 1) {
        conflictingComments.columns.push({
          column: columnKey,
          comments: comments
        });
      }
    }
  }
  
  const tableNameMap = new Map();
  for (const table of tables) {
    if (!tableNameMap.has(table.name)) {
      tableNameMap.set(table.name, []);
    }
    if (table.comment) {
      tableNameMap.get(table.name).push({
        comment: table.comment,
        filePath: table.filePath,
        line: table.startLine
      });
    }
  }
  
  for (const [tableName, comments] of tableNameMap.entries()) {
    if (comments.length > 1) {
      const uniqueComments = [...new Set(comments.map(c => c.comment.toLowerCase().trim()))];
      if (uniqueComments.length > 1) {
        conflictingComments.tables.push({
          table: tableName,
          comments: comments
        });
      }
    }
  }
  
  return {
    missingComments,
    duplicateComments,
    conflictingComments
  };
}

function generateStatistics(tables, analysis, badLines) {
  const totalTables = tables.length;
  const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0);
  const tablesWithMissingComment = analysis.missingComments.tables.length;
  const columnsWithMissingComment = analysis.missingComments.columns.length;
  const duplicateTableComments = analysis.duplicateComments.tables.length;
  const duplicateColumnComments = analysis.duplicateComments.columns.length;
  const conflictingTableComments = analysis.conflictingComments.tables.length;
  const conflictingColumnComments = analysis.conflictingComments.columns.length;
  
  return {
    summary: {
      totalTables,
      totalColumns,
      tablesWithMissingComment,
      columnsWithMissingComment,
      duplicateTableComments,
      duplicateColumnComments,
      conflictingTableComments,
      conflictingColumnComments,
      badLines: badLines.length,
      hasIssues: tablesWithMissingComment > 0 || columnsWithMissingComment > 0 || 
                 conflictingTableComments > 0 || conflictingColumnComments > 0 ||
                 badLines.length > 0
    },
    tables,
    ...analysis,
    badLines
  };
}

module.exports = {
  analyzeTables,
  generateStatistics
};
