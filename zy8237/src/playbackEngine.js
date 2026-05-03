import dayjs from 'dayjs';
import { CONFIG, RISK_TYPES } from './config.js';
import { riskDetector } from './riskDetector.js';

export class PlaybackEngine {
  constructor(sceneManager, animationController) {
    this.sceneManager = sceneManager;
    this.animationController = animationController;
    
    this.data = null;
    this.currentCommandIndex = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    
    this.state = {
      slotOccupancy: new Map(),
      elevatorUsage: new Map(),
      carPositions: new Map(),
      activeTasks: [],
      taskTimings: new Map(),
      parkedCars: new Map()
    };

    this.onRiskDetected = null;
    this.onStateUpdate = null;
    this.onTimeUpdate = null;
  }

  async loadData(data) {
    this.data = data;
    this.currentCommandIndex = 0;
    
    this.state = {
      slotOccupancy: new Map(),
      elevatorUsage: new Map(),
      carPositions: new Map(),
      activeTasks: [],
      taskTimings: new Map(),
      parkedCars: new Map()
    };

    riskDetector.reset();

    if (data.garageStructure) {
      this.sceneManager.loadGarage(data.garageStructure);
    }

    if (data.timeRange) {
      this.animationController.setTimeRange(data.timeRange.start, data.timeRange.end);
    }

    if (data.reservations) {
      data.reservations.forEach(res => {
        if (res.weight > 2500) {
          riskDetector.processCommand(
            { 
              id: res.id, 
              vehicleId: res.vehicleId, 
              time: res.requestTime,
              type: res.type
            },
            { vehicleWeight: res.weight, maxCapacity: 2500 }
          );
        }
      });
    }

    return true;
  }

  async play() {
    if (!this.data || !this.data.scheduleCommands) return;
    
    this.isPlaying = true;
    this.animationController.play();
    this.processCommands();
  }

  pause() {
    this.isPlaying = false;
    this.animationController.pause();
  }

  stop() {
    this.isPlaying = false;
    this.animationController.stop();
    this.currentCommandIndex = 0;
    this.state = {
      slotOccupancy: new Map(),
      elevatorUsage: new Map(),
      carPositions: new Map(),
      activeTasks: [],
      taskTimings: new Map(),
      parkedCars: new Map()
    };
    riskDetector.reset();
    this.sceneManager.clearAll();
    
    if (this.data && this.data.garageStructure) {
      this.sceneManager.loadGarage(this.data.garageStructure);
    }
  }

  reset() {
    this.stop();
    if (this.data && this.data.timeRange) {
      this.animationController.setTimeRange(this.data.timeRange.start, this.data.timeRange.end);
    }
  }

