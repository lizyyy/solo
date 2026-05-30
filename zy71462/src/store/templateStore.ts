import { create } from 'zustand';
import { Template, RebalanceConfig, DEFAULT_CONFIG } from '@/types';

interface TemplateState {
  templates: Template[];
  createTemplate: (name: string, description: string, config: RebalanceConfig) => Template;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, updates: Partial<Template>) => void;
  loadTemplate: (id: string) => RebalanceConfig | null;
  applyTemplate: (id: string, setConfig: (config: RebalanceConfig) => void) => void;
  initDefaultTemplates: () => void;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],

  createTemplate: (name, description, config) => {
    const template: Template = {
      id: `tpl_${Date.now()}`,
      name,
      description,
      config: JSON.parse(JSON.stringify(config)),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state) => ({ templates: [...state.templates, template] }));
    return template;
  },

  deleteTemplate: (id) => set((state) => ({
    templates: state.templates.filter(t => t.id !== id),
  })),

  updateTemplate: (id, updates) => set((state) => ({
    templates: state.templates.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
    ),
  })),

  loadTemplate: (id) => {
    const template = get().templates.find(t => t.id === id);
    return template ? JSON.parse(JSON.stringify(template.config)) : null;
  },

  applyTemplate: (id, setConfig) => {
    const config = get().loadTemplate(id);
    if (config) {
      setConfig(config);
    }
  },

  initDefaultTemplates: () => {
    const existing = get().templates;
    if (existing.length > 0) return;

    const defaultTemplates: Template[] = [
      {
        id: 'tpl_default_min_tax',
        name: '保守型-最小化税费',
        description: '优先考虑税费成本，适合对交易成本敏感的客户',
        config: {
          ...DEFAULT_CONFIG,
          optimizationTarget: 'minimize_tax',
          constraints: {
            ...DEFAULT_CONFIG.constraints,
            maxTurnoverPct: 0.20,
            minTradeValue: 2000,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tpl_default_balance',
        name: '平衡型-税后收益最大化',
        description: '在税费和跟踪误差之间取得平衡',
        config: {
          ...DEFAULT_CONFIG,
          optimizationTarget: 'maximize_after_tax',
          constraints: {
            ...DEFAULT_CONFIG.constraints,
            maxTurnoverPct: 0.30,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tpl_default_aggressive',
        name: '进取型-最小化跟踪误差',
        description: '优先跟踪目标权重，适合追求基准贴合的客户',
        config: {
          ...DEFAULT_CONFIG,
          optimizationTarget: 'minimize_tracking_error',
          constraints: {
            ...DEFAULT_CONFIG.constraints,
            maxTurnoverPct: 0.50,
            allowShortTermSell: true,
            minTradeValue: 500,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    set({ templates: defaultTemplates });
  },
}));
