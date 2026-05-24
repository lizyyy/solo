const fs = require('fs');

class SampleDataParser {
  parse(content, filePath = '') {
    let data;

    try {
      data = JSON.parse(content);
    } catch (e) {
      throw new Error(`样例数据JSON解析失败: ${e.message}`);
    }

    return {
      data,
      filePath,
      locales: this._extractLocales(data)
    };
  }

  _extractLocales(data) {
    const locales = [];
    if (data && typeof data === 'object') {
      const keys = Object.keys(data);
      const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;
      keys.forEach(key => {
        if (localePattern.test(key) && typeof data[key] === 'object') {
          locales.push(key);
        }
      });
    }
    return locales;
  }

  static parseFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new SampleDataParser();
    return parser.parse(content, filePath);
  }
}

module.exports = { SampleDataParser };
