import { DisplayMode, HumanReadableError } from '../types';
export interface NavigationContext {
    trackId: string;
    source: 'alias_table' | 'checkin_photo' | 'rehearsal_record';
    sourceId: string;
}
export declare class DisplayModeService {
    private store;
    private historyService;
    constructor();
    setDisplayMode(approvalId: string, displayMode: DisplayMode, operator: string): {
        success: boolean;
        error?: HumanReadableError;
        requiresReview?: boolean;
    };
    getNavigationTargets(trackId: string): Array<{
        type: 'alias_table' | 'checkin_photo' | 'rehearsal_record';
        id: string;
        label: string;
    }>;
    navigateToSource(trackId: string, targetType: 'alias_table' | 'checkin_photo' | 'rehearsal_record', targetId: string): {
        success: boolean;
        context?: NavigationContext;
        error?: HumanReadableError;
    };
    checkServiceReviewRequired(displayMode: DisplayMode, trackId: string): {
        required: boolean;
        reason?: string;
    };
}
