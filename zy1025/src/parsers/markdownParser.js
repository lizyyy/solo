import fs from 'fs';
import path from 'path';
import { ENV_VAR_PATTERN } from '../utils/constants.js';

export function parseMarkdown(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const variables = {};

  const codeBlocks = extractCodeBlocks(content);
  
  for (const block of codeBlocks) {
    const matches = block.text.matchAll(ENV_VAR_PATTERN);
    
    for (const match of matches) {
      const varName = match[0];
      
      if (!variables[varName]) {
        variables[varName] = {
          value: undefined,
          source: fileName,
          filePath: filePath,
          foundIn: 'markdown',
          codeBlocks: [],
        };
      }
      
      const blockInfo = {
        language: block.language,
        lineNumber: block.lineNumber,
      };
      
      if (!variables[varName].codeBlocks.some(b => 
        b.language === blockInfo.language && b.lineNumber === blockInfo.lineNumber
      )) {
        variables[varName].codeBlocks.push(blockInfo);
      }
    }
  }

  return variables;
}

function extractCodeBlocks(content) {
  const codeBlocks = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockStartLine = 0;
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim();
        codeBlockStartLine = i + 1;
        currentBlock = [];
      } else {
        inCodeBlock = false;
        if (currentBlock.length > 0) {
          codeBlocks.push({
            language: codeBlockLanguage,
            lineNumber: codeBlockStartLine,
            text: currentBlock.join('\n'),
          });
        }
        currentBlock = [];
        codeBlockLanguage = '';
      }
    } else if (inCodeBlock) {
      currentBlock.push(line);
    }
  }

  return codeBlocks;
}

export function isMarkdownFile(fileName) {
  return fileName.endsWith('.md') || fileName.endsWith('.markdown');
}
