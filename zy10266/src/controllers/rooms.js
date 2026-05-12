const storage = require('../storage');

function getRooms(req, res) {
  const rooms = storage.getRooms();
  res.json({ success: true, data: rooms });
}

function getRoomById(req, res) {
  const room = storage.getRoomById(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, error: '房间不存在' });
  }
  res.json({ success: true, data: room });
}

function getRoomDevices(req, res) {
  const room = storage.getRoomById(req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, error: '房间不存在' });
  }
  const devices = storage.getDevicesByRoomId(req.params.id);
  res.json({ success: true, data: devices });
}

module.exports = {
  getRooms,
  getRoomById,
  getRoomDevices
};