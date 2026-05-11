const { v4: uuidv4 } = require('uuid');
const { addDays, format } = require('date-fns');
const store = require('../storage/store');
const checker = require('./checker');

class WaiverManager {
  addWaiver(problemId, reason, expiresInDays = 7) {
    const allProblems = store.getAllProblems();
    const problem = allProblems.find(p => p.id === problemId);

    if (!problem) {
      return { success: false, error: 'Problem not found' };
    }

    const expiresAt = addDays(new Date(), expiresInDays).toISOString();

    const waiver = {
      id: uuidv4(),
      problemId: problemId,
      materialId: problem.materialId,
      problemType: problem.type,
      reason: reason,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt,
      grantedBy: 'cli_user'
    };

    store.addWaiver(waiver);
    const result = checker.run();

    return {
      success: true,
      waiver,
      checkResult: result
    };
  }

  getActiveWaivers() {
    const waivers = store.getAllWaivers();
    const now = new Date();

    return waivers.filter(w => new Date(w.expiresAt) > now);
  }

  getExpiredWaivers() {
    const waivers = store.getAllWaivers();
    const now = new Date();

    return waivers.filter(w => new Date(w.expiresAt) <= now);
  }

  listWaivers(options = {}) {
    const materials = store.getAllMaterials();
    const problems = store.getAllProblems();
    const waivers = store.getAllWaivers();

    const materialMap = new Map(materials.map(m => [m.id, m]));
    const problemMap = new Map(problems.map(p => [p.id, p]));

    return waivers.map(waiver => {
      const material = materialMap.get(waiver.materialId);
      const problem = problemMap.get(waiver.problemId);
      const now = new Date();
      const isExpired = new Date(waiver.expiresAt) <= now;

      return {
        ...waiver,
        materialTitle: material?.title || '',
        materialAuthor: material?.author || '',
        problemTitle: problem?.title || '',
        isExpired,
        formattedExpiresAt: format(new Date(waiver.expiresAt), 'yyyy-MM-dd HH:mm'),
        daysRemaining: isExpired ? 0 : Math.ceil((new Date(waiver.expiresAt) - now) / (1000 * 60 * 60 * 24))
      };
    });
  }
}

module.exports = new WaiverManager();