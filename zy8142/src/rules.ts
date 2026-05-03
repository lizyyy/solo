import {
  RouteConfig,
  ScreenConfig,
  EventEntry,
  GrayRule,
  Issue,
  RouteAnalysis,
  TestCase
} from './types';
import { Parser } from './parser';

export class RulesEngine {
  private issueIdCounter = 0;

  // 检查 URL scheme 和 path 参数
  checkUrlParameters(
    route: RouteConfig,
    queryParams: Record<string, string>,
    testCase?: TestCase
  ): Issue[] {
    const issues: Issue[] = [];
    
    // 检查必填参数
    if (route.requiredParams && route.requiredParams.length > 0) {
      const missingParams = route.requiredParams.filter(
        param => !queryParams[param] || queryParams[param].trim() === ''
      );
      
      if (missingParams.length > 0) {
        issues.push(this.createIssue(
          'parameter_missing',
          'high',
          route.path,
          route.targetScreen,
          `路由 ${route.path} 缺少必填参数`,
          `缺少参数: ${missingParams.join(', ')}，当前参数: ${JSON.stringify(queryParams)}`,
          `请确保所有必填参数 ${route.requiredParams.join(', ')} 都已提供`
        ));
      }
    }
    
    // 检查可选参数（如果提供了，检查是否符合预期格式）
    if (route.optionalParams && route.optionalParams.length > 0) {
      const providedOptionalParams = Object.keys(queryParams).filter(
        param => route.optionalParams!.includes(param)
      );
      
      // 这里可以添加参数格式验证，比如数字、日期等
      for (const param of providedOptionalParams) {
        const value = queryParams[param];
        // 简单的非空检查
        if (value.trim() === '') {
          issues.push(this.createIssue(
            'parameter_missing',
            'low',
            route.path,
            route.targetScreen,
            `可选参数 ${param} 为空`,
            `参数 ${param} 虽然是可选的，但提供了空值`,
            `如果不需要该参数，请不要包含在 URL 中，或者提供有效值`
          ));
        }
      }
    }
    
    return issues;
  }

  // 检查登录态要求
  checkLoginRequirement(
    route: RouteConfig,
    isLoggedIn: boolean,
    testCase?: TestCase
  ): Issue[] {
    const issues: Issue[] = [];
    
    if (route.requiresLogin && !isLoggedIn) {
      issues.push(this.createIssue(
        'login_required',
        'critical',
        route.path,
        route.targetScreen,
        `路由 ${route.path} 需要登录态`,
        `该路由标记为需要登录，但测试环境中未检测到登录状态`,
        `请确保在访问此路由前用户已登录，或者修改路由配置`
      ));
    }
    
    return issues;
  }

  // 检查废弃页面跳转
  checkDeprecatedRoute(
    route: RouteConfig,
    allRoutes: RouteConfig[],
    testCase?: TestCase
  ): Issue[] {
    const issues: Issue[] = [];
    
    // 检查当前路由是否已废弃
    if (route.isDeprecated) {
      let suggestion = `请停止使用此废弃路由`;
      let details = `该路由已标记为废弃`;
      
      if (route.redirectTo) {
        // 检查重定向目标是否存在
        const targetRoute = allRoutes.find(r => r.path === route.redirectTo);
        if (targetRoute) {
          details += `，应重定向到 ${route.redirectTo} (目标屏幕: ${targetRoute.targetScreen})`;
          suggestion = `请使用新路由 ${route.redirectTo} 替代`;
        } else {
          details += `，但重定向目标 ${route.redirectTo} 不存在`;
          suggestion = `请检查重定向配置`;
        }
      } else {
        details += `，且未配置重定向目标`;
      }
      
      issues.push(this.createIssue(
        'deprecated_route',
        'high',
        route.path,
        route.targetScreen,
        `路由 ${route.path} 已废弃`,
        details,
        suggestion
      ));
    }
    
    // 检查旧短链（边界情况：旧短链仍被投放）
    // 这里假设短链格式可能不同，需要根据实际情况调整
    if (route.path.includes('/short/') || route.path.includes('/s/')) {
      issues.push(this.createIssue(
        'old_shortlink',
        'medium',
        route.path,
        route.targetScreen,
        `检测到可能的旧短链格式`,
        `路由 ${route.path} 使用了短链格式，可能需要检查是否已更新为新格式`,
        `请确认是否需要将短链更新为完整路径，或者检查短链映射是否正确`
      ));
    }
    
    return issues;
  }

