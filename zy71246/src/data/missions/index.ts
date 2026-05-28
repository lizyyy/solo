import { MISSION1_CONFIG, MISSION1_WINDOWS, MISSION1_PACKETS, MISSION1_COMMANDS } from './mission1';
import type { MissionConfig, VisibilityWindow, DataPacket, Command } from '../../types/mission';

export interface MissionData {
  config: MissionConfig;
  windows: VisibilityWindow[];
  packets: DataPacket[];
  commands: Command[];
}

export const MISSIONS: Record<string, MissionData> = {
  'mission-1': {
    config: MISSION1_CONFIG,
    windows: MISSION1_WINDOWS,
    packets: MISSION1_PACKETS,
    commands: MISSION1_COMMANDS,
  },
};

export function getMissionData(missionId: string): MissionData | undefined {
  return MISSIONS[missionId];
}

export function getAllMissions(): MissionConfig[] {
  return Object.values(MISSIONS).map(m => m.config);
}
