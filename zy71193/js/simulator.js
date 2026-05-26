import {
  GameState,
  DefrostSchedule,
  ZONE_TARGETS,
  AMBIENT_TEMP,
  COOLING_RATE,
  WARMING_RATE,
  DEFROST_WARMING_RATE,
  DOOR_OPEN_WARMING_RATE,
  DEFROST_COOLDOWN,
  DEFROST_INTERVAL_RECOMMENDED,
  SCORE
} from './models.js';

export class Simulator {
  constructor(state) {
    this.state = state;
  }

  tick(dt) {
    if (this.state.paused || this.state.finished) return;

    this.state.gameTime += dt;
    this._updateTemperatures(dt);
    this._updateDefrosts();
    this._updateTasks(dt);
    this._checkFailures();
    this._updateScore(dt);
    this.state.recordTemp();

    if (this.state.gameTime >= 1440) {
      this.state.finished = true;
    }
  }

  _updateTemperatures(dt) {
    for (const zoneId of Object.keys(this.state.zones)) {
      const zone = this.state.zones[zoneId];
      const evap = this.state.getEvaporatorForZone(zoneId);

      let warmingRate = WARMING_RATE;

      if (zone.doorOpen) {
        warmingRate += DOOR_OPEN_WARMING_RATE;
      }

      if (evap && evap.isDefrosting(this.state.gameTime)) {
        warmingRate += DEFROST_WARMING_RATE;
      }

      const isCooling = evap && evap.status === 'cooling' && !evap.isDefrosting(this.state.gameTime);
      const coolingEffect = isCooling ? COOLING_RATE * (evap?.efficiency || 1) : 0;

      const targetMid = (zone.target.min + zone.target.max) / 2;
      const distFromMid = zone.temp - targetMid;

      const netWarming = warmingRate - coolingEffect;
      const pressure = distFromMid * 0.01;

      zone.temp += (netWarming - pressure) * dt;

      if (zone.temp > AMBIENT_TEMP) zone.temp = AMBIENT_TEMP;
      if (zone.temp < -40) zone.temp = -40;
    }
  }

  _updateDefrosts() {
    const now = this.state.gameTime;

    for (const evapId of Object.keys(this.state.evaporators)) {
      const evap = this.state.evaporators[evapId];

      if (evap.status === 'defrosting') {
        if (evap.defrostEnd !== null && now >= evap.defrostEnd) {
          evap.completeDefrost(now);
          this.state.addEvent('success', `蒸发器${evap.id}除霜完成`);
        } else if (evap.defrostEnd !== null) {
          const overrun = now - evap.defrostEnd;
          if (overrun > 0 && overrun < 60) {
            const overdue = now - evap.defrostEnd;
            if (!evap._timeoutScored) {
              this.state.scoreBreakdown.defrostTimeout += SCORE.DEFROST_TIMEOUT;
              evap._timeoutScored = true;
              this.state.addEvent('error', `蒸发器${evap.id}除霜超时`);
            }
          }
        }
      }
    }

    for (const schedule of this.state.defrostSchedules) {
      const evap = this.state.evaporators[schedule.evaporatorId];
      if (!evap) continue;

      if (now >= schedule.start && now < schedule.end && evap.status !== 'defrosting') {
        if (now >= evap.cooldownUntil) {
          evap.startDefrost(now, schedule.end - now);
          evap._timeoutScored = false;
          this.state.addEvent('info', `蒸发器${evap.id}开始除霜`);
        } else {
          this.state.addEvent('warning', `蒸发器${evap.id}除霜跳过（冷却中）`);
        }
      }

      if (!schedule._conflictChecked) {
        const tasksInZone = this.state.tasks.filter(
          t => t.zone === evap.zone && t.status !== 'completed'
        );
        for (const task of tasksInZone) {
          const taskStart = task.startedAt !== null ? task.startedAt : task.windowStart;
          const taskEnd = taskStart + task.duration;
          if (schedule.start < taskEnd && schedule.end > task.windowStart) {
            schedule.conflict = true;
            break;
          }
        }
        schedule._conflictChecked = true;
      }
    }

    for (const evapId of Object.keys(this.state.evaporators)) {
      const evap = this.state.evaporators[evapId];
      if (evap.status === 'cooling') {
        const sinceLast = now - (evap.lastDefrost || 0);
        if (sinceLast > DEFROST_INTERVAL_RECOMMENDED * 1.5) {
          evap.efficiency = Math.max(0.5, evap.efficiency - 0.001);
          const penaltyWindow = DEFROST_INTERVAL_RECOMMENDED * 1.5;
          if (sinceLast > penaltyWindow && !evap._missingScored) {
            this.state.scoreBreakdown.missingDefrost += SCORE.MISSING_DEFROST;
            evap._missingScored = true;
            this.state.addEvent('error', `蒸发器${evap.id}遗漏除霜（距上次${sinceLast.toFixed(0)}分钟）`);
          }
        } else if (sinceLast <= DEFROST_INTERVAL_RECOMMENDED * 1.2) {
          evap._missingScored = false;
        }
      }
    }
  }

