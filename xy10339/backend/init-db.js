const { v4: uuidv4 } = require('uuid');

function initDatabase(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS repair_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      estimated_cost REAL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS buildings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit_count INTEGER DEFAULT 0,
      total_area REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS houses (
      id TEXT PRIMARY KEY,
      building_id TEXT NOT NULL,
      unit_number TEXT NOT NULL,
      room_number TEXT NOT NULL,
      area REAL NOT NULL,
      owners_names TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(building_id, unit_number, room_number)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      house_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS delegates (
      id TEXT PRIMARY KEY,
      repair_item_id TEXT NOT NULL,
      principal_owner_id TEXT NOT NULL,
      agent_owner_id TEXT,
      agent_name TEXT,
      agent_phone TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      repair_item_id TEXT NOT NULL,
      house_id TEXT NOT NULL,
      voter_owner_id TEXT,
      vote_value TEXT NOT NULL,
      vote_type TEXT DEFAULT 'direct',
      delegate_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      replaced_by_vote_id TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vote_logs (
      id TEXT PRIMARY KEY,
      vote_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function insertSampleData(db) {
  db.get('SELECT COUNT(*) as count FROM repair_items', (err, row) => {
    if (err || row.count > 0) return;

    const buildingId = uuidv4();
    const repairItemId = uuidv4();
    const now = new Date().toISOString();

    const stmt1 = db.prepare(`
      INSERT INTO repair_items (id, name, description, estimated_cost, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);
    stmt1.run(repairItemId, '1号楼电梯维修', '1号楼两部电梯已使用15年，需要大修或更换。预算：80万元，工期：30天。', 800000, '2026-05-01', '2026-05-31');

    const stmt2 = db.prepare(`
      INSERT INTO buildings (id, name, unit_count, total_area)
      VALUES (?, ?, 2, 1312.8)
    `);
    stmt2.run(buildingId, '阳光花园1号楼');

    const houses = [];
    const owners = [];
    
    for (let unit = 1; unit <= 2; unit++) {
      for (let room = 101; room <= 106; room++) {
        const houseId = uuidv4();
        const ownerId = uuidv4();
        const area = room % 2 === 1 ? 98.5 : 120.3;
        
        houses.push({
          id: houseId,
          building_id: buildingId,
          unit_number: String(unit),
          room_number: String(room),
          area: area
        });
        
        owners.push({
          id: ownerId,
          name: `业主${unit}-${room}`,
          phone: `138${String(10000000 + Math.floor(Math.random() * 90000000)).padStart(8, '0')}`,
          house_id: houseId
        });
      }
    }

    const insertHouse = db.prepare(`
      INSERT INTO houses (id, building_id, unit_number, room_number, area)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertOwner = db.prepare(`
      INSERT INTO owners (id, name, phone, house_id)
      VALUES (?, ?, ?, ?)
    `);

    houses.forEach(house => {
      insertHouse.run(house.id, house.building_id, house.unit_number, house.room_number, house.area);
    });
    owners.forEach(owner => {
      insertOwner.run(owner.id, owner.name, owner.phone, owner.house_id);
    });

    const principalOwner = owners[2];
    const agentOwner = owners[3];
    const delegateId = uuidv4();

    const insertDelegate = db.prepare(`
      INSERT INTO delegates (id, repair_item_id, principal_owner_id, agent_owner_id, agent_name, agent_phone, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);
    insertDelegate.run(delegateId, repairItemId, principalOwner.id, agentOwner.id, agentOwner.name, agentOwner.phone, '2026-05-01', '2026-05-31');

    const firstHouse = houses[0];
    const firstOwner = owners[0];
    const firstVoteId = uuidv4();
    const secondVoteId = uuidv4();

    const insertVote = db.prepare(`
      INSERT INTO votes (id, repair_item_id, house_id, voter_owner_id, vote_value, vote_type, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertVote.run(firstVoteId, repairItemId, firstHouse.id, firstOwner.id, 'agree', 'direct', 'revoked', '初始投票，后撤回');

    const insertLog = db.prepare(`
      INSERT INTO vote_logs (id, vote_id, action, details)
      VALUES (?, ?, ?, ?)
    `);
    insertLog.run(uuidv4(), firstVoteId, 'vote_created', '业主亲自投票，表决：同意');
    insertLog.run(uuidv4(), firstVoteId, 'vote_revoked', '业主申请撤回投票');

    const updateVote = db.prepare(`UPDATE votes SET revoked_at = ?, status = 'revoked' WHERE id = ?`);
    updateVote.run(now, firstVoteId);

    insertVote.run(secondVoteId, repairItemId, firstHouse.id, firstOwner.id, 'disagree', 'direct', 'active', '撤回后重新投票');
    insertLog.run(uuidv4(), secondVoteId, 'vote_created', '撤回后重新投票，表决：反对');

    const delegatedHouse = houses[2];
    const delegatedVoteId = uuidv4();

    const insertDelegateVote = db.prepare(`
      INSERT INTO votes (id, repair_item_id, house_id, voter_owner_id, vote_value, vote_type, delegate_id, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);
    insertDelegateVote.run(delegatedVoteId, repairItemId, delegatedHouse.id, agentOwner.id, 'agree', 'delegate', delegateId, '委托投票');
    insertLog.run(uuidv4(), delegatedVoteId, 'delegate_vote_created', '受托人代投票，表决：同意');

    for (let i = 0; i < 4; i++) {
      const voteId = uuidv4();
      const houseForVote = houses[4 + i];
      const ownerForVote = owners[4 + i];
      const voteValue = i < 2 ? 'agree' : 'abstain';
      
      insertVote.run(voteId, repairItemId, houseForVote.id, ownerForVote.id, voteValue, 'direct', 'active', `示例投票-${i + 1}`);
    }

    insertHouse.finalize();
    insertOwner.finalize();
    insertDelegate.finalize();
    insertVote.finalize();
    insertDelegateVote.finalize();
    insertLog.finalize();
    updateVote.finalize();
    stmt1.finalize();
    stmt2.finalize();

    console.log('样例数据已插入');
  });
}

module.exports = { initDatabase, insertSampleData };
