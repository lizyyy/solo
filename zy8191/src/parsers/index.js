import { CSVParser } from './csvParser.js'
import { JSONParser } from './jsonParser.js'
import { YAMLParser } from './yamlParser.js'

export class DataParser {
  static async parseCSV(content) {
    return CSVParser.parse(content)
  }

  static async parseJSON(content) {
    return JSONParser.parse(content)
  }

  static async parseYAML(content) {
    return YAMLParser.parse(content)
  }

  static async parseFile(file) {
    const extension = file.name.split('.').pop().toLowerCase()
    const content = await this.readFile(file)

    switch (extension) {
      case 'csv':
        return this.parseCSV(content)
      case 'json':
        return this.parseJSON(content)
      case 'yaml':
      case 'yml':
        return this.parseYAML(content)
      default:
        throw new Error(`不支持的文件格式: .${extension}`)
    }
  }

  static readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(new Error('文件读取失败'))
      reader.readAsText(file)
    })
  }

  static validateAll(contexts, finds, rules) {
    const allErrors = []
    const allWarnings = []

    if (contexts && contexts.length > 0) {
      const ctxValidation = CSVParser.validateContexts(contexts)
      allErrors.push(...ctxValidation.errors)
      allWarnings.push(...ctxValidation.warnings)
    }

    if (finds && finds.length > 0) {
      const findsValidation = JSONParser.validateFinds(finds)
      allErrors.push(...findsValidation.errors)
      allWarnings.push(...findsValidation.warnings)
    }

    if (rules) {
      const rulesValidation = YAMLParser.validateRules(rules)
      allErrors.push(...rulesValidation.errors)
      allWarnings.push(...rulesValidation.warnings)
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    }
  }
}

export { CSVParser, JSONParser, YAMLParser }
export default DataParser
