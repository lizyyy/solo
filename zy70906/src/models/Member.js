const { v4: uuidv4 } = require('uuid');

const MEMBER_LEVELS = {
  NORMAL: { name: '普通会员', pointsMultiplier: 1, minPoints: 0 },
  SILVER: { name: '银卡会员', pointsMultiplier: 1.2, minPoints: 1000 },
  GOLD: { name: '金卡会员', pointsMultiplier: 1.5, minPoints: 5000 },
  PLATINUM: { name: '白金会员', pointsMultiplier: 2, minPoints: 20000 }
};

class Member {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.memberNo = data.memberNo;
    this.name = data.name;
    this.phone = data.phone;
    this.level = data.level || 'NORMAL';
    this.totalPoints = data.totalPoints || 0;
    this.joinDate = data.joinDate;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  getLevelConfig() {
    return MEMBER_LEVELS[this.level] || MEMBER_LEVELS.NORMAL;
  }

  getPointsMultiplier() {
    return this.getLevelConfig().pointsMultiplier;
  }

  static calculateLevel(points) {
    if (points >= MEMBER_LEVELS.PLATINUM.minPoints) return 'PLATINUM';
    if (points >= MEMBER_LEVELS.GOLD.minPoints) return 'GOLD';
    if (points >= MEMBER_LEVELS.SILVER.minPoints) return 'SILVER';
    return 'NORMAL';
  }

  toJSON() {
    return {
      id: this.id,
      memberNo: this.memberNo,
      name: this.name,
      phone: this.phone,
      level: this.level,
      levelName: this.getLevelConfig().name,
      totalPoints: this.totalPoints,
      pointsMultiplier: this.getPointsMultiplier(),
      joinDate: this.joinDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

Member.MEMBER_LEVELS = MEMBER_LEVELS;

module.exports = Member;