  _updateTasks(dt) {
    const now = this.state.gameTime;

    for (const task of this.state.tasks) {
      if (task.status === 'completed') continue;

      const zone = this.state.zones[task.zone];

      if (task.status === 'pending' && task.isInWindow(now)) {
        task.status = 'active';
        task.startedAt = now;
        if (zone) zone.doorOpen = true;
        this.state.addEvent('info', `任务开始: ${task.name}`);
      }

      if (task.status === 'active' || task.status === 'delayed') {
        if (task.startedAt !== null && now - task.startedAt >= task.duration) {
          task.status = 'completed';
          task.completedAt = now;
          if (zone) zone.doorOpen = false;

          if (task.completedAt <= task.windowEnd) {
            this.state.addEvent('success', `任务完成: ${task.name} (准时)`);
          } else {
            const delay = task.completedAt - task.windowEnd;
            this.state.addEvent('warning', `任务完成: ${task.name} (延误${delay.toFixed(0)}分钟)`);
          }
        } else if (task.isOverdue(now) && task.status === 'active') {
          task.status = 'delayed';
          this.state.addEvent('error', `任务延误: ${task.name}`);
        }
      }

      if (task.status === 'pending' && now > task.windowEnd) {
        task.status = 'delayed';
        task.startedAt = now;
        if (zone) zone.doorOpen = true;
        this.state.addEvent('error', `任务延误: ${task.name} (错过时间窗)`);
      }
    }
  }

  _checkFailures() {
    let anyOverTemp = false;

    for (const zoneId of Object.keys(this.state.zones)) {
      const zone = this.state.zones[zoneId];
      const overAmount = zone.temp - zone.target.max;
      if (overAmount > 15) {
        this.state.gameOver = true;
        this.state.finished = true;
        this.state.failureReason = `${ZONE_TARGETS[zoneId].label}温度严重超标 (${zone.temp.toFixed(1)}°C > ${zone.target.max}°C，超标${overAmount.toFixed(1)}°C)`;
        return;
      }
      if (overAmount > 0) anyOverTemp = true;
    }

    const incompleteDelayed = this.state.tasks.filter(
      t => t.status === 'delayed'
    );
    if (incompleteDelayed.length >= 5) {
      this.state.gameOver = true;
      this.state.finished = true;
      this.state.failureReason = `延误任务过多 (${incompleteDelayed.length}个任务延误)`;
    }
  }

  _updateScore(dt) {
    const now = this.state.gameTime;
    const sb = this.state.scoreBreakdown;

    for (const zoneId of Object.keys(this.state.zones)) {
      const zone = this.state.zones[zoneId];
      if (zone.temp >= zone.target.min && zone.temp <= zone.target.max) {
        sb.tempOk += SCORE.TEMP_OK_PER_MIN * dt;
      }
      if (zone.temp > zone.target.max) {
        const overAmount = zone.temp - zone.target.max;
        sb.tempOver += SCORE.TEMP_OVER_PER_DEGREE_MIN * overAmount * dt;
      }
    }

    for (const task of this.state.tasks) {
      if (task.status === 'completed' && task.completedAt !== null) {
        if (!task._scored) {
          task._scored = true;
          if (task.completedAt <= task.windowEnd) {
            sb.taskOnTime += SCORE.TASK_ON_TIME;
          } else {
            const delay = task.completedAt - task.windowEnd;
            sb.taskDelay += SCORE.TASK_DELAY_PER_MIN * delay;
          }
        }
      }
    }

    this.state.score = sb.tempOk + sb.taskOnTime + sb.defrostTimely
      + sb.tempOver + sb.taskDelay + sb.defrostTimeout
      + sb.energyWaste + sb.missingDefrost;
  }

