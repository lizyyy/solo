const { readData, writeData } = require('../utils/storage');
const { generateId } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

function createTeam(teamData) {
  const teams = readData('teams');
  
  const existingTeam = teams.find(t => 
    t.name === teamData.name || t.code === teamData.code
  );

  if (existingTeam) {
    return {
      success: false,
      isDuplicate: true,
      existingTeam,
      message: '班组名称或编码已存在'
    };
  }

  const id = generateId();
  const now = new Date();

  const team = {
    id,
    name: teamData.name,
    code: teamData.code,
    leader: teamData.leader || '',
    phone: teamData.phone || '',
    createdAt: now.toISOString()
  };

  teams.push(team);
  writeData('teams', teams);

  logAudit('create', 'team', id, team);

  return {
    success: true,
    team
  };
}

function getTeamById(teamId) {
  const teams = readData('teams');
  return teams.find(t => t.id === teamId);
}

function getAllTeams() {
  return readData('teams');
}

module.exports = {
  createTeam,
  getTeamById,
  getAllTeams
};
