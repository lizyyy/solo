class MemoryStore {
  constructor() {
    this.contracts = new Map();
    this.contractVersions = new Map();
    this.taxRules = new Map();
    this.approvalRequests = new Map();
  }

  saveContract(contract) {
    this.contracts.set(contract.id, contract);
    return contract;
  }

  getContractById(id) {
    return this.contracts.get(id) || null;
  }

  getContractByNo(contractNo) {
    for (const contract of this.contracts.values()) {
      if (contract.contractNo === contractNo) {
        return contract;
      }
    }
    return null;
  }

  getAllContracts() {
    return Array.from(this.contracts.values());
  }

  saveContractVersion(version) {
    this.contractVersions.set(version.id, version);
    return version;
  }

  getContractVersionById(id) {
    return this.contractVersions.get(id) || null;
  }

  getVersionsByContractId(contractId) {
    const versions = Array.from(this.contractVersions.values())
      .filter(v => v.contractId === contractId)
      .sort((a, b) => a.versionNo - b.versionNo);
    return versions;
  }

  getLatestVersionByContractId(contractId) {
    const versions = this.getVersionsByContractId(contractId);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  getNextVersionNumber(contractId) {
    const versions = this.getVersionsByContractId(contractId);
    return versions.length + 1;
  }

  saveTaxRule(rule) {
    this.taxRules.set(rule.id, rule);
    return rule;
  }

  getTaxRuleById(id) {
    return this.taxRules.get(id) || null;
  }

  getTaxRuleByCode(code) {
    for (const rule of this.taxRules.values()) {
      if (rule.code === code) {
        return rule;
      }
    }
    return null;
  }

  getAllTaxRules() {
    return Array.from(this.taxRules.values());
  }

  saveApprovalRequest(request) {
    this.approvalRequests.set(request.id, request);
    return request;
  }

  getApprovalRequestById(id) {
    return this.approvalRequests.get(id) || null;
  }

  getApprovalRequestsByContractId(contractId) {
    return Array.from(this.approvalRequests.values())
      .filter(r => r.contractId === contractId)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  }

  getApprovalRequestsByVersionId(versionId) {
    return Array.from(this.approvalRequests.values())
      .filter(r => r.contractVersionId === versionId);
  }

  clearAll() {
    this.contracts.clear();
    this.contractVersions.clear();
    this.taxRules.clear();
    this.approvalRequests.clear();
  }
}

module.exports = new MemoryStore();
