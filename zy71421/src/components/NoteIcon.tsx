import React from 'react';
import { NoteType } from '../types';

interface NoteIconProps {
  type: NoteType;
  size?: number;
}

export const NoteIcon: React.FC<NoteIconProps> = ({ type, size = 40 }) => {
  const noteColor = '#475569';
  const restColor = '#64748B';

  const renderNote = () => {
    switch (type) {
      case 'whole':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="20" cy="22" rx="12" ry="9" fill="none" stroke={noteColor} strokeWidth="3" />
          </svg>
        );
      case 'half':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="14" cy="24" rx="9" ry="7" fill="none" stroke={noteColor} strokeWidth="3" />
            <line x1="22" y1="20" x2="22" y2="6" stroke={noteColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
      case 'quarter':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="14" cy="24" rx="9" ry="7" fill={noteColor} />
            <line x1="22" y1="20" x2="22" y2="6" stroke={noteColor} strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
      case 'eighth':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="14" cy="24" rx="9" ry="7" fill={noteColor} />
            <line x1="22" y1="20" x2="22" y2="6" stroke={noteColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M22 6 L34 10 L34 14 Z" fill={noteColor} />
          </svg>
        );
      case 'sixteenth':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="14" cy="24" rx="9" ry="7" fill={noteColor} />
            <line x1="22" y1="20" x2="22" y2="6" stroke={noteColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M22 6 L34 8 L34 12 Z" fill={noteColor} />
            <path d="M22 12 L34 14 L34 18 Z" fill={noteColor} />
          </svg>
        );
      case 'dotted-quarter':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="14" cy="24" rx="9" ry="7" fill={noteColor} />
            <line x1="22" y1="20" x2="22" y2="6" stroke={noteColor} strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="26" r="4" fill="#F97316" />
          </svg>
        );
      case 'dotted-eighth':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <ellipse cx="14" cy="24" rx="9" ry="7" fill={noteColor} />
            <line x1="22" y1="20" x2="22" y2="6" stroke={noteColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M22 6 L34 10 L34 14 Z" fill={noteColor} />
            <circle cx="36" cy="28" r="3" fill="#F97316" />
          </svg>
        );
      case 'rest-half':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <rect x="10" y="14" width="20" height="6" fill={restColor} rx="2" />
            <text x="20" y="35" textAnchor="middle" fontSize="10" fill={restColor}>2拍</text>
          </svg>
        );
      case 'rest-quarter':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <path d="M20 8 L26 14 L20 20 L26 26 L18 32" stroke={restColor} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="20" y="38" textAnchor="middle" fontSize="9" fill={restColor}>1拍</text>
          </svg>
        );
      case 'rest-eighth':
        return (
          <svg width={size} height={size} viewBox="0 0 40 40">
            <path d="M22 10 L26 16 L20 22 L24 28" stroke={restColor} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="14" cy="22" r="4" fill={restColor} />
            <text x="20" y="38" textAnchor="middle" fontSize="8" fill={restColor}>半拍</text>
          </svg>
        );
      default:
        return null;
    }
  };

  return <div className="flex items-center justify-center">{renderNote()}</div>;
};
