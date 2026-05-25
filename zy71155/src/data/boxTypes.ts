import type { BoxType } from '../types/game';

export const boxTypes: BoxType[] = [
  {
    id: 'small',
    name: '小号纸箱',
    maxWeight: 20,
    width: 6,
    height: 6,
    gridSize: 50,
    color: '#F5F5DC',
  },
  {
    id: 'medium',
    name: '中号纸箱',
    maxWeight: 40,
    width: 8,
    height: 8,
    gridSize: 50,
    color: '#E8D9C0',
  },
  {
    id: 'large',
    name: '大号纸箱',
    maxWeight: 60,
    width: 10,
    height: 8,
    gridSize: 50,
    color: '#D4C4A8',
  },
  {
    id: 'xlarge',
    name: '特大号纸箱',
    maxWeight: 80,
    width: 12,
    height: 10,
    gridSize: 50,
    color: '#C4B498',
  },
];

export const getBoxTypeById = (id: string): BoxType | undefined => {
  return boxTypes.find(b => b.id === id);
};
