import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  SellerListing, 
  BuyerRequest, 
  ListingStatus,
  ImportResult,
  BookCondition
} from '../types';

const DATA_DIR = path.join(process.cwd(), '.book-match-data');
const SELLERS_FILE = path.join(DATA_DIR, 'sellers.json');
const BUYERS_FILE = path.join(DATA_DIR, 'buyers.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

export interface RawSellerData {
  courseName: string;
  bookTitle: string;
  edition: string;
  condition: string;
  price: number;
  pickupLocation: string;
  sellerId: string;
  sellerName: string;
}

export interface RawBuyerData {
  courseName: string;
  bookTitle: string;
  desiredEdition: string;
  acceptableConditions: string[];
  maxPrice: number;
  preferredPickupLocations: string[];
  buyerId: string;
  buyerName: string;
}

export class DataStore {
  private sellers: Map<string, SellerListing> = new Map();
  private buyers: Map<string, BuyerRequest> = new Map();
  private matches: Map<string, any> = new Map();
  private initialized = false;

  constructor() {}

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch {
      // 目录可能已存在
    }
    
    await this.loadData();
    this.initialized = true;
  }

  private async loadData(): Promise<void> {
    try {
      const sellersContent = await fs.readFile(SELLERS_FILE, 'utf-8');
      const sellersData = JSON.parse(sellersContent);
      for (const seller of sellersData) {
        this.sellers.set(seller.id, seller);
      }
    } catch {
      // 文件不存在，使用空数据
    }

    try {
      const buyersContent = await fs.readFile(BUYERS_FILE, 'utf-8');
      const buyersData = JSON.parse(buyersContent);
      for (const buyer of buyersData) {
        this.buyers.set(buyer.id, buyer);
      }
    } catch {
      // 文件不存在，使用空数据
    }

    try {
      const matchesContent = await fs.readFile(MATCHES_FILE, 'utf-8');
      const matchesData = JSON.parse(matchesContent);
      for (const match of matchesData) {
        this.matches.set(match.id, match);
      }
    } catch {
      // 文件不存在，使用空数据
    }
  }

  async save(): Promise<void> {
    const sellersArray = Array.from(this.sellers.values());
    const buyersArray = Array.from(this.buyers.values());
    const matchesArray = Array.from(this.matches.values());

    await fs.writeFile(SELLERS_FILE, JSON.stringify(sellersArray, null, 2), 'utf-8');
    await fs.writeFile(BUYERS_FILE, JSON.stringify(buyersArray, null, 2), 'utf-8');
    await fs.writeFile(MATCHES_FILE, JSON.stringify(matchesArray, null, 2), 'utf-8');
  }

  async importSellers(records: RawSellerData[]): Promise<ImportResult> {
    const result: ImportResult = {
      totalRecords: records.length,
      imported: 0,
      merged: 0,
      duplicates: 0,
      errors: 0,
      messages: []
    };

    for (const record of records) {
      try {
        const condition = this.parseCondition(record.condition);
        if (!condition) {
          result.errors++;
          result.messages.push(`错误: 无效的成色 '${record.condition}'，卖家 ${record.sellerName}`);
          continue;
        }

        const duplicate = this.findDuplicateSeller(record);
        
        if (duplicate) {
          if (record.price !== duplicate.price || record.condition !== duplicate.condition) {
            result.merged++;
            result.messages.push(`合并: ${record.sellerName} 的 ${record.bookTitle}，已更新价格/成色`);
            duplicate.price = record.price;
            duplicate.condition = condition;
            duplicate.updatedAt = new Date();
          } else {
            result.duplicates++;
            result.messages.push(`重复: ${record.sellerName} 的 ${record.bookTitle} 已存在，跳过`);
          }
        } else {
          const newListing: SellerListing = {
            id: uuidv4(),
            courseName: record.courseName,
            bookTitle: record.bookTitle,
            edition: record.edition,
            condition: condition,
            price: record.price,
            pickupLocation: record.pickupLocation,
            sellerId: record.sellerId,
            sellerName: record.sellerName,
            status: ListingStatus.AVAILABLE,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          this.sellers.set(newListing.id, newListing);
          result.imported++;
          result.messages.push(`导入: ${record.sellerName} - ${record.bookTitle}`);
        }
      } catch (error) {
        result.errors++;
        result.messages.push(`错误: 导入 ${record.bookTitle} 失败 - ${error}`);
      }
    }

    await this.save();
    return result;
  }

  async importBuyers(records: RawBuyerData[]): Promise<ImportResult> {
    const result: ImportResult = {
      totalRecords: records.length,
      imported: 0,
      merged: 0,
      duplicates: 0,
      errors: 0,
      messages: []
    };

    for (const record of records) {
      try {
        const conditions: BookCondition[] = [];
        for (const cond of record.acceptableConditions) {
          const parsed = this.parseCondition(cond);
          if (!parsed) {
            throw new Error(`无效的成色 '${cond}'`);
          }
          conditions.push(parsed);
        }

        const duplicate = this.findDuplicateBuyer(record);
        
        if (duplicate) {
          if (record.maxPrice !== duplicate.maxPrice || 
              record.desiredEdition !== duplicate.desiredEdition) {
            result.merged++;
            result.messages.push(`合并: ${record.buyerName} 的求购 ${record.bookTitle}，已更新价格/版本`);
            duplicate.maxPrice = record.maxPrice;
            duplicate.desiredEdition = record.desiredEdition;
            duplicate.acceptableConditions = conditions;
            duplicate.updatedAt = new Date();
          } else {
            result.duplicates++;
            result.messages.push(`重复: ${record.buyerName} 的求购 ${record.bookTitle} 已存在，跳过`);
          }
        } else {
          const newRequest: BuyerRequest = {
            id: uuidv4(),
            courseName: record.courseName,
            bookTitle: record.bookTitle,
            desiredEdition: record.desiredEdition,
            acceptableConditions: conditions,
            maxPrice: record.maxPrice,
            preferredPickupLocations: record.preferredPickupLocations,
            buyerId: record.buyerId,
            buyerName: record.buyerName,
            status: ListingStatus.AVAILABLE,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          this.buyers.set(newRequest.id, newRequest);
          result.imported++;
          result.messages.push(`导入: ${record.buyerName} 求购 ${record.bookTitle}`);
        }
      } catch (error) {
        result.errors++;
        result.messages.push(`错误: 导入 ${record.buyerName} 的求购失败 - ${error}`);
      }
    }

    await this.save();
    return result;
  }

  private parseCondition(condition: string): BookCondition | null {
    const normalized = condition.toLowerCase().trim();
    const mapping: Record<string, BookCondition> = {
      '全新': BookCondition.NEW,
      'new': BookCondition.NEW,
      '几乎全新': BookCondition.LIKE_NEW,
      'like_new': BookCondition.LIKE_NEW,
      '良好': BookCondition.GOOD,
      'good': BookCondition.GOOD,
      '一般': BookCondition.FAIR,
      'fair': BookCondition.FAIR,
      '较差': BookCondition.POOR,
      'poor': BookCondition.POOR
    };
    return mapping[normalized] || null;
  }

  private findDuplicateSeller(record: RawSellerData): SellerListing | undefined {
    for (const listing of this.sellers.values()) {
      if (listing.courseName === record.courseName &&
          listing.bookTitle === record.bookTitle &&
          listing.sellerId === record.sellerId &&
          listing.edition === record.edition) {
        return listing;
      }
    }
    return undefined;
  }

  private findDuplicateBuyer(record: RawBuyerData): BuyerRequest | undefined {
    for (const request of this.buyers.values()) {
      if (request.courseName === record.courseName &&
          request.bookTitle === record.bookTitle &&
          request.buyerId === record.buyerId) {
        return request;
      }
    }
    return undefined;
  }

  getSellers(): SellerListing[] {
    return Array.from(this.sellers.values());
  }

  getBuyers(): BuyerRequest[] {
    return Array.from(this.buyers.values());
  }

  getAvailableSellers(): SellerListing[] {
    return this.getSellers().filter(s => s.status === ListingStatus.AVAILABLE);
  }

  getAvailableBuyers(): BuyerRequest[] {
    return this.getBuyers().filter(b => b.status === ListingStatus.AVAILABLE);
  }

  getSellerById(id: string): SellerListing | undefined {
    return this.sellers.get(id);
  }

  getBuyerById(id: string): BuyerRequest | undefined {
    return this.buyers.get(id);
  }

  async lockDeal(sellerId: string, buyerId: string): Promise<{ success: boolean; message: string }> {
    const seller = this.sellers.get(sellerId);
    const buyer = this.buyers.get(buyerId);

    if (!seller) {
      return { success: false, message: '未找到该卖家清单' };
    }

    if (!buyer) {
      return { success: false, message: '未找到该买家需求' };
    }

    if (seller.status === ListingStatus.LOCKED) {
      if (seller.lockedByBuyerId === buyerId) {
        return { success: false, message: '该交易已被当前买家锁定' };
      }
      return { success: false, message: '该书已被其他买家锁定，请选择其他书籍' };
    }

    if (buyer.status === ListingStatus.LOCKED) {
      return { success: false, message: '您已锁定其他书籍，请先取消后再尝试' };
    }

    if (seller.status !== ListingStatus.AVAILABLE) {
      return { success: false, message: '该书不可用' };
    }

    if (buyer.status !== ListingStatus.AVAILABLE) {
      return { success: false, message: '该买家需求不可用' };
    }

    seller.status = ListingStatus.LOCKED;
    seller.lockedByBuyerId = buyerId;
    seller.lockedAt = new Date();
    seller.updatedAt = new Date();

    buyer.status = ListingStatus.LOCKED;
    buyer.lockedListingId = sellerId;
    buyer.lockedAt = new Date();
    buyer.updatedAt = new Date();

    await this.save();
    return { success: true, message: `已锁定交易: ${buyer.buyerName} ↔ ${seller.sellerName} (${seller.bookTitle})` };
  }

  async unlockDeal(sellerId: string, buyerId: string): Promise<{ success: boolean; message: string }> {
    const seller = this.sellers.get(sellerId);
    const buyer = this.buyers.get(buyerId);

    if (!seller) {
      return { success: false, message: '未找到该卖家清单' };
    }

    if (!buyer) {
      return { success: false, message: '未找到该买家需求' };
    }

    if (seller.status !== ListingStatus.LOCKED) {
      return { success: false, message: '该书未被锁定' };
    }

    if (seller.lockedByBuyerId !== buyerId) {
      return { success: false, message: '该书不是被当前买家锁定的' };
    }

    seller.status = ListingStatus.AVAILABLE;
    seller.lockedByBuyerId = undefined;
    seller.lockedAt = undefined;
    seller.updatedAt = new Date();

    buyer.status = ListingStatus.AVAILABLE;
    buyer.lockedListingId = undefined;
    buyer.lockedAt = undefined;
    buyer.updatedAt = new Date();

    await this.save();
    return { success: true, message: `已取消锁定: ${seller.bookTitle} 已回到可撮合池` };
  }
}

export const dataStore = new DataStore();
