import React, { useEffect, useRef, useState } from 'react';
import { getUserLevels, deleteUserLevel, MAX_USER_LEVELS } from '../firebase';
import type { UserLevel } from '../types/level';

interface Props {
  playerName: string;
  onEdit: (level: UserLevel) => void;
  onBack: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyLevelsScreen({ playerName, onEdit, onBack }: Props) {
  const [levels, setLevels] = useState<UserLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  // Animated star background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 390, H = Math.min(window.innerHeight, 844);
    canvas.width = W; canvas.height = H;
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
      ctx.fillStyle = '#1a1035'; ctx.fillRect(0, 0, W, H);
      for (const star of stars) {
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(f * star.twinkleSpeed + star.twinkleOffset);
        ctx.fillStyle = star.color;
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(render);
    }
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Load levels
  useEffect(() => {
    getUserLevels(playerName)
      .then(data => { setLevels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [playerName]);

  async function handleDelete(levelId: string) {
    setDeletingId(levelId);
    try {
      await deleteUserLevel(playerName, levelId);
      setLevels(prev => prev.filter(l => l.id !== levelId));
    } catch {
      // silently ignore
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  return (
    <div style={{
      width: '100%', height: '100dvh', position: 'relative',
      overflow: 'hidden', background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column',
    }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)', imageRendering: 'pixelated', pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 10, padding: '24px 20px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, color: '#ffd700', textShadow: '2px 2px 0 #8B6914', letterSpacing: 2, marginBottom: 6 }}>
          MY LEVELS
        </div>
        <div style={{ fontSize: 7, color: '#aaaaff', letterSpacing: 1, marginBottom: 4 }}>
          {loading ? 'LOADING...' : `${levels.length} / ${MAX_USER_LEVELS} LEVELS USED`}
        </div>
        {/* Progress bar */}
        {!loading && (
          <div style={{ width: '100%', maxWidth: 260, margin: '0 auto', height: 4, background: '#ffffff11', borderRadius: 2 }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${(levels.length / MAX_USER_LEVELS) * 100}%`,
              background: levels.length >= MAX_USER_LEVELS ? '#ff4444' : '#ffd700',
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}
        <div style={{ width: '100%', height: 2, background: 'repeating-linear-gradient(90deg, #ffd700 0px, #ffd700 6px, transparent 6px, transparent 10px)', marginTop: 12 }} />
      </div>

      {/* Level list */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, overflow: 'auto', padding: '8px 16px 16px', scrollbarWidth: 'none' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#aaaaff', fontSize: 9, lineHeight: 2.5, paddingTop: 40 }}>
            LOADING...<br /><span style={{ fontSize: 7, color: '#666688' }}>FETCHING YOUR LEVELS</span>
          </div>
        ) : levels.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666688', fontSize: 8, lineHeight: 2.5, padding: '40px 32px 0' }}>
            NO LEVELS YET<br />
            <span style={{ fontSize: 7, color: '#444466' }}>HIT "CREATE LEVEL" TO START!</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {levels.map((level) => (
              <div key={level.id} style={{
                background: 'rgba(10, 6, 30, 0.9)',
                border: `2px solid ${confirmDeleteId === level.id ? '#ff4444' : '#ffd70044'}`,
                boxShadow: '4px 4px 0 rgba(0,0,0,0.4)',
                padding: '14px 16px',
              }}>
                {confirmDeleteId === level.id ? (
                  /* Confirm delete */
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 8, color: '#ff4444', marginBottom: 12, lineHeight: 1.8 }}>
                      DELETE "{level.name.toUpperCase()}"?<br />
                      <span style={{ fontSize: 6, color: '#ff444488' }}>THIS CANNOT BE UNDONE</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                          flex: 1, background: 'transparent', color: '#aaaaff',
                          border: '2px solid #555588',
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 8, padding: '10px 0', cursor: 'pointer',
                        }}
                      >CANCEL</button>
                      <button
                        onClick={() => handleDelete(level.id)}
                        disabled={deletingId === level.id}
                        style={{
                          flex: 1, background: '#1a0000', color: '#ff4444',
                          border: '2px solid #ff4444',
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 8, padding: '10px 0', cursor: 'pointer',
                          opacity: deletingId === level.id ? 0.5 : 1,
                        }}
                      >{deletingId === level.id ? '...' : 'DELETE'}</button>
                    </div>
                  </div>
                ) : (
                  /* Normal view */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Level info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9, color: '#ffffff', letterSpacing: 1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {level.name}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 6, color: '#ffd70077' }}>{level.hoops.length} HOOPS</span>
                        <span style={{ fontSize: 6, color: '#00ffff77' }}>{level.makesNeeded} MAKES</span>
                        <span style={{ fontSize: 6, color: '#555577' }}>{formatDate(level.updatedAt)}</span>
                      </div>
                    </div>
                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => onEdit(level)}
                        style={{
                          background: '#1a1035', color: '#00ffff',
                          border: '2px solid #00ffff',
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 7, padding: '8px 10px', cursor: 'pointer',
                          boxShadow: '2px 2px 0 #006666',
                        }}
                        onMouseDown={e => (e.currentTarget.style.transform = 'translate(1px,1px)')}
                        onMouseUp={e => (e.currentTarget.style.transform = '')}
                        onTouchStart={e => (e.currentTarget.style.transform = 'translate(1px,1px)')}
                        onTouchEnd={e => (e.currentTarget.style.transform = '')}
                      >EDIT</button>
                      <button
                        onClick={() => setConfirmDeleteId(level.id)}
                        style={{
                          background: 'transparent', color: '#ff4444',
                          border: '2px solid #ff444466',
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: 7, padding: '8px 10px', cursor: 'pointer',
                        }}
                        onMouseDown={e => (e.currentTarget.style.transform = 'translate(1px,1px)')}
                        onMouseUp={e => (e.currentTarget.style.transform = '')}
                        onTouchStart={e => (e.currentTarget.style.transform = 'translate(1px,1px)')}
                        onTouchEnd={e => (e.currentTarget.style.transform = '')}
                      >DEL</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Back button */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'center', padding: 'max(16px, env(safe-area-inset-bottom, 16px)) 16px 16px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', color: '#aaaaff',
            border: '3px solid #555588', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9, padding: '11px 32px', cursor: 'pointer', letterSpacing: 2,
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
