import React from 'react';
import { ConflictList } from '@/components/conflict/ConflictList';
import { ShelterDetailPanel } from '@/components/shelter/ShelterDetailPanel';

export const ConflictPage: React.FC = () => {
  return (
    <div className="relative h-[calc(100vh-4rem)] w-full">
      <ConflictList />
      <ShelterDetailPanel />
    </div>
  );
};
