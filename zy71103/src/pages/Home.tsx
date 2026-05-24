import React from 'react';
import { Canvas3D } from '@/components/Canvas3D';
import { Toolbar } from '@/components/Toolbar';
import { PropertyPanel } from '@/components/PropertyPanel';
import { Timeline } from '@/components/Timeline';
import { TopMenu } from '@/components/TopMenu';
import { ErrorToast } from '@/components/ErrorToast';

const Home: React.FC = () => {
  return (
    <div className="w-full h-full relative">
      <Canvas3D />
      <TopMenu />
      <Toolbar />
      <PropertyPanel />
      <Timeline />
      <ErrorToast />
    </div>
  );
};

export default Home;
