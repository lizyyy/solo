import { taskService } from '../services/taskService';

describe('TaskService - 核心业务逻辑测试', () => {
  describe('开放窗口检查', () => {
    it('应该正确检测任务是否在雪道开放窗口内', () => {
      const openStart = '08:00';
      const openEnd = '18:00';
      
      const taskDuringOpen = new Date('2024-01-15T10:00:00');
      const taskBeforeOpen = new Date('2024-01-15T06:00:00');
      const taskAfterOpen = new Date('2024-01-15T20:00:00');
      
      expect(taskService.isDuringOpenWindow(taskDuringOpen, openStart, openEnd)).toBe(true);
      expect(taskService.isDuringOpenWindow(taskBeforeOpen, openStart, openEnd)).toBe(false);
      expect(taskService.isDuringOpenWindow(taskAfterOpen, openStart, openEnd)).toBe(false);
    });
    
    it('应该正确处理跨零点的开放窗口', () => {
      const openStart = '22:00';
      const openEnd = '06:00';
      
      const taskDuringNight = new Date('2024-01-15T02:00:00');
      const taskDuringDay = new Date('2024-01-15T10:00:00');
      
      expect(taskService.isDuringOpenWindow(taskDuringNight, openStart, openEnd)).toBe(true);
      expect(taskService.isDuringOpenWindow(taskDuringDay, openStart, openEnd)).toBe(false);
    });
  });
  
  describe('作业时间估算', () => {
    it('应该根据雪道面积和车辆能力估算作业时间', () => {
      const slopeArea = 30000;
      const vehicleCapacity = 10000;
      
      const estimatedHours = taskService.calculateEstimatedHours(slopeArea, vehicleCapacity);
      
      expect(estimatedHours).toBe(3);
    });
    
    it('应该向上取整估算作业时间', () => {
      const slopeArea = 25000;
      const vehicleCapacity = 10000;
      
      const estimatedHours = taskService.calculateEstimatedHours(slopeArea, vehicleCapacity);
      
      expect(estimatedHours).toBe(3);
    });
  });
  
  describe('任务状态文本转换', () => {
    it('应该正确转换任务状态为中文', () => {
      expect(taskService.getTaskStatusText('PENDING_ASSIGNMENT')).toBe('待分配');
      expect(taskService.getTaskStatusText('PENDING_EXECUTION')).toBe('待执行');
      expect(taskService.getTaskStatusText('IN_PROGRESS')).toBe('执行中');
      expect(taskService.getTaskStatusText('COMPLETED')).toBe('已完成');
      expect(taskService.getTaskStatusText('REJECTED')).toBe('已拒绝');
      expect(taskService.getTaskStatusText('CANCELLED')).toBe('已取消');
    });
  });
});
