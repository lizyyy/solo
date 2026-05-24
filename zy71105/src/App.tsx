import { useEffect, useRef } from 'react';
import { useSceneStore } from './store/useSceneStore';
import Stage3D from './components/Stage3D';
import Toolbar from './components/Controls/Toolbar';
import LightPanel from './components/Controls/LightPanel';
import CollisionPanel from './components/Controls/CollisionPanel';
import Timeline from './components/Controls/Timeline';

function App() {
  const { loadSampleData, lights, isPlaying, setCurrentTime, programSegments } = useSceneStore();
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (lights.length === 0) {
      loadSampleData();
    }
  }, [lights.length, loadSampleData]);

  useEffect(() => {
    if (programSegments.length === 0) return;
    
    const maxTime = Math.max(...programSegments.map((s) => s.endTime));

    if (isPlaying) {
      const animate = (time: number) => {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = time;
        }
        
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        setCurrentTime(
          useSceneStore.getState().currentTime + delta * 10 >= maxTime
            ? 0
            : useSceneStore.getState().currentTime + delta * 10
        );

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    } else {
      lastTimeRef.current = 0;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, programSegments, setCurrentTime]);

  return (
    <div className="w-full h-full bg-stage-dark flex flex-col">
      <Toolbar />
      
      <div className="flex-1 flex relative overflow-hidden">
        <LightPanel />
        
        <div className="flex-1 relative">
          <Stage3D />
        </div>
        
        <CollisionPanel />
      </div>
      
      <Timeline />
    </div>
  );
}

export default App;
