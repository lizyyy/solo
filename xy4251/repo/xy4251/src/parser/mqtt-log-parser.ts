import * as fs from 'fs';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { MqttMessage, ParsedLog, ParseError } from '../types';

export class MqttLogParser {
  private lineNumber = 0;

  async parseFile(filePath: string): Promise<ParsedLog> {
    const messages: MqttMessage[] = [];
    const errors: ParseError[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    this.lineNumber = 0;

    for await (const line of rl) {
      this.lineNumber++;
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      try {
        const message = this.parseLine(trimmedLine);
        if (message) {
          messages.push(message);
        }
      } catch (error) {
        errors.push({
          lineNumber: this.lineNumber,
          rawLine: trimmedLine,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now()
        });
      }
    }

    messages.sort((a, b) => a.timestamp - b.timestamp);

    return { messages, errors };
  }

  private parseLine(line: string): MqttMessage | null {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(line);
    } catch {
      return this.parseLegacyFormat(line);
    }

    return this.validateAndConvertMessage(parsed);
  }

  private parseLegacyFormat(line: string): MqttMessage | null {
    const parts = line.split(/\s+/);
    if (parts.length < 5) {
      throw new Error(`Invalid format: expected at least 5 fields, got ${parts.length}`);
    }

    const timestamp = this.parseTimestamp(parts[0]);
    const direction = parts[1] as 'in' | 'out';
    const clientId = parts[2];
    const qos = parseInt(parts[3], 10) as 0 | 1 | 2;
    const retain = parts[4] === '1' || parts[4].toLowerCase() === 'true';
    const topicIndex = line.indexOf('"', line.indexOf(parts[4]));
    
    if (topicIndex === -1) {
      throw new Error('Could not find topic in legacy format');
    }

    const topicEndIndex = line.indexOf('"', topicIndex + 1);
    if (topicEndIndex === -1) {
      throw new Error('Unclosed topic quote');
    }

    const topic = line.substring(topicIndex + 1, topicEndIndex);
    const payloadStartIndex = line.indexOf('{', topicEndIndex);
    const payload = payloadStartIndex !== -1 ? line.substring(payloadStartIndex) : '';

    return {
      id: uuidv4(),
      timestamp,
      topic,
      payload,
      qos: qos in [0, 1, 2] ? qos : 0,
      retain,
      dup: false,
      direction,
      clientId
    };
  }

  private validateAndConvertMessage(obj: Record<string, unknown>): MqttMessage {
    const requiredFields = ['timestamp', 'topic', 'payload'];
    const missingFields = requiredFields.filter(field => !(field in obj));
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const timestamp = this.parseTimestamp(obj.timestamp);
    const qos = this.parseQoS(obj.qos);
    const retain = typeof obj.retain === 'boolean' ? obj.retain : 
                   typeof obj.retain === 'string' ? obj.retain.toLowerCase() === 'true' : false;
    const dup = typeof obj.dup === 'boolean' ? obj.dup : false;
    const direction = (obj.direction === 'in' || obj.direction === 'out') ? obj.direction : 'out';
    const clientId = typeof obj.clientId === 'string' ? obj.clientId : 'unknown';

    return {
      id: typeof obj.id === 'string' ? obj.id : uuidv4(),
      timestamp,
      topic: String(obj.topic),
      payload: typeof obj.payload === 'object' ? JSON.stringify(obj.payload) : String(obj.payload),
      qos,
      retain,
      dup,
      direction,
      clientId
    };
  }

  private parseTimestamp(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
      
      const numeric = parseFloat(value);
      if (!isNaN(numeric)) {
        return numeric > 1e12 ? numeric : numeric * 1000;
      }
    }
    
    throw new Error(`Invalid timestamp: ${value}`);
  }

  private parseQoS(value: unknown): 0 | 1 | 2 {
    if (typeof value === 'number') {
      if (value === 0 || value === 1 || value === 2) {
        return value;
      }
    }
    
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (parsed === 0 || parsed === 1 || parsed === 2) {
        return parsed;
      }
    }
    
    return 0;
  }

  validateMessage(message: MqttMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!message.id) {
      errors.push('Message ID is required');
    }

    if (!message.timestamp || message.timestamp <= 0) {
      errors.push('Valid timestamp is required');
    }

    if (!message.topic || message.topic.length === 0) {
      errors.push('Topic is required');
    }

    if (message.topic.includes('#') && !message.topic.endsWith('#')) {
      if (message.topic.indexOf('#') !== message.topic.length - 1) {
        errors.push('Wildcard # must be at the end of topic');
      }
    }

    if (message.qos !== 0 && message.qos !== 1 && message.qos !== 2) {
      errors.push(`Invalid QoS level: ${message.qos}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}