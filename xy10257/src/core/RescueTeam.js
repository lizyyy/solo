class RescueTeam {
  constructor(id, name, currentNodeId, speed = 5.0, status = 'standby') {
    this.id = id;
    this.name = name;
    this.currentNodeId = currentNodeId;
    this.speed = speed;
    this.status = status;
    this.assignedTask = null;
    this.missionStartTime = null;
    this.route = [];
  }

  static fromJSON(json) {
    const team = new RescueTeam(
      json.id, json.name, json.currentNodeId, 
      json.speed || 5.0, json.status || 'standby'
    );
    if (json.assignedTask) team.assignedTask = json.assignedTask;
    if (json.missionStartTime) team.missionStartTime = json.missionStartTime;
    if (json.route) team.route = json.route;
    return team;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      currentNodeId: this.currentNodeId,
      speed: this.speed,
      status: this.status,
      assignedTask: this.assignedTask,
      missionStartTime: this.missionStartTime,
      route: this.route
    };
  }

  assignTask(alarmId, route) {
    this.assignedTask = { alarmId };
    this.route = route;
    this.status = 'moving';
    this.missionStartTime = Date.now();
  }

  completeMission() {
    this.assignedTask = null;
    this.route = [];
    this.status = 'standby';
    this.missionStartTime = null;
  }
}

module.exports = RescueTeam;
