export declare const generateId: () => string;
export declare const formatDate: (date: Date) => string;
export declare const parseDate: (dateStr: string) => Date;
export declare const isDateValid: (dateStr: string) => boolean;
export declare const daysBetween: (date1: string, date2: string) => number;
export declare const isFever: (temperature: number) => boolean;
export declare const isMedicationExpiringSoon: (expiryDate: string, checkDate: string) => boolean;
export declare const isMedicationExpired: (expiryDate: string, checkDate: string) => boolean;
