"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matcher = exports.Matcher = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const DataStore_1 = require("../store/DataStore");
class Matcher {
    constructor() {
        this.conditionOrder = {
            [types_1.BookCondition.NEW]: 5,
            [types_1.BookCondition.LIKE_NEW]: 4,
            [types_1.BookCondition.GOOD]: 3,
            [types_1.BookCondition.FAIR]: 2,
            [types_1.BookCondition.POOR]: 1
        };
    }
    async matchAll() {
        await DataStore_1.dataStore.init();
        const sellers = DataStore_1.dataStore.getAvailableSellers();
        const buyers = DataStore_1.dataStore.getAvailableBuyers();
        const results = [];
        for (const buyer of buyers) {
            for (const seller of sellers) {
                const matchResult = this.evaluateMatch(buyer, seller);
                results.push(matchResult);
            }
        }
        return this.sortResults(results);
    }
    async matchByBuyer(buyerId) {
        await DataStore_1.dataStore.init();
        const buyer = DataStore_1.dataStore.getBuyerById(buyerId);
        if (!buyer) {
            throw new Error('未找到该买家需求');
        }
        const sellers = DataStore_1.dataStore.getAvailableSellers();
        const results = [];
        for (const seller of sellers) {
            const matchResult = this.evaluateMatch(buyer, seller);
            results.push(matchResult);
        }
        return this.sortResults(results);
    }
    async matchBySeller(sellerId) {
        await DataStore_1.dataStore.init();
        const seller = DataStore_1.dataStore.getSellerById(sellerId);
        if (!seller) {
            throw new Error('未找到该卖家清单');
        }
        const buyers = DataStore_1.dataStore.getAvailableBuyers();
        const results = [];
        for (const buyer of buyers) {
            const matchResult = this.evaluateMatch(buyer, seller);
            results.push(matchResult);
        }
        return this.sortResults(results);
    }
    evaluateMatch(buyer, seller) {
        const reasons = [];
        const missingConditions = [];
        let matchScore = 0;
        let canBeMatched = true;
        if (seller.status === types_1.ListingStatus.LOCKED) {
            reasons.push(types_1.MatchReason.ALREADY_LOCKED);
            missingConditions.push('该书已被锁定，暂时不可交易');
            canBeMatched = false;
            return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
        }
        if (buyer.courseName !== seller.courseName) {
            reasons.push(types_1.MatchReason.LOCATION_MISMATCH);
            missingConditions.push('课程不匹配');
            canBeMatched = false;
            return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
        }
        if (this.normalizeTitle(buyer.bookTitle) !== this.normalizeTitle(seller.bookTitle)) {
            reasons.push(types_1.MatchReason.LOCATION_MISMATCH);
            missingConditions.push('书名不匹配');
            canBeMatched = false;
            return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
        }
        if (this.normalizeEdition(buyer.desiredEdition) !== this.normalizeEdition(seller.edition)) {
            reasons.push(types_1.MatchReason.VERSION_MISMATCH);
            missingConditions.push(`版本不匹配: 您需要第${buyer.desiredEdition}版，该书是第${seller.edition}版`);
            canBeMatched = false;
        }
        else {
            matchScore += 40;
            reasons.push(types_1.MatchReason.PERFECT_MATCH);
        }
        const conditionMatch = this.checkConditionMatch(buyer.acceptableConditions, seller.condition);
        if (conditionMatch.matched) {
            matchScore += 25 * conditionMatch.quality;
            reasons.push(types_1.MatchReason.PERFECT_MATCH);
        }
        else {
            reasons.push(types_1.MatchReason.CONDITION_MISMATCH);
            const acceptableStr = buyer.acceptableConditions.map(c => this.getConditionDisplay(c)).join('、');
            missingConditions.push(`成色不匹配: 您接受${acceptableStr}，该书是${this.getConditionDisplay(seller.condition)}`);
            canBeMatched = false;
        }
        if (seller.price <= buyer.maxPrice) {
            const priceRatio = 1 - (seller.price / buyer.maxPrice);
            matchScore += 25 * (0.5 + priceRatio * 0.5);
            reasons.push(types_1.MatchReason.PERFECT_MATCH);
        }
        else {
            reasons.push(types_1.MatchReason.PRICE_OVER_BUDGET);
            const overAmount = seller.price - buyer.maxPrice;
            missingConditions.push(`价格超预算: 您的预算是${buyer.maxPrice}元，该书售价${seller.price}元，超出${overAmount}元`);
            canBeMatched = false;
        }
        const locationMatch = buyer.preferredPickupLocations.some(loc => loc === seller.pickupLocation);
        if (locationMatch) {
            matchScore += 10;
            reasons.push(types_1.MatchReason.PERFECT_MATCH);
        }
        else {
            reasons.push(types_1.MatchReason.LOCATION_MISMATCH);
            const preferredStr = buyer.preferredPickupLocations.join('、');
            missingConditions.push(`取书地点不匹配: 您偏好${preferredStr}，该书在${seller.pickupLocation}取书`);
        }
        return this.createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions);
    }
    createMatchResult(buyer, seller, reasons, matchScore, canBeMatched, missingConditions) {
        const explanation = this.generateExplanation(buyer, seller, matchScore, canBeMatched, missingConditions);
        return {
            id: (0, uuid_1.v4)(),
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
    generateExplanation(buyer, seller, matchScore, canBeMatched, missingConditions) {
        if (!canBeMatched && missingConditions.length > 0) {
            return `【不可交易】${missingConditions[0]}`;
        }
        const matchedPoints = [];
        const warnings = [];
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
        }
        else {
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
    checkConditionMatch(acceptable, actual) {
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
    normalizeTitle(title) {
        return title.toLowerCase().trim().replace(/\s+/g, '');
    }
    normalizeEdition(edition) {
        const match = edition.match(/(\d+)/);
        return match ? match[1] : edition.toLowerCase().trim();
    }
    getConditionDisplay(condition) {
        const display = {
            [types_1.BookCondition.NEW]: '全新',
            [types_1.BookCondition.LIKE_NEW]: '几乎全新',
            [types_1.BookCondition.GOOD]: '良好',
            [types_1.BookCondition.FAIR]: '一般',
            [types_1.BookCondition.POOR]: '较差'
        };
        return display[condition];
    }
    sortResults(results) {
        return results.sort((a, b) => {
            if (a.canBeMatched && !b.canBeMatched)
                return -1;
            if (!a.canBeMatched && b.canBeMatched)
                return 1;
            return b.matchScore - a.matchScore;
        });
    }
}
exports.Matcher = Matcher;
exports.matcher = new Matcher();
