import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  createScene,
  addLights,
  createOperatingTable,
  createInstrumentZone,
  createPathwayVisualizer
} from '../utils/sceneUtils';
import {
  INSTRUMENT_TYPES,
  createInstrument,
  createCollisionMarker,
  updateCollisionMarkerAnimation,
  getInstrumentCenter
} from '../utils/instrumentUtils';
import {
  runAllValidations,
  getValidationSummary,
  ZONE_CONFIG
} from '../utils/validationUtils';
import { DragController, RotationController } from '../utils/dragController';
import { ReplaySystem } from '../utils/replaySystem';

export default function Scene3D({ 
  onInstrumentsChange, 
  onValidationChange,
  selectedInstrumentId,
  onInstrumentSelect,
  triggerAddInstrument,
  triggerRecordFrame,
  triggerPlayback,
  loadedSetup
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const dragControllerRef = useRef(null);
  const rotationControllerRef = useRef(null);
  const replaySystemRef = useRef(null);
  const instrumentsRef = useRef({});
  const markersRef = useRef({});
  const selectedInstrumentRef = useRef(null);
  const animationIdRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const nextInstrumentIdRef = useRef(1);

  const updateValidation = useCallback(() => {
    if (!sceneRef.current) return;
    
    const results = runAllValidations(
      instrumentsRef.current,
      ZONE_CONFIG.sterileZone,
      ZONE_CONFIG.pathway
    );
    const summary = getValidationSummary(results);
    
    Object.values(markersRef.current).forEach(marker => {
      sceneRef.current.remove(marker);
    });
    markersRef.current = {};

    results.issues.forEach(issue => {
      if (issue.type === 'collision') {
        const inst1 = instrumentsRef.current[issue.instrument1];
        const inst2 = instrumentsRef.current[issue.instrument2];
        
        if (inst1 && inst2) {
          const center1 = getInstrumentCenter(inst1);
          const center2 = getInstrumentCenter(inst2);
          const midPoint = new THREE.Vector3().addVectors(center1, center2).multiplyScalar(0.5);
          
          const marker = createCollisionMarker(issue.instrument1, midPoint);
          sceneRef.current.add(marker);
          markersRef.current[`collision_${issue.instrument1}_${issue.instrument2}`] = marker;
        }
      } else if (issue.type === 'boundary') {
        const inst = instrumentsRef.current[issue.instrument];
        if (inst) {
          const center = getInstrumentCenter(inst);
          const marker = createCollisionMarker(issue.instrument, center);
          sceneRef.current.add(marker);
          markersRef.current[`boundary_${issue.instrument}`] = marker;
        }
      } else if (issue.type === 'pathway') {
        const inst = instrumentsRef.current[issue.instrument];
        if (inst) {
          const center = getInstrumentCenter(inst);
          const marker = createCollisionMarker(issue.instrument, center);
          sceneRef.current.add(marker);
          markersRef.current[`pathway_${issue.instrument}`] = marker;
        }
      }
    });

    if (onValidationChange) {
      onValidationChange(results, summary);
    }
  }, [onValidationChange]);

  const addInstrument = useCallback((typeKey) => {
    if (!sceneRef.current) return;
    
    const instrumentTypes = Object.keys(INSTRUMENT_TYPES);
    const type = typeKey || instrumentTypes[Math.floor(Math.random() * instrumentTypes.length)];
    const id = `inst_${nextInstrumentIdRef.current++}`;
    
    const x = (Math.random() - 0.5) * 4;
    const z = (Math.random() - 0.5) * 3;
    const rotationY = Math.random() * Math.PI * 2;
    
    const instrument = createInstrument(type, id, { x, y: 0, z }, { x: 0, y: rotationY, z: 0 });
    
    if (instrument) {
      sceneRef.current.add(instrument);
      instrumentsRef.current[id] = instrument;
      
      if (onInstrumentsChange) {
        onInstrumentsChange(instrumentsRef.current);
      }
      
      updateValidation();
      return id;
    }
    
    return null;
  }, [onInstrumentsChange, updateValidation]);

  const loadInstrumentsFromSetup = useCallback((setup) => {
    if (!sceneRef.current || !setup) return;
    
    Object.values(instrumentsRef.current).forEach(instrument => {
      sceneRef.current.remove(instrument);
    });
    instrumentsRef.current = {};

    setup.instruments.forEach(instrumentData => {
      const instrument = createInstrument(
        instrumentData.typeKey,
        instrumentData.id,
        instrumentData.position,
        instrumentData.rotation
      );
      
      if (instrument) {
        sceneRef.current.add(instrument);
        instrumentsRef.current[instrumentData.id] = instrument;
        
        const idNum = parseInt(instrumentData.id.split('_')[1]);
        if (idNum >= nextInstrumentIdRef.current) {
          nextInstrumentIdRef.current = idNum + 1;
        }
      }
    });

    if (onInstrumentsChange) {
      onInstrumentsChange(instrumentsRef.current);
    }
    
    updateValidation();
  }, [onInstrumentsChange, updateValidation]);

  const handleDragStart = useCallback((instrument) => {
    selectedInstrumentRef.current = instrument;
    if (onInstrumentSelect) {
      onInstrumentSelect(instrument.userData.id);
    }

    instrument.traverse(child => {
      if (child.isMesh) {
        if (child.material.emissive) {
          child.material.emissive.setHex(0x333333);
        }
      }
    });
  }, [onInstrumentSelect]);

  const handleDrag = useCallback(() => {
    updateValidation();
    
    if (onInstrumentsChange) {
      onInstrumentsChange(instrumentsRef.current);
    }
  }, [updateValidation, onInstrumentsChange]);

  const handleDragEnd = useCallback(() => {
    if (replaySystemRef.current && replaySystemRef.current.isRecording) {
      replaySystemRef.current.recordFrame(instrumentsRef.current, null);
    }
    
    updateValidation();
    
    if (onInstrumentsChange) {
      onInstrumentsChange(instrumentsRef.current);
    }
  }, [updateValidation, onInstrumentsChange]);

  const handleRotate = useCallback(() => {
    updateValidation();
    
    if (onInstrumentsChange) {
      onInstrumentsChange(instrumentsRef.current);
    }
  }, [updateValidation, onInstrumentsChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const { scene, camera, renderer, controls } = createScene(container);
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    addLights(scene);

    const operatingTable = createOperatingTable();
    scene.add(operatingTable);

    const sterileZone = createInstrumentZone();
    scene.add(sterileZone);

    const pathway = createPathwayVisualizer(ZONE_CONFIG.pathway);
    scene.add(pathway);

    const gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xe0e0e0);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    dragControllerRef.current = new DragController(
      scene,
      camera,
      renderer,
      instrumentsRef.current,
      handleDragStart,
      handleDrag,
      handleDragEnd
    );

    rotationControllerRef.current = new RotationController(
      renderer,
      instrumentsRef.current,
      handleRotate
    );

    replaySystemRef.current = new ReplaySystem(
      scene,
      instrumentsRef.current,
      () => {
        if (onInstrumentsChange) {
          onInstrumentsChange(instrumentsRef.current);
        }
      },
      () => updateValidation()
    );

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      controls.update();
      
      const delta = clockRef.current.getElapsedTime();
      Object.values(markersRef.current).forEach(marker => {
        updateCollisionMarkerAnimation(marker, delta);
      });
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationIdRef.current);
      
      if (dragControllerRef.current) {
        dragControllerRef.current.dispose();
      }
      if (rotationControllerRef.current) {
        rotationControllerRef.current.dispose();
      }
      if (replaySystemRef.current) {
        replaySystemRef.current.dispose();
      }
      
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [handleDragStart, handleDrag, handleDragEnd, handleRotate, updateValidation, onInstrumentsChange]);

  useEffect(() => {
    if (selectedInstrumentId && instrumentsRef.current[selectedInstrumentId]) {
      const instrument = instrumentsRef.current[selectedInstrumentId];
      selectedInstrumentRef.current = instrument;
      
      if (rotationControllerRef.current) {
        rotationControllerRef.current.setSelectedInstrument(instrument);
      }
      
      instrument.traverse(child => {
        if (child.isMesh) {
          if (child.material.emissive) {
            child.material.emissive.setHex(0x3366ff);
          }
        }
      });
    } else if (selectedInstrumentRef.current) {
      selectedInstrumentRef.current.traverse(child => {
        if (child.isMesh) {
          if (child.material.emissive) {
            child.material.emissive.setHex(0x000000);
          }
        }
      });
      selectedInstrumentRef.current = null;
      
      if (rotationControllerRef.current) {
        rotationControllerRef.current.setSelectedInstrument(null);
      }
    }
  }, [selectedInstrumentId]);

  useEffect(() => {
    if (triggerAddInstrument) {
      addInstrument(triggerAddInstrument.typeKey);
    }
  }, [triggerAddInstrument, addInstrument]);

  useEffect(() => {
    if (loadedSetup) {
      loadInstrumentsFromSetup(loadedSetup);
    }
  }, [loadedSetup, loadInstrumentsFromSetup]);

  useEffect(() => {
    if (triggerRecordFrame && replaySystemRef.current) {
      if (triggerRecordFrame.action === 'start') {
        replaySystemRef.current.startRecording();
        replaySystemRef.current.recordFrame(instrumentsRef.current, null);
      } else if (triggerRecordFrame.action === 'record') {
        replaySystemRef.current.recordFrame(instrumentsRef.current, null);
      } else if (triggerRecordFrame.action === 'stop') {
        replaySystemRef.current.stopRecording();
      }
    }
  }, [triggerRecordFrame]);

  useEffect(() => {
    if (triggerPlayback && replaySystemRef.current) {
      if (triggerPlayback.action === 'play') {
        replaySystemRef.current.play();
      } else if (triggerPlayback.action === 'pause') {
        replaySystemRef.current.pause();
      } else if (triggerPlayback.action === 'stop') {
        replaySystemRef.current.stop();
      }
    }
  }, [triggerPlayback]);

  return <div ref={containerRef} className="scene-container" style={{ width: '100%', height: '100%' }} />;
}
