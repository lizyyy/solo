import { TaskPriority, TaskStatus, MissingComponentType } from '../../../entities/compliance-task.entity';
declare class AffectedItemDto {
    lineNumber: number;
    hsCode: string;
    productName: string;
    issue: string;
}
export declare class CreateComplianceTaskDto {
    batchId: string;
    title: string;
    description?: string;
    componentType: MissingComponentType;
    priority?: TaskPriority;
    assignee?: string;
    dueDate?: string;
    affectedItems?: AffectedItemDto[];
}
export declare class UpdateComplianceTaskDto {
    title?: string;
    description?: string;
    componentType?: MissingComponentType;
    priority?: TaskPriority;
    status?: TaskStatus;
    assignee?: string;
    dueDate?: string;
    resolutionNotes?: string;
    affectedItems?: AffectedItemDto[];
}
export declare class ComplianceTaskFilterDto {
    batchId?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    componentType?: MissingComponentType;
    assignee?: string;
}
export {};
