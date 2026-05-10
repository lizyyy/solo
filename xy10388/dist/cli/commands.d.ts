export declare function importSellers(filePath: string): Promise<void>;
export declare function importBuyers(filePath: string): Promise<void>;
export declare function runMatching(buyerId?: string, sellerId?: string): Promise<void>;
export declare function lockDeal(sellerId: string, buyerId: string): Promise<void>;
export declare function unlockDeal(sellerId: string, buyerId: string): Promise<void>;
export declare function exportResults(outputPath: string): Promise<void>;
export declare function listSellers(): Promise<void>;
export declare function listBuyers(): Promise<void>;
