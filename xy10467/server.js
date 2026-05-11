const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const zhCN = require('date-fns/locale/zh-CN');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const store = {
  contracts: [],
  versions: [],
  approvals: [],
  stampRequests: [],
  deliveries: [],
  archives: [],
  legalManagers: [
    { id: 'lm-1', name: '张明' },
    { id: 'lm-2', name: '李华' },
    { id: 'lm-3', name: '王芳' }
  ]
};

const CONTRACT_TYPES = {
  SALES: '销售合同',
  PURCHASE: '采购合同',
  SUPPLEMENT: '补充协议'
};

const VERSION_STATUS = {
  DRAFT: '草稿',
  PENDING_APPROVAL: '待审批',
  APPROVED: '已审批',
  REJECTED: '已驳回',
  OBSOLETE: '已作废'
};

const STAMP_STATUS = {
  PENDING: '待盖章',
  STAMPED: '已盖章'
};

const DELIVERY_STATUS = {
  PENDING: '待寄送',
  SHIPPED: '已寄送',
  RECEIVED: '已签收'
};

const ARCHIVE_STATUS = {
  PENDING: '待归档',
  ARCHIVED: '已归档'
};

function initSampleData() {
  const contracts = [
    {
      id: 'contract-1',
      contractNo: 'XS-2024-001',
      name: '软件销售合同',
      type: CONTRACT_TYPES.SALES,
      counterparty: '科技有限公司',
      legalManagerId: 'lm-1',
      legalManager: '张明',
      createdAt: new Date('2024-01-15').toISOString(),
      isClosed: false
    },
    {
      id: 'contract-2',
      contractNo: 'CG-2024-001',
      name: '设备采购合同',
      type: CONTRACT_TYPES.PURCHASE,
      counterparty: '供应商有限公司',
      legalManagerId: 'lm-2',
      legalManager: '李华',
      createdAt: new Date('2024-02-20').toISOString(),
      isClosed: false
    },
    {
      id: 'contract-3',
      contractNo: 'BC-2024-001',
      name: '服务补充协议',
      type: CONTRACT_TYPES.SUPPLEMENT,
      counterparty: '科技有限公司',
      relatedContractNo: 'XS-2024-001',
      legalManagerId: 'lm-1',
      legalManager: '张明',
      createdAt: new Date('2024-03-10').toISOString(),
      isClosed: false
    }
  ];

  const versions = [
    {
      id: 'version-1-1',
      contractId: 'contract-1',
      versionNo: 'v1.0',
      content: '甲方：科技有限公司\n乙方：我们公司\n...合同内容...\n金额：100万元',
      status: VERSION_STATUS.APPROVED,
      createdAt: new Date('2024-01-16').toISOString(),
      createdBy: '张三'
    },
    {
      id: 'version-1-2',
      contractId: 'contract-1',
      versionNo: 'v1.1',
      content: '甲方：科技有限公司\n乙方：我们公司\n...合同内容...\n金额：120万元',
      status: VERSION_STATUS.APPROVED,
      createdAt: new Date('2024-01-18').toISOString(),
      createdBy: '张三'
    },
    {
      id: 'version-2-1',
      contractId: 'contract-2',
      versionNo: 'v1.0',
      content: '甲方：我们公司\n乙方：供应商有限公司\n...采购合同内容...\n金额：80万元',
      status: VERSION_STATUS.PENDING_APPROVAL,
      createdAt: new Date('2024-02-21').toISOString(),
      createdBy: '李四'
    },
    {
      id: 'version-3-1',
      contractId: 'contract-3',
      versionNo: 'v1.0',
      content: '关于 XS-2024-001 合同补充协议...\n补充内容：延长服务期限1年',
      status: VERSION_STATUS.OBSOLETE,
      createdAt: new Date('2024-03-11').toISOString(),
      createdBy: '王五'
    },
    {
      id: 'version-3-2',
      contractId: 'contract-3',
      versionNo: 'v1.1',
      content: '关于 XS-2024-001 合同补充协议...\n补充内容：延长服务期限2年',
      status: VERSION_STATUS.APPROVED,
      createdAt: new Date('2024-03-12').toISOString(),
      createdBy: '王五'
    }
  ];

  const approvals = [
    {
      id: 'approval-1-1',
      versionId: 'version-1-1',
      approver: '法务经理',
      result: 'approved',
      comment: '同意',
      approvedAt: new Date('2024-01-17').toISOString()
    },
    {
      id: 'approval-1-2',
      versionId: 'version-1-2',
      approver: '法务经理',
      result: 'approved',
      comment: '金额变更已确认',
      approvedAt: new Date('2024-01-19').toISOString()
    },
    {
      id: 'approval-3-2',
      versionId: 'version-3-2',
      approver: '法务经理',
      result: 'approved',
      comment: '补充协议内容已审核通过',
      approvedAt: new Date('2024-03-13').toISOString()
    }
  ];

  const stampRequests = [
    {
      id: 'stamp-1-1',
      versionId: 'version-1-1',
      contractId: 'contract-1',
      contractNo: 'XS-2024-001',
      versionNo: 'v1.0',
      applicant: '张三',
      appliedAt: new Date('2024-01-20').toISOString(),
      status: STAMP_STATUS.STAMPED,
      stampedBy: '章管员',
      stampedAt: new Date('2024-01-21').toISOString()
    }
  ];

  const deliveries = [
    {
      id: 'delivery-1-1',
      stampRequestId: 'stamp-1-1',
      recipient: '科技有限公司-刘经理',
      address: '北京市朝阳区科技路100号',
      phone: '13800138000',
      courier: '顺丰速运',
      trackingNo: 'SF1234567890',
      status: DELIVERY_STATUS.RECEIVED,
      shippedAt: new Date('2024-01-22').toISOString(),
      receivedAt: new Date('2024-01-24').toISOString()
    }
  ];

  const archives = [
    {
      id: 'archive-1-1',
      stampRequestId: 'stamp-1-1',
      contractId: 'contract-1',
      location: '档案室A-1-001',
      archivedBy: '档案管理员',
      archivedAt: new Date('2024-01-25').toISOString()
    }
  ];

  store.contracts = contracts;
  store.versions = versions;
  store.approvals = approvals;
  store.stampRequests = stampRequests;
  store.deliveries = deliveries;
  store.archives = archives;
}

