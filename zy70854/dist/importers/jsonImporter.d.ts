import { RouteSchedule, ImageIndex, ImportResult } from '../types';
export declare class JsonImporter {
    importRouteSchedules(jsonContent: string): ImportResult<RouteSchedule>;
    importImageIndex(jsonContent: string): ImportResult<ImageIndex>;
    private parseRouteSchedule;
    private parseImageIndex;
    private normalizeDate;
}
