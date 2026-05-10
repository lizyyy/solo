export enum BookCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor'
}

export enum ListingStatus {
  AVAILABLE = 'available',
  LOCKED = 'locked',
  SOLD = 'sold',
  CANCELLED = 'cancelled'
}

export enum MatchReason {
  PERFECT_MATCH = 'perfect_match',
  VERSION_MISMATCH = 'version_mismatch',
  PRICE_OVER_BUDGET = 'price_over_budget',
  CONDITION_MISMATCH = 'condition_mismatch',
  LOCATION_MISMATCH = 'location_mismatch',
  ALREADY_LOCKED = 'already_locked'
}

export interface SellerListing {
  id: string;
  courseName: string;
  bookTitle: string;
  edition: string;
  condition: BookCondition;
  price: number;
  pickupLocation: string;
  sellerId: string;
  sellerName: string;
  status: ListingStatus;
  lockedByBuyerId?: string;
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyerRequest {
  id: string;
  courseName: string;
  bookTitle: string;
  desiredEdition: string;
  acceptableConditions: BookCondition[];
  maxPrice: number;
  preferredPickupLocations: string[];
  buyerId: string;
  buyerName: string;
  status: ListingStatus;
  lockedListingId?: string;
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchResult {
  id: string;
  buyerRequestId: string;
  sellerListingId: string;
  buyerName: string;
  sellerName: string;
  courseName: string;
  bookTitle: string;
  buyerEdition: string;
  sellerEdition: string;
  buyerCondition: BookCondition[];
  sellerCondition: BookCondition;
  buyerPrice: number;
  sellerPrice: number;
  buyerLocations: string[];
  sellerLocation: string;
  reasons: MatchReason[];
  matchScore: number;
  canBeMatched: boolean;
  explanation: string;
  missingConditions: string[];
}

export interface ImportResult {
  totalRecords: number;
  imported: number;
  merged: number;
  duplicates: number;
  errors: number;
  messages: string[];
}
