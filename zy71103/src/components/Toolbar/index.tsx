import React from 'react';
import { Plus, Box, Shield, Trash2, User } from 'lucide-react';
import { useAppStore, generateId } from '../../store/useAppStore';

export const Toolbar: React.FC = () => {
  const { addElement, editMode, setEditMode } = useAppStore();

  const addInstrumentCart = () => {
    addElement({
      id: generateId(),
      type: 'instrumentCart',
      name: `器械车 ${Math.floor(Math.random() * 100)}`,
      position: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      width: 1.2,
      depth: 0.6,
      height: 0.9,
    } as any);
  };

  const addSterileZone = () => {
    addElement({
      id: generateId(),
      type: 'sterileZone',
      name: `无菌区 ${Math.floor(Math.random() * 100)}`,
      position: { x: Math.random() * 4 - 2, y: 0.01, z: Math.random() * 4 - 2 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      width: 3,
      depth: 2,
      color: '#00B42A',
    } as any);
  };

  const addRecycleBin = () => {
    addElement({
      id: generateId(),
      type: 'recycleBin',
      name: `回收桶 ${Math.floor(Math.random() * 100)}`,
      position: { x: Math.random() * 4 - 2, y: 0, z: Math.random() * 4 - 2 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      radius: 0.4,
    } as any);
  };

  const addStaff = () => {
    const colors = ['#165DFF', '#722ED1', '#168CFF'];
    const roles = ['nurse', 'doctor', 'anesthetist'];
    const randomIndex = Math.floor(Math.random() * 3);
    addElement({
      id: generateId(),
      type: 'staff',
      name: `人员 ${Math.floor(Math.random() * 100)}`,
      position: { x: Math.random() * 6 - 3, y: 0, z: Math.random() * 6 - 3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      role: roles[randomIndex] as any,
      color: colors[randomIndex],
      path: [],
    } as any);
  };

  const toolButtons = [
    {
      icon: Box,
      label: '器械车',
      onClick: addInstrumentCart,
      color: 'text-gray-600',
    },
    {
      icon: Shield,
      label: '无菌区',
      onClick: addSterileZone,
      color: 'text-green-600',
    },
    {
      icon: Trash2,
      label: '回收桶',
      onClick: addRecycleBin,
      color: 'text-red-500',
    },
    {
      icon: User,
      label: '人员',
      onClick: addStaff,
      color: 'text-blue-500',
    },
  ];

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20">
      <div className="bg-white rounded-xl shadow-lg p-2 flex flex-col gap-1">
        <div className="text-xs text-gray-500 text-center py-2 border-b border-gray-100 mb-1">
          添加元素
        </div>
        {toolButtons.map((tool, index) => (
          <button
            key={index}
            onClick={tool.onClick}
            className="p-3 rounded-lg hover:bg-gray-100 transition-colors group relative"
            title={tool.label}
          >
            <tool.icon className={`w-5 h-5 ${tool.color}`} />
            <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              {tool.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
