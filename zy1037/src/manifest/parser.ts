import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { Manifest, AudioRole } from '../types';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

export interface ManifestLoadOptions {
  baseDir?: string;
  validateRequired?: boolean;
}

const VALID_ROLES: AudioRole[] = ['intro', 'main', 'ad', 'outro'];

export function validateManifest(data: unknown, filePath?: string): ParseResult<Manifest> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof data !== 'object' || data === null) {
    errors.push('Manifest 必须是一个对象');
    return { success: false, errors, warnings };
  }

  const obj = data as Record<string, unknown>;

  if (!obj.version) {
    warnings.push('Manifest 缺少 version 字段，建议添加以便未来兼容性');
  }

  if (!obj.project || typeof obj.project !== 'object') {
    errors.push('缺少必填字段: project');
  } else {
    const project = obj.project as Record<string, unknown>;
    if (!project.name) {
      errors.push('缺少必填字段: project.name');
    }
    if (!project.episode) {
      errors.push('缺少必填字段: project.episode');
    }
  }

  if (!obj.settings || typeof obj.settings !== 'object') {
    errors.push('缺少必填字段: settings');
  } else {
    const settings = obj.settings as Record<string, unknown>;
    
    if (typeof settings.targetLoudness !== 'number') {
      errors.push('缺少必填字段或类型错误: settings.targetLoudness (应为数字)');
    } else if (settings.targetLoudness > -8 || settings.targetLoudness < -24) {
      warnings.push(`目标响度 ${settings.targetLoudness} LUFS 不在常见播客范围 -16 ~ -14 LUFS 内`);
    }

    if (typeof settings.loudnessTolerance !== 'number') {
      errors.push('缺少必填字段或类型错误: settings.loudnessTolerance (应为数字)');
    }

    if (typeof settings.maxSilenceAtStart !== 'number') {
      errors.push('缺少必填字段或类型错误: settings.maxSilenceAtStart (应为数字)');
    }

    if (typeof settings.maxSilenceAtEnd !== 'number') {
      errors.push('缺少必填字段或类型错误: settings.maxSilenceAtEnd (应为数字)');
    }

    if (settings.sampleRate !== undefined && typeof settings.sampleRate !== 'number') {
      errors.push('settings.sampleRate 必须是数字');
    }

    if (settings.channels !== undefined && typeof settings.channels !== 'number') {
      errors.push('settings.channels 必须是数字');
    }
  }

  if (!obj.export || typeof obj.export !== 'object') {
    errors.push('缺少必填字段: export');
  } else {
    const exp = obj.export as Record<string, unknown>;
    if (!exp.directory) {
      errors.push('缺少必填字段: export.directory');
    }
  }

  if (!obj.audioFiles || !Array.isArray(obj.audioFiles)) {
    errors.push('缺少必填字段或类型错误: audioFiles (应为数组)');
  } else {
    const audioFiles = obj.audioFiles as unknown[];
    if (audioFiles.length === 0) {
      warnings.push('audioFiles 数组为空，没有音频文件需要检查');
    }

    audioFiles.forEach((file, index) => {
      if (typeof file !== 'object' || file === null) {
        errors.push(`audioFiles[${index}] 不是有效的对象`);
        return;
      }

      const audioFile = file as Record<string, unknown>;
      
      if (!audioFile.id) {
        errors.push(`audioFiles[${index}] 缺少必填字段: id`);
      }
      
      if (!audioFile.path) {
        errors.push(`audioFiles[${index}] 缺少必填字段: path`);
      }

      if (!audioFile.role) {
        errors.push(`audioFiles[${index}] 缺少必填字段: role`);
      } else if (!VALID_ROLES.includes(audioFile.role as AudioRole)) {
        errors.push(`audioFiles[${index}].role 无效: "${audioFile.role}"，有效值为: ${VALID_ROLES.join(', ')}`);
      }
    });
  }

  if (obj.chapters !== undefined) {
    if (!Array.isArray(obj.chapters)) {
      errors.push('chapters 必须是数组');
    } else {
      const chapters = obj.chapters as unknown[];
      chapters.forEach((chapter, index) => {
        if (typeof chapter !== 'object' || chapter === null) {
          errors.push(`chapters[${index}] 不是有效的对象`);
          return;
        }

        const chap = chapter as Record<string, unknown>;
        
        if (!chap.id) {
          errors.push(`chapters[${index}] 缺少必填字段: id`);
        }
        if (!chap.title) {
          errors.push(`chapters[${index}] 缺少必填字段: title`);
        }
        if (!chap.startTime) {
          errors.push(`chapters[${index}] 缺少必填字段: startTime`);
        }
      });
    }
  }

  if (obj.namingRules !== undefined) {
    if (typeof obj.namingRules !== 'object' || obj.namingRules === null) {
      errors.push('namingRules 必须是对象');
    } else {
      const rules = obj.namingRules as Record<string, unknown>;
      if (!rules.pattern) {
        warnings.push('namingRules 存在但缺少 pattern 字段');
      }
    }
  }

  return {
    success: errors.length === 0,
    data: errors.length === 0 ? data as Manifest : undefined,
    errors,
    warnings,
  };
}

