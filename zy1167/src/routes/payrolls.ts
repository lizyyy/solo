import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { payrollRepository } from '../repositories/PayrollRepository';
import { employeeRepository } from '../repositories/EmployeeRepository';
import { ImportPayrollsRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();

const importSchema = Joi.object({
  payrolls: Joi.array().items(
    Joi.object({
      employeeNumber: Joi.string().required(),
      baseSalary: Joi.number().positive().required(),
      bonus: Joi.number().min(0).optional().default(0),
      allowance: Joi.number().min(0).optional().default(0),
      deduction: Joi.number().min(0).optional().default(0),
      tax: Joi.number().min(0).optional().default(0),
      socialInsurance: Joi.number().min(0).optional().default(0),
      housingFund: Joi.number().min(0).optional().default(0),
      year: Joi.number().integer().min(2000).max(2100).required(),
      month: Joi.number().integer().min(1).max(12).required()
    })
  ).min(1).required()
});

const updateSchema = Joi.object({
  baseSalary: Joi.number().positive().optional(),
  bonus: Joi.number().min(0).optional(),
  allowance: Joi.number().min(0).optional(),
  deduction: Joi.number().min(0).optional(),
  tax: Joi.number().min(0).optional(),
  socialInsurance: Joi.number().min(0).optional(),
  housingFund: Joi.number().min(0).optional(),
  status: Joi.string().valid('pending', 'confirmed').optional()
});

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { error, value } = importSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const data = value as ImportPayrollsRequest;
    const errors: string[] = [];
    const payrollsToCreate: {
      employeeId: string;
      baseSalary: number;
      bonus: number;
      allowance: number;
      deduction: number;
      tax: number;
      socialInsurance: number;
      housingFund: number;
      year: number;
      month: number;
    }[] = [];

    for (const p of data.payrolls) {
      const employee = await employeeRepository.findByEmployeeNumber(p.employeeNumber);
      
      if (!employee) {
        errors.push(`Employee not found: ${p.employeeNumber}`);
        continue;
      }

      payrollsToCreate.push({
        employeeId: employee.id,
        baseSalary: p.baseSalary,
        bonus: p.bonus ?? 0,
        allowance: p.allowance ?? 0,
        deduction: p.deduction ?? 0,
        tax: p.tax ?? 0,
        socialInsurance: p.socialInsurance ?? 0,
        housingFund: p.housingFund ?? 0,
        year: p.year,
        month: p.month
      });
    }

    if (errors.length > 0 && payrollsToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid payrolls to import',
        details: errors
      });
    }

    const createdPayrolls = await payrollRepository.bulkCreate(payrollsToCreate);

    logger.info('Payrolls imported', { count: createdPayrolls.length });

    res.json({
      success: true,
      data: {
        imported: createdPayrolls.length,
        errors: errors.length > 0 ? errors : undefined,
        payrolls: createdPayrolls.map(p => ({
          id: p.id,
          employeeId: p.employeeId,
          year: p.year,
          month: p.month,
          baseSalary: p.baseSalary,
          netSalary: p.netSalary,
          status: p.status
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to import payrolls', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import payrolls',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const pageSize = parseInt(_req.query.pageSize as string) || 100;
    const year = _req.query.year ? parseInt(_req.query.year as string) : undefined;
    const month = _req.query.month ? parseInt(_req.query.month as string) : undefined;
    
    let result;
    
    if (year !== undefined && month !== undefined) {
      const payrolls = await payrollRepository.findByMonth(year, month);
      const count = await payrollRepository.countByMonth(year, month);
      result = { payrolls, total: count };
    } else {
      result = await payrollRepository.findAll(page, pageSize);
    }
    
    res.json({
      success: true,
      data: {
        payrolls: result.payrolls.map(p => ({
          id: p.id,
          employeeId: p.employeeId,
          year: p.year,
          month: p.month,
          baseSalary: p.baseSalary,
          bonus: p.bonus,
          allowance: p.allowance,
          deduction: p.deduction,
          tax: p.tax,
          socialInsurance: p.socialInsurance,
          housingFund: p.housingFund,
          netSalary: p.netSalary,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get payrolls', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get payrolls',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const payroll = await payrollRepository.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: payroll.id,
        employeeId: payroll.employeeId,
        year: payroll.year,
        month: payroll.month,
        baseSalary: payroll.baseSalary,
        bonus: payroll.bonus,
        allowance: payroll.allowance,
        deduction: payroll.deduction,
        tax: payroll.tax,
        socialInsurance: payroll.socialInsurance,
        housingFund: payroll.housingFund,
        netSalary: payroll.netSalary,
        status: payroll.status,
        createdAt: payroll.createdAt,
        updatedAt: payroll.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to get payroll', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get payroll',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }

    const payroll = await payrollRepository.update(req.params.id, value);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: payroll.id,
        employeeId: payroll.employeeId,
        netSalary: payroll.netSalary,
        status: payroll.status,
        updatedAt: payroll.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update payroll', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update payroll',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const payroll = await payrollRepository.confirm(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({
        success: false,
        error: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: payroll.id,
        status: payroll.status,
        updatedAt: payroll.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to confirm payroll', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payroll',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await payrollRepository.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Payroll not found'
      });
    }

    res.json({
      success: true,
      message: 'Payroll deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete payroll', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete payroll',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/employee/:employeeId', async (req: Request, res: Response) => {
  try {
    const payrolls = await payrollRepository.findByEmployeeId(req.params.employeeId);
    
    res.json({
      success: true,
      data: {
        count: payrolls.length,
        payrolls: payrolls.map(p => ({
          id: p.id,
          year: p.year,
          month: p.month,
          netSalary: p.netSalary,
          status: p.status
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get payrolls by employee', { 
      employeeId: req.params.employeeId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get payrolls',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as payrollsRouter };
