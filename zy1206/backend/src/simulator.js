const db = require('./database');
const utils = require('./utils');

class ConsistencySimulator {
  constructor() {
    this.experiments = new Map();
    this.eventOrder = 0;
  }

  async createExperiment(name, consistencyModel, config = {}) {
    const id = utils.generateId();
    const seed = utils.generateSeed();
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO experiments (id, name, consistency_model, seed, config) VALUES (?, ?, ?, ?, ?)',
        [id, name, consistencyModel, seed, utils.stringifyJSON(config)],
        function(err) {
          if (err) reject(err);
          else resolve({ id, name, consistencyModel, seed, config });
        }
      );
    });
  }

  async getExperiment(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM experiments WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Experiment not found'));
        else resolve({
          ...row,
          config: utils.parseJSON(row.config)
        });
      });
    });
  }

  async getAllExperiments() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM experiments ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          config: utils.parseJSON(row.config)
        })));
      });
    });
  }

  async createNode(experimentId, name, role = 'follower') {
    const id = utils.generateId();
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO nodes (id, experiment_id, name, role, data) VALUES (?, ?, ?, ?, ?)',
        [id, experimentId, name, role, '{}'],
        function(err) {
          if (err) reject(err);
          else resolve({ id, experimentId, name, role, data: {} });
        }
      );
    });
  }

  async getNodes(experimentId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM nodes WHERE experiment_id = ?', [experimentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          data: utils.parseJSON(row.data)
        })));
      });
    });
  }

  async updateNodeStatus(nodeId, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE nodes SET status = ?, updated_at = ? WHERE id = ?',
        [status, utils.currentTimestamp(), nodeId],
        function(err) {
          if (err) reject(err);
          else resolve({ nodeId, status });
        }
      );
    });
  }

  async updateNodeData(nodeId, key, value) {
    const node = await this.getNodeById(nodeId);
    const data = utils.parseJSON(node.data);
    data[key] = value;
    
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE nodes SET data = ?, updated_at = ? WHERE id = ?',
        [utils.stringifyJSON(data), utils.currentTimestamp(), nodeId],
        function(err) {
          if (err) reject(err);
          else resolve({ nodeId, data });
        }
      );
    });
  }

  async getNodeById(nodeId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM nodes WHERE id = ?', [nodeId], (err, row) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Node not found'));
        else resolve({
          ...row,
          data: utils.parseJSON(row.data)
        });
      });
    });
  }

  async createPartition(experimentId, name, nodeIds) {
    const id = utils.generateId();
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO partitions (id, experiment_id, name, nodes) VALUES (?, ?, ?, ?)',
        [id, experimentId, name, JSON.stringify(nodeIds)],
        function(err) {
          if (err) reject(err);
          else resolve({ id, experimentId, name, nodes: nodeIds, isIsolated: false });
        }
      );
    });
  }

  async isolatePartition(partitionId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE partitions SET is_isolated = 1 WHERE id = ?',
        [partitionId],
        function(err) {
          if (err) reject(err);
          else resolve({ partitionId, isIsolated: true });
        }
      );
    });
  }

  async restorePartition(partitionId) {
    return new Promise((resolve, reject) => {
      db.run.run('UPDATE partitions SET is_isolated = 0 WHERE id = ?',
        [partitionId],
        function(err) {
          if (err) reject(err);
          else resolve({ partitionId, isIsolated: false });
        }
      );
    });
  }

  async addLog(experimentId, nodeId, level, message, details = {}) {
    const id = utils.generateId();
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO node_logs (id, experiment_id, node_id, log_level, message, details) VALUES (?, ?, ?, ?, ?, ?)',
        [id, experimentId, nodeId, level, message, utils.stringifyJSON(details)],
        function(err) {
          if (err) reject(err);
          else resolve({ id, experimentId, nodeId, level, message, details });
        }
      );
    });
  }

  async addTimelineEvent(experimentId, eventType, nodeId = null, details = {}) {
    const id = utils.generateId();
    this.eventOrder++;
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO timeline_events (id, experiment_id, event_type, node_id, details, order_index) VALUES (?, ?, ?, ?, ?, ?)',
        [id, experimentId, eventType, nodeId, utils.stringifyJSON(details), this.eventOrder],
        function(err) {
          if (err) reject(err);
          else resolve({ id, experimentId, eventType, nodeId, details, orderIndex: this.eventOrder });
        }
      );
    });
  }

  async simulateWrite(experimentId, key, value, consistencyModel) {
    const nodes = await this.getNodes(experimentId);
    const activeNodes = nodes.filter(n => n.status === 'active');
    
    if (activeNodes.length === 0) {
      throw new Error('No active nodes available');
    }

    await this.addTimelineEvent(experimentId, 'WRITE_START', null, { key, value, consistencyModel });

    let result;
    switch (consistencyModel) {
      case 'strong':
        result = await this.simulateStrongConsistencyWrite(experimentId, key, value, activeNodes);
        break;
      case 'eventual':
        result = await this.simulateEventualConsistencyWrite(experimentId, key, value, activeNodes);
        break;
      case 'raft':
        result = await this.simulateRaftWrite(experimentId, key, value, activeNodes);
        break;
      case 'paxos':
        result = await this.simulatePaxosWrite(experimentId, key, value, activeNodes);
        break;
      default:
        throw new Error(`Unknown consistency model: ${consistencyModel}`);
    }

    await this.addTimelineEvent(experimentId, 'WRITE_COMPLETE', null, { key, value, result });
    
    return result;
  }

  async simulateStrongConsistencyWrite(experimentId, key, value, nodes) {
    await this.addLog(experimentId, null, 'INFO', '开始强一致性写入', { key, value });
    
    for (const node of nodes) {
      await this.updateNodeData(node.id, key, value);
      await this.addLog(experimentId, node.id, 'INFO', `节点 ${node.name} 写入成功`, { key, value });
      await this.addTimelineEvent(experimentId, 'NODE_WRITE', node.id, { key, value });
    }

    return {
      success: true,
      consistencyModel: 'strong',
      nodesWritten: nodes.length,
      message: '强一致性写入：所有节点已同步'
    };
  }

  async simulateEventualConsistencyWrite(experimentId, key, value, nodes) {
    await this.addLog(experimentId, null, 'INFO', '开始最终一致性写入', { key, value });
    
    const primaryNode = nodes[0];
    await this.updateNodeData(primaryNode.id, key, value);
    await this.addLog(experimentId, primaryNode.id, 'INFO', `主节点 ${primaryNode.name} 写入成功`, { key, value });
    await this.addTimelineEvent(experimentId, 'NODE_WRITE', primaryNode.id, { key, value, isPrimary: true });

    for (let i = 1; i < nodes.length; i++) {
      await this.addLog(experimentId, nodes[i].id, 'WARN', `节点 ${nodes[i].name} 尚未同步（异步复制中）`, { key });
    }

    return {
      success: true,
      consistencyModel: 'eventual',
      nodesWritten: 1,
      totalNodes: nodes.length,
      message: '最终一致性写入：主节点已写入，副本将异步同步',
      risk: '存在短时间内读取到旧值的风险'
    };
  }

  async simulateRaftWrite(experimentId, key, value, nodes) {
    await this.addLog(experimentId, null, 'INFO', '开始 Raft 一致性写入', { key, value });
    
    let leader = nodes.find(n => n.role === 'leader');
    if (!leader) {
      await this.addLog(experimentId, null, 'INFO', '未找到 Leader，开始选举');
      leader = await this.simulateRaftElection(experimentId, nodes);
    }

    await this.addLog(experimentId, leader.id, 'INFO', `Leader ${leader.name} 接收写入请求`, { key, value });
    await this.addTimelineEvent(experimentId, 'RAFT_LEADER_RECEIVE', leader.id, { key, value });

    const majority = utils.getMajorityCount(nodes.length);
    let ackCount = 1;

    await this.updateNodeData(leader.id, key, value);

    for (const node of nodes) {
      if (node.id === leader.id) continue;
      
      await this.addLog(experimentId, node.id, 'INFO', `节点 ${node.name} 收到 Leader 的 AppendEntries RPC`, { key, value });
      await this.updateNodeData(node.id, key, value);
      ackCount++;
      
      await this.addLog(experimentId, node.id, 'INFO', `节点 ${node.name} 确认写入`, { key });
      await this.addTimelineEvent(experimentId, 'RAFT_FOLLOWER_ACK', node.id, { key });
    }

    const committed = ackCount >= majority;
    
    await this.addLog(experimentId, leader.id, 
      committed ? 'INFO' : 'WARN', 
      committed ? `已达成多数确认 (${ackCount}/${nodes.length})，提交成功` : `未达成多数 (${ackCount}/${nodes.length})`,
      { key, ackCount, total: nodes.length, majority }
    );

    await this.addTimelineEvent(experimentId, 'RAFT_COMMIT', leader.id, { key, committed, ackCount, majority });

    return {
      success: committed,
      consistencyModel: 'raft',
      leader: leader.name,
      ackCount,
      majority,
      totalNodes: nodes.length,
      message: committed ? 'Raft 写入：已达成多数确认并提交' : 'Raft 写入：未达成多数，写入未提交',
      risk: !committed ? '存在数据丢失风险' : null
    };
  }

  async simulateRaftElection(experimentId, nodes) {
    const candidate = nodes[Math.floor(Math.random() * nodes.length)];
    const newTerm = (candidate.term || 0) + 1;

    await this.addLog(experimentId, candidate.id, 'INFO', `节点 ${candidate.name} 发起选举，任期 ${newTerm}`);
    await this.addTimelineEvent(experimentId, 'RAFT_ELECTION_START', candidate.id, { term: newTerm });

    const majority = utils.getMajorityCount(nodes.length);
    let votes = 1;

    for (const node of nodes) {
      if (node.id === candidate.id) continue;
      
      const voteGranted = Math.random() > 0.1;
      
      await this.addLog(experimentId, node.id, voteGranted ? 'INFO' : 'WARN', 
        `节点 ${node.name} ${voteGranted ? '投票给' : '拒绝投票给'} ${candidate.name}`,
        { term: newTerm, voteGranted }
      );

      const voteId = utils.generateId();
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO votes (id, experiment_id, term, candidate_id, voter_id, granted) VALUES (?, ?, ?, ?, ?, ?)',
          [voteId, experimentId, newTerm, candidate.id, node.id, voteGranted ? 1 : 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      if (voteGranted) votes++;
    }

    const elected = votes >= majority;
    
    if (elected) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE nodes SET role = "follower" WHERE experiment_id = ?', [experimentId], function(err) {
          if (err) reject(err);
          else {
            db.run('UPDATE nodes SET role = "leader", term = ? WHERE id = ?', [newTerm, candidate.id], function(err2) {
              if (err2) reject(err2);
              else resolve();
            });
          }
        });
      });

      await this.addLog(experimentId, candidate.id, 'INFO', 
        `节点 ${candidate.name} 当选 Leader，任期 ${newTerm}`,
        { votes, majority }
      );
      await this.addTimelineEvent(experimentId, 'RAFT_LEADER_ELECTED', candidate.id, { term: newTerm, votes, majority });
    } else {
      await this.addLog(experimentId, candidate.id, 'WARN', 
        `选举失败，票数不足 (${votes}/${majority})`,
        { votes, majority }
      );
    }

    return elected ? { ...candidate, role: 'leader', term: newTerm } : null;
  }

  async simulatePaxosWrite(experimentId, key, value, nodes) {
    await this.addLog(experimentId, null, 'INFO', '开始 Paxos 一致性写入', { key, value });
    
    const proposer = nodes[Math.floor(Math.random() * nodes.length)];
    const proposalNumber = Date.now();

    await this.addLog(experimentId, proposer.id, 'INFO', `Proposer ${proposer.name} 发起 Prepare 请求`, { proposalNumber });
    await this.addTimelineEvent(experimentId, 'PAXOS_PREPARE', proposer.id, { proposalNumber, key, value });

    const majority = utils.getMajorityCount(nodes.length);
    let preparePromises = 0;

    for (const node of nodes) {
      const promised = Math.random() > 0.05;
      
      await this.addLog(experimentId, node.id, promised ? 'INFO' : 'WARN',
        `节点 ${node.name} ${promised ? '承诺' : '拒绝'} Prepare 请求`,
        { proposalNumber, promised }
      );

      if (promised) preparePromises++;
    }

    if (preparePromises < majority) {
      await this.addLog(experimentId, proposer.id, 'WARN', 
        `Prepare 阶段失败，未达成多数承诺 (${preparePromises}/${majority})`
      );
      return {
        success: false,
        consistencyModel: 'paxos',
        phase: 'prepare',
        promises: preparePromises,
        majority,
        message: 'Paxos Prepare 阶段失败'
      };
    }

    await this.addLog(experimentId, proposer.id, 'INFO', 
      `Prepare 阶段成功 (${preparePromises}/${majority})，开始 Accept 阶段`,
      { key, value }
    );
    await this.addTimelineEvent(experimentId, 'PAXOS_ACCEPT', proposer.id, { proposalNumber, key, value });

    let acceptances = 0;
    for (const node of nodes) {
      const accepted = Math.random() > 0.05;
      
      await this.addLog(experimentId, node.id, accepted ? 'INFO' : 'WARN',
        `节点 ${node.name} ${accepted ? '接受' : '拒绝'} Accept 请求`,
        { proposalNumber, accepted, key, value }
      );

      if (accepted) {
        await this.updateNodeData(node.id, key, value);
        acceptances++;
      }
    }

    const chosen = acceptances >= majority;
    
    const proposalId = utils.generateId();
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO proposals (id, experiment_id, term, proposer_id, proposal_number, value, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [proposalId, experimentId, 1, proposer.id, proposalNumber, value, chosen ? 'chosen' : 'failed'],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    if (chosen) {
      await this.addLog(experimentId, proposer.id, 'INFO', 
        `Paxos 提案已被选定 (${acceptances}/${majority})`,
        { key, value }
      );
      await this.addTimelineEvent(experimentId, 'PAXOS_CHOSEN', proposer.id, { proposalNumber, key, value, acceptances, majority });
    } else {
      await this.addLog(experimentId, proposer.id, 'WARN', 
        `Accept 阶段失败 (${acceptances}/${majority})`,
        { key }
      );
    }

    return {
      success: chosen,
      consistencyModel: 'paxos',
      proposer: proposer.name,
      proposalNumber,
      preparePromises,
      acceptances,
      majority,
      totalNodes: nodes.length,
      message: chosen ? 'Paxos 写入：提案已被选定' : 'Paxos 写入：提案未被选定',
      risk: !chosen ? '需要重新提案' : null
    };
  }

  async simulateLeaderFailure(experimentId) {
    const nodes = await this.getNodes(experimentId);
    const leader = nodes.find(n => n.role === 'leader');

    if (!leader) {
      return { success: false, message: 'No leader found' };
    }

    await this.updateNodeStatus(leader.id, 'down');
    await this.addLog(experimentId, leader.id, 'ERROR', `Leader ${leader.name} 宕机`, { role: 'leader' });
    await this.addTimelineEvent(experimentId, 'LEADER_FAILURE', leader.id, { nodeName: leader.name });

    return {
      success: true,
      failedNode: leader.name,
      message: `Leader ${leader.name} 已模拟宕机`,
      nextStep: '需要重新选举 Leader'
    };
  }

  async simulateLockAcquire(experimentId, lockKey, nodeId, timeout = 10000) {
    const node = await this.getNodeById(nodeId);
    
    const existingLock = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM lock_records WHERE experiment_id = ? AND lock_key = ? AND released_at IS NULL',
        [experimentId, lockKey],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingLock) {
      const now = Date.now();
      const expiresAt = new Date(existingLock.expires_at).getTime();
      
      if (now < expiresAt) {
        await this.addLog(experimentId, nodeId, 'WARN', 
          `尝试获取锁 ${lockKey} 失败，已被其他节点持有`,
          { holderId: existingLock.holder_id }
        );
        return {
          success: false,
          lockKey,
          holderId: existingLock.holder_id,
          message: '锁已被其他节点持有'
        };
      } else {
        await this.addLog(experimentId, existingLock.holder_id, 'WARN', 
          `锁 ${lockKey} 已超时，自动释放`,
          { timeout }
        );
        
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE lock_records SET released_at = ? WHERE id = ?',
            [utils.currentTimestamp(), existingLock.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }

    const lockId = utils.generateId();
    const now = utils.currentTimestamp();
    const expiresAt = new Date(Date.now() + timeout).toISOString();

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO lock_records (id, experiment_id, lock_key, holder_id, acquired_at, expires_at, timeout) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [lockId, experimentId, lockKey, nodeId, now, expiresAt, timeout],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await this.addLog(experimentId, nodeId, 'INFO', 
      `成功获取锁 ${lockKey}`,
      { timeout, expiresAt }
    );
    await this.addTimelineEvent(experimentId, 'LOCK_ACQUIRED', nodeId, { lockKey, timeout, expiresAt });

    return {
      success: true,
      lockId,
      lockKey,
      holderId: nodeId,
      holderName: node.name,
      acquiredAt: now,
      expiresAt,
      timeout,
      message: `成功获取分布式锁 ${lockKey}`
    };
  }

  async simulateLockRelease(experimentId, lockKey, nodeId) {
    const lock = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM lock_records WHERE experiment_id = ? AND lock_key = ? AND holder_id = ? AND released_at IS NULL',
        [experimentId, lockKey, nodeId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!lock) {
      return {
        success: false,
        message: '未找到该节点持有的锁'
      };
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE lock_records SET released_at = ? WHERE id = ?',
        [utils.currentTimestamp(), lock.id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    await this.addLog(experimentId, nodeId, 'INFO', `释放锁 ${lockKey}`);
    await this.addTimelineEvent(experimentId, 'LOCK_RELEASED', nodeId, { lockKey });

    return {
      success: true,
      lockKey,
      message: `成功释放锁 ${lockKey}`
    };
  }

  async simulateStaleRead(experimentId, key, nodeId) {
    const node = await this.getNodeById(nodeId);
    const nodes = await this.getNodes(experimentId);
    
    const nodeValue = node.data[key];
    
    let latestValue = nodeValue;
    for (const n of nodes) {
      if (n.data[key] !== undefined) {
        if (latestValue === undefined || 
            (typeof n.data[key] === 'number' && n.data[key] > latestValue) ||
            (typeof n.data[key] === 'string' && n.data[key] > latestValue)) {
          latestValue = n.data[key];
        }
      }
    }

    const isStale = nodeValue !== latestValue && latestValue !== undefined;

    if (isStale) {
      const staleReadId = utils.generateId();
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO stale_reads (id, experiment_id, node_id, key, read_value, latest_value) VALUES (?, ?, ?, ?, ?, ?)',
          [staleReadId, experimentId, nodeId, key, JSON.stringify(nodeValue), JSON.stringify(latestValue)],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.addLog(experimentId, nodeId, 'WARN', 
        `检测到脏读：读取到旧值`,
        { key, readValue: nodeValue, latestValue }
      );
      await this.addTimelineEvent(experimentId, 'STALE_READ', nodeId, { key, readValue: nodeValue, latestValue });
    }

    return {
      isStale,
      key,
      nodeName: node.name,
      readValue: nodeValue,
      latestValue,
      message: isStale 
        ? `脏读检测：节点 ${node.name} 读取到旧值 ${nodeValue}，最新值为 ${latestValue}`
        : `节点 ${node.name} 读取的值 ${nodeValue} 是最新的`
    };
  }

  async getTimeline(experimentId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM timeline_events WHERE experiment_id = ? ORDER BY order_index ASC',
        [experimentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...row,
            details: utils.parseJSON(row.details)
          })));
        }
      );
    });
  }

  async getNodeLogs(experimentId, nodeId = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM node_logs WHERE experiment_id = ?';
      let params = [experimentId];
      
      if (nodeId) {
        query += ' AND node_id = ?';
        params.push(nodeId);
      }
      
      query += ' ORDER BY timestamp ASC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          details: utils.parseJSON(row.details)
        })));
      });
    });
  }

  async generateReport(experimentId, format = 'json') {
    const experiment = await this.getExperiment(experimentId);
    const nodes = await this.getNodes(experimentId);
    const timeline = await this.getTimeline(experimentId);
    const logs = await this.getNodeLogs(experimentId);
    
    const staleReads = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM stale_reads WHERE experiment_id = ?', [experimentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const lockRecords = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM lock_records WHERE experiment_id = ?', [experimentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const votes = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM votes WHERE experiment_id = ?', [experimentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const proposals = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM proposals WHERE experiment_id = ?', [experimentId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const report = {
      experiment: {
        id: experiment.id,
        name: experiment.name,
        consistencyModel: experiment.consistency_model,
        seed: experiment.seed,
        createdAt: experiment.created_at,
        config: experiment.config
      },
      summary: {
        totalNodes: nodes.length,
        activeNodes: nodes.filter(n => n.status === 'active').length,
        timelineEvents: timeline.length,
        logEntries: logs.length,
        staleReads: staleReads.length,
        lockOperations: lockRecords.length,
        votes: votes.length,
        proposals: proposals.length
      },
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.name,
        role: n.role,
        status: n.status,
        term: n.term,
        data: n.data
      })),
      timeline: timeline,
      risks: this.analyzeRisks(experiment, nodes, staleReads, timeline),
      seedData: this.generateSeedData(experiment),
      anomalyTips: this.generateAnomalyTips(experiment, staleReads, lockRecords, timeline)
    };

    if (format === 'markdown') {
      return this.generateMarkdownReport(report);
    }

    return report;
  }

  analyzeRisks(experiment, nodes, staleReads, timeline) {
    const risks = [];
    
    if (staleReads.length > 0) {
      risks.push({
        type: 'stale_read',
        severity: 'high',
        description: `检测到 ${staleReads.length} 次脏读`,
        explanation: '在最终一致性模型下，副本同步存在延迟，可能读取到旧值。'
      });
    }

    const leaderFailures = timeline.filter(e => e.event_type === 'LEADER_FAILURE').length;
    if (leaderFailures > 0) {
      risks.push({
        type: 'leader_failure',
        severity: 'medium',
        description: `发生 ${leaderFailures} 次 Leader 宕机`,
        explanation: 'Leader 宕机后需要重新选举，期间系统不可写入。'
      });
    }

    const activeNodes = nodes.filter(n => n.status === 'active').length;
    const majority = Math.floor(nodes.length / 2) + 1;
    if (activeNodes < majority) {
      risks.push({
        type: 'insufficient_nodes',
        severity: 'critical',
        description: `活跃节点不足（${activeNodes}/${nodes.length}），无法达成多数`,
        explanation: `需要至少 ${majority} 个节点才能达成共识。`
      });
    }

    return risks;
  }

  generateSeedData(experiment) {
    return {
      seed: experiment.seed,
      consistencyModel: experiment.consistency_model,
      recommendedScenarios: [
        {
          name: '网络分区演练',
          description: '将节点分为两个分区，观察一致性表现'
        },
        {
          name: 'Leader 宕机演练',
          description: '模拟 Leader 宕机，观察选举过程'
        },
        {
          name: '锁超时演练',
          description: '获取锁后不释放，观察超时机制'
        },
        {
          name: '脏读演练',
          description: '在最终一致性模型下，观察脏读现象'
        }
      ]
    };
  }

  generateAnomalyTips(experiment, staleReads, lockRecords, timeline) {
    const tips = [];
    
    if (experiment.consistency_model === 'eventual') {
      tips.push({
        type: 'consistency',
        title: '最终一致性注意事项',
        content: '最终一致性系统中，写入后立即读取可能返回旧值。建议使用读取修复或版本号机制。'
      });
    }

    if (staleReads.length > 0) {
      tips.push({
        type: 'stale_read',
        title: '脏读处理建议',
        content: '如果业务不能接受脏读，考虑使用强一致性或 Read-your-writes 一致性级别。'
      });
    }

    const activeLocks = lockRecords.filter(l => !l.released_at);
    if (activeLocks.length > 0) {
      tips.push({
        type: 'lock',
        title: '锁使用注意事项',
        content: `检测到 ${activeLocks.length} 个活跃锁。确保业务逻辑中正确释放锁，或设置合理的超时时间。`
      });
    }

    return tips;
  }

  generateMarkdownReport(report) {
    let md = `# 分布式一致性演练报告\n\n`;
    
    md += `## 实验概览\n\n`;
    md += `- **实验名称**: ${report.experiment.name}\n`;
    md += `- **一致性模型**: ${report.experiment.consistencyModel}\n`;
    md += `- **实验 Seed**: \`${report.experiment.seed}\`\n`;
    md += `- **创建时间**: ${report.experiment.createdAt}\n\n`;

    md += `## 统计摘要\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总节点数 | ${report.summary.totalNodes} |\n`;
    md += `| 活跃节点 | ${report.summary.activeNodes} |\n`;
    md += `| 时间线事件 | ${report.summary.timelineEvents} |\n`;
    md += `| 日志条目 | ${report.summary.logEntries} |\n`;
    md += `| 脏读次数 | ${report.summary.staleReads} |\n`;
    md += `| 锁操作 | ${report.summary.lockOperations} |\n\n`;

    md += `## 节点状态\n\n`;
    report.nodes.forEach(node => {
      md += `### ${node.name}\n`;
      md += `- **角色**: ${node.role}\n`;
      md += `- **状态**: ${node.status}\n`;
      md += `- **任期**: ${node.term}\n`;
      md += `- **数据**: \`${JSON.stringify(node.data)}\`\n\n`;
    });

    if (report.risks.length > 0) {
      md += `## 风险分析\n\n`;
      report.risks.forEach(risk => {
        md += `### [${risk.severity.toUpperCase()}] ${risk.type}\n`;
        md += `**描述**: ${risk.description}\n\n`;
        md += `**解释**: ${risk.explanation}\n\n`;
      });
    }

    md += `## Seed 数据\n\n`;
    md += `\`\`\`json\n${JSON.stringify(report.seedData, null, 2)}\n\`\`\`\n\n`;

    if (report.anomalyTips.length > 0) {
      md += `## 异常配置提示\n\n`;
      report.anomalyTips.forEach(tip => {
        md += `### ${tip.title}\n`;
        md += `${tip.content}\n\n`;
      });
    }

    md += `## 时间线\n\n`;
    report.timeline.forEach(event => {
      md += `- **${event.timestamp}** [${event.event_type}] ${event.node_id ? `节点 ${event.node_id}` : '系统'}: ${JSON.stringify(event.details)}\n`;
    });

    return md;
  }
}

module.exports = new ConsistencySimulator();