  // 检查埋点缺失
  checkMissingEvents(
    route: RouteConfig,
    screen: ScreenConfig | undefined,
    events: EventEntry[],
    testCase?: TestCase
  ): Issue[] {
    const issues: Issue[] = [];
    
    if (!screen) {
      issues.push(this.createIssue(
        'missing_event',
        'medium',
        route.path,
        route.targetScreen,
        `目标屏幕 ${route.targetScreen} 未在 screens.json 中定义`,
        `无法检查埋点要求，因为屏幕配置不存在`,
        `请在 screens.json 中添加屏幕 ${route.targetScreen} 的配置`
      ));
      return issues;
    }
    
    // 检查该路由和屏幕组合的埋点事件
    const relevantEvents = events.filter(
      event => event.routePath === route.path && event.screenId === screen.id
    );
    
    // 检查必填事件
    for (const requiredEvent of screen.requiredEvents) {
      const eventExists = relevantEvents.some(
        event => event.eventName === requiredEvent
      );
      
      if (!eventExists) {
        issues.push(this.createIssue(
          'missing_event',
          'high',
          route.path,
          route.targetScreen,
          `埋点事件缺失: ${requiredEvent}`,
          `屏幕 ${screen.name} (${screen.id}) 要求埋点事件 ${requiredEvent}，但在测试数据中未检测到`,
          `请确保在路由 ${route.path} 跳转到屏幕 ${screen.name} 时触发埋点事件 ${requiredEvent}`
        ));
      }
    }
    
    return issues;
  }

  // 检查灰度人群是否匹配
  checkGrayPolicy(
    route: RouteConfig,
    rules: GrayRule[],
    defaultPolicy: 'allow' | 'deny',
    userContext?: {
      segment?: string;
      version?: string;
      region?: string;
      userId?: string;
    },
    testCase?: TestCase
  ): Issue[] {
    const issues: Issue[] = [];
    
    // 找出适用于当前路由的所有规则
    const applicableRules = rules.filter(
      rule => rule.routes.includes(route.path) || rule.routes.includes('*')
    );
    
    if (applicableRules.length === 0) {
      // 没有适用的规则，使用默认策略
      if (defaultPolicy === 'deny') {
        issues.push(this.createIssue(
          'gray_policy_mismatch',
          'critical',
          route.path,
          route.targetScreen,
          `路由 ${route.path} 未在灰度规则中配置`,
          `默认策略为 deny，且无适用的灰度规则`,
          `请在 policy.yaml 中添加路由 ${route.path} 的灰度规则`
        ));
      }
      return issues;
    }
    
    // 检查每个适用规则
    for (const rule of applicableRules) {
      const isMatch = this.checkRuleMatch(rule, userContext);
      
      if (!isMatch) {
        issues.push(this.createIssue(
          'gray_policy_mismatch',
          'medium',
          route.path,
          route.targetScreen,
          `灰度规则不匹配: ${rule.name}`,
          `规则类型: ${rule.type}，期望值: ${JSON.stringify(rule.value)}，当前用户上下文: ${JSON.stringify(userContext || '无')}`,
          `请检查用户上下文是否符合灰度规则 ${rule.name} 的要求，或者调整规则配置`
        ));
      }
    }
    
    return issues;
  }

  // 检查单个规则是否匹配
  private checkRuleMatch(
    rule: GrayRule,
    userContext?: {
      segment?: string;
      version?: string;
      region?: string;
      userId?: string;
    }
  ): boolean {
    if (!userContext) {
      return false;
    }
    
    switch (rule.type) {
      case 'user_segment':
        // 用户分群匹配
        if (Array.isArray(rule.value)) {
          return rule.value.includes(userContext.segment || '');
        }
        return userContext.segment === rule.value;
        
      case 'version':
        // 版本号匹配（简单的字符串比较，实际可能需要更复杂的版本比较）
        if (Array.isArray(rule.value)) {
          return rule.value.includes(userContext.version || '');
        }
        return userContext.version === rule.value;
        
      case 'percentage':
        // 百分比灰度（基于 userId 哈希）
        if (typeof rule.value === 'number' && userContext.userId) {
          const hash = this.simpleHash(userContext.userId);
          return hash % 100 < rule.value;
        }
        return false;
        
      case 'region':
        // 地区匹配
        if (Array.isArray(rule.value)) {
          return rule.value.includes(userContext.region || '');
        }
        return userContext.region === rule.value;
        
      default:
        return false;
    }
  }

