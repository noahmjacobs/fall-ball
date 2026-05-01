import React, { useEffect, useRef, useState } from 'react';
import PinEntryModal from './PinEntryModal';

interface Props {
  playerName: string;
  onAdminAccess: () => void;
  onCreateLevel: () => void;
  onCommunityLevels: () => void;
  onMyLevels: () => void;
  onBack: () => void;
}

export default function LevelCreatorScreen({
  playerName,
  onAdminAccess,
  onCreateLevel,
  onCommunityLevels,
  onMyLevels,
  onBack,
}: Props) {
  const [showPin, setShowPin] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 390;
    const H = Math.min(window.innerHeight, 844);
    canvas.width = W;
    canvas.height = H;
    const starColors = ['#ffffff', '#ccbbff', '#aaaaff', '#eeeeff'];
    const stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() < 0.3 ? 2 : 1,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));
    const ctx = canvas.getContext('2d')!;
    function render() {
      frameRef.current++;
      const f = frameRef.current;
      ctx.fillStyle = '#1a1035';
      ctx.fillRect(0, 0, W, H);
      for (const star of stars) {
        const alpha = 0.4 + 0.4 * Math.sin(f * star.twinkleSpeed + star.twinkleOffset);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.color;
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const btn = (color: string, bg = 'transparent'): React.CSSProperties => ({
    fontFamily: "'Press Start 2P', monospace",
    cursor: 'pointer',
    background: bg,
    border: `3px solid ${color}`,
    color,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    width: '100%', maxWidth: 300,
    transition: 'transform 0.05s',
  });

  return (
    <div style={{
      width: '100%', height: '100dvh', position: 'relative',
      overflow: 'hidden', background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)', imageRendering: 'pixelated', pointerEvents: 'none',
      }} />

      {showPin && (
        <PinEntryModal
          correctPin="8161"
          onSuccess={() => { setShowPin(false); onAdminAccess(); }}
          onCancel={() => setShowPin(false)}
        />
      )}

      {/* Title */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', marginTop: 56 }}>
        <div style={{ fontSize: 18, color: '#ffd700', textShadow: '2px 2px 0 #8B6914', letterSpacing: 2 }}>
          LEVEL CREATOR
        </div>
        <div style={{ fontSize: 7, color: '#aaaaff', marginTop: 8, letterSpacing: 1 }}>
          BUILD · SHARE · PLAY
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 16, padding: '0 24px', width: '100%', marginTop: 44,
      }}>

        {/* Community Levels */}
        <button
          onClick={onCommunityLevels}
          style={{ ...btn('#ff69b4'), fontSize: 12, padding: '14px 24px', boxShadow: '4px 4px 0 #8B0048' }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <span>COMMUNITY</span>
          <span style={{ fontSize: 7, color: '#ff69b488' }}>BROWSE LEVELS BY EVERYONE</span>
        </button>

        {/* Create Level */}
        <button
          onClick={onCreateLevel}
          style={{ ...btn('#00ffff', '#1a1035'), fontSize: 14, padding: '18px 24px', boxShadow: '6px 6px 0 #006666', letterSpacing: 2, textShadow: '2px 2px 0 #006666' }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <span>CREATE LEVEL</span>
          <span style={{ fontSize: 7, color: '#00ffff99', letterSpacing: 1 }}>DESIGN YOUR OWN</span>
        </button>

        {/* My Levels */}
        <button
          onClick={onMyLevels}
          disabled={!playerName}
          style={{
            ...btn(playerName ? '#ffd700' : '#444466'),
            fontSize: 11, padding: '14px 24px',
            boxShadow: playerName ? '4px 4px 0 #8B6914' : 'none',
            opacity: playerName ? 1 : 0.5,
          }}
          onMouseDown={e => playerName && (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => playerName && (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <span>MY LEVELS</span>
          <span style={{ fontSize: 7, color: playerName ? '#ffd70088' : '#444466', letterSpacing: 1 }}>
            {playerName ? 'EDIT & MANAGE YOUR LEVELS' : 'SET YOUR NAME FIRST'}
          </span>
        </button>
      </div>

      {/* Back */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute', bottom: 'max(40px, env(safe-area-inset-bottom, 20px))',
          zIndex: 10, background: 'transparent', color: '#ffffff55',
          border: '2px solid #ffffff22', fontFamily: "'Press Start 2P', monospace",
          fontSize: 8, padding: '10px 20px', cursor: 'pointer', letterSpacing: 2,
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
        onMouseUp={e => (e.currentTarget.style.transform = '')}
        onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
        onTouchEnd={e => (e.currentTarget.style.transform = '')}
      >
        ← BACK
      </button>

      {/* Hidden admin button */}
      <button
        onClick={() => setShowPin(true)}
        style={{
          position: 'absolute', bottom: 'max(40px, env(safe-area-inset-bottom, 20px))',
          right: 20, zIndex: 10, background: 'transparent',
          border: '1px solid #ffffff11', color: '#ffffff22',
          fontFamily: "'Press Start 2P', monospace", fontSize: 6,
          padding: '8px 10px', cursor: 'pointer',
        }}
      >
        ADMIN
      </button>
    </div>
  );
}
