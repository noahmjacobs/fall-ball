import React from 'react';

interface Props {
  onSelect: (level: number) => void;
  onBack: () => void;
}

export default function LevelSelectScreen({ onSelect, onBack }: Props) {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div style={{
      width: '100%', height: '100dvh', background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 16px))',
    }}>
      <div style={{ padding: '28px 16px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#00ffff', letterSpacing: 2, marginBottom: 6, textShadow: '2px 2px 0 #006666' }}>
          ARCADE MODE
        </div>
        <div style={{ fontSize: 8, color: '#aaaaff', letterSpacing: 1, marginBottom: 6 }}>
          unlimited lives · no score saved
        </div>
        <div style={{ width: '100%', height: 2, background: 'repeating-linear-gradient(90deg, #00ffff 0px, #00ffff 6px, transparent 6px, transparent 10px)', marginTop: 12 }} />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10, padding: '0 16px', width: '100%', maxWidth: 390, boxSizing: 'border-box',
      }}>
        {levels.map(level => (
          <button
            key={level}
            onClick={() => onSelect(level)}
            style={{
              background: '#0d0820',
              color: '#ffd700',
              border: '3px solid #ffd70066',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 11,
              padding: '14px 4px',
              cursor: 'pointer',
              letterSpacing: 1,
              transition: 'transform 0.05s',
              boxShadow: '3px 3px 0 #00000066',
            }}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
          >
            {level}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: '0 16px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', color: '#aaaaff',
            border: '3px solid #555588',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9, padding: '11px 32px',
            cursor: 'pointer', letterSpacing: 2,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
