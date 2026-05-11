const express = require('express');
const models = require('./models');

const app = express();
app.use(express.json());

const { 
  createTicket, 
  getTicketById, 
  getAllTickets, 
  dispatchTicket, 
  recordArrival, 
  recordRescue, 
  closeTicket,
  getStatistics,
  checkTimeout,
  mergeDuplicateTicket,
  calculateResponseTime,
  calculateArrivalTime,
  calculateRescueTime,
  STATUS
} = models;

app.post('/api/tickets', (req, res) => {
  try {
    const { building, elevator, reporterName, reporterPhone, trappedCount, description } = req.body;
    
    if (!building || !elevator || !reporterName || !reporterPhone) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['building', 'elevator', 'reporterName', 'reporterPhone']
      });
    }

    const result = createTicket({
      building, 
      elevator, 
      reporterName, 
      reporterPhone, 
      trappedCount, 
      description
    });

    if (result.merged) {
      const merged = mergeDuplicateTicket(result.originalTicketId, req.body);
      return res.status(200).json({
        message: '检测到重复报警，已合并到现有工单',
        merged: true,
        originalTicketId: result.originalTicketId,
        ticket: {
          ...merged,
          responseTime: calculateResponseTime(merged),
          arrivalTime: calculateArrivalTime(merged),
          rescueTime: calculateRescueTime(merged),
          isTimeout: checkTimeout(merged)
        }
      });
    }

    res.status(201).json({
      message: '报警创建成功',
      merged: false,
      ticket: {
        ...result.ticket,
        responseTime: calculateResponseTime(result.ticket),
        arrivalTime: calculateArrivalTime(result.ticket),
        rescueTime: calculateRescueTime(result.ticket),
        isTimeout: checkTimeout(result.ticket)
      }
    });
  } catch (error) {
    console.error('创建报警失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/tickets', (req, res) => {
  try {
    const tickets = getAllTickets();
    const enriched = tickets.map(ticket => ({
      ...ticket,
      responseTime: calculateResponseTime(ticket),
      arrivalTime: calculateArrivalTime(ticket),
      rescueTime: calculateRescueTime(ticket),
      isTimeout: checkTimeout(ticket)
    }));
    res.json({ tickets: enriched });
  } catch (error) {
    console.error('查询工单列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/tickets/:id', (req, res) => {
  try {
    const ticket = getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    res.json({
      ticket: {
        ...ticket,
        responseTime: calculateResponseTime(ticket),
        arrivalTime: calculateArrivalTime(ticket),
        rescueTime: calculateRescueTime(ticket),
        isTimeout: checkTimeout(ticket)
      }
    });
  } catch (error) {
    console.error('查询工单详情失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/tickets/:id/dispatch', (req, res) => {
  try {
    const { maintenancePerson } = req.body;
    if (!maintenancePerson) {
      return res.status(400).json({ error: '请提供维保人员姓名' });
    }

    const ticket = getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    if (ticket.status === STATUS.CLOSED) {
      return res.status(400).json({ error: '工单已关闭，无法继续更新' });
    }

    if (ticket.status !== STATUS.REPORTED) {
      return res.status(400).json({ error: '只能对已报警未派单的工单进行派单' });
    }

    const result = dispatchTicket(req.params.id, maintenancePerson);
    res.json({
      message: '派单成功',
      ticket: {
        ...result,
        responseTime: calculateResponseTime(result),
        arrivalTime: calculateArrivalTime(result),
        rescueTime: calculateRescueTime(result),
        isTimeout: checkTimeout(result)
      }
    });
  } catch (error) {
    console.error('派单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/tickets/:id/arrive', (req, res) => {
  try {
    const ticket = getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    if (ticket.status === STATUS.CLOSED) {
      return res.status(400).json({ error: '工单已关闭，无法继续更新' });
    }

    if (ticket.status === STATUS.REPORTED) {
      return res.status(400).json({ error: '必须先派单才能记录到场时间' });
    }

    if (ticket.status !== STATUS.DISPATCHED) {
      return res.status(400).json({ error: '当前状态不允许记录到场时间' });
    }

    const result = recordArrival(req.params.id);
    res.json({
      message: '记录到场时间成功',
      ticket: {
        ...result,
        responseTime: calculateResponseTime(result),
        arrivalTime: calculateArrivalTime(result),
        rescueTime: calculateRescueTime(result),
        isTimeout: checkTimeout(result)
      }
    });
  } catch (error) {
    console.error('记录到场时间失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/tickets/:id/rescue', (req, res) => {
  try {
    const ticket = getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    if (ticket.status === STATUS.CLOSED) {
      return res.status(400).json({ error: '工单已关闭，无法继续更新' });
    }

    if (ticket.status !== STATUS.ON_SITE) {
      return res.status(400).json({ error: '必须先记录到场才能记录解救时间' });
    }

    const result = recordRescue(req.params.id);
    res.json({
      message: '记录解救时间成功',
      ticket: {
        ...result,
        responseTime: calculateResponseTime(result),
        arrivalTime: calculateArrivalTime(result),
        rescueTime: calculateRescueTime(result),
        isTimeout: checkTimeout(result)
      }
    });
  } catch (error) {
    console.error('记录解救时间失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/tickets/:id/close', (req, res) => {
  try {
    const ticket = getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }

    if (ticket.status === STATUS.CLOSED) {
      return res.status(400).json({ error: '工单已关闭，无法重复关闭' });
    }

    if (ticket.status !== STATUS.RESCUED) {
      return res.status(400).json({ error: '必须先完成解救才能关闭工单' });
    }

    const { issues, summary, improvementMeasures, reviewer } = req.body;
    if (!issues || !summary) {
      return res.status(400).json({ 
        error: '复盘信息不完整',
        required: ['issues', 'summary']
      });
    }

    const result = closeTicket(req.params.id, {
      issues,
      summary,
      improvementMeasures,
      reviewer
    });

    res.json({
      message: '工单关闭成功',
      ticket: {
        ...result,
        responseTime: calculateResponseTime(result),
        arrivalTime: calculateArrivalTime(result),
        rescueTime: calculateRescueTime(result),
        isTimeout: checkTimeout(result)
      }
    });
  } catch (error) {
    console.error('关闭工单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/statistics', (req, res) => {
  try {
    const stats = getStatistics();
    
    const enrichedOpenTickets = stats.openTickets.map(ticket => ({
      ...ticket,
      responseTime: calculateResponseTime(ticket),
      arrivalTime: calculateArrivalTime(ticket),
      rescueTime: calculateRescueTime(ticket),
      isTimeout: checkTimeout(ticket)
    }));

    res.json({
      buildings: stats.buildings,
      elevators: stats.elevators,
      openTickets: enrichedOpenTickets,
      totalTickets: stats.totalTickets,
      timeoutTickets: enrichedOpenTickets.filter(t => t.isTimeout)
    });
  } catch (error) {
    console.error('查询统计信息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`物业电梯困人响应API已启动，监听端口 ${PORT}`);
  console.log('API端点:');
  console.log('  POST   /api/tickets          - 创建报警');
  console.log('  GET    /api/tickets          - 查询所有工单');
  console.log('  GET    /api/tickets/:id      - 查询工单详情');
  console.log('  POST   /api/tickets/:id/dispatch - 派单');
  console.log('  POST   /api/tickets/:id/arrive   - 记录到场时间');
  console.log('  POST   /api/tickets/:id/rescue   - 记录解救时间');
  console.log('  POST   /api/tickets/:id/close    - 关闭工单并填写复盘');
  console.log('  GET    /api/statistics       - 查询统计信息');
});
