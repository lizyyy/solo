import { MealTimer } from '../types';
export declare const getMealTimer: (orderId: string) => MealTimer | null;
export declare const startMealTimer: (orderId: string, expectedMealMinutes: number, operatorId: string, operatorRole: string) => MealTimer;
export declare const stopMealTimer: (orderId: string, operatorId: string, operatorRole: string) => {
    timer: MealTimer;
    isOvertime: boolean;
    overtimeMinutes: number;
};
export declare const checkOvertimeStatus: (orderId: string) => {
    isRunning: boolean;
    elapsedMinutes: number;
    expectedMinutes: number;
    isOvertime: boolean;
    overtimeMinutes: number;
};
export declare const getOvertimeOrders: () => {
    orderId: string;
    timer: MealTimer;
    elapsedMinutes: number;
    overtimeMinutes: number;
}[];
