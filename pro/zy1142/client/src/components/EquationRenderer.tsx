import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface EquationRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

const EquationRenderer: React.FC<EquationRendererProps> = ({ 
  latex, 
  displayMode = true,
  className = '' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && latex) {
      try {
        katex.render(latex, containerRef.current, {
          throwOnError: false,
          displayMode,
          trust: true,
          macros: {
            '\\degree': '^\\circ',
            '\\R': '\\mathbb{R}',
            '\\N': '\\mathbb{N}',
          },
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        if (containerRef.current) {
          containerRef.current.textContent = latex;
        }
      }
    }
  }, [latex, displayMode]);

  return (
    <div 
      ref={containerRef} 
      className={`${className} ${displayMode ? 'text-center' : 'inline'}`}
    />
  );
};

export default EquationRenderer;
