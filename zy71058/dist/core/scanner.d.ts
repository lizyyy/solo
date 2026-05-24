import { SecretRule, Finding } from '../types';
import { ValueNode } from '../utils/yaml-parser';
export interface ScanContext {
    filePath: string;
    rules: SecretRule[];
    verbose: boolean;
}
export declare function isBase64(str: string): boolean;
export declare function tryDecodeBase64(str: string): {
    decoded: string;
    isBase64: boolean;
};
export declare function scanValue(valueNode: ValueNode, context: ScanContext, alreadyDecoded?: boolean): Finding[];
export declare function scanContent(content: string, context: ScanContext, basePath?: string): Finding[];
export declare function scanValueNodes(valueNodes: ValueNode[], context: ScanContext): Finding[];
