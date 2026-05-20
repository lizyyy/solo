import { Request, Response } from 'express';
import { allQuery, getQuery, runQuery } from '../database';
import matchingEngine from '../services/matchingEngine';
import reportService from '../services/reportService';

export async function getInvoices(req: Request, res: Response) {
  try {
    const { page = 1, pageSize = 20, status, employee_name, category, start_date, end_date } = req.query;
    
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (status) {
      whereConditions.push(`status = ?`);
      params.push(status);
    }
    if (employee_name) {
      whereConditions.push(`employee_name LIKE ?`);
      params.push(`%${employee_name}%`);
    }
    if (category) {
      whereConditions.push(`category LIKE ?`);
      params.push(`%${category}%`);
    }
    if (start_date) {
      whereConditions.push(`created_at >= ?`);
      params.push(start_date);
    }
    if (end_date) {
      whereConditions.push(`created_at <= ?`);
      params.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const countSql = `SELECT COUNT(*) as total FROM invoice_images ${whereClause}`;
    const countResult = await getQuery(countSql, params);
    const total = countResult?.total || 0;

    const offset = (Number(page) - 1) * Number(pageSize);
    const sql = `
      SELECT * FROM invoice_images 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const list = await allQuery(sql, [...params, Number(pageSize), offset]);

    res.json({
      success: true,
      data: {
        list,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getInvoiceDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const invoice = await getQuery(`SELECT * FROM invoice_images WHERE id = ?`, [id]);
    if (!invoice) {
      return res.status(404).json({ success: false, error: '票据不存在' });
    }

    const [matches, duplicates, timeline] = await Promise.all([
      allQuery(`
        SELECT m.*, 
          t.departure_city, t.arrival_city, t.start_date, t.end_date,
          b.name as budget_name, b.code as budget_code
        FROM match_results m
        LEFT JOIN trip_records t ON m.trip_id = t.id
        LEFT JOIN budget_categories b ON m.budget_category_id = b.id
        WHERE m.invoice_id = ?
        ORDER BY m.created_at DESC
      `, [id]),
      allQuery(`
        SELECT d.*,
          orig.invoice_no as orig_invoice_no, orig.total_amount as orig_total_amount,
          dup.invoice_no as dup_invoice_no, dup.total_amount as dup_total_amount
        FROM duplicate_invoices d
        LEFT JOIN invoice_images orig ON d.original_invoice_id = orig.id
        LEFT JOIN invoice_images dup ON d.duplicate_invoice_id = dup.id
        WHERE d.original_invoice_id = ? OR d.duplicate_invoice_id = ?
      `, [id, id]),
      allQuery(`
        SELECT * FROM status_timeline 
        WHERE entity_id = ? AND entity_type = 'invoice'
        ORDER BY created_at DESC
      `, [id]),
    ]);

    res.json({
      success: true,
      data: {
        invoice,
        matches,
        duplicates,
        timeline,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function createInvoice(req: Request, res: Response) {
  try {
    const invoice = await matchingEngine.receiveInvoiceOCR(req.body);
    
    const { isDuplicate } = await matchingEngine.checkDuplicate(invoice.id);
    if (!isDuplicate) {
      await matchingEngine.autoMatch(invoice.id);
    }

    res.json({
      success: true,
      data: invoice,
      message: isDuplicate ? '票据已创建，检测到重复' : '票据已创建并自动匹配',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function batchImportInvoices(req: Request, res: Response) {
  try {
    const { invoices } = req.body;
    const results = [];

    for (const invoiceData of invoices) {
      const invoice = await matchingEngine.receiveInvoiceOCR(invoiceData);
      const { isDuplicate } = await matchingEngine.checkDuplicate(invoice.id);
      if (!isDuplicate) {
        await matchingEngine.autoMatch(invoice.id);
      }
      results.push({ invoice, isDuplicate });
    }

    res.json({
      success: true,
      data: results,
      message: `成功导入 ${results.length} 张票据`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function manualMatch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { trip_id, budget_category_id, reimbursement_id, notes, operator } = req.body;
    
    const match = await matchingEngine.manualMatch(id, {
      trip_id,
      budget_category_id,
      reimbursement_id,
      notes,
      operator: operator || '财务人员',
    });

    res.json({
      success: true,
      data: match,
      message: '人工匹配成功',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function confirmMatch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { operator } = req.body;
    
    await matchingEngine.confirmMatch(id, operator || '财务人员');

    res.json({
      success: true,
      message: '匹配结果已确认',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function resolveDuplicate(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action, operator } = req.body;
    
    await matchingEngine.resolveDuplicate(id, action, operator || '财务人员');

    res.json({
      success: true,
      message: '重复票据已处理',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getStatistics(req: Request, res: Response) {
  try {
    const { start_date, end_date } = req.query;
    const stats = await reportService.getStatistics(
      start_date as string | undefined,
      end_date as string | undefined
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function generateReport(req: Request, res: Response) {
  try {
    const { start_date, end_date } = req.body;
    const fileName = await reportService.generateMatchingReport(start_date, end_date);

    res.json({
      success: true,
      data: { fileName },
      message: '报告生成成功',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function downloadReport(req: Request, res: Response) {
  try {
    const { fileName } = req.params;
    const filePath = reportService.getReportPath(fileName);
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        res.status(404).json({ success: false, error: '报告文件不存在' });
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getTrips(req: Request, res: Response) {
  try {
    const list = await allQuery(`SELECT * FROM trip_records ORDER BY created_at DESC`);
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getBudgets(req: Request, res: Response) {
  try {
    const list = await allQuery(`SELECT * FROM budget_categories ORDER BY created_at DESC`);
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
