import { ReportData, MatchRecord, PassengerLostItem, DriverTurnedInItem, WarehouseItem } from '../types';
export declare class ReportGenerator {
    generateJsonReport(reportData: ReportData): string;
    generateCsvReport(reportData: ReportData): string;
    generateExcelReport(reportData: ReportData): Buffer;
    generateTextReport(reportData: ReportData): string;
    generateAuditTrailReport(match: MatchRecord, passengerItem?: PassengerLostItem, driverItem?: DriverTurnedInItem, warehouseItem?: WarehouseItem, reviewHistory?: any[]): string;
    private getStatusText;
    private getDifferenceText;
    private getActionText;
    private maskPhone;
}
