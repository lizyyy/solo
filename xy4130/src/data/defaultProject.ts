import type { StageProject } from '@/types';
import { generateUUID } from '@/utils/math';

const rig1Id = 'rig_fly_1';
const rig2Id = 'rig_fly_2';
const rig3Id = 'rig_fly_3';
const lightType1Id = 'light_type_spot';
const lightType2Id = 'light_type_fresnel';
const light1Id = 'light_1_1';
const light2Id = 'light_1_2';
const light3Id = 'light_2_1';
const light4Id = 'light_3_1';
const actor1Id = 'actor_1';
const actor2Id = 'actor_2';

export const defaultProject: StageProject = {
  id: 'default_project',
  name: '示例剧目 - 灯光安全预演',
  created: new Date(),
  modified: new Date(),
  stage: {
    width: 16,
    depth: 12,
    height: 10,
    prosceniumWidth: 12,
    prosceniumHeight: 8,
    stageType: 'proscenium',
  },
  rigs: [
    {
      id: rig1Id,
      name: '一道顶光吊杆',
      type: 'batten',
      position: { x: 0, y: 8, z: 3 },
      length: 14,
      width: 0.15,
      currentHeight: 8,
      weight: 120,
      maxLoad: 300,
      motorized: true,
    },
    {
      id: rig2Id,
      name: '二道顶光吊杆',
      type: 'batten',
      position: { x: 0, y: 7.5, z: 6 },
      length: 14,
      width: 0.15,
      currentHeight: 7.5,
      weight: 100,
      maxLoad: 300,
      motorized: true,
    },
    {
      id: rig3Id,
      name: '天幕灯杆',
      type: 'pipe',
      position: { x: 0, y: 9, z: 11 },
      length: 12,
      width: 0.1,
      currentHeight: 9,
      weight: 50,
      maxLoad: 150,
      motorized: false,
    },
  ],
  lightTypes: [
    {
      id: lightType1Id,
      name: 'ETC Source Four 750W 26°',
      wattage: 750,
      intensity: 15000,
      beamAngle: 26,
      fieldAngle: 34,
      colorTemperature: 3200,
      dmxChannels: 3,
    },
    {
      id: lightType2Id,
      name: 'Fresnel 2K',
      wattage: 2000,
      intensity: 20000,
      beamAngle: 50,
      fieldAngle: 70,
      colorTemperature: 3200,
      dmxChannels: 2,
    },
  ],
  lights: [
    {
      id: light1Id,
      name: '1号定点光',
      type: {
        id: lightType1Id,
        name: 'ETC Source Four 750W 26°',
        wattage: 750,
        intensity: 15000,
        beamAngle: 26,
        fieldAngle: 34,
        colorTemperature: 3200,
        dmxChannels: 3,
      },
      rigId: rig1Id,
      positionOnRig: 2,
      pan: -20,
      tilt: 45,
      intensity: 1,
      color: { r: 255, g: 255, b: 255 },
      dmxAddress: 1,
      dmxUniverse: 1,
    },
    {
      id: light2Id,
      name: '2号定点光',
      type: {
        id: lightType1Id,
        name: 'ETC Source Four 750W 26°',
        wattage: 750,
        intensity: 15000,
        beamAngle: 26,
        fieldAngle: 34,
        colorTemperature: 3200,
        dmxChannels: 3,
      },
      rigId: rig1Id,
      positionOnRig: 10,
      pan: 20,
      tilt: 45,
      intensity: 1,
      color: { r: 255, g: 255, b: 255 },
      dmxAddress: 4,
      dmxUniverse: 1,
    },
    {
      id: light3Id,
      name: '面光主光源',
      type: {
        id: lightType2Id,
        name: 'Fresnel 2K',
        wattage: 2000,
        intensity: 20000,
        beamAngle: 50,
        fieldAngle: 70,
        colorTemperature: 3200,
        dmxChannels: 2,
      },
      rigId: rig2Id,
      positionOnRig: 7,
      pan: 0,
      tilt: 50,
      intensity: 0.8,
      color: { r: 255, g: 255, b: 255 },
      dmxAddress: 10,
      dmxUniverse: 1,
    },
    {
      id: light4Id,
      name: '天幕染色',
      type: {
        id: lightType2Id,
        name: 'Fresnel 2K',
        wattage: 2000,
        intensity: 20000,
        beamAngle: 50,
        fieldAngle: 70,
        colorTemperature: 3200,
        dmxChannels: 2,
      },
      rigId: rig3Id,
      positionOnRig: 6,
      pan: 0,
      tilt: 70,
      intensity: 1,
      color: { r: 100, g: 150, b: 255 },
      dmxAddress: 20,
      dmxUniverse: 1,
    },
  ],
  actors: [
    {
      id: actor1Id,
      name: '男主角',
      height: 1.8,
      radius: 0.35,
    },
    {
      id: actor2Id,
      name: '女主角',
      height: 1.68,
      radius: 0.3,
    },
  ],
  actorTimelines: [
    {
      actorId: actor1Id,
      keyframes: [
        {
          time: 0,
          position: { x: -4, y: 0, z: 4 },
          rotation: 0,
          note: '上场位置',
        },
        {
          time: 10,
          position: { x: -2, y: 0, z: 5 },
          rotation: 0,
          note: '走向舞台中央',
        },
        {
          time: 20,
          position: { x: 0, y: 0, z: 6 },
          rotation: 0,
          note: '舞台中央定点',
        },
        {
          time: 30,
          position: { x: 2, y: 0, z: 5 },
          rotation: 45,
          note: '转身互动',
        },
        {
          time: 40,
          position: { x: 4, y: 0, z: 4 },
          rotation: 90,
          note: '下场位置',
        },
      ],
    },
    {
      actorId: actor2Id,
      keyframes: [
        {
          time: 0,
          position: { x: 4, y: 0, z: 4 },
          rotation: 180,
          note: '上场位置',
        },
        {
          time: 15,
          position: { x: 2, y: 0, z: 5 },
          rotation: 180,
          note: '入场',
        },
        {
          time: 25,
          position: { x: 0, y: 0, z: 5.5 },
          rotation: 180,
          note: '定点',
        },
        {
          time: 35,
          position: { x: -1, y: 0, z: 6 },
          rotation: 225,
          note: '互动位置',
        },
      ],
    },
  ],
  rigTimelines: [
    {
      rigId: rig1Id,
      keyframes: [
        {
          time: 0,
          height: 8,
          note: '开场高度',
        },
        {
          time: 20,
          height: 6,
          note: '降下增强照度',
        },
        {
          time: 35,
          height: 8,
          note: '升回原位',
        },
      ],
    },
    {
      rigId: rig2Id,
      keyframes: [
        {
          time: 0,
          height: 7.5,
          note: '固定位置',
        },
      ],
    },
  ],
  lightTimelines: [
    {
      lightId: light1Id,
      keyframes: [
        {
          time: 0,
          intensity: 1,
          note: '开场点亮',
        },
        {
          time: 25,
          intensity: 0.3,
          note: '暗场过渡',
        },
        {
          time: 35,
          intensity: 0.8,
          note: '恢复亮度',
        },
      ],
    },
    {
      lightId: light3Id,
      keyframes: [
        {
          time: 0,
          intensity: 0.8,
        },
        {
          time: 20,
          intensity: 1,
          note: '增强面光',
        },
      ],
    },
  ],
  restrictedZones: [
    {
      id: 'zone_no_entry_left',
      name: '左侧翼道禁入区',
      type: 'noEntry',
      bounds: {
        min: { x: -8, y: 0, z: -2 },
        max: { x: -6, y: 3, z: 2 },
      },
    },
    {
      id: 'zone_height_limit_center',
      name: '台口高度限制',
      type: 'heightLimit',
      bounds: {
        min: { x: -6, y: 0, z: 0 },
        max: { x: 6, y: 10, z: 3 },
      },
      maxHeight: 6,
    },
  ],
  scenes: [
    {
      id: 'scene_1',
      name: '第一幕：开场',
      startTime: 0,
      endTime: 15,
      description: '男女主角上场，舞台亮灯',
    },
    {
      id: 'scene_2',
      name: '第二幕：互动',
      startTime: 15,
      endTime: 30,
      description: '主角在舞台中央互动，吊杆降下',
    },
    {
      id: 'scene_3',
      name: '第三幕：退场',
      startTime: 30,
      endTime: 40,
      description: '主角下场，场景结束',
    },
  ],
  targetMinLux: 500,
};
