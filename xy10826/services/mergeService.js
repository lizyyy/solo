const store = require('../store/dataStore');

class MergeService {
  findMatchingIdentities(identity) {
    const allIdentities = store.getExternalIdentities().filter(i => i.id !== identity.id);
    const matches = [];

    for (const candidate of allIdentities) {
      const { score, evidences } = this.calculateMatchScore(identity, candidate);
      if (score > 0) {
        matches.push({
          identity: candidate,
          matchScore: score,
          evidences
        });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  calculateMatchScore(identity1, identity2) {
    let score = 0;
    const evidences = [];

    if (identity1.email && identity2.email && 
        identity1.email.toLowerCase() === identity2.email.toLowerCase()) {
      score += 40;
      evidences.push({ type: 'email_exact', value: identity1.email, weight: 40 });
    }

    if (identity1.phone && identity2.phone && 
        this.normalizePhone(identity1.phone) === this.normalizePhone(identity2.phone)) {
      score += 35;
      evidences.push({ type: 'phone_exact', value: identity1.phone, weight: 35 });
    }

    if (identity1.name && identity2.name) {
      const nameSimilarity = this.calculateNameSimilarity(identity1.name, identity2.name);
      if (nameSimilarity >= 0.9) {
        score += 25;
        evidences.push({ type: 'name_high', value: identity1.name, weight: 25 });
      } else if (nameSimilarity >= 0.7) {
        score += 15;
        evidences.push({ type: 'name_medium', value: identity1.name, weight: 15 });
      }
    }

    if (identity1.attributes && identity2.attributes) {
      const field1 = identity1.attributes?.idCard || identity1.attributes?.身份证;
      const field2 = identity2.attributes?.idCard || identity2.attributes?.身份证;
      if (field1 && field2 && field1 === field2) {
        score += 50;
        evidences.push({ type: 'idcard_exact', value: field1, weight: 50 });
      }
    }

    return { score, evidences };
  }

  normalizePhone(phone) {
    return phone.replace(/\D/g, '');
  }

  calculateNameSimilarity(name1, name2) {
    const n1 = name1.toLowerCase().replace(/\s/g, '');
    const n2 = name2.toLowerCase().replace(/\s/g, '');
    if (n1 === n2) return 1;
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;
    let matches = 0;
    for (const char of n1) {
      if (n2.includes(char)) matches++;
    }
    return matches / Math.max(n1.length, n2.length);
  }

  initiateMerge(identityIds, reason, operator) {
    const identities = identityIds.map(id => store.getExternalIdentityById(id)).filter(Boolean);
    if (identities.length < 2) {
      throw new Error('有效的身份ID数量不足2个');
    }

    let totalScore = 0;
    const allEvidences = [];
    
    for (let i = 0; i < identities.length; i++) {
      for (let j = i + 1; j < identities.length; j++) {
        const { score, evidences } = this.calculateMatchScore(identities[i], identities[j]);
        totalScore += score;
        allEvidences.push(...evidences.map(e => ({
          ...e,
          identityIds: [identities[i].id, identities[j].id]
        })));
      }
    }

    const avgScore = totalScore / (identities.length * (identities.length - 1) / 2);

    const transaction = store.addMergeTransaction({
      identityIds,
      reason,
      operator,
      matchScore: avgScore,
      status: 'pending'
    });

    allEvidences.forEach(e => {
      store.addMergeEvidence({
        ...e,
        transactionId: transaction.id
      });
    });

    this.detectConflicts(transaction.id, identities);

    store.addAuditLog({
      action: 'initiate_merge',
      entityId: transaction.id,
      entityType: 'merge_transaction',
      operator,
      details: { identityIds, reason, matchScore: avgScore }
    });

    return transaction;
  }

  detectConflicts(transactionId, identities) {
    const fieldsToCheck = ['name', 'email', 'phone'];
    
    fieldsToCheck.forEach(field => {
      const values = identities.map(i => i[field]).filter(Boolean);
      const uniqueValues = [...new Set(values)];
      
      if (uniqueValues.length > 1) {
        store.addConflictField({
          transactionId,
          fieldName: field,
          values: uniqueValues,
          sourceIdentities: identities.filter(i => i[field]).map(i => ({
            identityId: i.id,
            value: i[field],
            source: i.source
          }))
        });
      }
    });
  }

  approveMerge(transactionId, operator) {
    const transaction = store.getMergeTransactionById(transactionId);
    if (!transaction) {
      throw new Error('合并事务不存在');
    }
    if (transaction.status !== 'pending') {
      throw new Error('只能审批待处理的合并事务');
    }

    const updated = store.updateMergeTransaction(transactionId, {
      status: 'approved',
      approvedBy: operator,
      approvedAt: new Date().toISOString()
    });

    store.addAuditLog({
      action: 'approve_merge',
      entityId: transactionId,
      entityType: 'merge_transaction',
      operator,
      details: { previousStatus: 'pending' }
    });

    return updated;
  }

  executeMerge(transactionId, operator, resolutionStrategy = 'latest') {
    const transaction = store.getMergeTransactionById(transactionId);
    if (!transaction) {
      throw new Error('合并事务不存在');
    }
    if (transaction.status !== 'approved') {
      throw new Error('只能执行已审批的合并事务');
    }

    const identities = transaction.identityIds.map(id => store.getExternalIdentityById(id)).filter(Boolean);

    const masterCustomer = store.addMasterCustomer({
      profile: this.buildMasterProfile(identities, resolutionStrategy)
    });

    const snapshot = identities.map(i => ({ ...i }));

    identities.forEach(identity => {
      store.updateExternalIdentity(identity.id, {
        masterCustomerId: masterCustomer.id
      });

      store.addImpactScope({
        transactionId,
        identityId: identity.id,
        masterCustomerId: masterCustomer.id,
        impactType: 'merged',
        description: `身份 ${identity.externalId} (${identity.source}) 已合并到主客户 ${masterCustomer.masterNumber}`,
        previousState: { masterCustomerId: identity.masterCustomerId }
      });
    });

    const updated = store.updateMergeTransaction(transactionId, {
      status: 'completed',
      masterCustomerId: masterCustomer.id,
      executedBy: operator,
      completedAt: new Date().toISOString(),
      snapshot
    });

    store.addAuditLog({
      action: 'execute_merge',
      entityId: transactionId,
      entityType: 'merge_transaction',
      operator,
      details: { masterCustomerId: masterCustomer.id, identityCount: identities.length }
    });

    return { ...updated, masterCustomer };
  }

  buildMasterProfile(identities, strategy) {
    const profile = {};
    const fields = ['name', 'email', 'phone'];

    fields.forEach(field => {
      const values = identities.map(i => ({ value: i[field], date: i.createdAt }))
        .filter(v => v.value);
      
      if (values.length > 0) {
        if (strategy === 'latest') {
          values.sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        profile[field] = values[0].value;
      }
    });

    profile.sources = [...new Set(identities.map(i => i.source))];
    profile.identityCount = identities.length;
    profile.firstSeen = identities.reduce((min, i) => 
      new Date(i.createdAt) < new Date(min) ? i.createdAt : min, identities[0].createdAt);
    profile.lastSeen = identities.reduce((max, i) => 
      new Date(i.createdAt) > new Date(max) ? i.createdAt : max, identities[0].createdAt);

    return profile;
  }

  undoMerge(transactionId, operator, reason) {
    const transaction = store.getMergeTransactionById(transactionId);
    if (!transaction) {
      throw new Error('合并事务不存在');
    }
    if (transaction.status !== 'completed') {
      throw new Error('只能撤销已完成的合并事务');
    }

    const impacts = store.getImpactScopes({ transactionId });

    impacts.forEach(impact => {
      if (impact.previousState) {
        store.updateExternalIdentity(impact.identityId, {
          masterCustomerId: impact.previousState.masterCustomerId
        });
      }
    });

    if (transaction.masterCustomerId) {
      store.updateMasterCustomer(transaction.masterCustomerId, {
        status: 'reverted'
      });
    }

    const updated = store.updateMergeTransaction(transactionId, {
      status: 'undone',
      undoneBy: operator,
      undoneAt: new Date().toISOString(),
      undoReason: reason
    });

    store.addUndoRecord({
      transactionId,
      operator,
      reason,
      snapshot: transaction.snapshot,
      restoredIdentities: impacts.map(i => i.identityId)
    });

    store.addAuditLog({
      action: 'undo_merge',
      entityId: transactionId,
      entityType: 'merge_transaction',
      operator,
      details: { reason, restoredIdentityCount: impacts.length }
    });

    return updated;
  }

  resolveConflict(conflictId, resolution, operator) {
    const conflict = store.updateConflictField(conflictId, {
      resolved: true,
      resolution,
      resolvedBy: operator
    });

    if (!conflict) {
      throw new Error('冲突不存在');
    }

    store.addAuditLog({
      action: 'resolve_conflict',
      entityId: conflictId,
      entityType: 'conflict_field',
      operator,
      details: { fieldName: conflict.fieldName, resolution }
    });

    return conflict;
  }
}

module.exports = new MergeService();