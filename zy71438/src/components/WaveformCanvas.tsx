import React, { useEffect, useRef, useCallback } from 'react';
import { OscillatorConfig } from '../types';
import { generateWaveformData } from '../utils/audioEngine';

interface WaveformCanvasProps {
  oscillators: OscillatorConfig[];
  targetOscillators?: OscillatorConfig[];
  width?: number;
  height?: number;
  showGrid?: boolean;
}

const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  oscillators,
  targetOscillators,
  width = 600,
  height = 200,
  showGrid = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D) => {
    const waveformData = generateWaveformData(oscillators, 0.05);
    const samples = waveformData.samples;
    
    ctx.clearRect(0, 0, width, height);
    
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.1)';
      ctx.lineWidth = 1;
      
      for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }
    
    if (targetOscillators) {
      const targetData = generateWaveformData(targetOscillators, 0.05);
      const targetSamples = targetData.samples;
      
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let i = 0; i < targetSamples.length; i++) {
        const x = (i / targetSamples.length) * width;
        const y = height / 2 - (targetSamples[i] * height * 0.4);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    
    for (let i = 0; i < samples.length; i++) {
      const x = (i / samples.length) * width;
      const y = height / 2 - (samples[i] * height * 0.4);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [oscillators, targetOscillators, width, height, showGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      drawWaveform(ctx);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawWaveform]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="waveform-canvas w-full"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

export default WaveformCanvas;
