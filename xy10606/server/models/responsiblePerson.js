const { run, get, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

async function getAllResponsiblePersons() {
  return await all('SELECT * FROM responsible_persons ORDER BY name');
}

async function getResponsiblePersonById(id) {
  return await get('SELECT * FROM responsible_persons WHERE id = ?', [id]);
}

async function createResponsiblePerson(name, role) {
  const id = uuidv4();
  await run('INSERT INTO responsible_persons (id, name, role) VALUES (?, ?, ?)', [id, name, role]);
  return await getResponsiblePersonById(id);
}

module.exports = {
  getAllResponsiblePersons,
  getResponsiblePersonById,
  createResponsiblePerson
};