  addDefrostSchedule(evaporatorId, start, duration) {
    const evap = this.state.evaporators[evaporatorId];
    if (!evap) return { success: false, error: '蒸发器不存在' };

    if (start < this.state.gameTime) {
      return { success: false, error: '开始时间不能早于当前时间' };
    }

    if (start < evap.cooldownUntil) {
      return { success: false, error: `蒸发器冷却中，需等待到第${evap.cooldownUntil.toFixed(0)}分钟` };
    }

    if (duration < 5 || duration > 60) {
      return { success: false, error: '除霜时长需在 5-60 分钟之间' };
    }

    const conflicts = this.state.defrostSchedules.filter(s =>
      s.evaporatorId === evaporatorId &&
      start < s.end &&
      start + duration > s.start
    );

    if (conflicts.length > 0) {
      return { success: false, error: '与已有除霜计划冲突' };
    }

    const schedule = new DefrostSchedule({
      id: this.state.nextDefrostId++,
      evaporatorId,
      start,
      duration
    });
    this.state.defrostSchedules.push(schedule);

    const lastDefrost = evap.lastDefrost || 0;
    const interval = start - lastDefrost;
    if (interval > 0 && interval <= DEFROST_INTERVAL_RECOMMENDED * 1.5) {
      this.state.scoreBreakdown.defrostTimely += SCORE.DEFROST_TIMELY;
      this.state.addEvent('success', `添加除霜计划: 蒸发器${evaporatorId}，第${start.toFixed(0)}分钟开始`);
    } else {
      this.state.addEvent('warning', `添加除霜计划: 蒸发器${evaporatorId}，建议更频繁除霜`);
    }

    const activeTask = this.state.tasks.find(
      t => t.zone === evap.zone && t.status === 'active'
    );
    if (activeTask) {
      const taskEnd = (activeTask.startedAt || 0) + activeTask.duration;
      if (start < taskEnd && start + duration > activeTask.windowStart) {
        schedule.conflict = true;
        this.state.scoreBreakdown.energyWaste += SCORE.ENERGY_WASTE;
        this.state.addEvent('warning', `除霜与"${activeTask.name}"冲突，造成能源浪费`);
      }
    }

    return { success: true, schedule };
  }

  removeDefrostSchedule(scheduleId) {
    const idx = this.state.defrostSchedules.findIndex(s => s.id === scheduleId);
    if (idx >= 0) {
      const s = this.state.defrostSchedules[idx];
      if (s.start <= this.state.gameTime) {
        return { success: false, error: '已开始的除霜无法取消' };
      }
      this.state.defrostSchedules.splice(idx, 1);
      this.state.addEvent('info', `已取消除霜计划: 蒸发器${s.evaporatorId}`);
      return { success: true };
    }
    return { success: false, error: '除霜计划不存在' };
  }

  getScoreBreakdown() {
    const sb = this.state.scoreBreakdown;
    return [
      { label: '温度达标', value: Math.round(sb.tempOk), positive: sb.tempOk >= 0 },
      { label: '任务准时完成', value: Math.round(sb.taskOnTime), positive: sb.taskOnTime >= 0 },
      { label: '除霜及时', value: Math.round(sb.defrostTimely), positive: sb.defrostTimely >= 0 },
      { label: '温度超标', value: Math.round(sb.tempOver), positive: false },
      { label: '任务延误', value: Math.round(sb.taskDelay), positive: false },
      { label: '除霜超时', value: Math.round(sb.defrostTimeout), positive: false },
      { label: '能源浪费', value: Math.round(sb.energyWaste), positive: false },
      { label: '遗漏除霜', value: Math.round(sb.missingDefrost), positive: false }
    ];
  }
}