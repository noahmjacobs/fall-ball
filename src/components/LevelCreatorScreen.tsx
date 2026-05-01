import React, { useEffect, useRef, useState } from 'react';
import PinEntryModal from './PinEntryModal';

const ADMIN_PIN = '8161';

interface Props {
  onAdminAccess: () => void;
  onBack: () => void;
}

interface Star {
  x: number; y: number; size: number;
  twinkleOffset: number; twinkleSpeed: number;
}

export default function LevelCreatorScreen({ onAdminAccess, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const [showPin, setShowPin] = useState(false);

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
      ctx.fillStyle = '#8B1400';
      ctx.font = "bold 16px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL CREATOR', W / 2 + 2, H * 0.14 + 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillText('LEVEL CREATOR', W / 2, H * 0.14);

      // Coming soon box
      const boxY = H * 0.38;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W / 2 - 150, boxY - 70, 300, 140);
      ctx.strokeStyle = '#333366';
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 150, boxY - 70, 300, 140);

      // Lock icon
      ctx.fillStyle = '#ffd700';
      ctx.font = "32px monospace";
      ctx.fillText('🔒', W / 2, boxY - 28);

      ctx.fillStyle = '#aaaaff';
      ctx.font = "11px 'Press Start 2P', monospace";
      ctx.fillText('COMING SOON', W / 2, boxY + 14);

      ctx.fillStyle = '#666688';
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.fillText('BUILD YOUR OWN LEVELS', W / 2, boxY + 38);
      ctx.fillText('AND SHARE WITH FRIENDS', W / 2, boxY + 54);

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{
      width: '100%', height: '100dvh',
      position: 'relative', overflow: 'hidden',
      background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', top: 0,
          left: '50%', transform: 'translateX(-50%)',
          imageRendering: 'pixelated',
        }}
      />

      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 20, left: 20,
          background: 'transparent', color: '#ffffff55',
          border: '2px solid #ffffff22',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 8, padding: '8px 14px', cursor: 'pointer',
        }}
      >
        ← BACK
      </button>

      {/* Admin button — small, at the bottom */}
      <button
        onClick={() => setShowPin(true)}
        style={{
          position: 'absolute',
          bottom: 'max(24px, env(safe-area-inset-bottom, 12px))',
          background: 'transparent',
          color: '#333355',
          border: '1px solid #222244',
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7, padding: '8px 16px', cursor: 'pointer',
          letterSpacing: 2,
        }}
      >
        ADMIN
      </button>

      {showPin && (
        <PinEntryModal
          correctPin={ADMIN_PIN}
          onSuccess={() => { setShowPin(false); onAdminAccess(); }}
          onCancel={() => setShowPin(false)}
        />
      )}
    </div>
  );
}