export async function parseManifestFile(
  filePath: string,
  options: ManifestLoadOptions = {}
): Promise<ParseResult<Manifest>> {
  const { baseDir, validateRequired = true } = options;

  try {
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return {
        success: false,
        errors: [`Manifest 文件不存在: ${filePath}`],
        warnings: [],
      };
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let data: unknown;

    try {
      if (ext === '.yaml' || ext === '.yml') {
        data = yaml.parse(content);
      } else {
        data = JSON.parse(content);
      }
    } catch (parseError) {
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      return {
        success: false,
        errors: [`解析 ${ext === '.yaml' || ext === '.yml' ? 'YAML' : 'JSON'} 失败: ${errorMsg}`],
        warnings: [],
      };
    }

    if (validateRequired) {
      const validation = validateManifest(data, filePath);
      if (!validation.success) {
        return validation;
      }
      
      if (baseDir && validation.data) {
        validation.data.audioFiles.forEach((file) => {
          if (!path.isAbsolute(file.path)) {
            file.path = path.resolve(baseDir, file.path);
          }
        });
      }

      return validation;
    }

    return {
      success: true,
      data: data as Manifest,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errors: [`读取 Manifest 文件失败: ${errorMsg}`],
      warnings: [],
    };
  }
}

export function generateSampleManifest(): Manifest {
  return {
    version: '1.0.0',
    project: {
      name: '我的播客',
      episode: 'EP001 - 第一期节目',
      publishDate: '2024-01-15',
    },
    settings: {
      targetLoudness: -16,
      loudnessTolerance: 2,
      maxSilenceAtStart: 0.5,
      maxSilenceAtEnd: 1.0,
      sampleRate: 44100,
      channels: 1,
    },
    namingRules: {
      pattern: '^ep\\d{3}-[a-z0-9-]+\\.wav$',
      description: '文件名格式: epXXX-描述性名称.wav',
      examples: ['ep001-intro.wav', 'ep001-main.wav', 'ep001-outro.wav'],
    },
    export: {
      directory: './output',
    },
    audioFiles: [
      {
        id: 'intro-001',
        path: './audio/intro.wav',
        role: 'intro',
        name: '片头',
      },
      {
        id: 'main-001',
        path: './audio/main.wav',
        role: 'main',
        name: '正片',
      },
      {
        id: 'ad-001',
        path: './audio/ad.wav',
        role: 'ad',
        name: '广告口播',
      },
      {
        id: 'outro-001',
        path: './audio/outro.wav',
        role: 'outro',
        name: '片尾',
      },
    ],
    chapters: [
      {
        id: 'chap-001',
        title: '开场问候',
        startTime: '0:00',
        audioRef: 'intro-001',
      },
      {
        id: 'chap-002',
        title: '本期主题介绍',
        startTime: '0:30',
        audioRef: 'main-001',
      },
      {
        id: 'chap-003',
        title: '广告时间',
        startTime: '15:00',
        audioRef: 'ad-001',
      },
      {
        id: 'chap-004',
        title: '精彩回顾',
        startTime: '30:00',
        audioRef: 'main-001',
      },
      {
        id: 'chap-005',
        title: '片尾致谢',
        startTime: '59:30',
        audioRef: 'outro-001',
      },
    ],
  };
}

export async function writeManifestFile(
  manifest: Manifest,
  filePath: string,
  format: 'json' | 'yaml' = 'yaml'
): Promise<void> {
  let content: string;
  
  if (format === 'yaml') {
    content = yaml.stringify(manifest);
  } else {
    content = JSON.stringify(manifest, null, 2);
  }

  await fs.outputFile(filePath, content, 'utf-8');
}
