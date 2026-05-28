import React, { useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import type { MarketEvent } from '@/types';
import { formatNumber, formatPercent, getPnLColor } from '@/utils/format';

interface MarketCardProps {
  event: MarketEvent;
  round: number;
  totalRounds: number;
  onReveal?: () => void;
  isRevealed?: boolean;
}

export const MarketCard: React.FC<MarketCardProps> = ({
  event,
  round,
  totalRounds,
  onReveal,
  isRevealed = true,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    if (!isRevealed) {
      onReveal?.();
    } else {
      setIsFlipped(!isFlipped);
    }
  };

  const priceColor = event.priceChange >= 0 ? 'text-trader-green' : 'text-trader-red';
  const volColor = event.volatilityChange >= 0 ? 'text-trader-red' : 'text-trader-green';

  return (
    <div
      className={`
        relative w-full h-72 cursor-pointer perspective-1000
        ${!isRevealed ? 'animate-pulse' : ''}
      `}
      onClick={handleClick}
    >
      <div
        className={`
          relative w-full h-full transition-transform duration-700 transform-style-preserve-3d
          ${isFlipped ? 'rotate-y-180' : ''}
        `}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div
          className={`
            absolute inset-0 backface-hidden rounded-xl p-6
            ${event.isShock ? 'burn-edge' : ''}
            bg-gradient-to-br from-bloomberg-panel to-bloomberg-bg
            border-2 ${event.isShock ? 'border-trader-red/50' : 'border-bloomberg-border'}
            shadow-2xl
          `}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute -top-4 left-4 transform -rotate-2">
            <div className={`
              px-4 py-1 rounded-full text-sm font-bold shadow-lg
              ${event.isShock 
                ? 'bg-trader-red text-white animate-pulse' 
                : 'bg-highlight-blue text-white'
              }
            `}>
              第 {round} / {totalRounds} 回合
              {event.isShock && <Zap className="inline ml-1" size={14} />}
            </div>
          </div>

          {event.isShock && (
            <div className="absolute top-2 right-2">
              <div className="sticker bg-trader-red text-white px-3 py-1 rounded font-hand text-lg">
                ⚡ 突变！
              </div>
            </div>
          )}

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between p-4 bg-bloomberg-bg/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className={priceColor} size={20} />
                <span className="text-bloomberg-muted">标的价格</span>
              </div>
              <div className="text-right">
                <div className={`font-mono text-2xl font-bold ${priceColor}`}>
                  ¥{formatNumber(event.underlyingPrice, 2)}
                </div>
                <div className={`font-mono text-sm ${priceColor}`}>
                  {formatPercent(event.priceChange)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-bloomberg-bg/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className={volColor} size={20} />
                <span className="text-bloomberg-muted">波动率 (IV)</span>
              </div>
              <div className="text-right">
                <div className={`font-mono text-2xl font-bold ${volColor}`}>
                  {formatNumber(event.volatility, 1)}%
                </div>
                <div className={`font-mono text-sm ${volColor}`}>
                  {formatPercent(event.volatilityChange)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-bloomberg-bg/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="text-bloomberg-muted" size={20} />
                <span className="text-bloomberg-muted">时间衰减</span>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-bold text-bloomberg-text">
                  +{event.daysPassed} 天
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-sm text-bloomberg-muted">
              {event.description}
            </p>
          </div>

          {event.handwrittenNote && (
            <div className="absolute -bottom-4 right-4 transform rotate-2">
              <div className="sticker-alt bg-highlight-yellow text-bloomberg-bg px-3 py-1 rounded font-hand text-lg">
                {event.handwrittenNote}
              </div>
            </div>
          )}

          <div className="absolute bottom-2 right-2 text-xs text-bloomberg-muted/50 font-hand">
            点击翻面 →
          </div>
        </div>

        <div
          className={`
            absolute inset-0 backface-hidden rounded-xl p-6
            bg-gradient-to-br from-bloomberg-panel to-bloomberg-bg
            border-2 border-highlight-blue/30
            shadow-2xl
          `}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="h-full flex flex-col justify-center items-center text-center">
            <div className="font-hand text-4xl text-highlight-yellow mb-4 transform -rotate-2">
              💡 培训师批注
            </div>
            
            <div className="space-y-3 text-left">
              <div className="p-3 bg-highlight-yellow/10 rounded-lg border-l-4 border-highlight-yellow">
                <p className="text-bloomberg-text font-hand text-xl">
                  {event.isShock 
                    ? '注意！突变行情下，Gamma和Vega会被急剧放大！'
                    : '当前Delta偏离多少？需要调仓多少才能回到中性？'
                  }
                </p>
              </div>
              
              <div className="p-3 bg-highlight-blue/10 rounded-lg border-l-4 border-highlight-blue">
                <p className="text-bloomberg-text font-hand text-xl">
                  估算一下：如果持仓不动，下一轮价格再变动{event.isShock ? '5%' : '2%'}，Gamma会带来多少盈亏？
                </p>
              </div>
              
              <div className="p-3 bg-trader-red/10 rounded-lg border-l-4 border-trader-red">
                <p className="text-bloomberg-text font-hand text-xl">
                  检查保证金！当前可用保证金还能承受多大的反向波动？
                </p>
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-2 left-2 text-xs text-bloomberg-muted/50 font-hand">
            ← 点击翻面
          </div>
        </div>
      </div>
    </div>
  );
};
