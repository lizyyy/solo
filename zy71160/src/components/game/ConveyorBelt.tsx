import React from 'react';

interface ConveyorBeltProps {
  width: number;
  children?: React.ReactNode;
}

const ConveyorBelt: React.FC<ConveyorBeltProps> = ({ width, children }) => {
  return (
    <div className="relative" style={{ width: `${width}px`, height: '100px' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="relative w-full h-20 overflow-hidden rounded-lg"
          style={{
            background: 'linear-gradient(180deg, #4a4a4a 0%, #2d2d2d 50%, #1a1a1a 100%)',
            boxShadow: 'inset 0 5px 15px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.3)',
          }}
        >
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 30px, rgba(255,255,255,0.05) 30px, rgba(255,255,255,0.05) 32px)`,
              animation: 'beltMove 0.5s linear infinite',
            }}
          />
          
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-gray-600 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-gray-800 to-transparent" />
          
          <div className="absolute top-1/2 left-4 -translate-y-1/2 w-6 h-12 bg-gray-500 rounded-md shadow-inner"
               style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }} />
          <div className="absolute top-1/2 right-4 -translate-y-1/2 w-6 h-12 bg-gray-500 rounded-md shadow-inner"
               style={{ boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)' }} />
        </div>
      </div>
      
      <div className="absolute -bottom-3 left-0 right-0 h-6 flex justify-between px-2">
        <div className="w-8 h-6 bg-gray-700 rounded-b-lg"
             style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }} />
        <div className="w-8 h-6 bg-gray-700 rounded-b-lg"
             style={{ boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }} />
      </div>
      
      {children}
      
      <style>{`
        @keyframes beltMove {
          from { background-position: 0 0; }
          to { background-position: 32px 0; }
        }
      `}</style>
    </div>
  );
};

export default ConveyorBelt;