initSampleData();

function formatDate(date) {
  if (!date) return '';
  return format(new Date(date), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
}

function getContractById(id) {
  return store.contracts.find(c => c.id === id);
}

function getVersionById(id) {
  return store.versions.find(v => v.id === id);
}

function getStampRequestById(id) {
  return store.stampRequests.find(s => s.id === id);
}

function getStampRequestsByContract(contractId) {
  return store.stampRequests.filter(s => s.contractId === contractId);
}

function getStampRequestsByVersion(versionId) {
  return store.stampRequests.filter(s => s.versionId === versionId);
}

function hasApproval(versionId) {
  return store.approvals.some(a => a.versionId === versionId && a.result === 'approved');
}

function isVersionObsolete(versionId) {
  const version = getVersionById(versionId);
  return version && version.status === VERSION_STATUS.OBSOLETE;
}

function hasOtherVersion(contractId) {
  return getStampRequestsByContract(contractId).length > 0;
}

function isDelivered(stampRequestId) {
  const delivery = store.deliveries.find(d => d.stampRequestId === stampRequestId);
  return delivery && delivery.status === DELIVERY_STATUS.RECEIVED;
}

function isArchived(stampRequestId) {
  return store.archives.some(a => a.stampRequestId === stampRequestId);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/legal-managers', (req, res) => {
  res.json(store.legalManagers);
});

