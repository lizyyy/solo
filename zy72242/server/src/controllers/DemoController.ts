import { Request, Response } from 'express';
import DemoService from '../services/DemoService';
import HolidayService from '../services/HolidayService';

class DemoController {
  async initDemo(req: Request, res: Response) {
    try {
      const { step } = req.query;
      
      let result;
      if (step === '1') {
        result = DemoService.initStep1_HolidayImport();
      } else if (step === '2') {
        result = DemoService.initStep2_TailAdjustment();
      } else if (step === '3') {
        result = DemoService.initStep3_ReconciliationUpdate();
      } else {
        result = DemoService.initFullDemo();
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '初始化演示数据失败'
      });
    }
  }

  async getDemoGuide(req: Request, res: Response) {
    try {
      const guide = DemoService.getDemoGuide();
      
      res.json({
        success: true,
        data: guide
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取演示指南失败'
      });
    }
  }

  async resetDemo(req: Request, res: Response) {
    try {
      DemoService.resetDemoData();
      
      res.json({
        success: true,
        message: '演示数据已重置'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '重置演示数据失败'
      });
    }
  }

  async getHolidays(req: Request, res: Response) {
    try {
      const holidays = HolidayService.getHolidays();
      
      res.json({
        success: true,
        data: holidays
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取节假日配置失败'
      });
    }
  }

  async calculateExpectedDate(req: Request, res: Response) {
    try {
      const { tradeDate } = req.query;
      
      if (!tradeDate) {
        return res.status(400).json({
          success: false,
          message: '请提供交易日期'
        });
      }

      const expectedDate = HolidayService.calculateExpectedArrivalDate(tradeDate as string);
      const workingDays = HolidayService.calculateWorkingDays(tradeDate as string, expectedDate);
      
      res.json({
        success: true,
        data: {
          tradeDate: tradeDate as string,
          expectedArrivalDate: expectedDate,
          workingDays,
          explanation: `T+1计算结果：${expectedDate}（已扣除节假日和周末）`
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '计算预期到账日失败'
      });
    }
  }
}

export default new DemoController();
