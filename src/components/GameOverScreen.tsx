import React, { useEffect, useRef } from 'react';

interface Props {
  score: number;
  level: number;
  personalBest: number;
  playerName: string;
  onTryAgain: () => void;
  onLeaderboard: () => void;
  onHome: () => void;
}

export default function GameOverScreen({
  score,
  level,
  personalBest,
  playerName,
  onTryAgain,
  onLeaderboard,
  onHome,
}: Props) {
  const isNewBest = score >= personalBest && score > 0;
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
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() < 0.3 ? 2 : 1,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    function render() {
      frameRef.current++;
      const f = frameRef.current;
      ctx.imageSmoothingEnabled = false;

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

  const pixelBox = (color: string): React.CSSProperties => ({
    border: `3px solid ${color}`,
    boxShadow: `4px 4px 0 rgba(0,0,0,0.5)`,
    background: 'rgba(10, 6, 30, 0.85)',
    padding: '14px 20px',
    imageRendering: 'pixelated',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        background: '#1a1035',
        fontFamily: "'Press Start 2P', monospace",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          imageRendering: 'pixelated',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          padding: '0 24px',
          width: '100%',
          maxWidth: 370,
        }}
      >
        <div style={{ textAlign: 'center', lineHeight: 1.5 }}>
          <div style={{ fontSize: 26, color: '#e83232', textShadow: '3px 3px 0 #7a0000, 6px 6px 0 rgba(0,0,0,0.4)', letterSpacing: 2 }}>GAME</div>
          <div style={{ fontSize: 26, color: '#e83232', textShadow: '3px 3px 0 #7a0000, 6px 6px 0 rgba(0,0,0,0.4)', letterSpacing: 2 }}>OVER</div>
        </div>

        {playerName && (
          <div style={{ fontSize: 9, color: '#aaaaff', letterSpacing: 2 }}>by {playerName}</div>
        )}

        <div style={{ width: '100%', height: '3px', background: 'repeating-linear-gradient(90deg, #e83232 0px, #e83232 8px, transparent 8px, transparent 12px)' }} />

        <div style={{ ...pixelBox('#ffd700'), width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 8, color: '#888', marginBottom: 10, letterSpacing: 2 }}>FINAL SCORE</div>
          <div style={{ fontSize: 36, color: '#ffd700', textShadow: '3px 3px 0 #8B6914', lineHeight: 1 }}>{score}</div>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <div style={{ ...pixelBox('#00ffff'), flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: '#888', marginBottom: 8, letterSpacing: 1 }}>LEVEL</div>
            <div style={{ fontSize: 22, color: '#00ffff', textShadow: '2px 2px 0 #006666' }}>{level}</div>
          </div>
          <div style={{ ...pixelBox('#ff69b4'), flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: '#888', marginBottom: 8, letterSpacing: 1 }}>BEST</div>
            <div style={{ fontSize: 22, color: '#ff69b4', textShadow: '2px 2px 0 #8B0048' }}>{personalBest}</div>
          </div>
        </div>

        {isNewBest && (
          <div style={{ background: '#ffd700', color: '#1a1035', fontSize: 10, padding: '10px 20px', letterSpacing: 2, textAlign: 'center', boxShadow: '4px 4px 0 #8B6914', border: '3px solid #ffa500', width: '100%' }}>
            ★ NEW BEST! ★
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', marginTop: 4 }}>
          <button
            onClick={onTryAgain}
            style={{ background: '#1a1035', color: '#00ffff', border: '4px solid #00ffff', boxShadow: '6px 6px 0 #006666', fontFamily: "'Press Start 2P', monospace", fontSize: 14, padding: '14px 0', cursor: 'pointer', letterSpacing: 3, width: '100%', textShadow: '2px 2px 0 #006666' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >
            ↺ TRY AGAIN
          </button>

          <button
            onClick={onLeaderboard}
            style={{ background: 'transparent', color: '#ff69b4', border: '3px solid #ff69b4', boxShadow: '4px 4px 0 #8B0048', fontFamily: "'Press Start 2P', monospace", fontSize: 9, padding: '11px 0', cursor: 'pointer', letterSpacing: 2, width: '100%' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >
            🏆 LEADERBOARD
          </button>

          <button
            onClick={onHome}
            style={{ background: 'transparent', color: '#aaaaff', border: '3px solid #555588', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', fontFamily: "'Press Start 2P', monospace", fontSize: 9, padding: '11px 0', cursor: 'pointer', letterSpacing: 2, width: '100%' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >
            ⌂ HOME
          </button>
        </div>
      </div>
    </div>
  );
}
