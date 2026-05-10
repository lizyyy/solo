import { RiskLevel, Site, WeatherAlert } from '../types';
export declare function assessSiteRisk(site: Site, weatherAlert: WeatherAlert): RiskLevel;
export declare function getActionRequired(riskLevel: RiskLevel): 'EVACUATE' | 'MONITOR' | 'REASSIGN' | 'NONE';
export declare function isSiteReassignable(siteId: string): boolean;
export declare function findAvailableReplacementSites(originalSiteId: string): Site[];
