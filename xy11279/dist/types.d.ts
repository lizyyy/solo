export declare enum VehicleStatus {
    AVAILABLE = "available",
    IN_USE = "in_use",
    CHARGING = "charging",
    MAINTENANCE = "maintenance"
}
export declare enum ChargerStatus {
    AVAILABLE = "available",
    OCCUPIED = "occupied",
    MAINTENANCE = "maintenance"
}
export declare enum TaskStatus {
    PENDING = "pending",
    ASSIGNED = "assigned",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    EXCEPTION = "exception"
}
export declare enum ShiftType {
    NIGHT = "night",
    DAY = "day"
}
export declare enum ExceptionType {
    LOW_BATTERY = "low_battery",
    CHARGER_CONFLICT = "charger_conflict",
    VEHICLE_BREAKDOWN = "vehicle_breakdown",
    TASK_DELAY = "task_delay",
    OPERATOR_ABSENT = "operator_absent"
}
export interface Vehicle {
    id: string;
    plateNumber: string;
    batteryLevel: number;
    status: VehicleStatus;
    currentChargerId?: string;
    currentTaskId?: string;
    operatorId?: string;
    lastUpdate: string;
    _sensitive?: {
        operatorPhone?: string;
    };
}
export interface Charger {
    id: string;
    name: string;
    status: ChargerStatus;
    currentVehicleId?: string;
    power: number;
    location: string;
}
export interface Task {
    id: string;
    orderNumber: string;
    description: string;
    priority: number;
    estimatedDuration: number;
    requiredBattery: number;
    status: TaskStatus;
    assignedVehicleId?: string;
    assignedOperatorId?: string;
    shiftId?: string;
    startTime?: string;
    endTime?: string;
    createdAt: string;
}
export interface Shift {
    id: string;
    date: string;
    type: ShiftType;
    startTime: string;
    endTime: string;
    operatorIds: string[];
    vehicleAssignments: {
        vehicleId: string;
        taskIds: string[];
    }[];
    chargerReservations: {
        chargerId: string;
        vehicleId: string;
        startTime: string;
        endTime: string;
    }[];
    status: 'planned' | 'active' | 'completed';
    createdAt: string;
}
export interface Exception {
    id: string;
    type: ExceptionType;
    shiftId: string;
    taskId?: string;
    vehicleId?: string;
    chargerId?: string;
    description: string;
    resolved: boolean;
    resolution?: string;
    createdAt: string;
    resolvedAt?: string;
}
export interface Operator {
    id: string;
    name: string;
    employeeId: string;
    phone: string;
    shiftPreference: ShiftType;
    isActive: boolean;
}
export interface ImportResult<T> {
    success: boolean;
    imported: number;
    skipped: number;
    failed: number;
    data: T[];
    errors: ImportError[];
}
export interface ImportError {
    rowNumber: number;
    rawData: Record<string, unknown>;
    error: string;
    suggestion: string;
}
export interface DailyReport {
    date: string;
    totalTasks: number;
    completedTasks: number;
    exceptionTasks: number;
    vehiclesUsed: number;
    chargersUsed: number;
    averageBatteryUsage: number;
    exceptions: ExceptionSummary[];
    shiftSummary: {
        day: ShiftSummary;
        night: ShiftSummary;
    };
}
export interface ExceptionSummary {
    type: ExceptionType;
    count: number;
    description: string;
}
export interface ShiftSummary {
    totalTasks: number;
    completedTasks: number;
    operators: number;
    vehicles: number;
}
export interface DatabaseSchema {
    vehicles: Vehicle[];
    chargers: Charger[];
    tasks: Task[];
    shifts: Shift[];
    exceptions: Exception[];
    operators: Operator[];
    importHistory: {
        id: string;
        type: string;
        fileName: string;
        timestamp: string;
        recordCount: number;
        hash: string;
    }[];
}
