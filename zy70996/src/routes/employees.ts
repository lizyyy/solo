import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';

const router = Router();

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { employees, operator } = req.body;

    if (!Array.isArray(employees)) {
      return res.status(400).json({ error: '员工数据必须是数组格式' });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const emp of employees) {
      try {
        const employee = await prisma.employee.upsert({
          where: { id: emp.id },
          update: {
            name: emp.name,
            department: emp.department,
            position: emp.position,
            status: emp.status || 'ACTIVE',
            phone: emp.phone,
            email: emp.email,
            joinDate: emp.joinDate ? new Date(emp.joinDate) : null,
            leaveDate: emp.leaveDate ? new Date(emp.leaveDate) : null,
          },
          create: {
            id: emp.id,
            name: emp.name,
            department: emp.department,
            position: emp.position,
            status: emp.status || 'ACTIVE',
            phone: emp.phone,
            email: emp.email,
            joinDate: emp.joinDate ? new Date(emp.joinDate) : null,
            leaveDate: emp.leaveDate ? new Date(emp.leaveDate) : null,
          },
        });
        results.push({ id: emp.id, success: true, employee });
        successCount++;
      } catch (error: any) {
        results.push({ id: emp.id, success: false, error: error.message });
        failCount++;
      }
    }

    await prisma.importHistory.create({
      data: {
        id: `import_${Date.now()}`,
        type: 'EMPLOYEE',
        fileName: 'api_import',
        recordCount: employees.length,
        successCount,
        failCount,
        operator: operator || 'system',
      },
    });

    res.json({
      success: true,
      total: employees.length,
      successCount,
      failCount,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, department } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (department) where.department = department;

    const employees = await prisma.employee.findMany({
      where,
      include: {
        collectionRecords: {
          include: {
            batch: true,
          },
        },
      },
    });
    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        collectionRecords: {
          include: {
            batch: true,
            auditLogs: true,
          },
        },
      },
    });
    if (!employee) {
      return res.status(404).json({ error: '员工不存在' });
    }
    res.json(employee);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