app.get('/api/contracts', (req, res) => {
  const contracts = store.contracts.map(contract => {
    const versions = store.versions.filter(v => v.contractId === contract.id);
    const stampRequests = getStampRequestsByContract(contract.id);
    return {
      ...contract,
      versionCount: versions.length,
      stampCount: stampRequests.length,
      latestVersion: versions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0],
      latestStamp: stampRequests.sort((a, b) => new Date(b.stampedAt || b.appliedAt) - new Date(a.stampedAt || a.appliedAt))[0]
    };
  });
  res.json(contracts);
});

app.post('/api/contracts', (req, res) => {
  const { name, type, counterparty, legalManagerId, relatedContractNo } = req.body;
  const legalManager = store.legalManagers.find(lm => lm.id === legalManagerId);
  const contract = {
    id: `contract-${uuidv4().slice(0, 8)}`,
    contractNo: `${type === CONTRACT_TYPES.SALES ? 'XS' : type === CONTRACT_TYPES.PURCHASE ? 'CG' : 'BC'}-${new Date().getFullYear()}-${String(store.contracts.length + 1).padStart(3, '0')}`,
    name,
    type,
    counterparty,
    legalManagerId,
    legalManager: legalManager ? legalManager.name : '',
    relatedContractNo,
    createdAt: new Date().toISOString(),
    isClosed: false
  };
  store.contracts.push(contract);
  res.status(201).json(contract);
});

app.get('/api/contracts/:id', (req, res) => {
  const contract = getContractById(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });
  const versions = store.versions.filter(v => v.contractId === contract.id);
  res.json({ ...contract, versions });
});

app.put('/api/contracts/:id/close', (req, res) => {
  const contract = getContractById(req.params.id);
  if (!contract) return res.status(404).json({ error: '合同不存在' });
  
  const stampRequests = getStampRequestsByContract(contract.id);
  const unarchived = stampRequests.filter(s => !isArchived(s.id));
  if (unarchived.length > 0) {
    return res.status(400).json({ error: '存在未归档的盖章记录，无法关闭合同' });
  }
  
  contract.isClosed = true;
  res.json(contract);
});

