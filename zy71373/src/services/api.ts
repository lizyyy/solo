import { mockFonts, mockLicenses, mockClients, mockChannels, mockProjects, mockReports, mockRegressionCases, mockTodos } from './mockData';
import type {
  FontFile, License, Client, Channel, Project, AuditReport,
  RegressionCase, TodoItem, AuditStep, AuditRisk, RiskLevel
} from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fontApi = {
  async getFonts(): Promise<FontFile[]> {
    await delay(300);
    return [...mockFonts];
  },

  async addFont(font: Omit<FontFile, 'id' | 'uploadDate'>): Promise<FontFile> {
    await delay(300);
    const newFont: FontFile = {
      ...font,
      id: `font-${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0]
    };
    mockFonts.push(newFont);
    return newFont;
  },

  async updateFontStatus(id: string, status: 'confirmed' | 'temp_note'): Promise<FontFile> {
    await delay(200);
    const font = mockFonts.find(f => f.id === id);
    if (font) {
      font.status = status;
    }
    return font!;
  },

  async recognizeFonts(fileName: string): Promise<{ fontCandidates: FontFile[], confidence: number }> {
    await delay(1500);
    
    const detectedFonts: FontFile[] = [];
    
    if (fileName.includes('恒瑞') || fileName.includes('地产')) {
      detectedFonts.push(mockFonts[0], mockFonts[1]);
    } else if (fileName.includes('悦动') || fileName.includes('科技')) {
      detectedFonts.push(mockFonts[2], mockFonts[3]);
    } else {
      detectedFonts.push(mockFonts[0], mockFonts[3]);
    }
    
    return {
      fontCandidates: detectedFonts,
      confidence: 0.92 + Math.random() * 0.07
    };
  },

  async matchFontByName(fontName: string): Promise<FontFile | null> {
    await delay(300);
    const lowerName = fontName.toLowerCase();
    const font = mockFonts.find(f => 
      f.name.toLowerCase().includes(lowerName) ||
      f.familyName.toLowerCase().includes(lowerName) ||
      f.aliases.some(a => a.toLowerCase().includes(lowerName))
    );
    return font || null;
  }
};

export const licenseApi = {
  async getLicenses(): Promise<License[]> {
    await delay(300);
    return [...mockLicenses];
  },

  async addLicense(license: Omit<License, 'id'>): Promise<License> {
    await delay(300);
    const newLicense: License = {
      ...license,
      id: `lic-${Date.now()}`
    };
    mockLicenses.push(newLicense);
    return newLicense;
  },

  async updateLicense(license: License): Promise<License> {
    await delay(200);
    const index = mockLicenses.findIndex(l => l.id === license.id);
    if (index !== -1) {
      mockLicenses[index] = license;
    }
    return license;
  },

  async matchLicense(fontId: string, projectId?: string): Promise<{ license?: License, matchStatus: 'matched' | 'not_found' | 'expired' }> {
    await delay(800);
    const license = mockLicenses.find(l => l.fontId === fontId);
    
    if (!license) {
      return { matchStatus: 'not_found' };
    }
    
    const today = new Date();
    const endDate = new Date(license.endDate);
    
    if (endDate < today) {
      return { license, matchStatus: 'expired' };
    }
    
    return { license, matchStatus: 'matched' };
  },

  async validateChannels(licenseId: string, channelIds: string[]): Promise<{ valid: boolean, invalidChannels: string[], reason: string }> {
    await delay(600);
    const license = mockLicenses.find(l => l.id === licenseId);
    const channelMap = new Map(mockChannels.map(c => [c.id, c]));
    
    if (!license) {
      return { valid: false, invalidChannels: channelIds, reason: '未找到授权证书' };
    }
    
    const invalidChannels: string[] = [];
    channelIds.forEach(chId => {
      const channel = channelMap.get(chId);
      if (channel && !license.allowedChannels.includes(channel.type)) {
        invalidChannels.push(chId);
      }
    });
    
    return {
      valid: invalidChannels.length === 0,
      invalidChannels,
      reason: invalidChannels.length > 0 ? '部分渠道不在授权范围内' : '所有渠道均在授权范围内'
    };
  }
};

export const clientApi = {
  async getClients(): Promise<Client[]> {
    await delay(300);
    return [...mockClients];
  },

  async addClient(client: Omit<Client, 'id'>): Promise<Client> {
    await delay(300);
    const newClient: Client = {
      ...client,
      id: `client-${Date.now()}`
    };
    mockClients.push(newClient);
    return newClient;
  }
};

export const channelApi = {
  async getChannels(): Promise<Channel[]> {
    await delay(300);
    return [...mockChannels];
  },

  async addChannel(channel: Omit<Channel, 'id'>): Promise<Channel> {
    await delay(300);
    const newChannel: Channel = {
      ...channel,
      id: `ch-${Date.now()}`
    };
    mockChannels.push(newChannel);
    return newChannel;
  },

  async updateChannelStatus(id: string, status: 'confirmed' | 'temp_note'): Promise<Channel> {
    await delay(200);
    const channel = mockChannels.find(c => c.id === id);
    if (channel) {
      channel.status = status;
    }
    return channel!;
  }
};

export const projectApi = {
  async getProjects(): Promise<Project[]> {
    await delay(300);
    return [...mockProjects];
  },

  async addProject(project: Omit<Project, 'id' | 'createDate' | 'auditStatus'>): Promise<Project> {
    await delay(300);
    const newProject: Project = {
      ...project,
      id: `proj-${Date.now()}`,
      createDate: new Date().toISOString().split('T')[0],
      auditStatus: 'pending'
    };
    mockProjects.push(newProject);
    return newProject;
  },

  async updateProjectAuditStatus(id: string, auditStatus: 'pending' | 'audited' | 'risk_found'): Promise<Project> {
    await delay(200);
    const project = mockProjects.find(p => p.id === id);
    if (project) {
      project.auditStatus = auditStatus;
    }
    return project!;
  }
};

export const reportApi = {
  async getReports(): Promise<AuditReport[]> {
    await delay(300);
    return [...mockReports];
  },

  async getReport(id: string): Promise<AuditReport | null> {
    await delay(200);
    return mockReports.find(r => r.id === id) || null;
  },

  async generateReport(params: {
    projectId?: string;
    steps: AuditStep[];
    risks: AuditRisk[];
    sampleFileName: string;
  }): Promise<AuditReport> {
    await delay(500);
    
    const overallRisk = params.risks.reduce<RiskLevel>((acc, risk) => {
      const order: RiskLevel[] = ['low', 'medium', 'high', 'pending'];
      return order.indexOf(risk.level) > order.indexOf(acc) ? risk.level : acc;
    }, 'low');
    
    let conclusion = '审计完成，未发现重大风险。';
    if (overallRisk === 'high') {
      conclusion = '检测到高风险项，请立即处理相关授权问题。';
    } else if (overallRisk === 'medium') {
      conclusion = '检测到中风险项，请补充相关资料或确认授权状态。';
    }
    
    const project = params.projectId ? mockProjects.find(p => p.id === params.projectId) : undefined;
    
    const newReport: AuditReport = {
      id: `report-${Date.now()}`,
      projectId: params.projectId,
      projectName: project?.name,
      clientName: project?.clientName,
      createDate: new Date().toISOString().split('T')[0],
      auditor: '当前用户',
      steps: params.steps,
      risks: params.risks,
      overallRisk,
      conclusion,
      status: overallRisk === 'pending' ? 'temp_note' : 'confirmed',
      sampleFileName: params.sampleFileName
    };
    
    mockReports.unshift(newReport);
    return newReport;
  },

  async exportReport(id: string, format: 'pdf' | 'excel'): Promise<Blob> {
    await delay(1000);
    const report = mockReports.find(r => r.id === id);
    if (!report) {
      throw new Error('Report not found');
    }
    
    const content = JSON.stringify(report, null, 2);
    const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return new Blob([content], { type: mimeType });
  }
};

export const regressionApi = {
  async getCases(): Promise<RegressionCase[]> {
    await delay(300);
    return [...mockRegressionCases];
  },

  async runCase(caseId: string, modifications?: any): Promise<{ passed: boolean, result: AuditReport, diff: any }> {
    await delay(2000);
    const testCase = mockRegressionCases.find(c => c.id === caseId);
    if (!testCase) {
      throw new Error('Test case not found');
    }
    
    let passed = true;
    let diff: any = {};
    let risks: AuditRisk[] = [];
    
    switch (testCase.type) {
      case 'expired_license': {
        const license = mockLicenses.find(l => l.id === testCase.testData.licenseId);
        const checkDate = new Date(modifications?.checkDate || testCase.testData.checkDate);
        const endDate = new Date(license?.endDate || '');
        
        if (endDate < checkDate) {
          passed = true;
          risks = [{
            id: `risk-${Date.now()}`,
            type: 'expired',
            level: 'high',
            fontName: license?.fontName || '',
            description: `授权已于 ${license?.endDate} 过期`,
            suggestion: '请立即续约或更换字体'
          }];
        } else {
          passed = false;
          diff = { expected: '检测到过期', actual: '未检测到过期' };
        }
        break;
      }
      
      case 'channel_out_of_scope': {
        const allowed = modifications?.allowedChannels || testCase.testData.allowedChannels;
        const project = modifications?.projectChannels || testCase.testData.projectChannels;
        const invalid = project.filter((ch: string) => !allowed.includes(ch));
        
        if (invalid.length > 0) {
          passed = true;
          risks = [{
            id: `risk-${Date.now()}`,
            type: 'channel_out_of_scope',
            level: 'high',
            fontName: 'Helvetica Neue Bold',
            description: `渠道 ${invalid.join(', ')} 不在授权范围内`,
            suggestion: '申请渠道扩展或更换字体'
          }];
        } else {
          passed = false;
          diff = { expected: '检测到渠道超范围', actual: '未检测到超范围' };
        }
        break;
      }
      
      case 'font_renamed': {
        const detectedName = modifications?.detectedFontName || testCase.testData.detectedFontName;
        const aliases = testCase.testData.fontAliases;
        const matched = aliases.some((a: string) => 
          detectedName.includes(a) || a.includes(detectedName)
        );
        
        if (matched) {
          passed = true;
        } else {
          passed = false;
          diff = { expected: '通过别名匹配成功', actual: '未匹配到对应字体' };
        }
        break;
      }
      
      case 'missing_info': {
        const fontStatus = modifications?.fontStatus || testCase.testData.fontStatus;
        const hasLicense = modifications?.hasLicense ?? testCase.testData.hasLicense;
        
        if (fontStatus === 'temp_note' || !hasLicense) {
          passed = true;
          risks = [{
            id: `risk-${Date.now()}`,
            type: 'pending_info',
            level: 'medium',
            fontName: 'Source Han Sans CN Medium',
            description: '缺少授权证书，需要补充资料',
            suggestion: '请上传授权证书进行确认'
          }];
        } else {
          passed = false;
          diff = { expected: '标记为待补资料', actual: '未标记待补资料' };
        }
        break;
      }
    }
    
    testCase.lastRunDate = new Date().toISOString().split('T')[0];
    testCase.lastRunResult = passed ? 'passed' : 'failed';
    
    const result: AuditReport = {
      id: `reg-report-${Date.now()}`,
      createDate: new Date().toISOString().split('T')[0],
      auditor: '回归测试系统',
      steps: [],
      risks,
      overallRisk: risks.length > 0 ? risks[0].level : 'low',
      conclusion: passed ? '回归测试通过' : '回归测试失败',
      status: 'confirmed',
      sampleFileName: `regression-${testCase.name}`
    };
    
    return { passed, result, diff };
  }
};

export const todoApi = {
  async getTodos(): Promise<TodoItem[]> {
    await delay(300);
    return [...mockTodos];
  },

  async addTodo(todo: Omit<TodoItem, 'id' | 'createDate' | 'status'>): Promise<TodoItem> {
    await delay(300);
    const newTodo: TodoItem = {
      ...todo,
      id: `todo-${Date.now()}`,
      createDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    mockTodos.push(newTodo);
    return newTodo;
  },

  async completeTodo(id: string): Promise<TodoItem> {
    await delay(200);
    const todo = mockTodos.find(t => t.id === id);
    if (todo) {
      todo.status = 'completed';
    }
    return todo!;
  }
};

export const riskApi = {
  async analyzeRisks(params: {
    font: FontFile;
    license?: License;
    channels: Channel[];
    project?: Project;
  }): Promise<{ risks: AuditRisk[], overallRisk: RiskLevel }> {
    await delay(800);
    const risks: AuditRisk[] = [];
    
    if (!params.license) {
      risks.push({
        id: `risk-${Date.now()}-1`,
        type: 'missing_license',
        level: 'high',
        fontName: params.font.name,
        description: '未找到该字体的授权证书记录',
        suggestion: '请补充上传授权证书或更换已授权的字体',
        relatedEntityId: params.font.id,
        relatedEntityType: 'font'
      });
    } else {
      const today = new Date();
      const endDate = new Date(params.license.endDate);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 0) {
        risks.push({
          id: `risk-${Date.now()}-2`,
          type: 'expired',
          level: 'high',
          fontName: params.font.name,
          description: `该字体授权已于 ${params.license.endDate} 过期`,
          suggestion: '请立即续约或更换为已获授权的字体',
          relatedEntityId: params.license.id,
          relatedEntityType: 'license'
        });
      } else if (daysUntilExpiry <= 30) {
        risks.push({
          id: `risk-${Date.now()}-3`,
          type: 'expired',
          level: 'medium',
          fontName: params.font.name,
          description: `该字体授权将于 ${daysUntilExpiry} 天后过期（${params.license.endDate}）`,
          suggestion: '请及时与授权方联系续约事宜',
          relatedEntityId: params.license.id,
          relatedEntityType: 'license'
        });
      }
      
      const invalidChannels = params.channels.filter(ch => 
        !params.license!.allowedChannels.includes(ch.type)
      );
      
      if (invalidChannels.length > 0) {
        risks.push({
          id: `risk-${Date.now()}-4`,
          type: 'channel_out_of_scope',
          level: 'high',
          fontName: params.font.name,
          description: `以下渠道不在授权范围内：${invalidChannels.map(c => c.name).join('、')}`,
          suggestion: '申请对应渠道的授权扩展，或在这些渠道使用其他已获授权的字体',
          relatedEntityId: params.license.id,
          relatedEntityType: 'license'
        });
      }
    }
    
    if (params.font.status === 'temp_note') {
      risks.push({
        id: `risk-${Date.now()}-5`,
        type: 'pending_info',
        level: 'medium',
        fontName: params.font.name,
        description: '该字体为临时备注状态，信息尚未确认',
        suggestion: '请确认字体信息并上传授权证书',
        relatedEntityId: params.font.id,
        relatedEntityType: 'font'
      });
    }
    
    const overallRisk = risks.reduce<RiskLevel>((acc, risk) => {
      const order: RiskLevel[] = ['low', 'medium', 'high', 'pending'];
      return order.indexOf(risk.level) > order.indexOf(acc) ? risk.level : acc;
    }, risks.length === 0 ? 'low' : 'pending');
    
    return { risks, overallRisk };
  },

  async getRiskStatistics(): Promise<{
    total: number;
    high: number;
    medium: number;
    low: number;
    pending: number;
    byType: Record<string, number>;
    trend: { date: string; count: number }[];
  }> {
    await delay(300);
    
    const allRisks = mockReports.flatMap(r => r.risks);
    
    const byType: Record<string, number> = {};
    allRisks.forEach(r => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });
    
    return {
      total: allRisks.length,
      high: allRisks.filter(r => r.level === 'high').length,
      medium: allRisks.filter(r => r.level === 'medium').length,
      low: allRisks.filter(r => r.level === 'low').length,
      pending: allRisks.filter(r => r.level === 'pending').length,
      byType,
      trend: [
        { date: '2025-01', count: 3 },
        { date: '2025-02', count: 5 },
        { date: '2025-03', count: 8 },
        { date: '2025-04', count: 6 },
        { date: '2025-05', count: 4 }
      ]
    };
  }
};
