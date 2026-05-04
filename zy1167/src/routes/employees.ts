import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { employeeRepository } from '../repositories/EmployeeRepository';
import { EmployeeStatus, ImportEmployeesRequest } from '../types';
import { logger } from '../utils/logger';

const router = Router();

const importSchema = Joi.object({
  employees: Joi.array().items(
    Joi.object({
      employeeNumber: Joi.string().required(),
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().allow('').optional(),
      bankName: Joi.string().required(),
      bankAccountNumber: Joi.string().required(),
      bankAccountName: Joi.string().required(),
      department: Joi.string().required(),
      position: Joi.string().required()
    })
  ).min(1).required()
});

const updateSchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().allow('').optional(),
  bankName: Joi.string().optional(),
  bankAccountNumber: Joi.string().optional(),
  bankAccountName: Joi.string().optional(),
  department: Joi.string().optional(),
  position: Joi.string().optional(),
  status: Joi.string().valid(...Object.values(EmployeeStatus)).optional()
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

    const data = value as ImportEmployeesRequest;
    
    const createdEmployees = await employeeRepository.bulkCreate(
      data.employees.map(e => ({
        employeeNumber: e.employeeNumber,
        name: e.name,
        email: e.email,
        phone: e.phone || '',
        bankName: e.bankName,
        bankAccountNumber: e.bankAccountNumber,
        bankAccountName: e.bankAccountName,
        department: e.department,
        position: e.position
      }))
    );

    logger.info('Employees imported', { count: createdEmployees.length });

    res.json({
      success: true,
      data: {
        imported: createdEmployees.length,
        employees: createdEmployees.map(e => ({
          id: e.id,
          employeeNumber: e.employeeNumber,
          name: e.name,
          email: e.email,
          department: e.department
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to import employees', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to import employees',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const pageSize = parseInt(_req.query.pageSize as string) || 100;
    
    const result = await employeeRepository.findAll(page, pageSize);
    
    res.json({
      success: true,
      data: {
        employees: result.employees.map(e => ({
          id: e.id,
          employeeNumber: e.employeeNumber,
          name: e.name,
          email: e.email,
          phone: e.phone,
          bankName: e.bankName,
          bankAccountNumber: e.bankAccountNumber,
          bankAccountName: e.bankAccountName,
          department: e.department,
          position: e.position,
          status: e.status,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt
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
    logger.error('Failed to get employees', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get employees',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const employee = await employeeRepository.findById(req.params.id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        bankName: employee.bankName,
        bankAccountNumber: employee.bankAccountNumber,
        bankAccountName: employee.bankAccountName,
        department: employee.department,
        position: employee.position,
        status: employee.status,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to get employee', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get employee',
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

    const employee = await employeeRepository.update(req.params.id, value);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        email: employee.email,
        status: employee.status,
        updatedAt: employee.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update employee', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update employee',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await employeeRepository.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      message: 'Employee deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete employee', { 
      id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete employee',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/department/:department', async (req: Request, res: Response) => {
  try {
    const employees = await employeeRepository.findByDepartment(req.params.department);
    
    res.json({
      success: true,
      data: {
        count: employees.length,
        employees: employees.map(e => ({
          id: e.id,
          employeeNumber: e.employeeNumber,
          name: e.name,
          email: e.email,
          position: e.position
        }))
      }
    });
  } catch (error) {
    logger.error('Failed to get employees by department', { 
      department: req.params.department,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get employees',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as employeesRouter };
