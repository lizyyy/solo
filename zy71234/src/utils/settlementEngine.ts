import type { Card, PartyState, Settlement, SplitDetail } from '../types';
import { detectAllIssues } from './issueDetector';

export function calculateSplitModifiers(
  parties: PartyState[],
  cards: Card[]
): { splits: SplitDetail[]; updatedParties: PartyState[] } {
  const splitDetails: SplitDetail[] = parties.map(party => ({
    partyId: party.id,
    partyName: party.name,
    partyType: party.type,
    baseSplit: party.rawSplitPercentage,
    rawSplit: party.rawSplitPercentage,
    modifiers: [],
    finalSplit: party.rawSplitPercentage,
    amount: 0
  }));

  const updatedParties = parties.map(party => ({ ...party }));

  cards.forEach(card => {
    if (card.effect.type === 'split_modifier') {
      const targets = card.effect.target === 'all' 
        ? splitDetails 
        : splitDetails.filter(s => 
            updatedParties.find(p => p.id === s.partyId)?.type === card.effect.target
          );
      
      targets.forEach(target => {
        target.modifiers.push({
          cardId: card.id,
          cardName: card.name,
          value: card.effect.value
        });
        target.finalSplit += card.effect.value;
        
        const party = updatedParties.find(p => p.id === target.partyId);
        if (party) {
          party.splitPercentage += card.effect.value;
        }
      });
    }
  });

  return { splits: splitDetails, updatedParties };
}

export function calculateDeductions(
  totalRevenue: number,
  cards: Card[]
): { 
  deductions: Array<{ name: string; amount: number; cardId: string }>;
  totalDeduction: number;
} {
  const deductions: Array<{ name: string; amount: number; cardId: string }> = [];
  
  cards.forEach(card => {
    if (card.effect.type === 'deduction_add') {
      const amount = totalRevenue * (card.effect.value / 100);
      deductions.push({
        name: card.name,
        amount,
        cardId: card.id
      });
    }
  });

  const totalDeduction = deductions.reduce((sum, d) => sum + d.amount, 0);
  
  return { deductions, totalDeduction };
}

export function applyRights(parties: PartyState[], cards: Card[]): PartyState[] {
  return parties.map(party => {
    const updatedParty = { ...party, rights: [...party.rights] };
    
    cards.forEach(card => {
      if (card.effect.type === 'right_add' && card.effect.right) {
        const shouldApply = card.effect.target === 'all' || 
          updatedParty.type === card.effect.target;
        
        if (shouldApply && !updatedParty.rights.includes(card.effect.right)) {
          if (card.effect.right !== 'missing_mechanical') {
            updatedParty.rights.push(card.effect.right);
          }
        }
      }
    });
    
    return updatedParty;
  });
}

export function calculateReputation(
  parties: PartyState[],
  cards: Card[],
  issuesLength: number
): { reputationScore: number; rawReputationScore: number } {
  let rawScore = parties.reduce((sum, p) => sum + p.reputation, 0) / parties.length;
  
  cards.forEach(card => {
    if (card.effect.type === 'reputation_mod') {
      if (card.effect.target === 'all') {
        rawScore += card.effect.value;
      }
    }
  });
  
  const issuePenalty = issuesLength * 5;
  const finalScore = Math.max(0, Math.min(100, rawScore - issuePenalty));
  
  return {
    reputationScore: finalScore,
    rawReputationScore: rawScore
  };
}

export function calculateSettlement(
  gameId: string,
  totalRevenue: number,
  parties: PartyState[],
  cards: Card[]
): Settlement {
  const rawTotalRevenue = totalRevenue;
  
  let updatedParties = applyRights(parties, cards);
  const { splits } = calculateSplitModifiers(updatedParties, cards);
  const { deductions, totalDeduction } = calculateDeductions(totalRevenue, cards);
  
  const revenueAfterDeductions = totalRevenue - totalDeduction;
  
  splits.forEach(split => {
    split.amount = revenueAfterDeductions * (split.finalSplit / 100);
  });
  
  updatedParties = splits.map(split => {
    const party = updatedParties.find(p => p.id === split.partyId)!;
    return { ...party, splitPercentage: split.finalSplit };
  });
  
  const issues = detectAllIssues(splits, updatedParties, cards, deductions);
  const { reputationScore, rawReputationScore } = calculateReputation(updatedParties, cards, issues.length);
  
  const finalPayout = splits.reduce((sum, s) => sum + s.amount, 0);

  return {
    id: `settlement-${Date.now()}`,
    gameId,
    totalRevenue,
    rawTotalRevenue,
    splits,
    issues,
    reputationScore,
    rawReputationScore,
    deductions,
    finalPayout
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function getPartyIcon(type: string): string {
  switch (type) {
    case 'songwriter': return '🎵';
    case 'recording': return '🎙️';
    case 'publisher': return '📀';
    default: return '❓';
  }
}

export function getCardTypeIcon(type: string): string {
  switch (type) {
    case 'copyright': return '📜';
    case 'artist': return '🎤';
    case 'platform': return '📱';
    case 'clause': return '📋';
    case 'action': return '⚡';
    default: return '🃏';
  }
}

export function getCardTypeName(type: string): string {
  switch (type) {
    case 'copyright': return '版权牌';
    case 'artist': return '艺人牌';
    case 'platform': return '平台牌';
    case 'clause': return '条款牌';
    case 'action': return '行动牌';
    default: return '未知';
  }
}

export function getRarityColor(rarity: string): string {
  switch (rarity) {
    case 'common': return 'border-gray-400';
    case 'rare': return 'border-blue-400';
    case 'epic': return 'border-amber-400';
    default: return 'border-gray-400';
  }
}

export function getRarityGlow(rarity: string): string {
  switch (rarity) {
    case 'common': return '';
    case 'rare': return 'shadow-blue-500/30';
    case 'epic': return 'shadow-amber-500/50';
    default: return '';
  }
}

export function getRarityName(rarity: string): string {
  switch (rarity) {
    case 'common': return '普通';
    case 'rare': return '稀有';
    case 'epic': return '史诗';
    default: return '未知';
  }
}
