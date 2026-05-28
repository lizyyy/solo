import type { GameEvent, IndexComponent } from '../types';

const eventTemplates = {
  subscription: [
    { title: '大额申购', description: '收到1000万元申购款，需要在本回合内建仓' },
    { title: '机构申购', description: '机构客户申购500万元，请及时配置' },
  ],
  redemption: [
    { title: '大额赎回', description: '客户赎回800万元，需要变现应对' },
    { title: '批量赎回', description: '多个客户合计赎回300万元，请调整持仓' },
  ],
  suspension: [
    { title: '股票临时停牌', description: '某成分股因重大事项停牌，无法交易' },
  ],
  marketMove: [
    { title: '市场大幅波动', description: '市场出现剧烈波动，请关注跟踪误差' },
    { title: '行业轮动', description: '板块轮动明显，部分股票异动' },
  ],
};

export function generateRandomEvent(components: IndexComponent[]): GameEvent {
  const eventTypes: Array<'subscription' | 'redemption' | 'suspension' | 'marketMove'> = 
    ['subscription', 'redemption', 'suspension', 'marketMove'];
  
  const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
  const templates = eventTemplates[type];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  const event: GameEvent = {
    id: Date.now().toString(),
    type,
    title: template.title,
    description: template.description,
    timeLimit: 30,
  };

  switch (type) {
    case 'subscription':
      event.amount = Math.floor(Math.random() * 1000 + 500) * 10000;
      break;
    case 'redemption':
      event.amount = Math.floor(Math.random() * 800 + 200) * 10000;
      break;
    case 'suspension':
      const availableStocks = components.filter(c => !c.isSuspended);
      if (availableStocks.length > 0) {
        event.affectedStock = availableStocks[Math.floor(Math.random() * availableStocks.length)].code;
      }
      break;
    case 'marketMove':
      event.priceChange = (Math.random() - 0.5) * 0.04;
      break;
  }

  return event;
}

export function applyEventImpact(
  event: GameEvent,
  cash: number,
  components: IndexComponent[]
): { newCash: number; updatedComponents: IndexComponent[] } {
  let newCash = cash;
  let updatedComponents = [...components];

  switch (event.type) {
    case 'subscription':
      newCash += event.amount || 0;
      break;
    case 'redemption':
      newCash -= event.amount || 0;
      break;
    case 'suspension':
      if (event.affectedStock) {
        updatedComponents = components.map(c => 
          c.code === event.affectedStock 
            ? { ...c, isSuspended: true, suspendedReason: '重大事项停牌' }
            : c
        );
      }
      break;
    case 'marketMove':
      const change = event.priceChange || 0;
      updatedComponents = components.map(c => ({
        ...c,
        price: c.price * (1 + change + (Math.random() - 0.5) * 0.02)
      }));
      break;
  }

  return { newCash, updatedComponents };
}
