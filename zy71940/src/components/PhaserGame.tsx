import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { TimelineScene } from '@/phaser/scenes/TimelineScene';
import { useAppStore } from '@/store/useAppStore';

export function PhaserGame() {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<TimelineScene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  
  const { windows, conflicts, view, selectedWindowId } = useAppStore();
  const setView = useAppStore(state => state.setView);
  const selectWindow = useAppStore(state => state.selectWindow);
  const selectConflict = useAppStore(state => state.selectConflict);

  useEffect(() => {
    if (!gameRef.current) return;

    const timelineScene = new TimelineScene(view);
    sceneRef.current = timelineScene;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: gameRef.current.clientWidth,
      height: gameRef.current.clientHeight,
      backgroundColor: '#0a1628',
      scene: [timelineScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER
      },
      render: {
        antialias: true,
        pixelArt: false
      },
      audio: {
        disableWebAudio: true
      }
    };

    const game = new Phaser.Game(config);
    gameInstanceRef.current = game;

    game.events.once('ready', () => {
      timelineScene.setEventHandlers({
        onWindowSelect: (windowId: string) => {
          selectWindow(windowId);
        },
        onConflictSelect: (conflictId: string) => {
          selectConflict(conflictId);
        },
        onViewChange: (viewState) => {
          setView(viewState);
        }
      });
      setSceneReady(true);
    });

    return () => {
      if (sceneRef.current) {
        sceneRef.current.cleanup();
      }
      game.destroy(true);
      gameInstanceRef.current = null;
      sceneRef.current = null;
      setSceneReady(false);
    };
  }, []);

  useEffect(() => {
    if (sceneReady && sceneRef.current) {
      sceneRef.current.updateWindows(windows);
    }
  }, [windows, sceneReady]);

  useEffect(() => {
    if (sceneReady && sceneRef.current) {
      sceneRef.current.updateConflicts(conflicts, windows);
    }
  }, [conflicts, windows, sceneReady]);

  useEffect(() => {
    if (sceneReady && sceneRef.current) {
      sceneRef.current.selectWindow(selectedWindowId);
    }
  }, [selectedWindowId, sceneReady]);

  useEffect(() => {
    if (sceneReady && sceneRef.current) {
      sceneRef.current.setViewState(view);
    }
  }, [view.startTime, view.endTime, view.zoom, sceneReady]);

  return (
    <div ref={gameRef} className="phaser-container" />
  );
}