  async processCommands() {
    if (!this.isPlaying) return;
    if (!this.data || !this.data.scheduleCommands) return;
    if (this.currentCommandIndex >= this.data.scheduleCommands.length) {
      this.isPlaying = false;
      return;
    }

    const command = this.data.scheduleCommands[this.currentCommandIndex];
    
    const context = this.buildDetectionContext(command);
    
    riskDetector.updateState({
      slotOccupancy: this.state.slotOccupancy,
      elevatorUsage: this.state.elevatorUsage,
      carPositions: this.state.carPositions,
      activeTasks: this.state.activeTasks,
      taskTimings: this.state.taskTimings
    });

    const newRisks = riskDetector.processCommand(command, context);
    
    if (newRisks.length > 0 && this.onRiskDetected) {
      newRisks.forEach(risk => this.onRiskDetected(risk));
    }

    await this.executeCommand(command);

    this.currentCommandIndex++;
    this.animationController.currentTime = dayjs(command.time).valueOf();
    
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.animationController.currentTime);
    }

    if (this.isPlaying && this.currentCommandIndex < this.data.scheduleCommands.length) {
      const nextCommand = this.data.scheduleCommands[this.currentCommandIndex];
      const timeDiff = dayjs(nextCommand.time).diff(dayjs(command.time), 'millisecond');
      
      if (timeDiff > 0) {
        const adjustedDelay = Math.max(100, timeDiff / this.playbackSpeed);
        setTimeout(() => this.processCommands(), adjustedDelay);
      } else {
        this.processCommands();
      }
    }
  }

  buildDetectionContext(command) {
    const context = {};

    if (command.toSlot) {
      const slotData = this.sceneManager.slotMeshes.get(command.toSlot);
      if (slotData) {
        context.slotPosition = {
          x: slotData.mesh.position.x,
          y: slotData.mesh.position.y,
          z: slotData.mesh.position.z
        };
      }
    }

    if (command.elevatorId) {
      const elevatorData = this.sceneManager.elevatorMeshes.get(command.elevatorId);
      if (elevatorData) {
        context.elevatorPosition = {
          x: elevatorData.group.position.x,
          y: elevatorData.car.position.y,
          z: elevatorData.group.position.z
        };
      }
    }

    if (command.vehicleId) {
      context.vehiclePosition = this.state.carPositions.get(command.vehicleId);
      
      const reservation = this.data?.reservations?.find(r => r.vehicleId === command.vehicleId);
      if (reservation) {
        context.vehicleWeight = reservation.weight;
      }
    }

    if (this.data?.deviceRules?.timing) {
      if (command.type === 'pickup' || command.type === 'exit') {
        context.timeLimit = this.data.deviceRules.timing.pickupTimeLimit || 180;
      } else if (command.type === 'park' || command.type === 'enter') {
        context.timeLimit = this.data.deviceRules.timing.parkTimeLimit || 120;
      }
    }

    if (this.data?.garageStructure?.elevators) {
      const elevator = this.data.garageStructure.elevators.find(e => e.id === command.elevatorId);
      if (elevator) {
        context.maxCapacity = elevator.maxCapacity;
      }
    }

    return context;
  }

  async executeCommand(command) {
    switch (command.type) {
      case 'park':
      case 'enter':
        await this.executeParkCommand(command);
        break;
      case 'pickup':
      case 'exit':
        await this.executePickupCommand(command);
        break;
      case 'move':
      case 'transfer':
        await this.executeMoveCommand(command);
        break;
      case 'elevator':
      case 'lift':
        await this.executeElevatorCommand(command);
        break;
      case 'wait':
        await this.executeWaitCommand(command);
        break;
      default:
        await this.executeMoveCommand(command);
    }
  }

  async executeParkCommand(command) {
    if (command.vehicleId) {
      if (!this.sceneManager.carMeshes.has(command.vehicleId)) {
        const startPos = command.fromSlot ? 
          this.getSlotPosition(command.fromSlot) : 
          { x: -15, y: 0.1, z: 0 };
        
        const colorIndex = this.state.parkedCars.size % 6;
        this.sceneManager.createCar(command.vehicleId, startPos, colorIndex);
        this.state.carPositions.set(command.vehicleId, { ...startPos });
      }

      if (command.path && command.path.length > 0) {
        this.animationController.showTrajectoryAnimation(command.path, CONFIG.COLORS.TRAJECTORY);
        await this.animationController.createPathAnimation(command.path, command.vehicleId, 300);
      } else if (command.toSlot) {
        const targetPos = this.getSlotPosition(command.toSlot);
        if (targetPos) {
          await this.animationController.animateCar(
            command.vehicleId,
            this.state.carPositions.get(command.vehicleId),
            targetPos,
            1000
          );
        }
      }

      if (command.toSlot) {
        this.state.slotOccupancy.set(command.toSlot, {
          vehicleId: command.vehicleId,
          since: command.time
        });
        this.state.parkedCars.set(command.vehicleId, {
          slotId: command.toSlot,
          parkTime: command.time
        });
        this.sceneManager.updateSlotStatus(command.toSlot, 'occupied', command.vehicleId);

        const carPos = this.getSlotPosition(command.toSlot);
        if (carPos) {
          this.state.carPositions.set(command.vehicleId, { ...carPos });
        }
      }

      const statCars = document.getElementById('stat-cars');
      if (statCars) statCars.textContent = this.state.parkedCars.size;
    }
  }

  async executePickupCommand(command) {
    if (command.vehicleId) {
      if (command.fromSlot) {
        const startPos = this.getSlotPosition(command.fromSlot);
        
        if (!this.sceneManager.carMeshes.has(command.vehicleId) && startPos) {
          const colorIndex = this.state.parkedCars.size % 6;
          this.sceneManager.createCar(command.vehicleId, startPos, colorIndex);
        }

        this.sceneManager.updateSlotStatus(command.fromSlot, 'highlight');
        
        setTimeout(() => {
          this.sceneManager.updateSlotStatus(command.fromSlot, 'empty');
        }, 500);
      }

      if (command.path && command.path.length > 0) {
        this.animationController.showTrajectoryAnimation(command.path, 0xff6b6b);
        await this.animationController.createPathAnimation(command.path, command.vehicleId, 300);
      }

      if (command.fromSlot) {
        this.state.slotOccupancy.delete(command.fromSlot);
        this.state.parkedCars.delete(command.vehicleId);
      }

      setTimeout(() => {
        this.sceneManager.removeCar(command.vehicleId);
        this.state.carPositions.delete(command.vehicleId);
        
        const statCars = document.getElementById('stat-cars');
        if (statCars) statCars.textContent = this.state.parkedCars.size;
      }, 500);
    }
  }

  async executeMoveCommand(command) {
    if (command.vehicleId) {
      if (!this.sceneManager.carMeshes.has(command.vehicleId)) {
        const startPos = command.fromSlot ? 
          this.getSlotPosition(command.fromSlot) : 
          { x: 0, y: 0.1, z: 0 };
        const colorIndex = this.state.parkedCars.size % 6;
        this.sceneManager.createCar(command.vehicleId, startPos, colorIndex);
        this.state.carPositions.set(command.vehicleId, { ...startPos });
      }

      if (command.path && command.path.length > 0) {
        this.animationController.showTrajectoryAnimation(command.path, 0xf39c12);
        await this.animationController.createPathAnimation(command.path, command.vehicleId, 300);
      } else if (command.toSlot) {
        const targetPos = this.getSlotPosition(command.toSlot);
        if (targetPos) {
          await this.animationController.animateCar(
            command.vehicleId,
            this.state.carPositions.get(command.vehicleId),
            targetPos,
            800
          );
        }
      }

      if (command.fromSlot) {
        this.state.slotOccupancy.delete(command.fromSlot);
        this.sceneManager.updateSlotStatus(command.fromSlot, 'empty');
      }

      if (command.toSlot) {
        this.state.slotOccupancy.set(command.toSlot, {
          vehicleId: command.vehicleId,
          since: command.time
        });
        this.sceneManager.updateSlotStatus(command.toSlot, 'occupied', command.vehicleId);
        
        const carPos = this.getSlotPosition(command.toSlot);
        if (carPos) {
          this.state.carPositions.set(command.vehicleId, { ...carPos });
        }
      }
    }
  }

  async executeElevatorCommand(command) {
    if (command.elevatorId) {
      const fromFloor = command.fromFloor ?? 0;
      const toFloor = command.toFloor ?? 1;
      
      await this.animationController.animateElevator(
        command.elevatorId,
        fromFloor,
        toFloor,
        1500
      );

      this.state.elevatorUsage.set(command.elevatorId, {
        taskId: command.id,
        targetFloor: toFloor,
        time: command.time
      });

      if (command.vehicleId) {
        const elevatorY = toFloor * CONFIG.FLOOR_HEIGHT + 0.1;
        const currentPos = this.state.carPositions.get(command.vehicleId) || { x: 0, y: 0.1, z: 0 };
        
        this.state.carPositions.set(command.vehicleId, {
          ...currentPos,
          y: elevatorY
        });
      }
    }
  }

  async executeWaitCommand(command) {
    const duration = command.duration ? command.duration * 1000 : 500;
    await new Promise(resolve => setTimeout(resolve, duration / this.playbackSpeed));
  }

  getSlotPosition(slotId) {
    const slotData = this.sceneManager.slotMeshes.get(slotId);
    if (!slotData) return null;
    
    return {
      x: slotData.mesh.position.x,
      y: slotData.mesh.position.y + 0.1,
      z: slotData.mesh.position.z
    };
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    this.animationController.setPlaybackSpeed(speed);
  }

  getCurrentTime() {
    return this.animationController.currentTime;
  }

  getTotalDuration() {
    if (!this.data || !this.data.timeRange) return 0;
    return dayjs(this.data.timeRange.end).diff(dayjs(this.data.timeRange.start), 'millisecond');
  }

  seekTo(time) {
    const targetTime = dayjs(time).valueOf();
    
    if (!this.data || !this.data.scheduleCommands) return;

    this.stop();
    
    for (let i = 0; i < this.data.scheduleCommands.length; i++) {
      const cmd = this.data.scheduleCommands[i];
      if (dayjs(cmd.time).valueOf() <= targetTime) {
        this.fastForwardCommand(cmd);
        this.currentCommandIndex = i + 1;
      } else {
        break;
      }
    }

    this.animationController.currentTime = targetTime;
    if (this.onTimeUpdate) {
      this.onTimeUpdate(targetTime);
    }
  }

  fastForwardCommand(command) {
    switch (command.type) {
      case 'park':
      case 'enter':
        if (command.vehicleId && command.toSlot) {
          this.state.slotOccupancy.set(command.toSlot, {
            vehicleId: command.vehicleId,
            since: command.time
          });
          this.state.parkedCars.set(command.vehicleId, {
            slotId: command.toSlot,
            parkTime: command.time
          });
          
          const pos = this.getSlotPosition(command.toSlot);
          if (pos) {
            const colorIndex = this.state.parkedCars.size % 6;
            this.sceneManager.createCar(command.vehicleId, pos, colorIndex);
            this.state.carPositions.set(command.vehicleId, { ...pos });
            this.sceneManager.updateSlotStatus(command.toSlot, 'occupied');
          }
        }
        break;
      case 'pickup':
      case 'exit':
        if (command.vehicleId) {
          if (command.fromSlot) {
            this.state.slotOccupancy.delete(command.fromSlot);
            this.sceneManager.updateSlotStatus(command.fromSlot, 'empty');
          }
          this.state.parkedCars.delete(command.vehicleId);
          this.sceneManager.removeCar(command.vehicleId);
          this.state.carPositions.delete(command.vehicleId);
        }
        break;
      case 'move':
      case 'transfer':
        if (command.vehicleId) {
          if (command.fromSlot) {
            this.state.slotOccupancy.delete(command.fromSlot);
            this.sceneManager.updateSlotStatus(command.fromSlot, 'empty');
          }
          if (command.toSlot) {
            this.state.slotOccupancy.set(command.toSlot, {
              vehicleId: command.vehicleId,
              since: command.time
            });
            this.sceneManager.updateSlotStatus(command.toSlot, 'occupied');
            
            const pos = this.getSlotPosition(command.toSlot);
            if (pos) {
              if (!this.sceneManager.carMeshes.has(command.vehicleId)) {
                const colorIndex = this.state.parkedCars.size % 6;
                this.sceneManager.createCar(command.vehicleId, pos, colorIndex);
              }
              this.state.carPositions.set(command.vehicleId, { ...pos });
            }
          }
        }
        break;
      case 'elevator':
      case 'lift':
        if (command.elevatorId && command.toFloor !== undefined) {
          this.sceneManager.updateElevatorStatus(command.elevatorId, command.toFloor, 'idle');
        }
        break;
    }

    const statCars = document.getElementById('stat-cars');
    if (statCars) statCars.textContent = this.state.parkedCars.size;
  }
}
