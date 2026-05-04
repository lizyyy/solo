const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../../../data/uploads');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function parseJsonl(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }
  
  const lines = content.trim().split('\n');
  const results = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const obj = JSON.parse(line);
      results.push(obj);
    } catch (error) {
      console.error(`Error parsing JSONL line ${i + 1}:`, error.message);
      throw new Error(`Invalid JSONL format at line ${i + 1}: ${error.message}`);
    }
  }
  
  return results;
}

function parseYaml(content) {
  if (!content || typeof content !== 'string') {
    return {};
  }
  
  try {
    return yaml.load(content) || {};
  } catch (error) {
    console.error('Error parsing YAML:', error.message);
    throw new Error(`Invalid YAML format: ${error.message}`);
  }
}

function parseJson(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing JSON:', error.message);
    throw new Error(`Invalid JSON format: ${error.message}`);
  }
}

function validateFile(type, content) {
  const errors = [];
  
  switch (type) {
    case 'conversations':
      try {
        const conversations = parseJsonl(content);
        if (!Array.isArray(conversations)) {
          errors.push('Conversations must be an array of messages');
        } else {
          conversations.forEach((msg, idx) => {
            if (!msg.role) {
              errors.push(`Message ${idx + 1} is missing "role" field`);
            }
            if (!msg.content && msg.content !== '') {
              errors.push(`Message ${idx + 1} is missing "content" field`);
            }
          });
        }
      } catch (e) {
        errors.push(e.message);
      }
      break;
      
    case 'docs':
      if (typeof content !== 'string') {
        errors.push('Docs must be a string');
      }
      break;
      
    case 'toolResults':
      try {
        const results = parseJson(content);
        if (results === null || results === undefined) {
          errors.push('Tool results JSON is empty or invalid');
        }
      } catch (e) {
        errors.push(e.message);
      }
      break;
      
    case 'budget':
      try {
        const budget = parseYaml(content);
        if (typeof budget !== 'object' || budget === null) {
          errors.push('Budget YAML must be an object');
        }
      } catch (e) {
        errors.push(e.message);
      }
      break;
  }
  
  return { valid: errors.length === 0, errors };
}

function processUploadedFiles(files) {
  const result = {
    conversations: null,
    docs: null,
    toolResults: null,
    budget: null,
    errors: []
  };
  
  if (files.conversations) {
    try {
      const content = files.conversations.buffer.toString('utf8');
      const validation = validateFile('conversations', content);
      if (validation.valid) {
        result.conversations = parseJsonl(content);
      } else {
        result.errors.push(...validation.errors.map(e => `conversations.jsonl: ${e}`));
      }
    } catch (error) {
      result.errors.push(`conversations.jsonl: ${error.message}`);
    }
  }
  
  if (files.docs) {
    try {
      const content = files.docs.buffer.toString('utf8');
      const validation = validateFile('docs', content);
      if (validation.valid) {
        result.docs = content;
      } else {
        result.errors.push(...validation.errors.map(e => `docs.md: ${e}`));
      }
    } catch (error) {
      result.errors.push(`docs.md: ${error.message}`);
    }
  }
  
  if (files.toolResults) {
    try {
      const content = files.toolResults.buffer.toString('utf8');
      const validation = validateFile('toolResults', content);
      if (validation.valid) {
        result.toolResults = parseJson(content);
      } else {
        result.errors.push(...validation.errors.map(e => `tool-results.json: ${e}`));
      }
    } catch (error) {
      result.errors.push(`tool-results.json: ${error.message}`);
    }
  }
  
  if (files.budget) {
    try {
      const content = files.budget.buffer.toString('utf8');
      const validation = validateFile('budget', content);
      if (validation.valid) {
        result.budget = parseYaml(content);
      } else {
        result.errors.push(...validation.errors.map(e => `budget.yaml: ${e}`));
      }
    } catch (error) {
      result.errors.push(`budget.yaml: ${error.message}`);
    }
  }
  
  return result;
}

function saveToUploadDir(content, filename) {
  ensureUploadDir();
  const uniqueName = `${uuidv4()}_${filename}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);
  
  fs.writeFileSync(filePath, content);
  
  return {
    path: filePath,
    filename: uniqueName,
    originalName: filename
  };
}

function readFromUploadDir(filename) {
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function formatContextForDisplay({ conversations, docs, toolResults, budget }) {
  return {
    conversations: conversations || [],
    docs: docs || '',
    toolResults: toolResults || null,
    budget: budget || {},
    summary: {
      conversationCount: conversations?.length || 0,
      docsLength: docs?.length || 0,
      hasToolResults: !!toolResults,
      hasBudget: !!budget && Object.keys(budget).length > 0
    }
  };
}

module.exports = {
  ensureUploadDir,
  parseJsonl,
  parseYaml,
  parseJson,
  validateFile,
  processUploadedFiles,
  saveToUploadDir,
  readFromUploadDir,
  formatContextForDisplay,
  UPLOAD_DIR
};
