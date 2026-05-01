import React, { useEffect, useRef, useState } from 'react';
import {
  subscribeCommunityLevels, getLevelCompletions,
  getLevelRatingSummary, submitLevelRating,
  type LevelCompletion, type RatingSummary,
} from '../firebase';
import type { UserLevel } from '../types/level';

interface Props {
  playerName: string;
  onPlay: (level: UserLevel) => void;
  onBack: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function playerKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/** Full-width 5-star row. Interactive when `onRate` is provided and `locked` is false. */
function StarRow({
  rating, count, locked, onRate,
}: {
  rating: number;
  count: number;
  locked: boolean;
  onRate?: (r: number) => void;
}) {
  const [hover, setHover] = useState(0);
  // Local submitted flag: ref for synchronous guard, state to force re-render
  const submittedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);

  const isLocked = locked || submitted;
  const display = hover > 0 && !isLocked ? hover : rating;

  function handleClick(s: number) {
    if (submittedRef.current || isLocked || !onRate) return;
    submittedRef.current = true; // synchronous — blocks any further click immediately
    setSubmitted(true);          // triggers re-render so stars go visually locked
    onRate(s);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <div style={{ fontSize: 6, color: '#888899', letterSpacing: 1 }}>
        {count === 0
          ? (isLocked ? 'NO RATINGS YET' : 'TAP TO RATE')
          : `${rating.toFixed(1)} AVG · ${count} RATING${count !== 1 ? 'S' : ''}`}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        {[1, 2, 3, 4, 5].map(s => (
          <span
            key={s}
            onClick={() => handleClick(s)}
            onMouseEnter={!isLocked ? () => setHover(s) : undefined}
            onMouseLeave={!isLocked ? () => setHover(0) : undefined}
            style={{
              fontSize: 36,
              lineHeight: 1,
              color: s <= Math.round(display) ? '#ffd700' : '#2a2050',
              cursor: !isLocked ? 'pointer' : 'default',
              transition: 'color 0.1s',
              textShadow: s <= Math.round(display) ? '0 0 10px #ffd70088' : 'none',
              userSelect: 'none',
            }}
          >
            {s <= Math.round(display) ? '★' : '☆'}
          </span>
        ))}
      </div>
    </div>
  );
}

type RatingData = RatingSummary | 'loading';

