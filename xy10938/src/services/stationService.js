const { runQuery, getOne, getAll } = require('../db');
const appConfig = require('../../config/app');

function createStation(data) {
  const { name } = data;

  if (!name) {
    throw { status: 400, message: '工位名称不能为空', conclusion: '必填参数缺失' };
  }

  const lastStation = getOne(`SELECT station_no FROM stations ORDER BY id DESC LIMIT 1`);
  let seq = 1;
  if (lastStation) {
    const match = lastStation.station_no.match(/S(\d{3})/);
    if (match) {
      seq = parseInt(match[1]) + 1;
    }
  }
  const stationNo = `S${String(seq).padStart(3, '0')}`;

  const result = runQuery(
    `INSERT INTO stations (station_no, name, status) VALUES (?, ?, '空闲')`,
    [stationNo, name]
  );

  return getOne(`SELECT * FROM stations WHERE id = ?`, [result.lastInsertRowid]);
}

function getStationList() {
  return getAll(`SELECT * FROM stations ORDER BY station_no ASC`);
}

function getStationById(id) {
  return getOne(`SELECT * FROM stations WHERE id = ?`, [id]);
}

function updateStation(id, data) {
  const station = getStationById(id);
  if (!station) {
    throw { status: 404, message: '工位不存在', conclusion: '找不到对应工位记录' };
  }

  const allowedFields = ['name', 'status'];
  const updates = [];
  const params = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      if (field === 'status' && !appConfig.stationStatuses.includes(data[field])) {
        throw { status: 400, message: '无效的工位状态', conclusion: '状态不在允许列表中' };
      }
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  }

  if (updates.length === 0) {
    throw { status: 400, message: '没有有效更新字段', conclusion: '请求参数无效' };
  }

  params.push(id);
  runQuery(`UPDATE stations SET ${updates.join(', ')} WHERE id = ?`, params);

  return getStationById(id);
}

module.exports = {
  createStation,
  getStationList,
  getStationById,
  updateStation
};
