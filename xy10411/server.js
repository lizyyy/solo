const express = require('express');
const cors = require('cors');
const path = require('path');
const dayjs = require('dayjs');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/channels', async (req, res) => {
  try {
    const channels = await prisma.licenseChannel.groupBy({
      by: ['channelName'],
      _count: true,
    });
    res.json(channels.map(c => c.channelName));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials', async (req, res) => {
  try {
    const { search, type, risk, status } = req.query;
    const where = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    
    if (type) {
      where.type = type;
    }
    
    const materials = await prisma.material.findMany({
      where,
      include: {
        clipVersions: true,
        channels: true,
        contracts: true,
        applications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    const materialsWithStatus = materials.map(material => {
      const now = dayjs();
      const isExpired = !material.contracts.some(c => 
        dayjs(c.startDate).isBefore(now) && dayjs(c.endDate).isAfter(now)
      );
      const isInactive = material.status === 'inactive';
      
      let riskLevel = 'NONE';
      let reasons = [];
      
      if (isInactive) {
        riskLevel = 'HIGH';
        reasons.push('素材已下架');
      } else if (isExpired) {
        riskLevel = 'MEDIUM';
        reasons.push('授权已过期');
      } else if (material.type === 'INFLUENCER') {
        riskLevel = 'LOW';
        reasons.push('达人授权，需定期检查');
      }
      
      return {
        ...material,
        isExpired,
        isInactive,
        riskLevel,
        reasons: reasons.join('; '),
      };
    });
    
    let filtered = materialsWithStatus;
    if (risk && risk !== 'ALL') {
      filtered = materialsWithStatus.filter(m => m.riskLevel === risk);
    }
    
    if (status === 'active') {
      filtered = filtered.filter(m => !m.isInactive);
    } else if (status === 'inactive') {
      filtered = filtered.filter(m => m.isInactive);
    }
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials/:id', async (req, res) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        clipVersions: true,
        channels: true,
        contracts: true,
        applications: {
          include: { clipVersion: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    if (!material) {
      return res.status(404).json({ error: '素材不存在' });
    }
    
    const now = dayjs();
    const isExpired = !material.contracts.some(c => 
      dayjs(c.startDate).isBefore(now) && dayjs(c.endDate).isAfter(now)
    );
    
    const timeline = [];
    material.contracts.forEach(c => {
      timeline.push({
        type: 'contract',
        date: c.startDate,
        title: '授权开始',
        description: `合同编号: ${c.contractNumber}`,
      });
      timeline.push({
        type: 'contract',
        date: c.endDate,
        title: '授权到期',
        description: `合同编号: ${c.contractNumber}`,
      });
    });
    material.applications.forEach(a => {
      timeline.push({
        type: 'application',
        date: a.createdAt,
        title: '使用申请',
        description: `${a.applicant} - ${a.status}`,
      });
    });
    material.clipVersions.forEach(v => {
      timeline.push({
        type: 'version',
        date: v.createdAt,
        title: '版本添加',
        description: `${v.version} - ${v.fileName}`,
      });
    });
    
    timeline.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    
    res.json({
      ...material,
      isExpired,
      timeline,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', async (req, res) => {
  try {
    const { name, description, type, clipVersions, channels, contracts } = req.body;
    
    const material = await prisma.material.create({
      data: {
        name,
        description,
        type,
        clipVersions: {
          create: clipVersions.map(v => ({
            version: v.version,
            fileName: v.fileName,
            duration: v.duration,
            size: v.size,
            description: v.description,
          })),
        },
        channels: {
          create: channels.map(c => ({
            channelName: c.channelName,
            description: c.description,
          })),
        },
      },
      include: { clipVersions: true, channels: true },
    });
    
    if (contracts && contracts.length > 0) {
      for (const contract of contracts) {
        const channel = material.channels.find(
          c => c.channelName === contract.channelName
        );
        if (channel) {
          await prisma.contract.create({
            data: {
              materialId: material.id,
              channelId: channel.id,
              contractNumber: contract.contractNumber,
              startDate: new Date(contract.startDate),
              endDate: new Date(contract.endDate),
              fileUrl: contract.fileUrl,
              notes: contract.notes,
            },
          });
        }
      }
    }
    
    res.json(material);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { materialId, clipVersionId, channel, applicant, department, purpose } = req.body;
    
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      include: {
        clipVersions: true,
        channels: true,
        contracts: true,
      },
    });
    
    if (!material) {
      return res.status(404).json({ error: '素材不存在' });
    }
    
    const clipVersion = material.clipVersions.find(v => v.id === clipVersionId);
    if (!clipVersion) {
      return res.status(404).json({ error: '剪辑版本不存在' });
    }
    
    let status = 'APPROVED';
    let riskLevel = 'NONE';
    const reasons = [];
    const now = dayjs();
    
    if (material.status === 'inactive') {
      status = 'REJECTED';
      riskLevel = 'HIGH';
      reasons.push('素材已下架，禁止使用');
    }
    
    const hasChannel = material.channels.some(c => c.channelName === channel);
    if (!hasChannel) {
      status = 'REJECTED';
      riskLevel = 'HIGH';
      reasons.push('未授权投放渠道');
    }
    
    const hasValidContract = material.contracts.some(c => {
      const channelMatch = material.channels.find(ch => ch.id === c.channelId);
      return channelMatch?.channelName === channel &&
        dayjs(c.startDate).isBefore(now) && dayjs(c.endDate).isAfter(now);
    });
    
    if (!hasValidContract) {
      if (status !== 'REJECTED') {
        status = 'REJECTED';
        riskLevel = 'HIGH';
      }
      reasons.push('授权已过期或无有效合同');
    }
    
    const existingApps = await prisma.application.findMany({
      where: {
        materialId,
        clipVersionId,
        status: 'APPROVED',
      },
    });
    
    if (existingApps.length > 0) {
      status = 'NEEDS_REVIEW';
      riskLevel = 'MEDIUM';
      reasons.push('同一剪辑版本已提交过申请');
    }
    
    if (material.type === 'INFLUENCER' && status === 'APPROVED') {
      status = 'NEEDS_REVIEW';
      riskLevel = 'LOW';
      reasons.push('达人授权素材需人工复核');
    }
    
    const application = await prisma.application.create({
      data: {
        materialId,
        clipVersionId,
        channel,
        applicant,
        department,
        purpose,
        status,
        riskLevel,
        reasons: reasons.join('; '),
      },
      include: { material: true, clipVersion: true },
    });
    
    res.json(application);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    
    const applications = await prisma.application.findMany({
      where,
      include: { material: true, clipVersion: true },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/pending', async (req, res) => {
  try {
    const startOfWeek = dayjs().startOf('week').toDate();
    const endOfWeek = dayjs().endOf('week').toDate();
    
    const pendingApps = await prisma.application.findMany({
      where: {
        createdAt: { gte: startOfWeek, lte: endOfWeek },
        status: { in: ['NEEDS_REVIEW', 'REJECTED'] },
      },
      include: { material: true, clipVersion: true },
      orderBy: { createdAt: 'asc' },
    });
    
    const data = pendingApps.map(app => ({
      申请时间: dayjs(app.createdAt).format('YYYY-MM-DD HH:mm'),
      素材名称: app.material.name,
      剪辑版本: app.clipVersion.version,
      投放渠道: app.channel,
      申请人: app.applicant,
      部门: app.department,
      状态: app.status === 'NEEDS_REVIEW' ? '需复核' : '禁止使用',
      风险等级: app.riskLevel,
      原因: app.reasons || '',
    }));
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '本周待处理');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=pending-applications-${dayjs().format('YYYY-MM-DD')}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/materials/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(material);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`短视频素材授权台已启动: http://localhost:${PORT}`);
});
