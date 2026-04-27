import React, { useEffect, useRef, useState } from 'react';
import { subscribeLeaderboard, type LeaderboardEntry } from '../firebase';

interface Props {
  playerName: string;
  onBack: () => void;
}

export default function LeaderboardScreen({ playerName, onBack }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
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
        const alpha = 0.35 + 0.35 * Math.sin(f * star.twinkleSpeed + star.twinkleOffset);
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

  useEffect(() => {
    const unsub = subscribeLeaderboard((data) => {
      setEntries(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  function rankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  function rankColor(rank: number): string {
    if (rank === 1) return '#ffd700';
    if (rank === 2) return '#c0c0c0';
    if (rank === 3) return '#cd7f32';
    return '#aaaaaa';
  }

  const isCurrentPlayer = (name: string) =>
    playerName && name.toUpperCase() === playerName.toUpperCase();

  return (
    <div style={{ width: '100%', height: '100dvh', position: 'relative', overflow: 'hidden', background: '#1a1035', fontFamily: "'Press Start 2P', monospace", display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', imageRendering: 'pixelated', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 390, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'], paddingBottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' }}>
        <div style={{ padding: '20px 16px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 18, color: '#ffd700', textShadow: '2px 2px 0 #8B6914', letterSpacing: 2, marginBottom: 12 }}>LEADERBOARD</div>
          <div style={{ background: 'rgba(26, 0, 60, 0.9)', border: '3px solid #ffd700', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', padding: '10px 14px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#ffd700', letterSpacing: 1, marginBottom: 6 }}>💰 $20 DOLLAR PRIZE 💰</div>
            <div style={{ fontSize: 7, color: '#ff69b4', letterSpacing: 1 }}>Which cousin will win?</div>
          </div>
          <div style={{ width: '100%', height: '3px', background: 'repeating-linear-gradient(90deg, #ffd700 0px, #ffd700 8px, transparent 8px, transparent 12px)', marginBottom: 12 }} />
        </div>

        <div style={{ padding: '0 12px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaaaff', fontSize: 9, marginTop: 40, lineHeight: 2.5 }}>LOADING...<br /><span style={{ fontSize: 7, color: '#666688' }}>FETCHING SCORES</span></div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666688', fontSize: 8, marginTop: 40, lineHeight: 2.5 }}>NO SCORES YET!<br /><span style={{ fontSize: 7, color: '#444466' }}>BE THE FIRST!</span></div>
          ) : (
            entries.map((entry, idx) => {
              const rank = idx + 1;
              const isMine = isCurrentPlayer(entry.name);
              return (
                <div key={`${entry.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', padding: '9px 10px', marginBottom: 6, background: isMine ? 'rgba(0, 255, 255, 0.12)' : rank <= 3 ? 'rgba(255, 215, 0, 0.06)' : 'rgba(255,255,255,0.03)', border: isMine ? '2px solid #00ffff' : rank <= 3 ? `2px solid ${rankColor(rank)}33` : '2px solid rgba(255,255,255,0.08)', boxShadow: isMine ? '0 0 8px rgba(0,255,255,0.2)' : 'none' }}>
                  <div style={{ minWidth: rank <= 3 ? 28 : 36, fontSize: rank <= 3 ? 16 : 7, color: rankColor(rank), textAlign: 'center', flexShrink: 0, lineHeight: 1 }}>{rankMedal(rank)}</div>
                  <div style={{ flex: 1, fontSize: 8, color: isMine ? '#00ffff' : rank <= 3 ? rankColor(rank) : '#cccccc', marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: 1, textShadow: isMine ? '0 0 6px #00ffff' : 'none' }}>
                    {entry.name.toUpperCase()}
                    {isMine && <span style={{ color: '#ff69b4', fontSize: 6, marginLeft: 6 }}>◄ YOU</span>}
                  </div>
                  <div style={{ fontSize: 9, color: isMine ? '#ffd700' : rank <= 3 ? rankColor(rank) : '#ffd700', textShadow: rank <= 3 ? `1px 1px 0 ${rankColor(rank)}66` : 'none', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginLeft: 8 }}>
                    {entry.score}<span style={{ fontSize: 6, color: '#666688', marginLeft: 4 }}>LV{entry.level}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: 'max(14px, env(safe-area-inset-bottom, 14px)) 16px 14px', background: 'linear-gradient(transparent, #1a1035 40%)', zIndex: 20 }}>
        <button
          onClick={onBack}
          style={{ background: 'rgba(26, 16, 53, 0.95)', color: '#aaaaff', border: '3px solid #555588', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', fontFamily: "'Press Start 2P', monospace", fontSize: 9, padding: '11px 32px', cursor: 'pointer', letterSpacing: 2, minWidth: 160 }}
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
