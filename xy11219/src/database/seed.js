const { db } = require('./init');
const { ROLES, ROLE_PERMISSIONS } = require('../middleware/auth');

function seedDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get('SELECT COUNT(*) as count FROM roles', (err, row) => {
        if (err) return reject(err);
        
        if (row.count === 0) {
          console.log('正在初始化角色数据...');
          
          const roleValues = Object.entries(ROLE_PERMISSIONS).map(([name, permissions]) => [
            name,
            JSON.stringify(permissions)
          ]);

          const insertRole = db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)');
          roleValues.forEach(values => insertRole.run(values));
          insertRole.finalize();
        }
      });

      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) return reject(err);
        
        if (row.count === 0) {
          console.log('正在初始化用户数据...');
          
          const users = [
            ['admin', '系统管理员', 1, '13800138001'],
            ['manager01', '张经理', 2, '13800138002'],
            ['qc01', '品控员小李', 3, '13800138003'],
            ['kitchen01', '厨师小王', 4, '13800138004']
          ];

          const insertUser = db.prepare('INSERT INTO users (username, real_name, role_id, phone) VALUES (?, ?, ?, ?)');
          users.forEach(user => insertUser.run(user));
          insertUser.finalize();
          
          console.log('用户初始化完成，默认用户 ID: 1(管理员), 2(店长), 3(品控员), 4(厨师)');
        }
        
        resolve();
      });
    });
  });
}

module.exports = { seedDatabase };
