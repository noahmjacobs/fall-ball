import React, { useEffect, useRef } from 'react';

interface Props {
  levelName: string;
  creatorName: string;
  playerName: string;
  failed?: boolean;
  onPlayAgain: () => void;
  onCommunity: () => void;
  onHome: () => void;
}

export default function CommunityLevelCompleteScreen({ levelName, creatorName, playerName, failed = false, onPlayAgain, onCommunity, onHome }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 390, H = Math.min(window.innerHeight, 844);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Confetti particles — celebratory on complete, dim/falling on fail
    const confettiColors = failed
      ? ['#ff4444', '#ff6644', '#882222', '#cc2222', '#ff2244']
      : ['#00ff88', '#ff69b4', '#ffd700', '#00ffff', '#ff6644'];
    const particles = Array.from({ length: failed ? 30 : 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.6,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.4 + Math.random() * 1.2,
      size: 3 + Math.floor(Math.random() * 4),
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.15,
    }));

    const starColors = ['#ffffff', '#ccbbff', '#aaaaff'];
    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: 1, twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));

    function render() {
      frameRef.current++;
      const f = frameRef.current;

      ctx.fillStyle = '#1a1035';
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (const star of stars) {
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(f * star.twinkleSpeed + star.twinkleOffset);
        ctx.fillStyle = star.color;
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;

      // Confetti
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const btn = (color: string): React.CSSProperties => ({
    background: 'transparent',
    color,
    border: `3px solid ${color}`,
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 10,
    padding: '14px 0',
    cursor: 'pointer',
    letterSpacing: 2,
    width: '100%',
    maxWidth: 280,
    boxShadow: `4px 4px 0 rgba(0,0,0,0.5)`,
  });

  return (
    <div style={{
      width: '100%', height: '100dvh', position: 'relative',
      overflow: 'hidden', background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      boxSizing: 'border-box',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)', imageRendering: 'pixelated', pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: '100%', padding: '0 24px',
        flex: 1, justifyContent: 'center', gap: 0,
      }}>
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 16, filter: `drop-shadow(0 0 12px ${failed ? '#ff4444' : '#ffd700'})` }}>
          {failed ? '💀' : '🏆'}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 18,
          color: failed ? '#ff4444' : '#00ff88',
          textShadow: failed ? '0 0 20px #ff444488, 3px 3px 0 #440000' : '0 0 20px #00ff8888, 3px 3px 0 #004422',
          letterSpacing: 2, textAlign: 'center', marginBottom: 8,
        }}>
          {failed ? 'LEVEL' : 'LEVEL'}
        </div>
        <div style={{
          fontSize: 18,
          color: failed ? '#ff4444' : '#00ff88',
          textShadow: failed ? '0 0 20px #ff444488, 3px 3px 0 #440000' : '0 0 20px #00ff8888, 3px 3px 0 #004422',
          letterSpacing: 2, textAlign: 'center', marginBottom: 28,
        }}>
          {failed ? 'FAILED' : 'COMPLETE!'}
        </div>

        {/* Level info card */}
        <div style={{
          background: 'rgba(10, 6, 30, 0.9)',
          border: `2px solid ${failed ? '#ff444444' : '#00ff8844'}`,
          padding: '16px 20px',
          width: '100%', maxWidth: 280,
          textAlign: 'center', marginBottom: 32,
        }}>
          <div style={{ fontSize: 10, color: '#ffffff', letterSpacing: 1, marginBottom: 8, lineHeight: 1.6, wordBreak: 'break-word' }}>
            {levelName}
          </div>
          <div style={{ fontSize: 7, color: '#00ff8888', letterSpacing: 1, marginBottom: 4 }}>
            BY {creatorName.toUpperCase()}
          </div>
          {playerName && !failed && (
            <div style={{ fontSize: 6, color: '#aaaaff88', letterSpacing: 1, marginTop: 8 }}>
              COMPLETED BY {playerName.toUpperCase()}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
          <button
            onClick={onPlayAgain}
            style={{ ...btn(failed ? '#ff4444' : '#00ff88'), boxShadow: `4px 4px 0 ${failed ? '#440000' : '#004422'}` }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >
            {failed ? '↺ TRY AGAIN' : '▶ PLAY AGAIN'}
          </button>

          <button
            onClick={onCommunity}
            style={{ ...btn('#ff69b4'), boxShadow: '4px 4px 0 #8B0048' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >
            🌐 COMMUNITY
          </button>

          <button
            onClick={onHome}
            style={{
              background: 'transparent', color: '#aaaaff',
              border: '2px solid #333355',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8, padding: '10px 0',
              cursor: 'pointer', letterSpacing: 2,
              width: '100%', maxWidth: 280,
            }}
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
