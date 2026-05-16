const fs = require('fs').promises;
const path = require('path');

async function parseSilences(filePath) {
  const silences = [];
  const errors = [];
  const content = await fs.readFile(filePath, 'utf8');

  try {
    const data = JSON.parse(content);

    let silenceArray;
    if (Array.isArray(data)) {
      silenceArray = data;
    } else if (data.data && Array.isArray(data.data)) {
      silenceArray = data.data;
    } else {
      throw new Error('无法识别的JSON格式，期望是数组或包含data字段的对象');
    }

    silenceArray.forEach((item, index) => {
      try {
        silences.push({
          ...item,
          __source: {
            file: filePath,
            index: index,
            line: index + 2,
          },
        });
      } catch (e) {
        errors.push({
          type: 'PARSE_ERROR',
          recordIndex: index,
          message: e.message,
          rawRecord: item,
          source: {
            file: filePath,
            line: index + 2,
          },
        });
      }
    });

  } catch (e) {
    if (e.name === 'SyntaxError') {
      const match = e.message.match(/at position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      
      const lines = content.substring(0, position).split('\n');
      const lineNumber = lines.length;
      const columnNumber = lines[lines.length - 1].length + 1;

      errors.push({
        type: 'JSON_SYNTAX_ERROR',
        message: `JSON语法错误: ${e.message}`,
        source: {
          file: filePath,
          line: lineNumber,
          column: columnNumber,
          position: position,
        },
        context: getErrorContext(content, lineNumber, columnNumber),
      });
    } else {
      errors.push({
        type: 'FILE_PARSE_ERROR',
        message: e.message,
        source: { file: filePath },
      });
    }
  }

  return { silences, errors };
}

function getErrorContext(content, lineNumber, columnNumber) {
  const lines = content.split('\n');
  const startLine = Math.max(0, lineNumber - 3);
  const endLine = Math.min(lines.length, lineNumber + 2);
  
  const context = [];
  for (let i = startLine; i < endLine; i++) {
    context.push({
      line: i + 1,
      content: lines[i],
      isError: i + 1 === lineNumber,
      column: i + 1 === lineNumber ? columnNumber : null,
    });
  }
  return context;
}

async function loadAlerts(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(content);

  if (Array.isArray(data)) {
    return data;
  } else if (data.data && Array.isArray(data.data)) {
    return data.data;
  } else if (data.alerts && Array.isArray(data.alerts)) {
    return data.alerts;
  }

  throw new Error('无法识别的告警数据格式');
}

module.exports = {
  parseSilences,
  loadAlerts,
};
