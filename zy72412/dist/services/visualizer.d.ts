export interface BatchVisualization {
    batchId: string;
    totalCount: number;
    paidCount: number;
    complimentaryCount: number;
    hasMixedTypes: boolean;
    reviewStatus: string;
    importDate: string;
    tickets: Array<{
        ticketId: number;
        ticketNo: string;
        ticketType: string;
        authStatus: string;
        attendeeName: string;
        audioRemark?: string;
        sourceLink: {
            type: 'ticket_export' | 'audio_file';
            reference: string;
        };
    }>;
}
export interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor: string[];
    }>;
}
export declare function getBatchVisualization(batchId: string): BatchVisualization | null;
export declare function getOverviewChartData(): ChartData;
export interface AuthStatusSummary {
    pending: number;
    needs_review: number;
    audio_verified: number;
    approved: number;
    rejected: number;
}
export declare function getAuthStatusSummary(): AuthStatusSummary;
export interface TraceInfo {
    ticketNo: string;
    batchId: string;
    authTrail: Array<{
        status: string;
        reason: string;
        timestamp: string;
        assignee: string;
    }>;
    sourceReferences: Array<{
        type: string;
        reference: string;
        description: string;
    }>;
}
export declare function getTicketTrace(ticketId: number): TraceInfo | null;