export default function CommunityLevelsScreen({ playerName, onPlay, onBack }: Props) {
  const [levels, setLevels] = useState<UserLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completionsMap, setCompletionsMap] = useState<Record<string, LevelCompletion[] | 'loading'>>({});
  const [ratingsMap, setRatingsMap] = useState<Record<string, RatingData>>({});
  // Synchronous lock so rapid taps can't fire multiple ratings before state updates
  const ratedRef = useRef<Set<string>>(new Set());
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

  // Subscribe to community feed
  useEffect(() => {
    const unsub = subscribeCommunityLevels(data => {
      setLevels(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Fetch ratings for all levels once they load
  useEffect(() => {
    if (levels.length === 0) return;
    const pKey = playerName ? playerKey(playerName) : undefined;
    setRatingsMap(prev => {
      const next = { ...prev };
      for (const level of levels) {
        if (next[level.id]) continue; // already fetched or loading
        next[level.id] = 'loading';
        getLevelRatingSummary(level.id, pKey).then(summary => {
          setRatingsMap(r => {
            const existing = r[level.id];
            // Don't overwrite a rating the user already submitted optimistically
            if (existing && existing !== 'loading' && existing.userRating !== null) {
              return { ...r, [level.id]: { ...summary, userRating: existing.userRating } };
            }
            return { ...r, [level.id]: summary };
          });
        }).catch(() => {
          setRatingsMap(r => {
            const existing = r[level.id];
            if (existing && existing !== 'loading' && existing.userRating !== null) return r;
            return { ...r, [level.id]: { avg: 0, count: 0, userRating: null } };
          });
        });
      }
      return next;
    });
  }, [levels, playerName]);

  function toggleCompletions(levelId: string) {
    if (expandedId === levelId) { setExpandedId(null); return; }
    setExpandedId(levelId);
    if (completionsMap[levelId]) return;
    setCompletionsMap(prev => ({ ...prev, [levelId]: 'loading' }));
    getLevelCompletions(levelId).then(data => {
      setCompletionsMap(prev => ({ ...prev, [levelId]: data }));
    }).catch(() => {
      setCompletionsMap(prev => ({ ...prev, [levelId]: [] }));
    });
  }

  async function handleRate(levelId: string, rating: number) {
    if (!playerName) return;
    // Synchronous check — blocks any tap that arrives before state re-renders
    if (ratedRef.current.has(levelId)) return;
    const current = ratingsMap[levelId];
    if (!current || current === 'loading' || current.userRating !== null) return;
    // Lock immediately so rapid taps are ignored
    ratedRef.current.add(levelId);
    // Optimistically update UI
    setRatingsMap(prev => {
      const c = prev[levelId];
      if (!c || c === 'loading') return prev;
      const newCount = c.count + 1;
      const newAvg = (c.avg * c.count + rating) / newCount;
      return { ...prev, [levelId]: { avg: newAvg, count: newCount, userRating: rating } };
    });
    try {
      await submitLevelRating(levelId, playerName, rating);
    } catch (_) {
      // Revert on error and release lock
      ratedRef.current.delete(levelId);
      setRatingsMap(prev => {
        const c = prev[levelId];
        if (!c || c === 'loading') return prev;
        return { ...prev, [levelId]: { ...c, userRating: null } };
      });
    }
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
        <div style={{ fontSize: 15, color: '#ff69b4', textShadow: '2px 2px 0 #8B0048', letterSpacing: 2, marginBottom: 6 }}>
          COMMUNITY LEVELS
        </div>
        {!loading && (
          <div style={{ fontSize: 7, color: '#aaaaff', letterSpacing: 1 }}>
            {levels.length === 0 ? 'NO LEVELS YET — BE THE FIRST!' : `${levels.length} LEVEL${levels.length !== 1 ? 'S' : ''} · SWIPE TO BROWSE`}
          </div>
        )}
        <div style={{ width: '100%', height: 2, background: 'repeating-linear-gradient(90deg, #ff69b4 0px, #ff69b4 6px, transparent 6px, transparent 10px)', marginTop: 12 }} />
      </div>

      {/* Card carousel */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', alignItems: 'center' }}>
        {loading ? (
          <div style={{ width: '100%', textAlign: 'center', color: '#aaaaff', fontSize: 9, lineHeight: 2.5 }}>
            LOADING...<br /><span style={{ fontSize: 7, color: '#666688' }}>FETCHING LEVELS</span>
          </div>
        ) : levels.length === 0 ? (
          <div style={{ width: '100%', textAlign: 'center', color: '#666688', fontSize: 8, lineHeight: 2.5, padding: '0 32px' }}>
            NO COMMUNITY LEVELS YET<br />
            <span style={{ fontSize: 7, color: '#444466' }}>CREATE ONE TO GET STARTED!</span>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            gap: 16,
            padding: '16px 40px',
            width: '100%',
            boxSizing: 'border-box',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          }}>
            {levels.map(level => {
              const isExpanded = expandedId === level.id;
              const completions = completionsMap[level.id];
              const completionCount = Array.isArray(completions) ? completions.length : null;
              const ratingData = ratingsMap[level.id];
              const ratingLoaded = ratingData && ratingData !== 'loading';
              const hasRated = ratingLoaded ? (ratingData as RatingSummary).userRating !== null : false;
              const canRate = !!playerName && ratingLoaded && !hasRated;

              return (
                <div key={level.id} style={{
                  scrollSnapAlign: 'center',
                  flexShrink: 0,
                  width: 260,
                  background: 'rgba(10, 6, 30, 0.9)',
                  border: '3px solid #ff69b4',
                  boxShadow: '6px 6px 0 rgba(0,0,0,0.5)',
                  padding: '12px 18px 20px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {/* Star rating — full width, top of card */}
                  {ratingData === 'loading' || !ratingData ? (
                    <div style={{ fontSize: 6, color: '#555577', letterSpacing: 1 }}>LOADING RATINGS...</div>
                  ) : (
                    <div>
                      <StarRow
                        rating={(ratingData as RatingSummary).avg}
                        count={(ratingData as RatingSummary).count}
                        locked={!canRate}
                        onRate={canRate ? (r) => handleRate(level.id, r) : undefined}
                      />
                      {!playerName && (
                        <div style={{ fontSize: 5, color: '#555577', letterSpacing: 1, marginTop: 4 }}>
                          SET NAME TO RATE
                        </div>
                      )}
                    </div>
                  )}

                  {/* Level name */}
                  <div style={{
                    fontSize: 11, color: '#ffffff', letterSpacing: 1,
                    lineHeight: 1.5, wordBreak: 'break-word', minHeight: 32,
                    marginTop: 8, marginBottom: -4,
                  }}>
                    {level.name}
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#ff69b422' }} />

                  {/* Creator + date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 7, color: '#ff69b4', letterSpacing: 1 }}>
                      BY {level.creatorName.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 6, color: '#555577', letterSpacing: 1 }}>
                      {formatDate(level.createdAt)}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{
                      flex: 1, background: '#ffffff0a', border: '1px solid #ffffff11',
                      padding: '6px 8px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 6, color: '#888', marginBottom: 3 }}>HOOPS</div>
                      <div style={{ fontSize: 11, color: '#ffd700' }}>{level.hoops.length}</div>
                    </div>
                    <div style={{
                      flex: 1, background: '#ffffff0a', border: '1px solid #ffffff11',
                      padding: '6px 8px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 6, color: '#888', marginBottom: 3 }}>MAKES</div>
                      <div style={{ fontSize: 11, color: '#00ffff' }}>{level.makesNeeded}</div>
                    </div>
                  </div>

                  {/* Play button */}
                  <button
                    onClick={() => onPlay(level)}
                    style={{
                      background: '#1a1035', color: '#00ff88',
                      border: '3px solid #00ff88', boxShadow: '4px 4px 0 #004422',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 11, padding: '12px 0',
                      cursor: 'pointer', letterSpacing: 2, width: '100%',
                      marginTop: 4,
                    }}
                    onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
                    onMouseUp={e => (e.currentTarget.style.transform = '')}
                    onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
                    onTouchEnd={e => (e.currentTarget.style.transform = '')}
                  >
                    ▶ PLAY
                  </button>

                  {/* Completions accordion */}
                  <button
                    onClick={() => toggleCompletions(level.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #ffffff11',
                      color: '#888899',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 6, padding: '8px 10px',
                      cursor: 'pointer', letterSpacing: 1,
                      width: '100%', textAlign: 'left',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span>
                      {completionCount !== null
                        ? `${completionCount} COMPLETED`
                        : 'COMPLETIONS'}
                    </span>
                    <span style={{ fontSize: 8 }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded completions list */}
                  {isExpanded && (
                    <div style={{
                      background: '#ffffff06',
                      border: '1px solid #ffffff11',
                      padding: '8px 10px',
                      maxHeight: 120,
                      overflowY: 'auto',
                      scrollbarWidth: 'none',
                    }}>
                      {completions === 'loading' ? (
                        <div style={{ fontSize: 6, color: '#555577', textAlign: 'center' }}>LOADING...</div>
                      ) : Array.isArray(completions) && completions.length === 0 ? (
                        <div style={{ fontSize: 6, color: '#444466', textAlign: 'center', lineHeight: 2 }}>
                          NO COMPLETIONS YET<br />BE THE FIRST!
                        </div>
                      ) : Array.isArray(completions) && completions.map((c, idx) => (
                        <div key={idx} style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', padding: '4px 0',
                          borderBottom: idx < completions.length - 1 ? '1px solid #ffffff0a' : 'none',
                        }}>
                          <span style={{ fontSize: 6, color: '#00ff88', letterSpacing: 1 }}>
                            {c.playerName.toUpperCase()}
                          </span>
                          <span style={{ fontSize: 5, color: '#444466' }}>
                            {formatDate(c.completedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
