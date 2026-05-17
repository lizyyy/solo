const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class YamlParser {
  constructor() {
    this.errors = [];
  }

  parseFile(filePath) {
    const result = {
      filePath,
      fileName: path.basename(filePath),
      documents: [],
      success: false,
      error: null
    };

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      const documents = yaml.loadAll(content, null, { filename: filePath });
      
      let docIndex = 0;
      for (const doc of documents) {
        if (doc === null || doc === undefined) {
          docIndex++;
          continue;
        }
        
        const parsedDoc = this.parseDocument(doc, filePath, lines, docIndex);
        result.documents.push(parsedDoc);
        docIndex++;
      }
      
      result.success = result.documents.length > 0;
    } catch (error) {
      result.error = {
        message: error.message,
        type: error.name,
        line: error.mark?.line,
        column: error.mark?.column
      };
      this.errors.push({
        filePath,
        type: 'PARSE_ERROR',
        ...result.error
      });
    }

    return result;
  }

  parseDocument(doc, filePath, lines, docIndex) {
    const result = {
      kind: doc.kind || doc.apiVersion,
      apiVersion: doc.apiVersion,
      kind: doc.kind,
      metadata: {
        name: doc.metadata?.name,
        namespace: doc.metadata?.namespace,
        labels: doc.metadata?.labels || {}
      },
      containers: [],
      raw: doc
    };

    try {
      let containers = [];
      
      if (doc.spec?.template?.spec?.containers) {
        containers = doc.spec.template.spec.containers;
      } else if (doc.spec?.containers) {
        containers = doc.spec.containers;
      } else if (doc.kind === 'CronJob' && doc.spec?.jobTemplate?.spec?.template?.spec?.containers) {
        containers = doc.spec.jobTemplate.spec.template.spec.containers;
      }

      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        result.containers.push({
          name: container.name,
          index: i,
          livenessProbe: this.normalizeProbe(container.livenessProbe),
          readinessProbe: this.normalizeProbe(container.readinessProbe),
          startupProbe: this.normalizeProbe(container.startupProbe)
        });
      }
    } catch (error) {
      this.errors.push({
        filePath,
        docIndex,
        type: 'DOCUMENT_PARSE_ERROR',
        message: error.message,
        kind: doc.kind,
        name: doc.metadata?.name
      });
    }

    return result;
  }

  normalizeProbe(probe) {
    if (!probe) return null;

    return {
      initialDelaySeconds: probe.initialDelaySeconds || 0,
      periodSeconds: probe.periodSeconds || 10,
      timeoutSeconds: probe.timeoutSeconds || 1,
      successThreshold: probe.successThreshold || 1,
      failureThreshold: probe.failureThreshold || 3,
      type: this.getProbeType(probe),
      raw: probe
    };
  }

  getProbeType(probe) {
    if (probe.httpGet) return 'HTTP';
    if (probe.tcpSocket) return 'TCP';
    if (probe.exec) return 'EXEC';
    if (probe.grpc) return 'GRPC';
    return 'UNKNOWN';
  }

  parseDirectory(dirPath, recursive = true) {
    const results = [];
    const files = this.findAllYamlFiles(dirPath, recursive);
    
    for (const file of files) {
      const result = this.parseFile(file);
      results.push(result);
    }

    return {
      files: results,
      totalFiles: files.length,
      successfulFiles: results.filter(r => r.success).length,
      errors: this.errors
    };
  }

  findAllYamlFiles(dirPath, recursive = true) {
    const yamlFiles = [];
    
    const findFiles = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory() && recursive) {
          findFiles(fullPath);
        } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
          yamlFiles.push(fullPath);
        }
      }
    };

    findFiles(dirPath);
    return yamlFiles;
  }

  parseInput(inputPath) {
    const stats = fs.statSync(inputPath);
    
    if (stats.isDirectory()) {
      return this.parseDirectory(inputPath);
    } else if (stats.isFile()) {
      const result = this.parseFile(inputPath);
      return {
        files: [result],
        totalFiles: 1,
        successfulFiles: result.success ? 1 : 0,
        errors: this.errors
      };
    }
    
    throw new Error(`Invalid input path: ${inputPath}`);
  }
}

module.exports = YamlParser;
