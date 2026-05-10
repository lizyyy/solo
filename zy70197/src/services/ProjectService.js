const Project = require('../models/Project');
const Agreement = require('../models/Agreement');

class ProjectService {
  static createProject({ name, agreementId }) {
    if (!name || !agreementId) {
      throw new Error('项目名称和协议ID为必填项');
    }
    
    const agreement = Agreement.findById(agreementId);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    if (agreement.status !== 'active') {
      throw new Error('协议状态无效');
    }
    
    return Project.create({ name, agreementId });
  }

  static getProject(id) {
    const project = Project.findById(id);
    if (!project) {
      throw new Error('项目不存在');
    }
    
    const available = Project.getAvailableAmount(id);
    return {
      ...project,
      available_amount: available
    };
  }

  static getAllProjects() {
    const projects = Project.findAll();
    return projects.map(project => ({
      ...project,
      available_amount: Project.getAvailableAmount(project.id)
    }));
  }

  static getProjectsByAgreement(agreementId) {
    const projects = Project.findByAgreementId(agreementId);
    return projects.map(project => ({
      ...project,
      available_amount: Project.getAvailableAmount(project.id)
    }));
  }
}

module.exports = ProjectService;
