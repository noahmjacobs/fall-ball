import React, { useEffect, useRef, useState } from 'react';
export type BallSkin =
  | 'basketball' | 'baseball' | 'soccer'
  | 'watermelon' | 'sun' | 'moon' | 'golf' | 'smiley'
  | 'eightball' | 'earth' | 'spiky' | 'eyeball';

export const SKINS: { id: BallSkin; name: string }[] = [
  { id: 'basketball', name: 'BASKETBALL' },
  { id: 'baseball',   name: 'BASEBALL' },
  { id: 'soccer',     name: 'SOCCER BALL' },
  { id: 'watermelon', name: 'WATERMELON' },
  { id: 'sun',        name: 'SUN' },
  { id: 'moon',       name: 'MOON' },
  { id: 'golf',       name: 'GOLF BALL' },
  { id: 'smiley',     name: 'SMILEY' },
  { id: 'eightball',  name: '8-BALL' },
  { id: 'earth',      name: 'EARTH' },
  { id: 'spiky',      name: 'SPIKY' },
  { id: 'eyeball',    name: 'EYEBALL' },
];

interface Props {
  currentSkin: BallSkin;
  onSelect: (skin: BallSkin) => void;
  onBack: () => void;
}

function pixelCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const x = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - x), Math.round(cy + y), x * 2, 1);
  }
}

function drawBasketball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#e87722');
  ctx.fillStyle = '#f5a040';
  for (let dy = -r + 2; dy <= -r + Math.floor(r * 0.3); dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy)) - Math.floor(r * 0.2);
    if (hw > 0) ctx.fillRect(cx - hw + Math.floor(r * 0.15), cy + dy, hw, 1);
  }
  ctx.strokeStyle = '#8B3A00'; ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, -Math.PI * 0.6, Math.PI * 0.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, Math.PI * 0.4, Math.PI * 1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx - r * 0.3, cy, r * 0.75, -Math.PI * 0.3, Math.PI * 0.3); ctx.stroke();
}

function drawBaseball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#f4f0e8');
  ctx.fillStyle = '#ffffff';
  for (let dy = -r + 2; dy <= -r + Math.floor(r * 0.3); dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy)) - Math.floor(r * 0.2);
    if (hw > 0) ctx.fillRect(cx - hw + Math.floor(r * 0.15), cy + dy, hw, 1);
  }
  ctx.strokeStyle = '#cc1100'; ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath(); ctx.arc(cx - r * 0.25, cy, r * 0.65, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + r * 0.25, cy, r * 0.65, Math.PI * 0.58, Math.PI * 1.42); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.07);
  const ticks = Math.max(3, Math.floor(r * 0.28));
  for (let i = 0; i <= ticks; i++) {
    const t = (i / ticks) * 0.84 - 0.42;
    const bx = cx - r * 0.25 + Math.cos(t) * r * 0.65;
    const by = cy + Math.sin(t) * r * 0.65;
    const nx = Math.cos(t + Math.PI / 2) * r * 0.13;
    const ny = Math.sin(t + Math.PI / 2) * r * 0.13;
    ctx.beginPath(); ctx.moveTo(bx - nx, by - ny); ctx.lineTo(bx + nx, by + ny); ctx.stroke();
  }
}

function drawSoccer(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#f0f0f0');
  const cr = Math.round(r * 0.28);
  pixelCircle(ctx, cx, cy, cr, '#111111');
  const od = r * 0.62, pr = Math.max(2, Math.round(r * 0.2));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const ox = Math.round(cx + Math.cos(a) * od), oy = Math.round(cy + Math.sin(a) * od);
    if (Math.sqrt((ox - cx) ** 2 + (oy - cy) ** 2) + pr <= r + 1)
      pixelCircle(ctx, ox, oy, pr, '#111111');
  }
}

function drawWatermelon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#2e8b2e');
  // light green stripes
  ctx.fillStyle = '#55bb55';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sx = Math.round(cx + Math.cos(a) * r * 0.88);
    const sy = Math.round(cy + Math.sin(a) * r * 0.88);
    const ex = Math.round(cx + Math.cos(a) * r * 0.65);
    const ey = Math.round(cy + Math.sin(a) * r * 0.65);
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.strokeStyle = '#55bb55';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  }
  // red flesh
  const ir = Math.round(r * 0.76);
  pixelCircle(ctx, cx, cy, ir, '#ff3344');
  // seeds
  ctx.fillStyle = '#111111';
  const seeds = [[-0.3, -0.2], [0.2, -0.3], [0.35, 0.15], [-0.1, 0.35], [-0.35, 0.2], [0.05, 0.05]];
  for (const [sx, sy] of seeds) {
    const ox = Math.round(cx + sx * ir), oy = Math.round(cy + sy * ir);
    ctx.fillRect(ox - 1, oy - Math.max(2, Math.round(r * 0.1)), 2, Math.max(3, Math.round(r * 0.15)));
  }
}

