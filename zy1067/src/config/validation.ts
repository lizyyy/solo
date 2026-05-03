import * as Joi from 'joi';
import * as path from 'path';
import * as fs from 'fs-extra';
import { RoutesConfig, ConfigurationError } from '../types';
import { isUrl, isHtmlFile, resolvePath } from '../utils';

const routeConfigSchema = Joi.object({
  id: Joi.string().required().description('路由唯一标识'),
  name: Joi.string().required().description('路由名称'),
  url: Joi.string().required().description('URL 或 HTML 文件路径'),
  type: Joi.string().valid('html', 'url').description('页面类型'),
  description: Joi.string().description('描述'),
  group: Joi.string().description('分组 ID'),
  keyControls: Joi.array()
    .items(
      Joi.object({
        selector: Joi.string().required().description('CSS 选择器'),
        name: Joi.string().required().description('控件名称'),
        expectedRole: Joi.string().description('期望的 ARIA role'),
        expectedActions: Joi.array()
          .items(Joi.string().valid('tab', 'enter', 'escape', 'click'))
          .description('期望的操作'),
      })
    )
    .description('关键控件列表'),
  disabled: Joi.boolean().description('是否禁用'),
  settings: Joi.object({
    viewport: Joi.object({
      width: Joi.number().integer().min(0).description('视口宽度'),
      height: Joi.number().integer().min(0).description('视口高度'),
    }),
    userAgent: Joi.string().description('用户代理'),
    locale: Joi.string().description('语言区域'),
  }).description('页面特定设置'),
});

const routesConfigSchema = Joi.object({
  version: Joi.string()
    .valid('1.0')
    .required()
    .description('配置文件版本'),
  name: Joi.string().description('配置名称'),
  description: Joi.string().description('描述'),
  defaultSettings: Joi.object({
    viewport: Joi.object({
      width: Joi.number().integer().min(0).description('视口宽度'),
      height: Joi.number().integer().min(0).description('视口高度'),
    }),
    checkers: Joi.array()
      .items(Joi.string())
      .description('默认启用的检查器列表'),
    timeout: Joi.number().integer().min(0).description('超时时间（毫秒）'),
  }),
  groups: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required().description('分组 ID'),
        name: Joi.string().required().description('分组名称'),
        description: Joi.string().description('分组描述'),
      })
    )
    .description('页面分组'),
  routes: Joi.array()
    .items(routeConfigSchema)
    .required()
    .description('路由列表'),
});

export interface ValidationResult {
  valid: boolean;
  config?: RoutesConfig;
  errors: ConfigurationError[];
}

export async function validateConfigFile(
  configPath: string
): Promise<ValidationResult> {
  const errors: ConfigurationError[] = [];

  try {
    const exists = await fs.pathExists(configPath);
    if (!exists) {
      errors.push({
        type: 'config-error',
        message: `配置文件不存在: ${configPath}`,
        field: 'path',
      });
      return { valid: false, errors };
    }

    const content = await fs.readFile(configPath, 'utf-8');
    let config: RoutesConfig;

    try {
      config = JSON.parse(content);
    } catch (parseError) {
      errors.push({
        type: 'config-error',
        message: '配置文件 JSON 解析失败',
        details: (parseError as Error).message,
        field: 'json',
      });
      return { valid: false, errors };
    }

    const { error } = routesConfigSchema.validate(config, {
      abortEarly: false,
      convert: false,
    });

    if (error) {
      for (const detail of error.details) {
        errors.push({
          type: 'validation-error',
          message: detail.message,
          field: detail.path.join('.'),
        });
      }
      return { valid: false, errors };
    }

    for (let i = 0; i < config.routes.length; i++) {
      const route = config.routes[i];

      let routeType = route.type;
      if (!routeType) {
        if (isUrl(route.url)) {
          routeType = 'url';
        } else if (isHtmlFile(route.url)) {
          routeType = 'html';
        }
      }

      if (routeType === 'html' && !isUrl(route.url)) {
        const absolutePath = resolvePath(configPath, route.url);
        const fileExists = await fs.pathExists(absolutePath);
        if (!fileExists) {
          errors.push({
            type: 'validation-error',
            message: `HTML 文件不存在: ${route.url}`,
            routeId: route.id,
            field: `routes[${i}].url`,
          });
        }
      }

      if (route.group && config.groups) {
        const groupExists = config.groups.some((g) => g.id === route.group);
        if (!groupExists) {
          errors.push({
            type: 'validation-error',
            message: `引用的分组不存在: ${route.group}`,
            routeId: route.id,
            field: `routes[${i}].group`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      config,
      errors,
    };
  } catch (err) {
    errors.push({
      type: 'config-error',
      message: '读取配置文件时发生错误',
      details: (err as Error).message,
    });
    return { valid: false, errors };
  }
}

export async function loadConfig(configPath: string): Promise<RoutesConfig> {
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

export function getDefaultRoutesConfig(): RoutesConfig {
  return {
    version: '1.0',
    name: '键盘可访问性巡检配置',
    description: '默认配置，包含示例页面',
    defaultSettings: {
      viewport: {
        width: 1280,
        height: 720,
      },
      checkers: [
        'focus-order',
        'focus-visibility',
        'focus-trap',
        'skip-link',
        'form-label',
        'button-name',
        'modal-trap',
        'modal-return',
      ],
      timeout: 30000,
    },
    groups: [],
    routes: [],
  };
}
