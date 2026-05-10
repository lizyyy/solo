import { v4 as uuidv4 } from 'uuid';
import {
  SellerListing,
  BuyerRequest,
  MatchResult,
  MatchReason,
  BookCondition,
  ListingStatus
} from '../types';
import { dataStore } from '../store/DataStore';

export class Matcher {
  private conditionOrder: Record<BookCondition, number> = {
    [BookCondition.NEW]: 5,
    [BookCondition.LIKE_NEW]: 4,
    [BookCondition.GOOD]: 3,
    [BookCondition.FAIR]: 2,
    [BookCondition.POOR]: 1
  };

  async matchAll(): Promise<MatchResult[]> {
    await dataStore.init();
    
    const sellers = dataStore.getAvailableSellers();
    const buyers = dataStore.getAvailableBuyers();
    
    const results: MatchResult[] = [];
    
    for (const buyer of buyers) {
      for (const seller of sellers) {
        const matchResult = this.evaluateMatch(buyer, seller);
        results.push(matchResult);
      }
    }
    
    return this.sortResults(results);
  }

  async matchByBuyer(buyerId: string): Promise<MatchResult[]> {
    await dataStore.init();
    
    const buyer = dataStore.getBuyerById(buyerId);
    if (!buyer) {
      throw new Error('未找到该买家需求');
    }
    
    const sellers = dataStore.getAvailableSellers();
    const results: MatchResult[] = [];
    
    for (const seller of sellers) {
      const matchResult = this.evaluateMatch(buyer, seller);
      results.push(matchResult);
    }
    
    return this.sortResults(results);
  }

  async matchBySeller(sellerId: string): Promise<MatchResult[]> {
    await dataStore.init();
    
    const seller = dataStore.getSellerById(sellerId);
    if (!seller) {
      throw new Error('未找到该卖家清单');
    }
    
    const buyers = dataStore.getAvailableBuyers();
    const results: MatchResult[] = [];
    
    for (const buyer of buyers) {
      const matchResult = this.evaluateMatch(buyer, seller);
      results.push(matchResult);
    }
    
    return this.sortResults(results);
  }

  private evaluateMatch(buyer: BuyerRequest, seller: SellerListing): MatchResult {
    const reasons: MatchReason[] = [];
    const missingConditions: string[] = [];
    let matchScore = 0;
    let canBeMatched = true;

    if (seller.status === ListingStatus.LOCKED) {
      reasons.push(MatchReason.ALREADY_LOCKED);
      missingConditions.push('该书已被锁定，暂时不可交易');
      canBeMatched = false;
      return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
    }

    if (buyer.courseName !== seller.courseName) {
      reasons.push(MatchReason.LOCATION_MISMATCH);
      missingConditions.push('课程不匹配');
      canBeMatched = false;
      return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
    }

    if (this.normalizeTitle(buyer.bookTitle) !== this.normalizeTitle(seller.bookTitle)) {
      reasons.push(MatchReason.LOCATION_MISMATCH);
      missingConditions.push('书名不匹配');
      canBeMatched = false;
      return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
    }

    if (this.normalizeEdition(buyer.desiredEdition) !== this.normalizeEdition(seller.edition)) {
      reasons.push(MatchReason.VERSION_MISMATCH);
      missingConditions.push(`版本不匹配: 您需要第${buyer.desiredEdition}版，该书是第${seller.edition}版`);
      canBeMatched = false;
    } else {
      matchScore += 40;
      reasons.push(MatchReason.PERFECT_MATCH);
    }

    const conditionMatch = this.checkConditionMatch(buyer.acceptableConditions, seller.condition);
    if (conditionMatch.matched) {
      matchScore += 25 * conditionMatch.quality;
      reasons.push(MatchReason.PERFECT_MATCH);
    } else {
      reasons.push(MatchReason.CONDITION_MISMATCH);
      const acceptableStr = buyer.acceptableConditions.map(c => this.getConditionDisplay(c)).join('、');
      missingConditions.push(`成色不匹配: 您接受${acceptableStr}，该书是${this.getConditionDisplay(seller.condition)}`);
      canBeMatched = false;
    }

    if (seller.price <= buyer.maxPrice) {
      const priceRatio = 1 - (seller.price / buyer.maxPrice);
      matchScore += 25 * (0.5 + priceRatio * 0.5);
      reasons.push(MatchReason.PERFECT_MATCH);
    } else {
      reasons.push(MatchReason.PRICE_OVER_BUDGET);
      const overAmount = seller.price - buyer.maxPrice;
      missingConditions.push(`价格超预算: 您的预算是${buyer.maxPrice}元，该书售价${seller.price}元，超出${overAmount}元`);
      canBeMatched = false;
    }

    const locationMatch = buyer.preferredPickupLocations.some(loc => 
      loc === seller.pickupLocation
    );
    if (locationMatch) {
      matchScore += 10;
      reasons.push(MatchReason.PERFECT_MATCH);
    } else {
      reasons.push(MatchReason.LOCATION_MISMATCH);
      const preferredStr = buyer.preferredPickupLocations.join('、');
      missingConditions.push(`取书地点不匹配: 您偏好${preferredStr}，该书在${seller.pickupLocation}取书`);
    }

    return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
  }

