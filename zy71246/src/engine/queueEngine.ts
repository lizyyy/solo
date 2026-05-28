import type { Command, CommandQueue, VisibilityWindow, ErrorDetail } from '../types/mission';

export function sortCommandsByPriority(commands: Command[]): Command[] {
  return [...commands].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.timeout - b.timeout;
  });
}

export function calculateTransmissionTime(
  command: Command,
  bandwidth: number
): number {
  return (command.size * 8) / (bandwidth * 1024) * 1000 + 500;
}

export function canTransmitCommand(
  command: Command,
  window: VisibilityWindow,
  currentTime: number,
  bandwidth: number
): boolean {
  const requiredTime = calculateTransmissionTime(command, bandwidth);
  return currentTime + requiredTime <= window.endTime;
}

export function getQueuePosition(
  queue: CommandQueue,
  commandId: string
): number {
  return queue.commands.indexOf(commandId);
}

export function addToQueue(
  queue: CommandQueue,
  commandId: string
): CommandQueue {
  return {
    ...queue,
    commands: [...queue.commands, commandId],
  };
}

export function removeFromQueue(
  queue: CommandQueue,
  commandId: string
): CommandQueue {
  const index = queue.commands.indexOf(commandId);
  if (index === -1) return queue;
  
  const newCommands = [...queue.commands];
  newCommands.splice(index, 1);
  
  return {
    ...queue,
    commands: newCommands,
    currentIndex: index < queue.currentIndex ? queue.currentIndex - 1 : queue.currentIndex,
  };
}

export function reorderQueue(
  queue: CommandQueue,
  fromIndex: number,
  toIndex: number
): CommandQueue {
  const newCommands = [...queue.commands];
  const [item] = newCommands.splice(fromIndex, 1);
  newCommands.splice(toIndex, 0, item);
  
  let newCurrentIndex = queue.currentIndex;
  if (queue.currentIndex === fromIndex) {
    newCurrentIndex = toIndex;
  } else if (fromIndex < queue.currentIndex && toIndex >= queue.currentIndex) {
    newCurrentIndex = queue.currentIndex - 1;
  } else if (fromIndex > queue.currentIndex && toIndex <= queue.currentIndex) {
    newCurrentIndex = queue.currentIndex + 1;
  }
  
  return {
    ...queue,
    commands: newCommands,
    currentIndex: newCurrentIndex,
  };
}

export function getNextCommand(
  queue: CommandQueue,
  commands: Command[]
): Command | null {
  if (queue.currentIndex >= queue.commands.length) return null;
  
  const commandId = queue.commands[queue.currentIndex];
  return commands.find(c => c.id === commandId) || null;
}

export function advanceQueue(queue: CommandQueue): CommandQueue {
  return {
    ...queue,
    currentIndex: queue.currentIndex + 1,
  };
}

export function detectCommandTimeout(
  command: Command,
  window: VisibilityWindow,
  currentTime: number,
  queuePosition: number,
  transmittedPercent: number
): ErrorDetail | null {
  if (command.status !== 'transmitting' && command.status !== 'queued') return null;
  if (currentTime < window.endTime) return null;

  if (transmittedPercent < 100) {
    return {
      errorType: 'command_timeout',
      commandTimeout: {
        commandId: command.id,
        windowId: window.id,
        reason: determineTimeoutReason(command, window, queuePosition, transmittedPercent),
        queuePosition,
        transmittedPercent,
      },
    };
  }

  return null;
}

function determineTimeoutReason(
  command: Command,
  window: VisibilityWindow,
  queuePosition: number,
  transmittedPercent: number
): 'queue_position' | 'size_too_large' | 'retransmission_needed' | 'solar_conjunction' {
  if (queuePosition > 2) {
    return 'queue_position';
  }
  
  if (command.size > 1024 && transmittedPercent > 50) {
    return 'size_too_large';
  }
  
  if (transmittedPercent > 0 && transmittedPercent < 100) {
    return 'retransmission_needed';
  }
  
  return 'solar_conjunction';
}

export function getQueueStats(
  queue: CommandQueue,
  commands: Command[]
): { total: number; completed: number; remaining: number; byPriority: Record<number, number> } {
  const byPriority: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  queue.commands.forEach(cmdId => {
    const cmd = commands.find(c => c.id === cmdId);
    if (cmd) {
      byPriority[cmd.priority] = (byPriority[cmd.priority] || 0) + 1;
    }
  });
  
  return {
    total: queue.commands.length,
    completed: queue.currentIndex,
    remaining: queue.commands.length - queue.currentIndex,
    byPriority,
  };
}

export function getTotalTransmissionTime(
  queue: CommandQueue,
  commands: Command[],
  bandwidth: number
): number {
  return queue.commands.reduce((total, cmdId) => {
    const cmd = commands.find(c => c.id === cmdId);
    if (cmd) {
      return total + calculateTransmissionTime(cmd, bandwidth);
    }
    return total;
  }, 0);
}

export function canCompleteQueueInWindow(
  queue: CommandQueue,
  commands: Command[],
  window: VisibilityWindow,
  currentTime: number,
  bandwidth: number
): boolean {
  const remainingCommands = queue.commands.slice(queue.currentIndex);
  const remainingTime = window.endTime - currentTime;
  
  const requiredTime = remainingCommands.reduce((total, cmdId) => {
    const cmd = commands.find(c => c.id === cmdId);
    if (cmd) {
      return total + calculateTransmissionTime(cmd, bandwidth);
    }
    return total;
  }, 0);
  
  return requiredTime <= remainingTime;
}
