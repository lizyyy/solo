import * as fs from 'fs';
import * as path from 'path';
import { Parser } from '../src/parser';

// 创建临时测试配置文件
const createTempFile = (filename: string, content: string): string => {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
};

// 清理临时文件
const cleanupTempFiles = (): void => {
  const tempDir = path.join(__dirname, 'temp');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(tempDir, file));
    });
    fs.rmdirSync(tempDir);
  }
};

describe('Parser', () => {
  afterAll(() => {
    cleanupTempFiles();
  });

  describe('parseDeeplink', () => {
    it('应该正确解析标准 URL scheme', () => {
      const deeplink = 'myapp://product/detail?productId=123&source=push';
      const result = Parser.parseDeeplink(deeplink);
      
      expect(result.scheme).toBe('myapp');
      expect(result.path).toBe('/product/detail');
      expect(result.queryParams.productId).toBe('123');
      expect(result.queryParams.source).toBe('push');
    });

    it('应该正确解析没有参数的 URL', () => {
      const deeplink = 'myapp://home';
      const result = Parser.parseDeeplink(deeplink);
      
      expect(result.scheme).toBe('myapp');
      expect(result.path).toBe('/home');
      expect(Object.keys(result.queryParams).length).toBe(0);
    });

    it('应该正确解析只有斜杠的路径', () => {
      const deeplink = 'myapp:///?tab=recommend';
      const result = Parser.parseDeeplink(deeplink);
      
      expect(result.scheme).toBe('myapp');
      expect(result.path).toBe('/');
      expect(result.queryParams.tab).toBe('recommend');
    });
  });

  describe('parseRoutes', () => {
    it('应该正确解析有效的 routes.yaml', () => {
      const yamlContent = `defaultScheme: myapp

routes:
  - path: /home
    scheme: myapp
    targetScreen: home_screen
    requiredParams: []
    optionalParams:
      - tab
    requiresLogin: false
    isDeprecated: false

  - path: /product/detail
    scheme: myapp
    targetScreen: product_detail_screen
    requiredParams:
      - productId
    optionalParams:
      - source
    requiresLogin: false
    isDeprecated: false
`;
      const filePath = createTempFile('valid_routes.yaml', yamlContent);
      const result = Parser.parseRoutes(filePath);
      
      expect(result.defaultScheme).toBe('myapp');
      expect(result.routes.length).toBe(2);
      expect(result.routes[0].path).toBe('/home');
      expect(result.routes[0].targetScreen).toBe('home_screen');
      expect(result.routes[1].requiredParams).toContain('productId');
    });

    it('应该对缺少必填字段的 routes.yaml 抛出错误', () => {
      const yamlContent = `defaultScheme: myapp

routes:
  - path: /home
    targetScreen: home_screen
    requiresLogin: false
`;
      const filePath = createTempFile('invalid_routes.yaml', yamlContent);
      
      expect(() => Parser.parseRoutes(filePath)).toThrow();
    });
  });

  describe('parseScreens', () => {
    it('应该正确解析有效的 screens.json', () => {
      const jsonContent = JSON.stringify({
        screens: [
          {
            id: "home_screen",
            name: "首页",
            requiredEvents: ["page_view_home", "home_impression"],
            deprecated: false,
            minimumAppVersion: "1.0.0"
          }
        ]
      });
      
      const filePath = createTempFile('valid_screens.json', jsonContent);
      const result = Parser.parseScreens(filePath);
      
      expect(result.screens.length).toBe(1);
      expect(result.screens[0].id).toBe('home_screen');
      expect(result.screens[0].requiredEvents.length).toBe(2);
    });

    it('应该对无效的 JSON 抛出错误', () => {
      const invalidJson = `{
        "screens": [
          {
            id: "home_screen",
            name: "首页"
          }
        ]
      }`;
      
      const filePath = createTempFile('invalid_screens.json', invalidJson);
      
      expect(() => Parser.parseScreens(filePath)).toThrow();
    });
  });

  describe('parseEvents', () => {
    it('应该正确解析有效的 events.jsonl', () => {
      const jsonlContent = `{"eventName":"page_view_home","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:00Z","userId":"user_001"}
{"eventName":"home_impression","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:01Z","userId":"user_001"}
`;
      
      const filePath = createTempFile('valid_events.jsonl', jsonlContent);
      const result = Parser.parseEvents(filePath);
      
      expect(result.length).toBe(2);
      expect(result[0].eventName).toBe('page_view_home');
      expect(result[1].eventName).toBe('home_impression');
    });

    it('应该跳过无效的 JSON 行并继续解析', () => {
      const jsonlContent = `{"eventName":"page_view_home","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:00Z"}
这不是有效的 JSON
{"eventName":"home_impression","screenId":"home_screen","routePath":"/home","timestamp":"2026-05-03T10:00:01Z"}
`;
      
      const filePath = createTempFile('mixed_events.jsonl', jsonlContent);
      
      // 应该不会抛出错误，而是跳过无效行
      expect(() => Parser.parseEvents(filePath)).not.toThrow();
      
      const result = Parser.parseEvents(filePath);
      expect(result.length).toBeLessThan(3); // 至少跳过一行
    });
  });

  describe('parsePolicy', () => {
    it('应该正确解析有效的 policy.yaml', () => {
      const yamlContent = `defaultPolicy: allow

rules:
  - id: rule_001
    name: VIP 用户专属
    type: user_segment
    value: ["vip", "svip"]
    routes:
      - /order/detail

  - id: rule_002
    name: 版本限制
    type: version
    value: ["2.0.0"]
    routes:
      - /order/detail
`;
      
      const filePath = createTempFile('valid_policy.yaml', yamlContent);
      const result = Parser.parsePolicy(filePath);
      
      expect(result.defaultPolicy).toBe('allow');
      expect(result.rules.length).toBe(2);
      expect(result.rules[0].type).toBe('user_segment');
      expect(Array.isArray(result.rules[0].value)).toBe(true);
    });

    it('应该对无效的 rule type 抛出错误', () => {
      const yamlContent = `defaultPolicy: allow

rules:
  - id: rule_001
    name: 测试规则
    type: invalid_type
    value: test
    routes:
      - /test
`;
      
      const filePath = createTempFile('invalid_policy.yaml', yamlContent);
      
      expect(() => Parser.parsePolicy(filePath)).toThrow();
    });
  });
});
