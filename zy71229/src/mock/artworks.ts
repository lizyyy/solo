import { Artwork } from '../game/types';

export const MOCK_ARTWORKS: Artwork[] = [
  {
    id: 'art_1',
    name: '《星月夜》- 梵高',
    hallId: 'hall_1',
    position: { x: 100, y: 100 },
    vibrationSensor: {
      enabled: true,
      threshold: 50,
      currentValue: 12,
      lastTriggered: null,
    },
  },
  {
    id: 'art_2',
    name: '《蒙娜丽莎》- 达芬奇',
    hallId: 'hall_1',
    position: { x: 180, y: 100 },
    vibrationSensor: {
      enabled: true,
      threshold: 50,
      currentValue: 8,
      lastTriggered: null,
    },
  },
  {
    id: 'art_3',
    name: '《思想者》- 罗丹',
    hallId: 'hall_2',
    position: { x: 340, y: 100 },
    vibrationSensor: {
      enabled: true,
      threshold: 60,
      currentValue: 15,
      lastTriggered: null,
    },
  },
  {
    id: 'art_4',
    name: '《大卫》- 米开朗基罗',
    hallId: 'hall_2',
    position: { x: 400, y: 120 },
    vibrationSensor: {
      enabled: true,
      threshold: 60,
      currentValue: 10,
      lastTriggered: null,
    },
  },
  {
    id: 'art_5',
    name: '《现代装置 #7》',
    hallId: 'hall_3',
    position: { x: 100, y: 290 },
    vibrationSensor: {
      enabled: true,
      threshold: 45,
      currentValue: 20,
      lastTriggered: null,
    },
  },
  {
    id: 'art_6',
    name: '《无题》- 当代艺术',
    hallId: 'hall_3',
    position: { x: 180, y: 300 },
    vibrationSensor: {
      enabled: true,
      threshold: 45,
      currentValue: 5,
      lastTriggered: null,
    },
  },
  {
    id: 'art_7',
    name: '《青花瓷瓶》- 明代',
    hallId: 'hall_4',
    position: { x: 320, y: 290 },
    vibrationSensor: {
      enabled: true,
      threshold: 30,
      currentValue: 3,
      lastTriggered: null,
    },
  },
  {
    id: 'art_8',
    name: '《金缕玉衣》- 汉代',
    hallId: 'hall_4',
    position: { x: 400, y: 290 },
    vibrationSensor: {
      enabled: true,
      threshold: 30,
      currentValue: 2,
      lastTriggered: null,
    },
  },
  {
    id: 'art_9',
    name: '《抗战胜利》- 纪实摄影',
    hallId: 'hall_5',
    position: { x: 550, y: 120 },
    vibrationSensor: {
      enabled: false,
      threshold: 50,
      currentValue: 0,
      lastTriggered: null,
    },
  },
  {
    id: 'art_10',
    name: '《城市风光》- 系列摄影',
    hallId: 'hall_5',
    position: { x: 550, y: 260 },
    vibrationSensor: {
      enabled: false,
      threshold: 50,
      currentValue: 0,
      lastTriggered: null,
    },
  },
];
