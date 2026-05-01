import React, { useEffect, useRef } from 'react';
import { drawBallSkin, type BallSkin } from './BallSkinsScreen';

interface Props {
  onPlay: () => void;
  onLeaderboard: () => void;
  onSkins: () => void;
  ballSkin?: BallSkin;
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkleOffset: number;
  twinkleSpeed: number;
  color: string;
}

export default function StartScreen({ onPlay, onLeaderboard, onSkins, ballSkin = 'basketball' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const skinRef = useRef<BallSkin>(ballSkin);
  skinRef.current = ballSkin;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 390;
    const H = Math.min(window.innerHeight, 844);
    canvas.width = W;
    canvas.height = H;

    const starColors = ['#ffffff', '#ccbbff', '#aaaaff', '#eeeeff', '#ffeecc'];
    starsRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() < 0.3 ? 2 : 1,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    function drawPixelCircle(cx: number, cy: number, r: number, color: string) {
      ctx.fillStyle = color;
      for (let dy = -r; dy <= r; dy++) {
        const halfW = Math.round(Math.sqrt(r * r - dy * dy));
        ctx.fillRect(Math.round(cx) - halfW, Math.round(cy + dy), halfW * 2, 1);
      }
    }

    function render() {
      frameRef.current++;
      const f = frameRef.current;
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = '#1a1035';
      ctx.fillRect(0, 0, W, H);

      for (const star of starsRef.current) {
        const alpha = 0.5 + 0.5 * Math.sin(f * star.twinkleSpeed + star.twinkleOffset);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.color;
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;

      const ballX = W / 2;
      const ballY = H * 0.34 + Math.round(Math.sin(f * 0.04) * 8);
      const ballR = 28;

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      for (let dy = -4; dy <= 4; dy++) {
        const hw = Math.round(Math.sqrt(16 - dy * dy)) * 3;
        ctx.fillRect(Math.round(ballX) - hw, Math.round(ballY + ballR + 8 + dy), hw * 2, 1);
      }
      ctx.globalAlpha = 1;

      drawBallSkin(ctx, skinRef.current, ballX, ballY, ballR);

      const titleY = H * 0.14;
      ctx.fillStyle = '#8B1400';
      ctx.font = "bold 28px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FALL BALL', W / 2 + 3, titleY + 3);
      ctx.fillStyle = '#ffd700';
      ctx.fillText('FALL BALL', W / 2, titleY);

      ctx.fillStyle = '#ff9900';
      ctx.font = "9px 'Press Start 2P', monospace";
      ctx.fillText('by Noah Jacobs', W / 2, titleY + 30);

      const htpY = H * 0.58;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(W / 2 - 145, htpY - 22, 290, 52);
      ctx.strokeStyle = '#333366';
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 145, htpY - 22, 290, 52);

      ctx.fillStyle = '#aaaaff';
      ctx.font = "9px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('HOW TO PLAY', W / 2, htpY - 8);
      ctx.fillStyle = '#cccccc';
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.fillText('DRAG → RELEASE → SCORE!', W / 2, htpY + 10);

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

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
      paddingTop: 'env(safe-area-inset-top, 0px)',
      boxSizing: 'border-box',
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
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom, 16px))',
        gap: 14,
      }}>
        <button
          onClick={onPlay}
          style={{
            background: '#1a1035',
            color: '#00ffff',
            border: '4px solid #00ffff',
            boxShadow: '6px 6px 0 #006666',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 18,
            padding: '16px 48px',
            cursor: 'pointer',
            letterSpacing: 3,
            textShadow: '2px 2px 0 #006666',
            imageRendering: 'pixelated',
            minWidth: 220,
            transition: 'transform 0.05s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(3px,3px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          PLAY
        </button>

        <button
          onClick={onLeaderboard}
          style={{
            background: 'transparent',
            color: '#ff69b4',
            border: '3px solid #ff69b4',
            boxShadow: '4px 4px 0 #8B0048',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            padding: '11px 24px',
            cursor: 'pointer',
            letterSpacing: 2,
            imageRendering: 'pixelated',
            minWidth: 200,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          LEADERBOARD
        </button>

        <button
          onClick={onSkins}
          style={{
            background: 'transparent',
            color: '#ffd700',
            border: '3px solid #ffd70066',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9,
            padding: '11px 24px',
            cursor: 'pointer',
            letterSpacing: 2,
            minWidth: 200,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          BALL SKINS
        </button>
      </div>
    </div>
  );
}
