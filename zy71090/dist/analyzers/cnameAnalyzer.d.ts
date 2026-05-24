import { ZoneData, CNAMEChain } from '../types';
export declare function analyzeCNAMEChains(zoneData: ZoneData, maxDepth?: number): CNAMEChain[];
export declare function getLongestChains(chains: CNAMEChain[], limit?: number): CNAMEChain[];
export declare function getCircularChains(chains: CNAMEChain[]): CNAMEChain[];
export declare function getChainsWithHighTTL(chains: CNAMEChain[], threshold?: number): CNAMEChain[];
export declare function getUnresolvedChains(chains: CNAMEChain[]): CNAMEChain[];
export declare function formatChainAsTree(chain: CNAMEChain): string;