function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // rays behind the circle
  ctx.fillStyle = '#ff9900';
  const rays = 10;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const sa = (0.4 / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - sa) * (r - 1), cy + Math.sin(a - sa) * (r - 1));
    ctx.lineTo(cx + Math.cos(a) * (r + r * 0.42), cy + Math.sin(a) * (r + r * 0.42));
    ctx.lineTo(cx + Math.cos(a + sa) * (r - 1), cy + Math.sin(a + sa) * (r - 1));
    ctx.closePath(); ctx.fill();
  }
  pixelCircle(ctx, cx, cy, r, '#ffd700');
  // highlight
  ctx.fillStyle = '#ffff88';
  for (let dy = -r + 2; dy <= -r + Math.floor(r * 0.4); dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy)) - Math.floor(r * 0.25);
    if (hw > 0) ctx.fillRect(cx - hw + Math.floor(r * 0.2), cy + dy, hw, 1);
  }
}

function drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#f0e060');
  // craters
  const craters = [
    { dx: -0.3, dy: -0.3, cr: 0.2 },
    { dx: 0.3,  dy:  0.1, cr: 0.15 },
    { dx: -0.05, dy: 0.38, cr: 0.13 },
    { dx: 0.1,  dy: -0.1, cr: 0.09 },
  ];
  for (const c of craters) {
    const cr = Math.max(1, Math.round(c.cr * r));
    const ox = Math.round(cx + c.dx * r), oy = Math.round(cy + c.dy * r);
    pixelCircle(ctx, ox, oy, cr, '#c8a800');
    if (cr > 2) {
      ctx.fillStyle = '#ddb800';
      ctx.fillRect(ox - 1, oy - 1, 2, 2);
    }
  }
}

function drawGolf(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#f8f8f8');
  ctx.fillStyle = '#cccccc';
  const spacing = Math.max(3, Math.round(r * 0.33));
  for (let dy = -r + spacing; dy <= r - 1; dy += spacing) {
    const offset = Math.floor(dy / spacing) % 2 === 0 ? 0 : Math.round(spacing / 2);
    for (let dx = -r + spacing + offset; dx <= r - 1; dx += spacing) {
      if (dx * dx + dy * dy < (r - 2) * (r - 2)) {
        const dimR = Math.max(1, Math.round(r * 0.07));
        pixelCircle(ctx, Math.round(cx + dx), Math.round(cy + dy), dimR, '#bbbbbb');
      }
    }
  }
}

function drawSmiley(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#ffd700');
  ctx.fillStyle = '#ffee55';
  for (let dy = -r + 2; dy <= -r + Math.floor(r * 0.35); dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy)) - Math.floor(r * 0.2);
    if (hw > 0) ctx.fillRect(cx - hw + Math.floor(r * 0.15), cy + dy, hw, 1);
  }
  const eyeR = Math.max(1, Math.round(r * 0.13));
  pixelCircle(ctx, Math.round(cx - r * 0.3), Math.round(cy - r * 0.15), eyeR, '#111111');
  pixelCircle(ctx, Math.round(cx + r * 0.3), Math.round(cy - r * 0.15), eyeR, '#111111');
  ctx.strokeStyle = '#111111'; ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.08, r * 0.42, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  // rosy cheeks
  ctx.globalAlpha = 0.35;
  pixelCircle(ctx, Math.round(cx - r * 0.48), Math.round(cy + r * 0.1), Math.max(2, Math.round(r * 0.18)), '#ff6688');
  pixelCircle(ctx, Math.round(cx + r * 0.48), Math.round(cy + r * 0.1), Math.max(2, Math.round(r * 0.18)), '#ff6688');
  ctx.globalAlpha = 1;
}

