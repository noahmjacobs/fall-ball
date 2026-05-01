import React, { useEffect, useRef } from 'react';

interface Props {
  onCampaign: () => void;
  onArcade: () => void;
  onLevelCreator: () => void;
  onBack: () => void;
}

interface Star {
  x: number; y: number;
  size: number;
  twinkleOffset: number;
  twinkleSpeed: number;
}

export default function ModeSelectScreen({ onCampaign, onArcade, onLevelCreator, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const starsRef = useRef<Star[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 390;
    const H = Math.min(window.innerHeight, 844);
    canvas.width = W;
    canvas.height = H;

    starsRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() < 0.3 ? 2 : 1,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
    }));

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    function render() {
      frameRef.current++;
      const f = frameRef.current;
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = '#1a1035';
      ctx.fillRect(0, 0, W, H);

      for (const star of starsRef.current) {
        const alpha = 0.5 + 0.5 * Math.sin(f * star.twinkleSpeed + star.twinkleOffset);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;

      // Title
      const titleY = H * 0.14;
      ctx.fillStyle = '#8B1400';
      ctx.font = "bold 20px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SELECT MODE', W / 2 + 2, titleY + 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillText('SELECT MODE', W / 2, titleY);

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const btnBase: React.CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    cursor: 'pointer',
    transition: 'transform 0.05s',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 260,
  };

  return (
    <div style={{
      width: '100%',
      height: '100dvh',
      position: 'relative',
      overflow: 'hidden',
      background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
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

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        width: '100%',
        paddingTop: 40,
      }}>

        {/* DAILY CHALLENGE — coming soon */}
        <button
          disabled
          style={{
            ...btnBase,
            background: 'transparent',
            color: '#666688',
            border: '3px solid #44446688',
            boxShadow: 'none',
            fontSize: 11,
            padding: '14px 28px',
            letterSpacing: 2,
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <span>DAILY CHALLENGE</span>
          <span style={{ fontSize: 7, color: '#555577', letterSpacing: 1 }}>COMING SOON</span>
        </button>

        {/* CAMPAIGN */}
        <button
          onClick={onCampaign}
          style={{
            ...btnBase,
            background: '#1a1035',
            color: '#00ffff',
            border: '4px solid #00ffff',
            boxShadow: '6px 6px 0 #006666',
            fontSize: 16,
            padding: '18px 36px',
            letterSpacing: 2,
            textShadow: '2px 2px 0 #006666',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <span>CAMPAIGN</span>
          <span style={{ fontSize: 7, color: '#00ffff99', letterSpacing: 1 }}>3 LIVES · LEADERBOARD</span>
        </button>

        {/* ARCADE */}
        <button
          onClick={onArcade}
          style={{
            ...btnBase,
            background: 'transparent',
            color: '#00ffff',
            border: '3px solid #00ffff88',
            boxShadow: '4px 4px 0 #006666',
            fontSize: 13,
            padding: '14px 28px',
            letterSpacing: 2,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <span>ARCADE</span>
          <span style={{ fontSize: 7, color: '#00ffff88', letterSpacing: 1 }}>PICK ANY LEVEL · NO LIVES</span>
        </button>

        {/* LEVEL CREATOR */}
        <button
          onClick={onLevelCreator}
          style={{
            ...btnBase,
            background: 'transparent',
            color: '#ffd700',
            border: '3px solid #ffd70055',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            fontSize: 10,
            padding: '12px 24px',
            letterSpacing: 2,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          <span>LEVEL CREATOR</span>
          <span style={{ fontSize: 7, color: '#ffd70088', letterSpacing: 1 }}>BUILD · SHARE · PLAY</span>
        </button>

      </div>

      {/* Back */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          bottom: 'max(32px, env(safe-area-inset-bottom, 16px))',
          background: 'transparent',
          color: '#ffffff55',
          border: '2px solid #ffffff22',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 8,
          padding: '10px 20px',
          cursor: 'pointer',
          letterSpacing: 2,
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
        onMouseUp={e => (e.currentTarget.style.transform = '')}
        onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
        onTouchEnd={e => (e.currentTarget.style.transform = '')}
      >
        ← BACK
      </button>
    </div>
  );
}
