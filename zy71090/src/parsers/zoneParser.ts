import { readFile } from 'fs/promises';
import { extname, basename } from 'path';
import { ZoneData, DNSRecord } from '../types';
import { validateTTL, validateDomainName, validateRecordType } from '../utils/validator';
import { FileNotFoundError, ParseError } from '../utils/errors';

export async function parseZoneFile(filePath: string): Promise<ZoneData> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new FileNotFoundError(filePath);
    }
    throw new ParseError(`读取文件失败: ${error.message}`);
  }
  const ext = extname(filePath).toLowerCase();
  const zoneName = basename(filePath, ext).replace(/\.zone$/, '');
  
  switch (ext) {
    case '.json':
      return parseJSONFormat(content, zoneName);
    case '.zone':
    case '.txt':
      return parseBINDFormat(content, zoneName);
    default:
      return parseBINDFormat(content, zoneName);
  }
}

function parseJSONFormat(content: string, zoneName: string): ZoneData {
  try {
    const data = JSON.parse(content);
    
    if (data.ResourceRecordSets) {
      return parseAWSFormat(data, zoneName);
    }
    
    if (Array.isArray(data)) {
      const records = data.map(parseJSONRecord).filter(Boolean) as DNSRecord[];
      return { name: zoneName, records };
    }
    
    if (data.records && Array.isArray(data.records)) {
      return {
        name: data.name || zoneName,
        records: data.records.map(parseJSONRecord).filter(Boolean) as DNSRecord[]
      };
    }
    
    throw new ParseError('无法识别的 JSON 格式');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ParseError(`JSON 解析失败: ${error.message}`);
    }
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(String(error));
  }
}

function parseAWSFormat(data: any, zoneName: string): ZoneData {
  const records: DNSRecord[] = [];
  
  for (const rrset of data.ResourceRecordSets) {
    const ttl = rrset.TTL || 300;
    const name = normalizeDomain(rrset.Name);
    
    if (rrset.ResourceRecords) {
      for (const rr of rrset.ResourceRecords) {
        records.push({
          name,
          type: rrset.Type,
          ttl,
          value: normalizeRecordValue(rrset.Type, rr.Value),
          setIdentifier: rrset.SetIdentifier,
          weight: rrset.Weight
        });
      }
    }
    
    if (rrset.AliasTarget) {
      records.push({
        name,
        type: rrset.Type,
        ttl,
        value: normalizeDomain(rrset.AliasTarget.DNSName),
        comment: 'ALIAS record'
      });
    }
  }
  
  return { name: zoneName, records };
}

function parseJSONRecord(item: any): DNSRecord | null {
  if (!item.name || !item.type || !item.value) {
    return null;
  }
  
  return {
    name: item.name,
    type: item.type.toUpperCase(),
    ttl: parseInt(item.ttl, 10) || 300,
    value: item.value,
    comment: item.comment,
    weight: item.weight,
    priority: item.priority,
    setIdentifier: item.setIdentifier
  };
}

function parseBINDFormat(content: string, zoneName: string): ZoneData {
  const lines = content.split('\n');
  const records: DNSRecord[] = [];
  let origin = zoneName;
  let defaultTTL = 3600;
  let currentName = '';
  
  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    
    if (!line || line.startsWith(';')) {
      i++;
      continue;
    }
    
    while (line.endsWith('(')) {
      i++;
      const nextLine = lines[i]?.trim() || '';
      line = line.slice(0, -1) + ' ' + nextLine.replace(')', '');
      if (!nextLine.includes(')')) break;
    }
    
    line = line.replace(/\s+/g, ' ');
    
    if (line.startsWith('$ORIGIN')) {
      origin = line.split(' ')[1].replace(/\.$/, '');
      i++;
      continue;
    }
    
    if (line.startsWith('$TTL')) {
      defaultTTL = parseTTL(line.split(' ')[1]);
      i++;
      continue;
    }
    
    const record = parseBINDRecordLine(line, origin, defaultTTL, currentName);
    if (record) {
      records.push(record);
      currentName = record.name;
    }
    
    i++;
  }
  
  return {
    name: zoneName,
    records,
    origin,
    ttl: defaultTTL
  };
}

function parseBINDRecordLine(line: string, origin: string, defaultTTL: number, currentName: string): DNSRecord | null {
  const parts = line.split(' ');
  if (parts.length < 3) return null;
  
  let name = parts[0];
  let offset = 1;
  
  if (name === '') {
    name = currentName;
  } else if (name === '@') {
    name = origin;
  } else if (!name.endsWith('.') && !name.startsWith('*')) {
    name = name + '.' + origin;
  } else if (name.endsWith('.')) {
    name = name.slice(0, -1);
  }
  
  let ttl = defaultTTL;
  if (/^\d+$/.test(parts[offset])) {
    ttl = parseInt(parts[offset], 10);
    offset++;
  }
  
  let recordClass = 'IN';
  if (['IN', 'CH', 'HS', 'CS'].includes(parts[offset]?.toUpperCase())) {
    recordClass = parts[offset].toUpperCase();
    offset++;
  }
  
  const type = parts[offset]?.toUpperCase();
  offset++;
  
  if (!type || !/^[A-Z]+$/.test(type)) {
    return null;
  }
  
  const value = parts.slice(offset).join(' ');
  if (!value) return null;
  
  return {
    name: normalizeDomain(name),
    type,
    ttl,
    value: normalizeRecordValue(type, value)
  };
}

function normalizeDomain(domain: string): string {
  if (domain.endsWith('.')) {
    return domain.slice(0, -1);
  }
  return domain;
}

function normalizeRecordValue(type: string, value: string): string {
  type = type.toUpperCase();
  
  if (type === 'CNAME' || type === 'NS' || type === 'PTR') {
    return normalizeDomain(value);
  }
  
  if (type === 'SOA') {
    return value;
  }
  
  if (type === 'MX') {
    const parts = value.split(' ');
    if (parts.length >= 2) {
      const priority = parts[0];
      const exchange = normalizeDomain(parts.slice(1).join(' '));
      return `${priority} ${exchange}`;
    }
  }
  
  if (type === 'SRV') {
    const parts = value.split(' ');
    if (parts.length >= 4) {
      const [priority, weight, port, target] = parts;
      return `${priority} ${weight} ${port} ${normalizeDomain(target)}`;
    }
  }
  
  return value;
}

function parseTTL(ttlStr: string): number {
  const match = ttlStr.match(/^(\d+)([smhdw])?$/i);
  if (!match) return 3600;
  
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800
  };
  
  return value * (multipliers[unit] || 1);
}

export function validateZoneRecords(records: DNSRecord[], strict: boolean = false): { errors: string[], warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const record of records) {
    const ttlError = validateTTL(record.ttl);
    if (ttlError) {
      if (ttlError.severity === 'error') {
        errors.push(`[${record.name}] ${ttlError.message}`);
      } else {
        warnings.push(`[${record.name}] ${ttlError.message}`);
      }
    }
    
    const nameError = validateDomainName(record.name);
    if (nameError) {
      if (nameError.severity === 'error') {
        errors.push(`[${record.name}] ${nameError.message}`);
      } else {
        warnings.push(`[${record.name}] ${nameError.message}`);
      }
    }
    
    const typeError = validateRecordType(record.type);
    if (typeError) {
      warnings.push(`[${record.name}] ${typeError.message}`);
    }
  }
  
  return { errors, warnings };
}

export function formatTTL(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
