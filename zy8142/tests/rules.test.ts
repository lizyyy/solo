import { RulesEngine } from '../src/rules';
import {
  RouteConfig,
  ScreenConfig,
  EventEntry,
  GrayRule
} from '../src/types';

describe('RulesEngine', () => {
  let rulesEngine: RulesEngine;

  beforeEach(() => {
    rulesEngine = new RulesEngine();
    rulesEngine.resetCounter();
  });

  describe('checkUrlParameters', () => {
    it('应该检测到缺少必填参数', () => {
      const route: RouteConfig = {
        path: '/product/detail',
        scheme: 'myapp',
        targetScreen: 'product_detail_screen',
        requiredParams: ['productId'],
        optionalParams: ['source'],
        requiresLogin: false,
        isDeprecated: false
      };

      const queryParams: Record<string, string> = {};
      const issues = rulesEngine.checkUrlParameters(route, queryParams);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('parameter_missing');
      expect(issues[0].severity).toBe('high');
      expect(issues[0].message).toContain('缺少必填参数');
    });

    it('应该通过有完整必填参数的检查', () => {
      const route: RouteConfig = {
        path: '/product/detail',
        scheme: 'myapp',
        targetScreen: 'product_detail_screen',
        requiredParams: ['productId'],
        optionalParams: ['source'],
        requiresLogin: false,
        isDeprecated: false
      };

      const queryParams: Record<string, string> = {
        productId: '123',
        source: 'push'
      };
      const issues = rulesEngine.checkUrlParameters(route, queryParams);

      expect(issues.length).toBe(0);
    });

    it('应该检测到可选参数为空', () => {
      const route: RouteConfig = {
        path: '/activity',
        scheme: 'myapp',
        targetScreen: 'activity_screen',
        requiredParams: [],
        optionalParams: ['activityId'],
        requiresLogin: false,
        isDeprecated: false
      };

      const queryParams: Record<string, string> = {
        activityId: ''
      };
      const issues = rulesEngine.checkUrlParameters(route, queryParams);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('parameter_missing');
      expect(issues[0].severity).toBe('low');
    });
  });

  describe('checkLoginRequirement', () => {
    it('应该检测到需要登录但未登录的情况', () => {
      const route: RouteConfig = {
        path: '/profile',
        scheme: 'myapp',
        targetScreen: 'profile_screen',
        requiredParams: [],
        requiresLogin: true,
        isDeprecated: false
      };

      const issues = rulesEngine.checkLoginRequirement(route, false);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('login_required');
      expect(issues[0].severity).toBe('critical');
    });

    it('应该通过已登录的检查', () => {
      const route: RouteConfig = {
        path: '/profile',
        scheme: 'myapp',
        targetScreen: 'profile_screen',
        requiredParams: [],
        requiresLogin: true,
        isDeprecated: false
      };

      const issues = rulesEngine.checkLoginRequirement(route, true);

      expect(issues.length).toBe(0);
    });

    it('应该通过不需要登录的检查', () => {
      const route: RouteConfig = {
        path: '/home',
        scheme: 'myapp',
        targetScreen: 'home_screen',
        requiredParams: [],
        requiresLogin: false,
        isDeprecated: false
      };

      const issues = rulesEngine.checkLoginRequirement(route, false);

      expect(issues.length).toBe(0);
    });
  });

  describe('checkDeprecatedRoute', () => {
    it('应该检测到已废弃的路由', () => {
      const route: RouteConfig = {
        path: '/old/product',
        scheme: 'myapp',
        targetScreen: 'product_detail_screen',
        requiredParams: ['id'],
        requiresLogin: false,
        isDeprecated: true,
        redirectTo: '/product/detail'
      };

      const allRoutes: RouteConfig[] = [
        route,
        {
          path: '/product/detail',
          scheme: 'myapp',
          targetScreen: 'product_detail_screen',
          requiredParams: ['productId'],
          requiresLogin: false,
          isDeprecated: false
        }
      ];

      const issues = rulesEngine.checkDeprecatedRoute(route, allRoutes);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('deprecated_route');
      expect(issues[0].severity).toBe('high');
      expect(issues[0].details).toContain('/product/detail');
    });

    it('应该通过未废弃路由的检查', () => {
      const route: RouteConfig = {
        path: '/product/detail',
        scheme: 'myapp',
        targetScreen: 'product_detail_screen',
        requiredParams: ['productId'],
        requiresLogin: false,
        isDeprecated: false
      };

      const issues = rulesEngine.checkDeprecatedRoute(route, [route]);

      expect(issues.length).toBe(0);
    });

    it('应该检测到旧短链格式', () => {
      const route: RouteConfig = {
        path: '/s/p123',
        scheme: 'myapp',
        targetScreen: 'product_detail_screen',
        requiredParams: [],
        requiresLogin: false,
        isDeprecated: false
      };

      const issues = rulesEngine.checkDeprecatedRoute(route, [route]);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('old_shortlink');
      expect(issues[0].severity).toBe('medium');
    });
  });

  describe('checkMissingEvents', () => {
    it('应该检测到缺少的埋点事件', () => {
      const route: RouteConfig = {
        path: '/home',
        scheme: 'myapp',
        targetScreen: 'home_screen',
        requiredParams: [],
        requiresLogin: false,
        isDeprecated: false
      };

      const screen: ScreenConfig = {
        id: 'home_screen',
        name: '首页',
        requiredEvents: ['page_view_home', 'home_impression'],
        deprecated: false
      };

      const events: EventEntry[] = [
        {
          eventName: 'page_view_home',
          screenId: 'home_screen',
          routePath: '/home',
          timestamp: '2026-05-03T10:00:00Z'
        }
        // 缺少 home_impression 事件
      ];

      const issues = rulesEngine.checkMissingEvents(route, screen, events);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('missing_event');
      expect(issues[0].severity).toBe('high');
      expect(issues[0].message).toContain('home_impression');
    });

    it('应该通过有完整埋点的检查', () => {
      const route: RouteConfig = {
        path: '/home',
        scheme: 'myapp',
        targetScreen: 'home_screen',
        requiredParams: [],
        requiresLogin: false,
        isDeprecated: false
      };

      const screen: ScreenConfig = {
        id: 'home_screen',
        name: '首页',
        requiredEvents: ['page_view_home', 'home_impression'],
        deprecated: false
      };

      const events: EventEntry[] = [
        {
          eventName: 'page_view_home',
          screenId: 'home_screen',
          routePath: '/home',
          timestamp: '2026-05-03T10:00:00Z'
        },
        {
          eventName: 'home_impression',
          screenId: 'home_screen',
          routePath: '/home',
          timestamp: '2026-05-03T10:00:01Z'
        }
      ];

      const issues = rulesEngine.checkMissingEvents(route, screen, events);

      expect(issues.length).toBe(0);
    });

    it('应该检测到未定义的屏幕', () => {
      const route: RouteConfig = {
        path: '/unknown',
        scheme: 'myapp',
        targetScreen: 'unknown_screen',
        requiredParams: [],
        requiresLogin: false,
        isDeprecated: false
      };

      const issues = rulesEngine.checkMissingEvents(route, undefined, []);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('missing_event');
      expect(issues[0].message).toContain('未在 screens.json 中定义');
    });
  });

  describe('checkGrayPolicy', () => {
    it('应该检测到用户分群不匹配', () => {
      const route: RouteConfig = {
        path: '/order/detail',
        scheme: 'myapp',
        targetScreen: 'order_detail_screen',
        requiredParams: ['orderId'],
        requiresLogin: true,
        isDeprecated: false
      };

      const rules: GrayRule[] = [
        {
          id: 'rule_001',
          name: 'VIP 用户专属',
          type: 'user_segment',
          value: ['vip', 'svip'],
          routes: ['/order/detail']
        }
      ];

      const userContext = {
        segment: 'regular' // 不是 VIP
      };

      const issues = rulesEngine.checkGrayPolicy(route, rules, 'allow', userContext);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('gray_policy_mismatch');
      expect(issues[0].severity).toBe('medium');
    });

    it('应该通过用户分群匹配的检查', () => {
      const route: RouteConfig = {
        path: '/order/detail',
        scheme: 'myapp',
        targetScreen: 'order_detail_screen',
        requiredParams: ['orderId'],
        requiresLogin: true,
        isDeprecated: false
      };

      const rules: GrayRule[] = [
        {
          id: 'rule_001',
          name: 'VIP 用户专属',
          type: 'user_segment',
          value: ['vip', 'svip'],
          routes: ['/order/detail']
        }
      ];

      const userContext = {
        segment: 'vip' // 是 VIP
      };

      const issues = rulesEngine.checkGrayPolicy(route, rules, 'allow', userContext);

      expect(issues.length).toBe(0);
    });

    it('应该检测到版本不匹配', () => {
      const route: RouteConfig = {
        path: '/order/detail',
        scheme: 'myapp',
        targetScreen: 'order_detail_screen',
        requiredParams: ['orderId'],
        requiresLogin: true,
        isDeprecated: false
      };

      const rules: GrayRule[] = [
        {
          id: 'rule_002',
          name: '2.0 版本以上',
          type: 'version',
          value: ['2.0.0', '2.1.0'],
          routes: ['/order/detail']
        }
      ];

      const userContext = {
        version: '1.9.0' // 低于 2.0.0
      };

      const issues = rulesEngine.checkGrayPolicy(route, rules, 'allow', userContext);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('gray_policy_mismatch');
    });

    it('应该通过版本匹配的检查', () => {
      const route: RouteConfig = {
        path: '/order/detail',
        scheme: 'myapp',
        targetScreen: 'order_detail_screen',
        requiredParams: ['orderId'],
        requiresLogin: true,
        isDeprecated: false
      };

      const rules: GrayRule[] = [
        {
          id: 'rule_002',
          name: '2.0 版本以上',
          type: 'version',
          value: ['2.0.0', '2.1.0'],
          routes: ['/order/detail']
        }
      ];

      const userContext = {
        version: '2.0.0'
      };

      const issues = rulesEngine.checkGrayPolicy(route, rules, 'allow', userContext);

      expect(issues.length).toBe(0);
    });

    it('应该检测到 defaultPolicy 为 deny 且无规则的路由', () => {
      const route: RouteConfig = {
        path: '/unlisted',
        scheme: 'myapp',
        targetScreen: 'unlisted_screen',
        requiredParams: [],
        requiresLogin: false,
        isDeprecated: false
      };

      const rules: GrayRule[] = []; // 没有适用的规则

      const issues = rulesEngine.checkGrayPolicy(route, rules, 'deny');

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('gray_policy_mismatch');
      expect(issues[0].severity).toBe('critical');
    });
  });

  describe('runAllChecks', () => {
    it('应该运行所有检查并返回综合结果', () => {
      const routes: RouteConfig[] = [
        {
          path: '/home',
          scheme: 'myapp',
          targetScreen: 'home_screen',
          requiredParams: [],
          requiresLogin: false,
          isDeprecated: false
        },
        {
          path: '/product/detail',
          scheme: 'myapp',
          targetScreen: 'product_detail_screen',
          requiredParams: ['productId'], // 缺少这个参数
          requiresLogin: false,
          isDeprecated: false
        },
        {
          path: '/profile',
          scheme: 'myapp',
          targetScreen: 'profile_screen',
          requiredParams: [],
          requiresLogin: true, // 需要登录
          isDeprecated: false
        }
      ];

      const screens: ScreenConfig[] = [
        {
          id: 'home_screen',
          name: '首页',
          requiredEvents: ['page_view_home'],
          deprecated: false
        },
        {
          id: 'product_detail_screen',
          name: '商品详情页',
          requiredEvents: ['page_view_product'],
          deprecated: false
        },
        {
          id: 'profile_screen',
          name: '个人中心',
          requiredEvents: ['page_view_profile'],
          deprecated: false
        }
      ];

      const events: EventEntry[] = [
        {
          eventName: 'page_view_home',
          screenId: 'home_screen',
          routePath: '/home',
          timestamp: '2026-05-03T10:00:00Z'
        }
      ];

      const rules: GrayRule[] = [];
      const userContext = {
        isLoggedIn: false // 未登录
      };

      const result = rulesEngine.runAllChecks(
        routes,
        screens,
        events,
        rules,
        'allow',
        undefined,
        userContext
      );

      // 应该检测到多个问题
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.routeAnalysis.length).toBe(routes.length);

      // 检查是否有参数缺失问题
      const paramIssues = result.issues.filter(i => i.type === 'parameter_missing');
      expect(paramIssues.length).toBeGreaterThan(0);

      // 检查是否有登录态问题
      const loginIssues = result.issues.filter(i => i.type === 'login_required');
      expect(loginIssues.length).toBeGreaterThan(0);
    });
  });
});
