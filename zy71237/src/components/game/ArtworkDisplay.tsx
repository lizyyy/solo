import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

export function ArtworkDisplay() {
  const { selectedArtwork, currentStain, currentPaintLayer, currentStructure } = useGameStore();

  if (!selectedArtwork) return null;

  const { base, accent, detail } = selectedArtwork.imageColors;

  const stainOpacity = currentStain / 100;
  const paintDamage = 1 - currentPaintLayer / 100;
  const structureDamage = 1 - currentStructure / 100;

  const getArtworkStyle = {
    filter: `
      brightness(${0.95 + (1 - stainOpacity * 0.3)})
      contrast(${1 - paintDamage * 0.2})
    `,
  };

  const renderArtworkContent = () => {
    const type = selectedArtwork.imageType;

    if (type === 'paper') {
      return (
        <svg viewBox="0 0 400 500" className="w-full h-full">
          <defs>
            <filter id="paperTexture">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" />
              <feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.75  0 0 0 0 0.65  0 0 0 0.15 0" />
            </filter>
            <filter id="stainFilter">
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" />
              <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.6 0" />
            </filter>
          </defs>

          <rect x="0" y="0" width="400" height="500" fill={base} filter="url(#paperTexture)" />

          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: stainOpacity * 0.7 }}
            transition={{ duration: 0.8 }}
          >
            <ellipse cx="100" cy="150" rx="80" ry="60" filter="url(#stainFilter)" />
            <ellipse cx="300" cy="350" rx="70" ry="50" filter="url(#stainFilter)" />
            <ellipse cx="200" cy="250" rx="60" ry="80" filter="url(#stainFilter)" />
          </motion.g>

          <g style={getArtworkStyle as React.CSSProperties}>
            <path
              d="M 50 400 Q 100 300 150 350 T 250 300 T 350 380"
              stroke={detail}
              strokeWidth="3"
              fill="none"
              opacity={0.8}
            />
            <path
              d="M 80 350 Q 120 280 180 320 T 280 280 T 320 350"
              stroke={accent}
              strokeWidth="2"
              fill="none"
              opacity={0.6}
            />

            <motion.g
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 - paintDamage * 0.5 }}
              transition={{ duration: 0.8 }}
            >
              <circle cx="150" cy="200" r="30" fill={accent} opacity="0.8" />
              <circle cx="250" cy="180" r="25" fill={detail} opacity="0.7" />
              <path
                d="M 100 250 Q 150 200 200 230 T 300 200"
                stroke={detail}
                strokeWidth="2"
                fill="none"
                opacity={0.7}
              />
            </motion.g>

            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: structureDamage * 0.6 }}
              transition={{ duration: 0.8 }}
            >
              <line x1="0" y1="100" x2="50" y2="150" stroke="#000" strokeWidth="1" opacity="0.3" />
              <line x1="380" y1="450" x2="400" y2="480" stroke="#000" strokeWidth="1" opacity="0.3" />
            </motion.g>
          </g>

          <rect
            x="0"
            y="0"
            width="400"
            height="500"
            fill="none"
            stroke="#8B4513"
            strokeWidth="8"
            opacity="0.3"
          />
        </svg>
      );
    }

    if (type === 'canvas') {
      return (
        <svg viewBox="0 0 500 400" className="w-full h-full">
          <defs>
            <filter id="canvasTexture">
              <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" />
              <feColorMatrix values="0 0 0 0 0.7  0 0 0 0 0.6  0 0 0 0 0.5  0 0 0 0.2 0" />
            </filter>
            <filter id="canvasStain">
              <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" />
              <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0 0.1  0 0 0 0.5 0" />
            </filter>
          </defs>

          <rect x="0" y="0" width="500" height="400" fill={base} filter="url(#canvasTexture)" />

          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: stainOpacity * 0.8 }}
            transition={{ duration: 0.8 }}
          >
            <rect x="50" y="50" width="400" height="300" filter="url(#canvasStain)" opacity="0.6" />
            <ellipse cx="150" cy="200" rx="100" ry="80" filter="url(#canvasStain)" />
          </motion.g>

          <g style={getArtworkStyle as React.CSSProperties}>
            <motion.g
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 - paintDamage * 0.4 }}
              transition={{ duration: 0.8 }}
            >
              <rect x="80" y="80" width="340" height="240" fill={accent} opacity="0.8" />
              <ellipse cx="250" cy="200" rx="80" ry="60" fill={detail} opacity="0.9" />
              <circle cx="200" cy="180" r="20" fill={base} opacity="0.8" />
              <circle cx="300" cy="220" r="25" fill={base} opacity="0.7" />
              <path
                d="M 150 280 Q 250 240 350 280"
                stroke={detail}
                strokeWidth="3"
                fill="none"
                opacity="0.7"
              />
            </motion.g>

            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: structureDamage * 0.7 }}
              transition={{ duration: 0.8 }}
            >
              <line x1="0" y1="0" x2="60" y2="80" stroke="#000" strokeWidth="2" opacity="0.4" />
              <line x1="440" y1="320" x2="500" y2="400" stroke="#000" strokeWidth="2" opacity="0.4" />
              <line x1="100" y1="380" x2="150" y2="400" stroke="#000" strokeWidth="1" opacity="0.3" />
            </motion.g>
          </g>

          <rect
            x="0"
            y="0"
            width="500"
            height="400"
            fill="none"
            stroke="#654321"
            strokeWidth="10"
            opacity="0.4"
          />
        </svg>
      );
    }

    return (
      <svg viewBox="0 0 300 600" className="w-full h-full">
        <rect x="0" y="0" width="300" height="600" fill={base} />
        <text x="150" y="300" textAnchor="middle" fill={detail} fontSize="24" fontFamily="serif">
          卷轴作品
        </text>
      </svg>
    );
  };

  return (
    <div className="card-paper relative overflow-hidden">
      <div className="mb-4">
        <h3 className="text-lg font-serif font-bold text-museum-ink mb-2">
          {selectedArtwork.name}
        </h3>
        <p className="text-sm text-museum-ink/70">
          {selectedArtwork.description}
        </p>
      </div>

      <div className="relative aspect-[4/5] rounded-lg overflow-hidden border-4 border-museum-bronze/30 bg-museum-paperDark shadow-inner">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentStain}-${currentPaintLayer}-${currentStructure}`}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.8 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full"
          >
            {renderArtworkContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-museum-ink/70">
        <div className="text-center p-2 bg-museum-paperDark/50 rounded">
          <div className="font-medium">材质</div>
          <div>{selectedArtwork.materials[0]}</div>
        </div>
        <div className="text-center p-2 bg-museum-paperDark/50 rounded">
          <div className="font-medium">年代</div>
          <div>{selectedArtwork.creationEra}</div>
        </div>
        <div className="text-center p-2 bg-museum-paperDark/50 rounded">
          <div className="font-medium">类型</div>
          <div>{selectedArtwork.imageType === 'paper' ? '纸本' : selectedArtwork.imageType === 'canvas' ? '布面' : '卷轴'}</div>
        </div>
      </div>
    </div>
  );
}
