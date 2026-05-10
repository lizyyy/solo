import { Router, Request, Response } from 'express';
import { LeadService } from '../services/LeadService';
import { LeadStatus } from '../types';

const router = Router();

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { leads } = req.body;
    
    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: '缺少线索数据' });
    }

    const result = await LeadService.createLeads(leads);

    res.json({
      success: true,
      data: {
        created: result.created.length,
        duplicates: result.duplicates.length,
        needsReview: result.needsReview.length,
        details: result
      }
    });
  } catch (error) {
    console.error('导入线索失败:', error);
    res.status(500).json({ error: '导入线索失败' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, region, assignedTo, customerLevel, search } = req.query;
    const filters: any = {};

    if (status) filters.status = status;
    if (region) filters.region = region;
    if (assignedTo) filters.assignedTo = assignedTo;
    if (customerLevel) filters.customerLevel = customerLevel;
    if (search) filters.search = search;

    const leads = await LeadService.getLeads(filters);
    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('获取线索列表失败:', error);
    res.status(500).json({ error: '获取线索列表失败' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const lead = await LeadService.getLeadById(req.params.id);
    
    if (!lead) {
      return res.status(404).json({ error: '线索不存在' });
    }

    const followUpRecords = await LeadService.getFollowUpRecords(req.params.id);
    
    res.json({ 
      success: true, 
      data: { 
        lead, 
        followUpRecords 
      } 
    });
  } catch (error) {
    console.error('获取线索详情失败:', error);
    res.status(500).json({ error: '获取线索详情失败' });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: '缺少状态参数' });
    }

    const validStatuses = Object.values(LeadStatus);
    if (!validStatuses.includes(status as LeadStatus)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const updatedLead = await LeadService.updateLeadStatus(
      req.params.id,
      status as LeadStatus,
      notes
    );

    if (!updatedLead) {
      return res.status(404).json({ error: '线索不存在' });
    }

    res.json({ success: true, data: updatedLead });
  } catch (error) {
    console.error('更新线索状态失败:', error);
    res.status(500).json({ error: '更新线索状态失败' });
  }
});

router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { salesId } = req.body;
    
    if (!salesId) {
      return res.status(400).json({ error: '缺少销售人员ID' });
    }

    const updatedLead = await LeadService.manuallyAssignLead(req.params.id, salesId);
    
    if (!updatedLead) {
      return res.status(404).json({ error: '线索不存在或销售人员不存在' });
    }

    res.json({ success: true, data: updatedLead });
  } catch (error) {
    console.error('手动分配线索失败:', error);
    res.status(500).json({ error: '手动分配线索失败' });
  }
});

router.post('/merge', async (req: Request, res: Response) => {
  try {
    const { duplicateLeadId, targetLeadId } = req.body;
    
    if (!duplicateLeadId || !targetLeadId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await LeadService.mergeDuplicateLeads(duplicateLeadId, targetLeadId);
    
    if (!result) {
      return res.status(404).json({ error: '线索不存在' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('合并线索失败:', error);
    res.status(500).json({ error: '合并线索失败' });
  }
});

router.post('/:id/follow-up', async (req: Request, res: Response) => {
  try {
    const { salesId, status, notes, nextFollowUpDate } = req.body;
    
    if (!salesId || !status) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const record = await LeadService.addFollowUpRecord(
      req.params.id,
      salesId,
      status,
      notes,
      nextFollowUpDate ? new Date(nextFollowUpDate) : undefined
    );

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('添加跟进记录失败:', error);
    res.status(500).json({ error: '添加跟进记录失败' });
  }
});

export default router;
