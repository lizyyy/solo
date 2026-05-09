const { db, getNextId, now, runTransaction } = require('../db/database');

class DormRepository {
  static getBuildings() {
    return [...db.data.buildings]
      .sort((a, b) => a.building_code.localeCompare(b.building_code));
  }
  
  static createBuilding(buildingCode, buildingName, floors = 6) {
    const id = getNextId('buildings');
    const building = {
      id,
      building_code: buildingCode,
      building_name: buildingName,
      floors,
      created_at: now(),
      updated_at: now()
    };
    db.data.buildings.push(building);
    return id;
  }
  
  static getRoomsByBuilding(buildingId) {
    return db.data.dorm_rooms
      .filter(r => r.building_id === buildingId && r.is_active === 1)
      .map(room => {
        const beds = db.data.beds.filter(b => b.room_id === room.id);
        return {
          ...room,
          total_beds: beds.length,
          available_beds: beds.filter(b => b.status === 'available').length
        };
      })
      .sort((a, b) => (a.floor_number - b.floor_number) || (a.room_number.localeCompare(b.room_number)));
  }
  
  static createRoom(buildingId, floorNumber, roomNumber, bedCount = 4, feePerSemester = 1200) {
    const id = getNextId('dorm_rooms');
    const roomCode = `R-${floorNumber}${roomNumber}-${buildingId}`;
    const room = {
      id,
      room_code: roomCode,
      building_id: buildingId,
      floor_number: floorNumber,
      room_number: roomNumber,
      bed_count: bedCount,
      fee_per_semester: feePerSemester,
      is_active: 1,
      created_at: now(),
      updated_at: now()
    };
    db.data.dorm_rooms.push(room);
    return id;
  }
  
  static getAvailableBeds() {
    return db.data.beds
      .filter(b => b.status === 'available')
      .map(bed => {
        const room = db.data.dorm_rooms.find(r => r.id === bed.room_id);
        if (!room || room.is_active !== 1) return null;
        const building = db.data.buildings.find(b => b.id === room.building_id);
        return {
          ...bed,
          room_code: room.room_code,
          floor_number: room.floor_number,
          room_number: room.room_number,
          fee_per_semester: room.fee_per_semester,
          building_code: building.building_code,
          building_name: building.building_name
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.building_code.localeCompare(b.building_code) !== 0) return a.building_code.localeCompare(b.building_code);
        if (a.floor_number !== b.floor_number) return a.floor_number - b.floor_number;
        if (a.room_number.localeCompare(b.room_number) !== 0) return a.room_number.localeCompare(b.room_number);
        return a.bed_number - b.bed_number;
      });
  }
  
  static getBedById(bedId) {
    const bed = db.data.beds.find(b => b.id === bedId);
    if (!bed) return null;
    const room = db.data.dorm_rooms.find(r => r.id === bed.room_id);
    const building = db.data.buildings.find(b => b.id === room.building_id);
    return {
      ...bed,
      room_code: room.room_code,
      floor_number: room.floor_number,
      room_number: room.room_number,
      fee_per_semester: room.fee_per_semester,
      building_code: building.building_code,
      building_name: building.building_name
    };
  }
  
  static getBedByCode(bedCode) {
    const bed = db.data.beds.find(b => b.bed_code === bedCode);
    if (!bed) return null;
    return this.getBedById(bed.id);
  }
  
  static createBedsForRoom(roomId, bedCount) {
    for (let i = 1; i <= bedCount; i++) {
      const id = getNextId('beds');
      db.data.beds.push({
        id,
        bed_code: `BED-${roomId}-${i}`,
        room_id: roomId,
        bed_number: i,
        status: 'available',
        student_id: null,
        assigned_at: null,
        created_at: now(),
        updated_at: now()
      });
    }
  }
  
  static updateBedStatus(bedId, status, studentId = null, operator = 'system') {
    const bed = db.data.beds.find(b => b.id === bedId);
    if (!bed) {
      throw new Error(`床位不存在: ${bedId}`);
    }
    
    bed.status = status;
    bed.student_id = studentId;
    bed.assigned_at = status === 'occupied' ? now() : null;
    bed.updated_at = now();
    return true;
  }
}

module.exports = DormRepository;