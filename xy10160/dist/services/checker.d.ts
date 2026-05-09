import { Product, ProductDiff, CheckSummary } from '../types';
export declare const compareProducts: (indexProduct: Product, sourceProduct: Product) => ProductDiff;
export declare const compareAllProducts: (indexProducts: Product[], sourceProducts: Product[]) => {
    productDiffs: ProductDiff[];
    summary: CheckSummary;
    missingFieldsCount: number;
    mismatchedFieldsCount: number;
};
//# sourceMappingURL=checker.d.ts.map