import { ExportService } from '../services/export.service';
import { CreateExportTaskDto, ExportQueryDto } from '../dto/export.dto';
import { UserContext } from '../../../common/types';
export declare class ExportController {
    private readonly exportService;
    constructor(exportService: ExportService);
    createTask(dto: CreateExportTaskDto, user: UserContext): Promise<import("../../../common/types").ProcessingResult<import("../entities/export-task.entity").ExportTask>>;
    getById(id: string): Promise<import("../entities/export-task.entity").ExportTask>;
    query(query: ExportQueryDto): Promise<import("../../../common/types").PaginatedResult<import("../entities/export-task.entity").ExportTask>>;
}
