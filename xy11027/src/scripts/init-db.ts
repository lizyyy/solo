import db from '../config/database';

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS 校区 (
        校区编号 TEXT PRIMARY KEY,
        校区名称 TEXT NOT NULL,
        校区地址 TEXT,
        联系电话 TEXT,
        负责人姓名 TEXT,
        创建时间 TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS 培训项目 (
        项目编号 TEXT PRIMARY KEY,
        项目名称 TEXT NOT NULL,
        项目类型 TEXT,
        培训时长 TEXT,
        发证机构 TEXT,
        证书有效期 TEXT,
        创建时间 TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS 学员 (
        学员编号 TEXT PRIMARY KEY,
        姓名 TEXT NOT NULL,
        证件类型 TEXT NOT NULL DEFAULT '身份证',
        证件号码 TEXT NOT NULL,
        性别 TEXT,
        出生日期 TEXT,
        联系电话 TEXT,
        电子邮箱 TEXT,
        通讯地址 TEXT,
        创建时间 TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(证件类型, 证件号码)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS 原始证书 (
        证书编号 TEXT PRIMARY KEY,
        学员编号 TEXT NOT NULL,
        项目编号 TEXT NOT NULL,
        校区编号 TEXT NOT NULL,
        培训开始日期 TEXT,
        培训结束日期 TEXT,
        发证日期 TEXT NOT NULL,
        成绩 TEXT,
        证书状态 TEXT DEFAULT '有效',
        首次发证 BOOLEAN DEFAULT 1,
        备注 TEXT,
        创建时间 TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (学员编号) REFERENCES 学员(学员编号),
        FOREIGN KEY (项目编号) REFERENCES 培训项目(项目编号),
        FOREIGN KEY (校区编号) REFERENCES 校区(校区编号)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS 补办申请 (
        申请编号 TEXT PRIMARY KEY,
        学员编号 TEXT NOT NULL,
        原始证书编号 TEXT NOT NULL,
        申请校区编号 TEXT NOT NULL,
        申请日期 TEXT NOT NULL,
        补办原因 TEXT NOT NULL,
        补办原因说明 TEXT,
        遗失地点 TEXT,
        登报声明编号 TEXT,
        申请人联系电话 TEXT,
        申请人通讯地址 TEXT,
        收件方式 TEXT,
        申请状态 TEXT NOT NULL DEFAULT '待审核',
        审核人 TEXT,
        审核日期 TEXT,
        审核意见 TEXT,
        驳回原因 TEXT,
        新证书编号 TEXT,
        创建时间 TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (学员编号) REFERENCES 学员(学员编号),
        FOREIGN KEY (原始证书编号) REFERENCES 原始证书(证书编号),
        FOREIGN KEY (申请校区编号) REFERENCES 校区(校区编号),
        FOREIGN KEY (新证书编号) REFERENCES 原始证书(证书编号)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS 操作日志 (
        日志编号 TEXT PRIMARY KEY,
        申请编号 TEXT,
        操作类型 TEXT NOT NULL,
        操作人 TEXT,
        操作时间 TEXT DEFAULT CURRENT_TIMESTAMP,
        操作详情 TEXT,
        IP地址 TEXT,
        FOREIGN KEY (申请编号) REFERENCES 补办申请(申请编号)
      )`);

      console.log('数据库表初始化完成');
      resolve();
    });
  });
}
