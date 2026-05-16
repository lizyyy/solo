const fs = require('fs');
const path = require('path');

class ProtoParser {
  constructor() {
    this.messages = new Map();
    this.enums = new Map();
    this.services = new Map();
    this.sourceLocations = new Map();
  }

  parse(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Proto 文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);

    let currentPackage = '';
    let currentMessage = null;
    let currentEnum = null;
    let currentService = null;
    
    const messageStack = [];
    let braceDepth = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const trimmed = line.trim();

      if (trimmed.startsWith('package ')) {
        const match = trimmed.match(/package\s+([\w.]+)\s*;/);
        if (match) {
          currentPackage = match[1];
        }
        continue;
      }

      if (trimmed.startsWith('message ')) {
        const match = trimmed.match(/message\s+(\w+)/);
        if (match) {
          const messageName = match[1];
          const fullName = this.buildFullName(currentPackage, messageStack.map(m => m.name), messageName);
          
          const msg = {
            name: messageName,
            fullName: fullName,
            package: currentPackage,
            fileName: fileName,
            startLine: lineNum + 1,
            startBraceDepth: braceDepth + 1,
            fields: new Map(),
            nestedMessages: new Map(),
            enums: new Map()
          };
          
          this.messages.set(fullName, msg);
          this.sourceLocations.set(fullName, {
            filePath: filePath,
            fileName: fileName,
            line: lineNum + 1
          });
          
          messageStack.push(msg);
          currentMessage = msg;
        }
        continue;
      }

      if (trimmed.startsWith('enum ')) {
        const match = trimmed.match(/enum\s+(\w+)/);
        if (match) {
          const enumName = match[1];
          const fullName = this.buildFullName(currentPackage, messageStack.map(m => m.name), enumName);
          
          currentEnum = {
            name: enumName,
            fullName: fullName,
            package: currentPackage,
            fileName: fileName,
            startLine: lineNum + 1,
            startBraceDepth: braceDepth + 1,
            values: new Map()
          };
          
          this.enums.set(fullName, currentEnum);
          
          if (currentMessage) {
            currentMessage.enums.set(enumName, currentEnum);
          }
        }
        continue;
      }

      if (trimmed.startsWith('service ')) {
        const match = trimmed.match(/service\s+(\w+)/);
        if (match) {
          const serviceName = match[1];
          const fullName = currentPackage ? `${currentPackage}.${serviceName}` : serviceName;
          
          currentService = {
            name: serviceName,
            fullName: fullName,
            package: currentPackage,
            fileName: fileName,
            startLine: lineNum + 1,
            startBraceDepth: braceDepth + 1,
            methods: new Map()
          };
          
          this.services.set(fullName, currentService);
        }
        continue;
      }

      if (trimmed.includes('{')) {
        braceDepth++;
      }

      if (trimmed.includes('}')) {
        braceDepth--;
        
        if (currentEnum && braceDepth === currentEnum.startBraceDepth - 1) {
          currentEnum = null;
        }
        
        if (currentService && braceDepth === currentService.startBraceDepth - 1) {
          currentService = null;
        }
        
        if (messageStack.length > 0) {
          const topMsg = messageStack[messageStack.length - 1];
          if (braceDepth === topMsg.startBraceDepth - 1) {
            messageStack.pop();
            currentMessage = messageStack.length > 0 ? 
              messageStack[messageStack.length - 1] : null;
          }
        }
      }

      if (currentMessage && this.isFieldLine(trimmed)) {
        const field = this.parseField(trimmed, lineNum + 1, filePath, fileName);
        if (field) {
          currentMessage.fields.set(field.number, field);
          const fieldKey = `${currentMessage.fullName}.${field.name}`;
          this.sourceLocations.set(fieldKey, {
            filePath: filePath,
            fileName: fileName,
            line: lineNum + 1
          });
        }
        continue;
      }

      if (currentEnum && this.isEnumValueLine(trimmed)) {
        const enumValue = this.parseEnumValue(trimmed, lineNum + 1);
        if (enumValue) {
          currentEnum.values.set(enumValue.number, enumValue);
        }
        continue;
      }

      if (currentService && this.isRpcLine(trimmed)) {
        const rpc = this.parseRpc(trimmed, lineNum + 1);
        if (rpc) {
          currentService.methods.set(rpc.name, rpc);
        }
        continue;
      }
    }

    return {
      messages: Array.from(this.messages.values()),
      enums: Array.from(this.enums.values()),
      services: Array.from(this.services.values()),
      sourceLocations: Object.fromEntries(this.sourceLocations)
    };
  }

  buildFullName(packageName, nameStack, name) {
    const parts = [];
    if (packageName) parts.push(packageName);
    parts.push(...nameStack);
    parts.push(name);
    return parts.join('.');
  }

  isFieldLine(line) {
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) return false;
    return /^\s*(repeated\s+)?(string|int32|int64|uint32|uint64|bool|float|double|bytes|\w+)\s+\w+\s*=\s*\d+/.test(line);
  }

  parseField(line, lineNum, filePath, fileName) {
    const cleanLine = line.replace(/\s*\/\/.*$/, '').replace(/\s*\[.*\]\s*;?\s*$/, '').trim();
    
    const match = cleanLine.match(/^(repeated\s+)?(\w+)\s+(\w+)\s*=\s*(\d+)\s*;?/);
    if (match) {
      return {
        name: match[3],
        number: parseInt(match[4], 10),
        type: match[2],
        repeated: !!match[1],
        line: lineNum,
        fileName: fileName,
        filePath: filePath
      };
    }
    return null;
  }

  isEnumValueLine(line) {
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) return false;
    return /^\s*\w+\s*=\s*\d+/.test(line);
  }

  parseEnumValue(line, lineNum) {
    const cleanLine = line.replace(/\s*\/\/.*$/, '').trim();
    const match = cleanLine.match(/^(\w+)\s*=\s*(\d+)\s*;?/);
    if (match) {
      return {
        name: match[1],
        number: parseInt(match[2], 10),
        line: lineNum
      };
    }
    return null;
  }

  isRpcLine(line) {
    return /^\s*rpc\s+\w+\s*\(/.test(line);
  }

  parseRpc(line, lineNum) {
    const match = line.match(/rpc\s+(\w+)\s*\(\s*(\w+)\s*\)\s*returns\s*\(\s*(\w+)\s*\)/);
    if (match) {
      return {
        name: match[1],
        input: match[2],
        output: match[3],
        line: lineNum
      };
    }
    return null;
  }
}

module.exports = ProtoParser;
