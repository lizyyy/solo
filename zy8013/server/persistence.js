const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getRoomFilePath(roomId) {
  return path.join(DATA_DIR, `room-${roomId}.json`);
}

function getEventsFilePath(roomId) {
  return path.join(DATA_DIR, `events-${roomId}.json`);
}

function getClientStatesFilePath(roomId) {
  return path.join(DATA_DIR, `clients-${roomId}.json`);
}

function saveRoom(room) {
  ensureDataDir();
  const filePath = getRoomFilePath(room.id);
  const data = JSON.stringify(room, null, 2);
  fs.writeFileSync(filePath, data, 'utf8');
}

function loadRoom(roomId) {
  ensureDataDir();
  const filePath = getRoomFilePath(roomId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function saveEvents(roomId, events) {
  ensureDataDir();
  const filePath = getEventsFilePath(roomId);
  const data = JSON.stringify(events, null, 2);
  fs.writeFileSync(filePath, data, 'utf8');
}

function loadEvents(roomId) {
  ensureDataDir();
  const filePath = getEventsFilePath(roomId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function saveClientStates(roomId, clientStates) {
  ensureDataDir();
  const filePath = getClientStatesFilePath(roomId);
  const data = JSON.stringify(clientStates, null, 2);
  fs.writeFileSync(filePath, data, 'utf8');
}

function loadClientStates(roomId) {
  ensureDataDir();
  const filePath = getClientStatesFilePath(roomId);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

function listAllRooms() {
  ensureDataDir();
  const files = fs.readdirSync(DATA_DIR);
  const roomIds = new Set();
  
  files.forEach(file => {
    const match = file.match(/^room-(.+)\.json$/);
    if (match) {
      roomIds.add(match[1]);
    }
  });
  
  return Array.from(roomIds);
}

function deleteRoom(roomId) {
  const roomFile = getRoomFilePath(roomId);
  const eventsFile = getEventsFilePath(roomId);
  const clientsFile = getClientStatesFilePath(roomId);
  
  [roomFile, eventsFile, clientsFile].forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
}

module.exports = {
  DATA_DIR,
  ensureDataDir,
  saveRoom,
  loadRoom,
  saveEvents,
  loadEvents,
  saveClientStates,
  loadClientStates,
  listAllRooms,
  deleteRoom
};
