import * as fs from 'fs';
import * as yaml from 'yaml';
import {
  RoutesFile,
  ScreensFile,
  EventEntry,
  PolicyFile,
  RouteConfig,
  ScreenConfig,
  GrayRule
} from './types';

export class Parser {
  // 解析 routes.yaml 文件
  static parseRoutes(filePath: string): RoutesFile {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(fileContent);
      
      // 验证数据结构
      if (!parsed.routes || !Array.isArray(parsed.routes)) {
        throw new Error('routes.yaml 格式错误: 缺少 routes 数组');
      }
      
      if (!parsed.defaultScheme || typeof parsed.defaultScheme !== 'string') {
        throw new Error('routes.yaml 格式错误: 缺少 defaultScheme');
      }
      
      // 验证每个路由配置
      parsed.routes.forEach((route: Partial<RouteConfig>, index: number) => {
        if (!route.path || typeof route.path !== 'string') {
          throw new Error(`routes.yaml 格式错误: 第 ${index + 1} 个路由缺少 path`);
        }
        if (!route.scheme || typeof route.scheme !== 'string') {
          throw new Error(`routes.yaml 格式错误: 第 ${index + 1} 个路由缺少 scheme`);
        }
        if (!route.targetScreen || typeof route.targetScreen !== 'string') {
          throw new Error(`routes.yaml 格式错误: 第 ${index + 1} 个路由缺少 targetScreen`);
        }
        if (route.requiresLogin === undefined || typeof route.requiresLogin !== 'boolean') {
          throw new Error(`routes.yaml 格式错误: 第 ${index + 1} 个路由缺少 requiresLogin`);
        }
      });
      
      return parsed as RoutesFile;
    } catch (error) {
      throw new Error(`解析 routes.yaml 失败: ${(error as Error).message}`);
    }
  }

  // 解析 screens.json 文件
  static parseScreens(filePath: string): ScreensFile {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      
      // 验证数据结构
      if (!parsed.screens || !Array.isArray(parsed.screens)) {
        throw new Error('screens.json 格式错误: 缺少 screens 数组');
      }
      
      // 验证每个屏幕配置
      parsed.screens.forEach((screen: Partial<ScreenConfig>, index: number) => {
        if (!screen.id || typeof screen.id !== 'string') {
          throw new Error(`screens.json 格式错误: 第 ${index + 1} 个屏幕缺少 id`);
        }
        if (!screen.name || typeof screen.name !== 'string') {
          throw new Error(`screens.json 格式错误: 第 ${index + 1} 个屏幕缺少 name`);
        }
        if (!screen.requiredEvents || !Array.isArray(screen.requiredEvents)) {
          throw new Error(`screens.json 格式错误: 第 ${index + 1} 个屏幕缺少 requiredEvents 数组`);
        }
      });
      
      return parsed as ScreensFile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`解析 screens.json 失败: JSON 格式错误 - ${error.message}`);
      }
      throw new Error(`解析 screens.json 失败: ${(error as Error).message}`);
    }
  }

  // 解析 events.jsonl 文件 (JSON Lines 格式)
  static parseEvents(filePath: string): EventEntry[] {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      
      const events: EventEntry[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const parsed = JSON.parse(line) as Partial<EventEntry>;
          
          // 验证必要字段
          if (!parsed.eventName || typeof parsed.eventName !== 'string') {
            console.warn(`警告: 第 ${i + 1} 行缺少 eventName，跳过`);
            continue;
          }
          if (!parsed.screenId || typeof parsed.screenId !== 'string') {
            console.warn(`警告: 第 ${i + 1} 行缺少 screenId，跳过`);
            continue;
          }
          if (!parsed.routePath || typeof parsed.routePath !== 'string') {
            console.warn(`警告: 第 ${i + 1} 行缺少 routePath，跳过`);
            continue;
          }
          if (!parsed.timestamp || typeof parsed.timestamp !== 'string') {
            console.warn(`警告: 第 ${i + 1} 行缺少 timestamp，跳过`);
            continue;
          }
          
          events.push(parsed as EventEntry);
        } catch (parseError) {
          console.warn(`警告: 第 ${i + 1} 行 JSON 格式错误，跳过: ${(parseError as Error).message}`);
        }
      }
      
      return events;
    } catch (error) {
      throw new Error(`解析 events.jsonl 失败: ${(error as Error).message}`);
    }
  }

  // 解析 policy.yaml 文件
  static parsePolicy(filePath: string): PolicyFile {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = yaml.parse(fileContent);
      
      // 验证数据结构
      if (!parsed.rules || !Array.isArray(parsed.rules)) {
        throw new Error('policy.yaml 格式错误: 缺少 rules 数组');
      }
      
      if (!parsed.defaultPolicy || 
          (parsed.defaultPolicy !== 'allow' && parsed.defaultPolicy !== 'deny')) {
        throw new Error('policy.yaml 格式错误: defaultPolicy 必须是 "allow" 或 "deny"');
      }
      
      // 验证每个规则配置
      parsed.rules.forEach((rule: Partial<GrayRule>, index: number) => {
        if (!rule.id || typeof rule.id !== 'string') {
          throw new Error(`policy.yaml 格式错误: 第 ${index + 1} 个规则缺少 id`);
        }
        if (!rule.name || typeof rule.name !== 'string') {
          throw new Error(`policy.yaml 格式错误: 第 ${index + 1} 个规则缺少 name`);
        }
        if (!rule.type || 
            !['user_segment', 'version', 'percentage', 'region'].includes(rule.type)) {
          throw new Error(`policy.yaml 格式错误: 第 ${index + 1} 个规则 type 无效，必须是 user_segment、version、percentage 或 region`);
        }
        if (rule.value === undefined) {
          throw new Error(`policy.yaml 格式错误: 第 ${index + 1} 个规则缺少 value`);
        }
        if (!rule.routes || !Array.isArray(rule.routes)) {
          throw new Error(`policy.yaml 格式错误: 第 ${index + 1} 个规则缺少 routes 数组`);
        }
      });
      
      return parsed as PolicyFile;
    } catch (error) {
      throw new Error(`解析 policy.yaml 失败: ${(error as Error).message}`);
    }
  }

  // 解析 URL scheme 并提取参数
  static parseDeeplink(deeplink: string): {
    scheme: string;
    path: string;
    queryParams: Record<string, string>;
  } {
    // 对于移动 App 的 deep link，手动解析更可靠
    // 因为 new URL() 会把自定义 scheme 的路径第一部分当作 hostname
    
    // 1. 提取 scheme
    const schemeMatch = deeplink.match(/^([^:]+):/);
    const scheme = schemeMatch ? schemeMatch[1] : '';
    
    // 2. 提取路径（处理 :// 和 : 两种格式）
    let pathPart = '';
    const afterScheme = deeplink.substring(scheme.length + 1);
    
    // 处理 :// 格式
    if (afterScheme.startsWith('//')) {
      pathPart = afterScheme.substring(2);
    } else {
      pathPart = afterScheme;
    }
    
    // 3. 分离路径和查询参数
    let path = '';
    const queryParams: Record<string, string> = {};
    
    const queryIndex = pathPart.indexOf('?');
    if (queryIndex !== -1) {
      path = pathPart.substring(0, queryIndex);
      const queryString = pathPart.substring(queryIndex + 1);
      
      // 解析查询参数
      queryString.split('&').forEach(pair => {
        const equalIndex = pair.indexOf('=');
        if (equalIndex !== -1) {
          const key = decodeURIComponent(pair.substring(0, equalIndex));
          const value = decodeURIComponent(pair.substring(equalIndex + 1));
          queryParams[key] = value;
        } else if (pair) {
          queryParams[decodeURIComponent(pair)] = '';
        }
      });
    } else {
      path = pathPart;
    }
    
    // 确保路径以 / 开头
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }
    
    return {
      scheme,
      path,
      queryParams
    };
  }
}