  private createMatchResult(
    buyer: BuyerRequest,
    seller: SellerListing,
    reasons: MatchReason[],
    matchScore: number,
    canBeMatched: boolean,
    missingConditions: string[]
  ): MatchResult {
    const explanation = this.generateExplanation(buyer, seller, matchScore, canBeMatched, missingConditions);
    
    return {
      id: uuidv4(),
      buyerRequestId: buyer.id,
      sellerListingId: seller.id,
      buyerName: buyer.buyerName,
      sellerName: seller.sellerName,
      courseName: buyer.courseName,
      bookTitle: buyer.bookTitle,
      buyerEdition: buyer.desiredEdition,
      sellerEdition: seller.edition,
      buyerCondition: buyer.acceptableConditions,
      sellerCondition: seller.condition,
      buyerPrice: buyer.maxPrice,
      sellerPrice: seller.price,
      buyerLocations: buyer.preferredPickupLocations,
      sellerLocation: seller.pickupLocation,
      reasons: reasons.filter((v, i, a) => a.indexOf(v) === i),
      matchScore: Math.min(100, Math.round(matchScore)),
      canBeMatched,
      explanation,
      missingConditions
    };
  }

  private generateExplanation(
    buyer: BuyerRequest,
    seller: SellerListing,
    matchScore: number,
    canBeMatched: boolean,
    missingConditions: string[]
  ): string {
    if (!canBeMatched && missingConditions.length > 0) {
      return `【不可交易】${missingConditions[0]}`;
    }

    const matchedPoints: string[] = [];
    const warnings: string[] = [];

    if (this.normalizeEdition(buyer.desiredEdition) === this.normalizeEdition(seller.edition)) {
      matchedPoints.push(`版本匹配：第${seller.edition}版`);
    }

    const conditionMatch = this.checkConditionMatch(buyer.acceptableConditions, seller.condition);
    if (conditionMatch.matched) {
      matchedPoints.push(`成色符合：${this.getConditionDisplay(seller.condition)}`);
    }

    if (seller.price <= buyer.maxPrice) {
      const saved = buyer.maxPrice - seller.price;
      matchedPoints.push(`价格合适：${seller.price}元（您预算${buyer.maxPrice}元，可省${saved}元）`);
    }

    const locationMatch = buyer.preferredPickupLocations.some(loc => loc === seller.pickupLocation);
    if (locationMatch) {
      matchedPoints.push(`取书方便：${seller.pickupLocation}`);
    } else {
      warnings.push(`注意：取书地点是${seller.pickupLocation}，不在您的偏好列表中`);
    }

    let explanation = `【匹配度 ${Math.round(matchScore)}%】`;
    
    if (matchedPoints.length > 0) {
      explanation += '\n✓ 匹配点：' + matchedPoints.join('；');
    }
    
    if (warnings.length > 0) {
      explanation += '\n⚠ 提醒：' + warnings.join('；');
    }

    if (canBeMatched) {
      explanation += '\n\n推荐理由：这本书基本符合您的所有需求，可以考虑锁定交易！';
    }

    return explanation;
  }

  private checkConditionMatch(
    acceptable: BookCondition[],
    actual: BookCondition
  ): { matched: boolean; quality: number } {
    const actualLevel = this.conditionOrder[actual];
    
    for (const cond of acceptable) {
      const acceptableLevel = this.conditionOrder[cond];
      if (actualLevel >= acceptableLevel) {
        const quality = Math.min(1, actualLevel / 5);
        return { matched: true, quality };
      }
    }
    
    return { matched: false, quality: 0 };
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().trim().replace(/\s+/g, '');
  }

  private normalizeEdition(edition: string): string {
    const match = edition.match(/(\d+)/);
    return match ? match[1] : edition.toLowerCase().trim();
  }

  private getConditionDisplay(condition: BookCondition): string {
    const display: Record<BookCondition, string> = {
      [BookCondition.NEW]: '全新',
      [BookCondition.LIKE_NEW]: '几乎全新',
      [BookCondition.GOOD]: '良好',
      [BookCondition.FAIR]: '一般',
      [BookCondition.POOR]: '较差'
    };
    return display[condition];
  }

  private sortResults(results: MatchResult[]): MatchResult[] {
    return results.sort((a, b) => {
      if (a.canBeMatched && !b.canBeMatched) return -1;
      if (!a.canBeMatched && b.canBeMatched) return 1;
      return b.matchScore - a.matchScore;
    });
  }
}

export const matcher = new Matcher();
