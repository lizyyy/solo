import yaml from 'js-yaml';

export const parseCsv = (content) => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCsvLine(lines[0]);
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    
    const values = parseCsvLine(lines[i]);
    const row = {};
    
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : '';
    });
    
    data.push(row);
  }
  
  return data;
};

const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
};

export const parseJsonl = (content) => {
  const lines = content.split('\n').filter(line => line.trim());
  const data = [];
  
  for (const line of lines) {
    try {
      data.push(JSON.parse(line));
    } catch (e) {
      console.error('Error parsing JSONL line:', e);
    }
  }
  
  return data;
};

export const parseYaml = (content) => {
  try {
    return yaml.load(content);
  } catch (e) {
    console.error('Error parsing YAML:', e);
    throw e;
  }
};
