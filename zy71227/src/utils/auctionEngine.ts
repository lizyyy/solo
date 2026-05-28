import type { Artwork, Collector, Booth, Bid, ScenarioType, AuctionStatus } from '../types';

export interface AuctionState {
  artwork: Artwork;
  booth: Booth;
  collectors: Collector[];
  currentPrice: number;
  bidHistory: Bid[];
  round: number;
}

export interface AuctionResult {
  artworkId: string;
  boothId: string;
  finalBidderId: string | null;
  finalPrice: number;
  bidHistory: Bid[];
  scenarioType: ScenarioType;
  scenarioDetails: string;
  status: AuctionStatus;
  heatChange: number;
  satisfactionChange: number;
}

export function calculateMatchScore(artwork: Artwork, collector: Collector): number {
  let score = 50;

  if (collector.preferredGenres.includes(artwork.genre)) {
    score += 25;
  }

  if (collector.preferredArtists.includes(artwork.artist)) {
    score += 25;
  }

  const budgetRatio = artwork.estimatedValue / collector.budget;
  if (budgetRatio < 0.3) {
    score += 10;
  } else if (budgetRatio > 0.7) {
    score -= 15;
  }

  return Math.min(100, Math.max(0, score));
}

export function generateBid(
  collector: Collector,
  matchScore: number,
  currentPrice: number,
  artworkValue: number
): number | null {
  if (collector.budget < currentPrice) {
    return null;
  }

  const bidProbability = matchScore / 100;
  const randomFactor = Math.random();

  if (randomFactor > bidProbability) {
    return null;
  }

  const minIncrement = Math.max(100, artworkValue * 0.05);
  const maxBid = Math.min(collector.budget, artworkValue * (1 + matchScore / 200));

  if (currentPrice >= maxBid) {
    return null;
  }

  const bidAmount = currentPrice + minIncrement + Math.random() * (artworkValue * 0.1);
  return Math.min(bidAmount, maxBid);
}

export function checkScenarioTriggers(
  artwork: Artwork,
  booth: Booth,
  bidHistory: Bid[],
  collectors: Collector[]
): { type: ScenarioType; details: string } | null {
  if (booth.reservePrice > artwork.estimatedValue * 1.5) {
    return {
      type: 'reserve_too_high',
      details: `底价 ${booth.reservePrice.toLocaleString()} 远超估值 ${artwork.estimatedValue.toLocaleString()} 的150%，藏家望而却步`
    };
  }

  if (booth.royaltyRate === 0 || booth.royaltyRate < artwork.baseRoyaltyRate * 0.5) {
    return {
      type: 'royalty_missing',
      details: `版税率 ${booth.royaltyRate}% 显著低于艺术家要求的 ${artwork.baseRoyaltyRate}%，可能引发纠纷`
    };
  }

  const bidderCounts: Record<string, number> = {};
  bidHistory.forEach(bid => {
    bidderCounts[bid.collectorId] = (bidderCounts[bid.collectorId] || 0) + 1;
  });

  const frequentBidders = Object.entries(bidderCounts).filter(([, count]) => count >= 3);
  if (frequentBidders.length > 0) {
    const bidderId = frequentBidders[0][0];
    const collector = collectors.find(c => c.id === bidderId);
    return {
      type: 'duplicate_bidder',
      details: `藏家 ${collector?.name || '未知'} 已连续出价 ${frequentBidders[0][1]} 次，需关注是否存在异常操作`
    };
  }

  return null;
}

export function executeAuctionRound(
  artwork: Artwork,
  booth: Booth,
  collectors: Collector[]
): AuctionResult {
  const heatAdjustedValue = artwork.estimatedValue * booth.heatBonus;
  let currentPrice = booth.reservePrice;
  const bidHistory: Bid[] = [];
  let timestamp = Date.now();

  const activeCollectors = collectors.map(c => ({ ...c, remainingBudget: c.budget }));

  if (currentPrice > heatAdjustedValue * 1.8) {
    return {
      artworkId: artwork.id,
      boothId: booth.id,
      finalBidderId: null,
      finalPrice: 0,
      bidHistory: [],
      scenarioType: 'reserve_too_high',
      scenarioDetails: `底价 ${currentPrice.toLocaleString()} 远超热度调整估值 ${Math.floor(heatAdjustedValue).toLocaleString()}，无人应价`,
      status: 'unsold',
      heatChange: -2,
      satisfactionChange: -5
    };
  }

  for (let bidRound = 0; bidRound < 5; bidRound++) {
    for (const collector of activeCollectors) {
      if (collector.remainingBudget < currentPrice) continue;

      const matchScore = calculateMatchScore(artwork, collector);
      const bid = generateBid(collector, matchScore, currentPrice, heatAdjustedValue);

      if (bid && bid <= collector.remainingBudget) {
        currentPrice = bid;
        collector.remainingBudget -= bid;
        bidHistory.push({
          collectorId: collector.id,
          amount: bid,
          timestamp: timestamp++
        });
      }
    }
  }

  const scenario = checkScenarioTriggers(artwork, booth, bidHistory, collectors);

  if (bidHistory.length === 0) {
    return {
      artworkId: artwork.id,
      boothId: booth.id,
      finalBidderId: null,
      finalPrice: 0,
      bidHistory: [],
      scenarioType: scenario?.type || 'reserve_too_high',
      scenarioDetails: scenario?.details || '无有效出价，作品流拍',
      status: 'unsold',
      heatChange: -1,
      satisfactionChange: -3
    };
  }

  const finalBid = bidHistory[bidHistory.length - 1];

  return {
    artworkId: artwork.id,
    boothId: booth.id,
    finalBidderId: finalBid.collectorId,
    finalPrice: Math.floor(finalBid.amount),
    bidHistory,
    scenarioType: scenario?.type || 'normal',
    scenarioDetails: scenario?.details || `经过 ${bidHistory.length} 轮竞价，作品成功成交`,
    status: 'sold',
    heatChange: scenario?.type === 'normal' ? 1 : -1,
    satisfactionChange: scenario?.type === 'normal' ? 2 : -2
  };
}