function drawEightball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#111111');
  const wr = Math.round(r * 0.46);
  pixelCircle(ctx, cx, cy, wr, '#f8f8f8');
  ctx.fillStyle = '#111111';
  ctx.font = `bold ${Math.round(r * 0.58)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8', cx, cy + r * 0.04);
}

function drawEarth(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // clip to circle
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  pixelCircle(ctx, cx, cy, r, '#1a6fcc');
  ctx.fillStyle = '#2e9e2e';
  // rough continent blobs
  const blobs = [
    { dx: -0.22, dy: -0.18, r: 0.35 },
    { dx:  0.28, dy: -0.05, r: 0.28 },
    { dx: -0.05, dy:  0.38, r: 0.22 },
    { dx:  0.12, dy:  0.18, r: 0.16 },
  ];
  for (const b of blobs) {
    pixelCircle(ctx, Math.round(cx + b.dx * r), Math.round(cy + b.dy * r), Math.round(b.r * r), '#2e9e2e');
  }
  // ice caps
  pixelCircle(ctx, Math.round(cx), Math.round(cy - r * 0.88), Math.round(r * 0.2), '#ddeeff');
  ctx.restore();
}

function drawSpiky(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // spikes
  ctx.fillStyle = '#ff4400';
  const spikes = 10;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const sa = (0.38 / spikes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - sa) * (r * 0.92), cy + Math.sin(a - sa) * (r * 0.92));
    ctx.lineTo(cx + Math.cos(a) * (r + r * 0.52), cy + Math.sin(a) * (r + r * 0.52));
    ctx.lineTo(cx + Math.cos(a + sa) * (r * 0.92), cy + Math.sin(a + sa) * (r * 0.92));
    ctx.closePath(); ctx.fill();
  }
  pixelCircle(ctx, cx, cy, r, '#ff8800');
  ctx.fillStyle = '#ffaa44';
  for (let dy = -r + 2; dy <= -r + Math.floor(r * 0.3); dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy)) - Math.floor(r * 0.2);
    if (hw > 0) ctx.fillRect(cx - hw + Math.floor(r * 0.15), cy + dy, hw, 1);
  }
  // angry eyes
  const eyeR = Math.max(1, Math.round(r * 0.12));
  pixelCircle(ctx, Math.round(cx - r * 0.28), Math.round(cy - r * 0.05), eyeR, '#111111');
  pixelCircle(ctx, Math.round(cx + r * 0.28), Math.round(cy - r * 0.05), eyeR, '#111111');
  ctx.strokeStyle = '#111111'; ctx.lineWidth = Math.max(1.5, r * 0.1);
  // angry brows
  ctx.beginPath(); ctx.moveTo(cx - r * 0.44, cy - r * 0.28); ctx.lineTo(cx - r * 0.14, cy - r * 0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + r * 0.44, cy - r * 0.28); ctx.lineTo(cx + r * 0.14, cy - r * 0.18); ctx.stroke();
  // mouth
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.28, r * 0.28, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
}

function drawEyeball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  pixelCircle(ctx, cx, cy, r, '#f8f8f0');
  // veins
  ctx.strokeStyle = '#ff4444'; ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.quadraticCurveTo(
      cx + Math.cos(a + 0.3) * r * 0.6, cy + Math.sin(a + 0.3) * r * 0.6,
      cx + Math.cos(a + 0.15) * r * 0.48, cy + Math.sin(a + 0.15) * r * 0.48
    );
    ctx.stroke();
  }
  // iris
  const ir = Math.round(r * 0.46);
  pixelCircle(ctx, cx, cy, ir, '#3377ff');
  // iris detail ring
  const ir2 = Math.round(r * 0.34);
  ctx.strokeStyle = '#2255cc'; ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath(); ctx.arc(cx, cy, ir2, 0, Math.PI * 2); ctx.stroke();
  // pupil
  pixelCircle(ctx, cx, cy, Math.round(r * 0.22), '#111111');
  // highlight
  ctx.fillStyle = '#ffffff';
  const hs = Math.max(1, Math.round(r * 0.1));
  ctx.fillRect(Math.round(cx + ir * 0.28), Math.round(cy - ir * 0.38), hs * 2, hs * 2);
}

export function drawBallSkin(ctx: CanvasRenderingContext2D, skin: BallSkin, cx: number, cy: number, r: number) {
  const icx = Math.round(cx), icy = Math.round(cy);
  switch (skin) {
    case 'basketball': drawBasketball(ctx, icx, icy, r); break;
    case 'baseball':   drawBaseball(ctx, icx, icy, r); break;
    case 'soccer':     drawSoccer(ctx, icx, icy, r); break;
    case 'watermelon': drawWatermelon(ctx, icx, icy, r); break;
    case 'sun':        drawSun(ctx, icx, icy, r); break;
    case 'moon':       drawMoon(ctx, icx, icy, r); break;
    case 'golf':       drawGolf(ctx, icx, icy, r); break;
    case 'smiley':     drawSmiley(ctx, icx, icy, r); break;
    case 'eightball':  drawEightball(ctx, icx, icy, r); break;
    case 'earth':      drawEarth(ctx, icx, icy, r); break;
    case 'spiky':      drawSpiky(ctx, icx, icy, r); break;
    case 'eyeball':    drawEyeball(ctx, icx, icy, r); break;
  }
}

export default function BallSkinsScreen({ currentSkin, onSelect, onBack }: Props) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const ballCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgRafRef = useRef<number>(0);
  const ballRafRef = useRef<number>(0);
  const [idx, setIdx] = useState(() => Math.max(0, SKINS.findIndex(s => s.id === currentSkin)));
  const [selectedSkin, setSelectedSkin] = useState(currentSkin);
  const idxRef = useRef(idx);

  useEffect(() => { idxRef.current = idx; }, [idx]);

  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const W = 390, H = Math.min(window.innerHeight, 844);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const starColors = ['#ffffff', '#ccbbff', '#aaaaff', '#eeeeff'];
    const stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() < 0.3 ? 2 : 1,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.03,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));
    let frame = 0;
    function render() {
      frame++;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#1a1035'; ctx.fillRect(0, 0, W, H);
      for (const star of stars) {
        const alpha = 0.35 + 0.35 * Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        ctx.globalAlpha = alpha; ctx.fillStyle = star.color;
        ctx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      }
      ctx.globalAlpha = 1;
      bgRafRef.current = requestAnimationFrame(render);
    }
    bgRafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(bgRafRef.current);
  }, []);

  useEffect(() => {
    const canvas = ballCanvasRef.current;
    if (!canvas) return;
    const SIZE = 130;
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    function render() {
      frame++;
      ctx.clearRect(0, 0, SIZE, SIZE);
      const bob = Math.round(Math.sin(frame * 0.04) * 5);
      drawBallSkin(ctx, SKINS[idxRef.current].id, SIZE / 2, SIZE / 2 + bob, 40);
      ballRafRef.current = requestAnimationFrame(render);
    }
    ballRafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(ballRafRef.current);
  }, []);

  const skin = SKINS[idx];
  const isSelected = skin.id === selectedSkin;

  const handleSelect = () => {
    setSelectedSkin(skin.id);
    onSelect(skin.id);
  };

  const arrowBtn: React.CSSProperties = {
    background: 'transparent', color: '#00ffff',
    border: '3px solid #00ffff88',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 18, padding: '14px 18px', cursor: 'pointer',
    boxShadow: '3px 3px 0 #006666', lineHeight: 1,
  };

  return (
    <div style={{
      width: '100%', height: '100dvh', position: 'relative',
      overflow: 'hidden', background: '#1a1035',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      boxSizing: 'border-box',
    }}>
      <canvas ref={bgCanvasRef} style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)', imageRendering: 'pixelated', pointerEvents: 'none',
      }} />

      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 390,
        height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ padding: '28px 16px 0', textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 14, color: '#ffd700', letterSpacing: 2, textShadow: '2px 2px 0 #8B6914' }}>
            BALL SKINS
          </div>
          <div style={{ width: '100%', height: 2, background: 'repeating-linear-gradient(90deg, #ffd700 0px, #ffd700 6px, transparent 6px, transparent 10px)', marginTop: 12 }} />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            style={arrowBtn}
            onClick={() => setIdx(i => (i - 1 + SKINS.length) % SKINS.length)}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >◄</button>

          <canvas ref={ballCanvasRef} style={{ imageRendering: 'pixelated', display: 'block' }} />

          <button
            style={arrowBtn}
            onClick={() => setIdx(i => (i + 1) % SKINS.length)}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >►</button>
        </div>

        <div style={{ fontSize: 10, color: '#ffffff', letterSpacing: 2, marginTop: 20 }}>
          {skin.name}
        </div>

        <div style={{ fontSize: 8, color: '#555588', letterSpacing: 1, marginTop: 8 }}>
          {idx + 1} / {SKINS.length}
        </div>

        <button
          onClick={handleSelect}
          style={{
            marginTop: 16,
            background: isSelected ? '#ffd700' : 'transparent',
            color: isSelected ? '#1a1035' : '#ffd700',
            border: '3px solid #ffd700',
            boxShadow: isSelected ? '4px 4px 0 #8B6914' : '4px 4px 0 rgba(0,0,0,0.5)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 9, padding: '11px 28px', cursor: 'pointer',
            letterSpacing: 1, minWidth: 150,
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
          onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onTouchEnd={e => (e.currentTarget.style.transform = '')}
        >
          {isSelected ? '✓ SELECTED' : 'SELECT'}
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom, 16px))' }}>
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
    </div>
  );
}