app.get('/api/contracts/:contractId/versions', (req, res) => {
  const versions = store.versions
    .filter(v => v.contractId === req.params.contractId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(versions);
});

app.post('/api/contracts/:contractId/versions', (req, res) => {
  const { content, createdBy } = req.body;
  const contract = getContractById(req.params.contractId);
  if (!contract) return res.status(404).json({ error: '合同不存在' });
  
  const existingVersions = store.versions.filter(v => v.contractId === contract.id);
  const versionNo = `v${existingVersions.length + 1}.0`;
  
  const version = {
    id: `version-${uuidv4().slice(0, 8)}`,
    contractId: contract.id,
    versionNo,
    content,
    status: VERSION_STATUS.DRAFT,
    createdAt: new Date().toISOString(),
    createdBy
  };
  store.versions.push(version);
  res.status(201).json(version);
});

app.get('/api/versions/:id', (req, res) => {
  const version = getVersionById(req.params.id);
  if (version) {
    const approval = store.approvals.find(a => a.versionId === version.id);
    res.json({ ...version, approval });
  } else {
    res.status(404).json({ error: '版本不存在' });
  }
});

app.put('/api/versions/:id/submit-approval', (req, res) => {
  const version = getVersionById(req.params.id);
  if (!version) return res.status(404).json({ error: '版本不存在' });
  
  version.status = VERSION_STATUS.PENDING_APPROVAL;
  res.json(version);
});

app.put('/api/versions/:id/approve', (req, res) => {
  const { approver, comment } = req.body;
  const version = getVersionById(req.params.id);
  if (!version) return res.status(404).json({ error: '版本不存在' });
  
  version.status = VERSION_STATUS.APPROVED;
  
  const approval = {
    id: `approval-${uuidv4().slice(0, 8)}`,
    versionId: version.id,
    approver,
    result: 'approved',
    comment,
    approvedAt: new Date().toISOString()
  };
  store.approvals.push(approval);
  
  res.json({ version, approval });
});

app.put('/api/versions/:id/reject', (req, res) => {
  const { approver, comment } = req.body;
  const version = getVersionById(req.params.id);
  if (!version) return res.status(404).json({ error: '版本不存在' });
  
  version.status = VERSION_STATUS.REJECTED;
  
  const approval = {
    id: `approval-${uuidv4().slice(0, 8)}`,
    versionId: version.id,
    approver,
    result: 'rejected',
    comment,
    approvedAt: new Date().toISOString()
  };
  store.approvals.push(approval);
  
  res.json({ version, approval });
});

app.put('/api/versions/:id/obsolete', (req, res) => {
  const version = getVersionById(req.params.id);
  if (!version) return res.status(404).json({ error: '版本不存在' });
  
  version.status = VERSION_STATUS.OBSOLETE;
  res.json(version);
});

app.get('/api/stamp-requests', (req, res) => {
  const stampRequests = store.stampRequests.map(sr => {
    const contract = getContractById(sr.contractId);
    const version = getVersionById(sr.versionId);
    const delivery = store.deliveries.find(d => d.stampRequestId === sr.id);
    const archive = store.archives.find(a => a.stampRequestId === sr.id);
    
    return {
      ...sr,
      contract,
      version,
      delivery,
      archive
    };
  }).sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
  res.json(stampRequests);
});

app.get('/api/stamp-requests/pending', (req, res) => {
  const pending = store.stampRequests
    .filter(sr => sr.status === STAMP_STATUS.PENDING)
    .map(sr => {
      const contract = getContractById(sr.contractId);
      const version = getVersionById(sr.versionId);
      
      return { ...sr, contract, version };
    })
    .sort((a, b) => new Date(a.appliedAt) - new Date(b.appliedAt));
  res.json(pending);
});

app.post('/api/stamp-requests', (req, res) => {
  const { versionId, applicant } = req.body;
  
  const version = getVersionById(versionId);
  if (!version) return res.status(404).json({ error: '版本不存在' });
  
  if (!hasApproval(versionId)) {
    return res.status(400).json({ error: '该版本未通过审批，无法申请用印' });
  }
  
  if (isVersionObsolete(versionId)) {
    return res.status(400).json({ error: '该版本已作废，无法申请用印' });
  }
  
  const contract = getContractById(version.contractId);
  
  const stampedRequests = getStampRequestsByContract(contract.id);
  if (stampedRequests.some(sr => sr.status === STAMP_STATUS.STAMPED && sr.versionId !== versionId)) {
    const otherStamped = stampedRequests.find(sr => sr.status === STAMP_STATUS.STAMPED && sr.versionId !== versionId);
    const otherVersion = getVersionById(otherStamped.versionId);
    return res.status(400).json({
      error: `该合同已有其他版本已盖章（版本：${otherVersion.versionNo}），同一合同不允许重复盖章`
    });
  }
  
  const stampRequest = {
    id: `stamp-${uuidv4().slice(0, 8)}`,
    versionId,
    contractId: contract.id,
    contractNo: contract.contractNo,
    versionNo: version.versionNo,
    applicant,
    appliedAt: new Date().toISOString(),
    status: STAMP_STATUS.PENDING
  };
  store.stampRequests.push(stampRequest);
  
  res.status(201).json(stampRequest);
});

app.put('/api/stamp-requests/:id/stamp', (req, res) => {
  const { stampedBy } = req.body;
  
  const stampRequest = getStampRequestById(req.params.id);
  if (!stampRequest) return res.status(404).json({ error: '用印申请不存在' });
  
  const version = getVersionById(stampRequest.versionId);
  
  if (!hasApproval(stampRequest.versionId)) {
    return res.status(400).json({ error: '该版本未通过审批，无法盖章' });
  }
  
  if (isVersionObsolete(stampRequest.versionId)) {
    return res.status(400).json({ error: '该版本已作废，无法盖章' });
  }
  
  const contract = getContractById(stampRequest.contractId);
  const stampedRequests = getStampRequestsByContract(contract.id);
  const otherStamped = stampedRequests.find(sr => sr.id !== stampRequest.id && sr.status === STAMP_STATUS.STAMPED);
  
  if (otherStamped) {
    const otherVersion = getVersionById(otherStamped.versionId);
    return res.status(400).json({
      error: `该合同已有其他版本已盖章（版本：${otherVersion.versionNo}），同一合同不允许重复盖章`
    });
  }
  
  stampRequest.status = STAMP_STATUS.STAMPED;
  stampRequest.stampedBy = stampedBy;
  stampRequest.stampedAt = new Date().toISOString();
  
  res.json(stampRequest);
});

app.get('/api/stamp-requests/:id', (req, res) => {
  const sr = getStampRequestById(req.params.id);
  if (!sr) return res.status(404).json({ error: '用印申请不存在' });
  
  const contract = getContractById(sr.contractId);
  const version = getVersionById(sr.versionId);
  const delivery = store.deliveries.find(d => d.stampRequestId === sr.id);
  const archive = store.archives.find(a => a.stampRequestId === sr.id);
  
  res.json({ ...sr, contract, version, delivery, archive });
});

app.get('/api/stamp-history', (req, res) => {
  const history = store.stampRequests
    .filter(sr => sr.status === STAMP_STATUS.STAMPED)
    .map(sr => {
      const contract = getContractById(sr.contractId);
      const version = getVersionById(sr.versionId);
      const delivery = store.deliveries.find(d => d.stampRequestId === sr.id);
      
      return { ...sr, contract, version, delivery };
    })
    .sort((a, b) => new Date(b.stampedAt) - new Date(a.stampedAt));
  res.json(history);
});

app.post('/api/deliveries', (req, res) => {
  const { stampRequestId, recipient, address, phone, courier, trackingNo } = req.body;
  
  const stampRequest = getStampRequestById(stampRequestId);
  if (!stampRequest) return res.status(404).json({ error: '用印申请不存在' });
  
  const existing = store.deliveries.find(d => d.stampRequestId === stampRequestId);
  if (existing) {
    return res.status(400).json({ error: '该用印申请已存在寄送记录' });
  }
  
  const delivery = {
    id: `delivery-${uuidv4().slice(0, 8)}`,
    stampRequestId,
    recipient,
    address,
    phone,
    courier,
    trackingNo,
    status: DELIVERY_STATUS.PENDING,
    shippedAt: null,
    receivedAt: null
  };
  store.deliveries.push(delivery);
  
  res.status(201).json(delivery);
});

app.put('/api/deliveries/:id/ship', (req, res) => {
  const delivery = store.deliveries.find(d => d.id === req.params.id);
  if (!delivery) return res.status(404).json({ error: '寄送记录不存在' });
  
  delivery.status = DELIVERY_STATUS.SHIPPED;
  delivery.shippedAt = new Date().toISOString();
  
  res.json(delivery);
});

app.put('/api/deliveries/:id/receive', (req, res) => {
  const delivery = store.deliveries.find(d => d.id === req.params.id);
  if (!delivery) return res.status(404).json({ error: '寄送记录不存在' });
  
  delivery.status = DELIVERY_STATUS.RECEIVED;
  delivery.receivedAt = new Date().toISOString();
  
  res.json(delivery);
});

app.put('/api/deliveries/:id/update', (req, res) => {
  const delivery = store.deliveries.find(d => d.id === req.params.id);
  if (!delivery) return res.status(404).json({ error: '寄送记录不存在' });
  
  if (delivery.status !== DELIVERY_STATUS.PENDING) {
    return res.status(400).json({ error: '已寄出后不允许修改收件信息' });
  }
  
  const { recipient, address, phone } = req.body;
  if (recipient) delivery.recipient = recipient;
  if (address) delivery.address = address;
  if (phone) delivery.phone = phone;
  
  res.json(delivery);
});

app.get('/api/deliveries', (req, res) => {
  const deliveries = store.deliveries.map(d => {
    const stampRequest = getStampRequestById(d.stampRequestId);
    const contract = stampRequest ? getContractById(stampRequest.contractId) : null;
    return { ...d, stampRequest, contract };
  });
  res.json(deliveries);
});

app.post('/api/archives', (req, res) => {
  const { stampRequestId, location, archivedBy } = req.body;
  
  const stampRequest = getStampRequestById(stampRequestId);
  if (!stampRequest) return res.status(404).json({ error: '用印申请不存在' });
  
  if (stampRequest.status !== STAMP_STATUS.STAMPED) {
    return res.status(400).json({ error: '该用印申请未盖章，无法归档' });
  }
  
  const existing = store.archives.find(a => a.stampRequestId === stampRequestId);
  if (existing) {
    return res.status(400).json({ error: '该用印申请已归档' });
  }
  
  const archive = {
    id: `archive-${uuidv4().slice(0, 8)}`,
    stampRequestId,
    contractId: stampRequest.contractId,
    location,
    archivedBy,
    archivedAt: new Date().toISOString()
  };
  store.archives.push(archive);
  
  res.status(201).json(archive);
});

app.get('/api/archives', (req, res) => {
  const archives = store.archives.map(a => {
    const stampRequest = getStampRequestById(a.stampRequestId);
    const contract = stampRequest ? getContractById(stampRequest.contractId) : null;
    const version = stampRequest ? getVersionById(stampRequest.versionId) : null;
    return { ...a, stampRequest, contract, version };
  }).sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  res.json(archives);
});

app.get('/api/archive-gaps', (req, res) => {
  const stamped = store.stampRequests.filter(sr => sr.status === STAMP_STATUS.STAMPED);
  
  const gaps = stamped
    .filter(sr => !isArchived(sr.id))
    .map(sr => {
      const contract = getContractById(sr.contractId);
      const version = getVersionById(sr.versionId);
      const delivery = store.deliveries.find(d => d.stampRequestId === sr.id);
      
      return {
        stampRequestId: sr.id,
        contractNo: contract.contractNo,
        contractName: contract.name,
        counterparty: contract.counterparty,
        versionNo: version.versionNo,
        legalManagerId: contract.legalManagerId,
        legalManager: contract.legalManager,
        stampedAt: sr.stampedAt,
        stampedBy: sr.stampedBy,
        delivery,
        daysSinceStamped: Math.floor((new Date() - new Date(sr.stampedAt)) / (1000 * 60 * 60 * 24))
      };
    });
  
  res.json(gaps);
});

app.get('/api/archive-gaps/by-manager', (req, res) => {
  const gaps = [];
  store.legalManagers.forEach(lm => {
    const managerGaps = store.stampRequests
      .filter(sr => {
        if (sr.status !== STAMP_STATUS.STAMPED) return false;
        if (isArchived(sr.id)) return false;
        const contract = getContractById(sr.contractId);
        return contract && contract.legalManagerId === lm.id;
      })
      .map(sr => {
        const contract = getContractById(sr.contractId);
        const version = getVersionById(sr.versionId);
        const delivery = store.deliveries.find(d => d.stampRequestId === sr.id);
        
        return {
          stampRequestId: sr.id,
          contractNo: contract.contractNo,
          contractName: contract.name,
          counterparty: contract.counterparty,
          versionNo: version.versionNo,
          stampedAt: sr.stampedAt,
          stampedBy: sr.stampedBy,
          delivery
        };
      });
    
    if (managerGaps.length > 0) {
      gaps.push({
        legalManagerId: lm.id,
        legalManager: lm.name,
        gaps: managerGaps,
        gapCount: managerGaps.length
      });
    }
  });
  
  res.json(gaps);
});

app.get('/api/versions/compare', (req, res) => {
  const { versionId1, versionId2 } = req.query;
  const v1 = getVersionById(versionId1);
  const v2 = getVersionById(versionId2);
  
  if (!v1 || !v2) return res.status(404).json({ error: '版本不存在' });
  
  res.json({
    version1: v1,
    version2: v2
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
