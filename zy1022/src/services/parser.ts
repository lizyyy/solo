import * as fs from 'fs';
import * as path from 'path';
import { LightingScenario, ValidationResult } from '../models/types.js';
import { ScenarioValidator } from './validator.js';

export interface ParseResult {
  success: boolean;
  scenario?: LightingScenario;
  validation?: ValidationResult;
  error?: string;
}

export class ScenarioParser {
  private validator: ScenarioValidator;

  constructor() {
    this.validator = new ScenarioValidator();
  }

  parseFileSync(filePath: string, validate: boolean = true): ParseResult {
    try {
      const absolutePath = path.resolve(filePath);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      
      const parsed = JSON.parse(fileContent);
      
      if (validate) {
        const validation = this.validator.validate(parsed);
        
        if (!validation.valid) {
          return {
            success: false,
            validation,
            error: `场景验证失败，发现 ${validation.errors.length} 个错误`,
          };
        }
        
        return {
          success: true,
          scenario: parsed as LightingScenario,
          validation,
        };
      }
      
      return {
        success: true,
        scenario: parsed as LightingScenario,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          success: false,
          error: `JSON 解析错误: ${error.message}`,
        };
      }
      if (error instanceof Error) {
        return {
          success: false,
          error: `文件读取错误: ${error.message}`,
        };
      }
      return {
        success: false,
        error: '未知错误',
      };
    }
  }

  async parseFile(filePath: string, validate: boolean = true): Promise<ParseResult> {
    return new Promise((resolve) => {
      const absolutePath = path.resolve(filePath);
      
      fs.readFile(absolutePath, 'utf-8', (readError, fileContent) => {
        if (readError) {
          resolve({
            success: false,
            error: `文件读取错误: ${readError.message}`,
          });
          return;
        }
        
        try {
          const parsed = JSON.parse(fileContent);
          
          if (validate) {
            const validation = this.validator.validate(parsed);
            
            if (!validation.valid) {
              resolve({
                success: false,
                validation,
                error: `场景验证失败，发现 ${validation.errors.length} 个错误`,
              });
              return;
            }
            
            resolve({
              success: true,
              scenario: parsed as LightingScenario,
              validation,
            });
            return;
          }
          
          resolve({
            success: true,
            scenario: parsed as LightingScenario,
          });
        } catch (parseError) {
          if (parseError instanceof SyntaxError) {
            resolve({
              success: false,
              error: `JSON 解析错误: ${parseError.message}`,
            });
          } else if (parseError instanceof Error) {
            resolve({
              success: false,
              error: parseError.message,
            });
          } else {
            resolve({
              success: false,
              error: '未知错误',
            });
          }
        }
      });
    });
  }

  validate(scenario: unknown): ValidationResult {
    return this.validator.validate(scenario);
  }
}
