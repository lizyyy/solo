const fs = require('fs');
const path = require('path');

class ConfigLoader {
  constructor(options = {}) {
    this.inputDir = options.inputDir || process.cwd();
    this.sensitivePatterns = options.sensitivePatterns || [];
    this.defaultValues = options.defaultValues || {};
  }

  loadConfig(filename) {
    const filePath = path.resolve(this.inputDir, filename);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content);
      return {
        success: true,
        filename,
        filePath,
        config,
        rawContent: content
      };
    } catch (error) {
      return {
        success: false,
        filename,
        filePath,
        error: {
          message: error.message,
          type: error.name,
          line: this.extractErrorLine(error)
        }
      };
    }
  }

  extractErrorLine(error) {
    const match = error.message.match(/at position (\d+)/);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  loadEnvConfigs(envFiles) {
    const results = {};
    const errors = [];

    for (const { env, filename } of envFiles) {
      const result = this.loadConfig(filename);
      if (result.success) {
        results[env] = result.config;
      } else {
        errors.push(result);
      }
    }

    return { configs: results, errors };
  }

  findJsonFiles() {
    const files = fs.readdirSync(this.inputDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const env = path.basename(f, '.json');
        return { env, filename: f };
      });
    return files;
  }
}

module.exports = ConfigLoader;