import * as path from 'path';
import { 
  MaskerConfig, 
  FileConfig, 
  FileProcessingResult, 
  MaskingSummary,
  RiskItem
} from '../types';
import { FileReader, FileReadResult } from '../io/file-reader';
import { FileWriter } from '../io/file-writer';
import { MaskEngine } from '../masking/mask-engine';
import { RiskChecker } from '../risk/risk-checker';
import { Reporter } from '../reporter/reporter';

export interface ProcessingResult {
  summary: MaskingSummary;
  risks: RiskItem[];
  maskEngine: MaskEngine;
}

export class DataProcessor {
  private config: MaskerConfig;
  private configPath: string;

  constructor(config: MaskerConfig, configPath: string) {
    this.config = config;
    this.configPath = configPath;
  }

  validate(): { valid: boolean; errors: string[]; warnings: string[]; risks: RiskItem[] } {
    const risks = RiskChecker.checkAll(this.config);
    
    return {
      valid: risks.filter(r => r.level === 'high').length === 0,
      errors: [],
      warnings: [],
      risks,
    };
  }

  process(): ProcessingResult {
    const maskEngine = new MaskEngine(this.config.salt);
    const fileResults: FileProcessingResult[] = [];
    let totalRecords = 0;
    let totalMaskedFields = 0;

    if (!this.config.dryRun) {
      FileWriter.ensureOutputDir(this.config.outputDir);
    }

    for (const fileConfig of this.config.files) {
      const fileResult = this.processFile(fileConfig, maskEngine);
      fileResults.push(fileResult);
      totalRecords += fileResult.totalRecords;
      
      for (const count of Object.values(fileResult.maskedFields)) {
        totalMaskedFields += count;
      }
    }

    const mappingStats: { [type: string]: number } = {};
    const stats = maskEngine.getMappingStats();
    for (const [type, typeData] of Object.entries(stats)) {
      mappingStats[type] = (typeData as any).totalUnique;
    }

    const summary: MaskingSummary = {
      timestamp: new Date().toISOString(),
      configFile: this.configPath,
      salt: this.config.salt,
      dryRun: this.config.dryRun,
      totalFiles: fileResults.length,
      totalRecords,
      totalMaskedFields,
      files: fileResults,
      mappingStats,
    };

    const risks = RiskChecker.checkAll(this.config);

    return { summary, risks, maskEngine };
  }

  private processFile(
    fileConfig: FileConfig,
    maskEngine: MaskEngine
  ): FileProcessingResult {
    const fileName = path.basename(fileConfig.path);
    const outputPath = FileWriter.generateOutputPath(
      fileConfig.path,
      this.config.outputDir,
      this.config.preserveOriginalFilenames,
      this.config.outputFormat
    );

    const result: FileProcessingResult = {
      filePath: fileConfig.path,
      outputPath,
      totalRecords: 0,
      maskedFields: {},
      errors: [],
      warnings: [],
    };

    try {
      const fileData = FileReader.read(fileConfig);
      result.totalRecords = fileData.totalCount;

      if (fileData.totalCount === 0) {
        result.warnings.push(`文件 ${fileName} 为空，无记录可处理`);
        return result;
      }

      const allIgnoreFields = new Set([
        ...(fileConfig.ignoreFields || []),
        ...(this.config.globalIgnoreFields || []),
      ]);

      const maskedRecords: any[] = [];
      const fieldMaskCounts: { [field: string]: number } = {};

      for (const record of fileData.records) {
        const maskedRecord: any = { ...record };

        for (const [fieldName, fieldConfig] of Object.entries(fileConfig.fields)) {
          if (allIgnoreFields.has(fieldName)) {
            continue;
          }

          const originalValue = record[fieldName];
          if (originalValue === undefined || originalValue === null) {
            continue;
          }

          const maskResult = maskEngine.maskField(
            originalValue,
            fieldConfig.type,
            fileName
          );

          if (maskResult.wasMasked) {
            maskedRecord[fieldName] = maskResult.masked;
            fieldMaskCounts[fieldName] = (fieldMaskCounts[fieldName] || 0) + 1;
          }
        }

        for (const ignoreField of allIgnoreFields) {
          if (maskedRecord[ignoreField] !== undefined) {
            delete maskedRecord[ignoreField];
          }
        }

        maskedRecords.push(maskedRecord);
      }

      result.maskedFields = fieldMaskCounts;

      if (!this.config.dryRun) {
        const outputFormat = this.config.outputFormat || fileConfig.type;
        const outputHeaders = fileData.headers.filter(h => !allIgnoreFields.has(h));
        
        if (outputFormat === 'json') {
          FileWriter.writeJson(outputPath, maskedRecords);
        } else {
          FileWriter.writeCsv(outputPath, maskedRecords, outputHeaders);
        }
      } else {
        result.warnings.push('Dry-run 模式：未实际写入文件');
      }

    } catch (e) {
      result.errors.push(`处理文件时出错: ${(e as Error).message}`);
    }

    return result;
  }

  static generateReports(
    processingResult: ProcessingResult,
    outputDir: string,
    includeMappingDetails: boolean = false
  ): { markdownPath: string; jsonPath: string; mappingPath?: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdownPath = path.join(outputDir, `report_${timestamp}.md`);
    const jsonPath = path.join(outputDir, `report_${timestamp}.json`);

    const markdownReport = Reporter.generateReport(
      processingResult.summary,
      { format: 'markdown', includeMappingDetails },
      processingResult.risks
    );
    FileWriter.ensureOutputDir(outputDir);
    require('fs').writeFileSync(markdownPath, markdownReport, 'utf-8');

    const jsonReport = Reporter.generateReport(
      processingResult.summary,
      { format: 'json', includeMappingDetails },
      processingResult.risks
    );
    require('fs').writeFileSync(jsonPath, jsonReport, 'utf-8');

    let mappingPath: string | undefined;
    if (includeMappingDetails) {
      mappingPath = path.join(outputDir, `mappings_${timestamp}.json`);
      const mappingReport = Reporter.generateMappingReport(
        processingResult.maskEngine.getMappingStats(),
        { format: 'json', includeMappingDetails: true }
      );
      require('fs').writeFileSync(mappingPath, mappingReport, 'utf-8');
    }

    return { markdownPath, jsonPath, mappingPath };
  }
}
