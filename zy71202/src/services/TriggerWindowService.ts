import type { StockQuote, TriggerWindowResult, WindowType } from '@/types';

export class TriggerWindowService {
  calculateTriggerWindow(
    bondCode: string,
    quotes: StockQuote[],
    windowType: WindowType
  ): TriggerWindowResult {
    const windowDays = windowType === '30_15' ? 30 : 20;
    const requiredDays = windowType === '30_15' ? 15 : 10;
    
    const sortedQuotes = [...quotes].sort((a, b) => 
      new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );
    
    const gapDates: string[] = [];
    for (let i = 1; i < sortedQuotes.length; i++) {
      const prev = new Date(sortedQuotes[i - 1].tradeDate);
      const curr = new Date(sortedQuotes[i].tradeDate);
      const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 3) {
        gapDates.push(sortedQuotes[i - 1].tradeDate);
      }
    }
    
    let maxMeetDays = 0;
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let triggerDate: string | null = null;
    
    for (let i = 0; i <= sortedQuotes.length - windowDays; i++) {
      const window = sortedQuotes.slice(i, i + windowDays);
      const meetDays = window.filter(q => q.meetRedemptionCondition).length;
      
      if (meetDays > maxMeetDays) {
        maxMeetDays = meetDays;
      }
      
      for (const q of window) {
        if (q.meetRedemptionCondition) {
          currentConsecutive++;
          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
          }
        } else {
          currentConsecutive = 0;
        }
      }
      
      if (meetDays >= requiredDays && !triggerDate) {
        triggerDate = window[window.length - 1].tradeDate;
      }
    }
    
    const hasGap = gapDates.length > 0;
    
    return {
      bondCode,
      windowStartDate: sortedQuotes[0]?.tradeDate || '',
      windowEndDate: sortedQuotes[sortedQuotes.length - 1]?.tradeDate || '',
      windowType,
      totalDays: windowDays,
      meetDays: maxMeetDays,
      consecutiveDays: maxConsecutive,
      hasGap,
      gapDates,
      isTriggered: !hasGap && maxMeetDays >= requiredDays,
      triggeredAt: hasGap ? null : triggerDate,
      dailyQuotes: sortedQuotes,
    };
  }
  
  calculateBothWindows(
    bondCode: string,
    quotes: StockQuote[]
  ): { window30_15: TriggerWindowResult; window20_10: TriggerWindowResult } {
    return {
      window30_15: this.calculateTriggerWindow(bondCode, quotes, '30_15'),
      window20_10: this.calculateTriggerWindow(bondCode, quotes, '20_10'),
    };
  }
  
  getTriggerStatus(result: TriggerWindowResult): { 
    status: 'NORMAL' | 'WARNING' | 'TRIGGERED' | 'GAP';
    progress: number;
    message: string;
  } {
    if (result.hasGap) {
      return {
        status: 'GAP',
        progress: (result.meetDays / result.totalDays) * 100,
        message: `数据存在${result.gapDates.length}处断档，请补全数据后重新计算`,
      };
    }
    
    const progress = (result.meetDays / result.totalDays) * 100;
    
    if (result.isTriggered) {
      return {
        status: 'TRIGGERED',
        progress: 100,
        message: `已触发强赎条件，${result.windowType === '30_15' ? '30交易日15天' : '20交易日10天'}条件已满足`,
      };
    }
    
    if (result.meetDays >= result.totalDays * 0.7) {
      return {
        status: 'WARNING',
        progress,
        message: `即将触发，当前已满足${result.meetDays}/${result.totalDays}天`,
      };
    }
    
    return {
      status: 'NORMAL',
      progress,
      message: `监控中，当前已满足${result.meetDays}/${result.totalDays}天`,
    };
  }
}

export const triggerWindowService = new TriggerWindowService();
