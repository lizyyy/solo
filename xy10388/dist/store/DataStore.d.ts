import { SellerListing, BuyerRequest, ImportResult } from '../types';
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
export declare class DataStore {
    private sellers;
    private buyers;
    private matches;
    private initialized;
    constructor();
    init(): Promise<void>;
    private loadData;
    save(): Promise<void>;
    importSellers(records: RawSellerData[]): Promise<ImportResult>;
    importBuyers(records: RawBuyerData[]): Promise<ImportResult>;
    private parseCondition;
    private findDuplicateSeller;
    private findDuplicateBuyer;
    getSellers(): SellerListing[];
    getBuyers(): BuyerRequest[];
    getAvailableSellers(): SellerListing[];
    getAvailableBuyers(): BuyerRequest[];
    getSellerById(id: string): SellerListing | undefined;
    getBuyerById(id: string): BuyerRequest | undefined;
    lockDeal(sellerId: string, buyerId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    unlockDeal(sellerId: string, buyerId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export declare const dataStore: DataStore;