  // 简单的哈希函数，用于百分比灰度
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位有符号整数
    }
    return Math.abs(hash);
  }

  // 运行所有检查
  runAllChecks(
    routes: RouteConfig[],
    screens: ScreenConfig[],
    events: EventEntry[],
    rules: GrayRule[],
    defaultPolicy: 'allow' | 'deny',
    testCases?: TestCase[],
    userContext?: {
      segment?: string;
      version?: string;
      region?: string;
      userId?: string;
      isLoggedIn?: boolean;
    }
  ): {
    issues: Issue[];
    routeAnalysis: RouteAnalysis[];
  } {
    const allIssues: Issue[] = [];
    const routeAnalysis: RouteAnalysis[] = [];
    
    // 遍历所有路由进行检查
    for (const route of routes) {
      const routeIssues: Issue[] = [];
      const checks: { name: string; passed: boolean; message?: string }[] = [];
      
      // 查找目标屏幕
      const targetScreen = screens.find(s => s.id === route.targetScreen);
      
      // 1. 检查 URL 参数（使用测试用例中的参数或默认空参数）
      let queryParams: Record<string, string> = {};
      let isLoggedIn = userContext?.isLoggedIn ?? true;
      let testUserContext = userContext;
      
      // 如果有测试用例，使用测试用例中的数据
      if (testCases && testCases.length > 0) {
        const matchingTestCase = testCases.find(
          tc => {
            const parsed = Parser.parseDeeplink(tc.deeplink);
            return parsed.path === route.path || 
                   (parsed.scheme === route.scheme && parsed.path === route.path);
          }
        );
        
        if (matchingTestCase) {
          const parsed = Parser.parseDeeplink(matchingTestCase.deeplink);
          queryParams = parsed.queryParams;
          isLoggedIn = matchingTestCase.expectLogin;
          
          if (matchingTestCase.testUserSegment || matchingTestCase.testAppVersion) {
            testUserContext = {
              ...userContext,
              segment: matchingTestCase.testUserSegment || userContext?.segment,
              version: matchingTestCase.testAppVersion || userContext?.version
            };
          }
        }
      }
      
      // 执行各项检查
      
      // 检查 URL 参数
      try {
        const paramIssues = this.checkUrlParameters(route, queryParams);
        routeIssues.push(...paramIssues);
        checks.push({
          name: 'URL 参数检查',
          passed: paramIssues.length === 0,
          message: paramIssues.length > 0 ? `发现 ${paramIssues.length} 个参数问题` : '通过'
        });
      } catch (error) {
        checks.push({
          name: 'URL 参数检查',
          passed: false,
          message: `检查失败: ${(error as Error).message}`
        });
      }
      
      // 检查登录态要求
      try {
        const loginIssues = this.checkLoginRequirement(route, isLoggedIn);
        routeIssues.push(...loginIssues);
        checks.push({
          name: '登录态检查',
          passed: loginIssues.length === 0,
          message: loginIssues.length > 0 ? `发现 ${loginIssues.length} 个登录态问题` : '通过'
        });
      } catch (error) {
        checks.push({
          name: '登录态检查',
          passed: false,
          message: `检查失败: ${(error as Error).message}`
        });
      }
      
      // 检查废弃路由
      try {
        const deprecatedIssues = this.checkDeprecatedRoute(route, routes);
        routeIssues.push(...deprecatedIssues);
        checks.push({
          name: '废弃路由检查',
          passed: deprecatedIssues.length === 0,
          message: deprecatedIssues.length > 0 ? `发现 ${deprecatedIssues.length} 个废弃路由问题` : '通过'
        });
      } catch (error) {
        checks.push({
          name: '废弃路由检查',
          passed: false,
          message: `检查失败: ${(error as Error).message}`
        });
      }
      
      // 检查埋点缺失
      try {
        const eventIssues = this.checkMissingEvents(route, targetScreen, events);
        routeIssues.push(...eventIssues);
        checks.push({
          name: '埋点检查',
          passed: eventIssues.length === 0,
          message: eventIssues.length > 0 ? `发现 ${eventIssues.length} 个埋点问题` : '通过'
        });
      } catch (error) {
        checks.push({
          name: '埋点检查',
          passed: false,
          message: `检查失败: ${(error as Error).message}`
        });
      }
      
      // 检查灰度规则
      try {
        const grayIssues = this.checkGrayPolicy(route, rules, defaultPolicy, testUserContext);
        routeIssues.push(...grayIssues);
        checks.push({
          name: '灰度规则检查',
          passed: grayIssues.length === 0,
          message: grayIssues.length > 0 ? `发现 ${grayIssues.length} 个灰度规则问题` : '通过'
        });
      } catch (error) {
        checks.push({
          name: '灰度规则检查',
          passed: false,
          message: `检查失败: ${(error as Error).message}`
        });
      }
      
      // 确定路由的整体状态
      let status: 'pass' | 'warning' | 'error' = 'pass';
      if (routeIssues.some(i => i.severity === 'critical' || i.severity === 'high')) {
        status = 'error';
      } else if (routeIssues.some(i => i.severity === 'medium' || i.severity === 'low')) {
        status = 'warning';
      }
      
      // 添加到路由分析
      routeAnalysis.push({
        path: route.path,
        scheme: route.scheme,
        targetScreen: route.targetScreen,
        status,
        checks
      });
      
      // 添加到所有问题列表
      allIssues.push(...routeIssues);
    }
    
    return {
      issues: allIssues,
      routeAnalysis
    };
  }

  // 创建问题对象
  private createIssue(
    type: Issue['type'],
    severity: Issue['severity'],
    route: string,
    screen: string,
    message: string,
    details: string,
    suggestion: string
  ): Issue {
    return {
      id: `ISSUE-${++this.issueIdCounter}`,
      type,
      severity,
      route,
      screen,
      message,
      details,
      suggestion
    };
  }

  // 重置问题 ID 计数器（用于测试）
  resetCounter(): void {
    this.issueIdCounter = 0;
  }
}
