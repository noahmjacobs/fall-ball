import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { EditorHoop, EditorObstacle, LevelData, HoopPattern } from '../types/level';

const CW = 390;
const DROP_H = 90;
const RIM_H = 14;
const BALL_R = 14;

type Tool = 'select' | 'hoop' | 'metal' | 'trampoline';

interface Props {
  onBack: () => void;
  onTest: (data: LevelData) => void;
  initialData?: LevelData;
  mode?: 'admin' | 'user';
  onSaveToCloud?: (data: LevelData) => Promise<void>;
}

let _nextId = 1;
function uid() { return `e${_nextId++}`; }

function makeHoop(x: number, y: number): EditorHoop {
  return {
    id: uid(), baseX: Math.round(x), baseY: Math.round(y),
    pattern: 'linear', speed: 2.0,
    innerHalf: 44, rimThick: 10,
    ampX: 120, ampY: 60, frameOffset: 0,
    rotation: 0,
  };
}

function makeObstacle(x1: number, y1: number, x2: number, y2: number, type: 'metal' | 'trampoline'): EditorObstacle {
  return {
    id: uid(),
    x1: Math.round(x1), y1: Math.round(y1),
    x2: Math.round(x2), y2: Math.round(y2),
    type,
    thick: type === 'trampoline' ? 10 : 5,
    restitution: type === 'trampoline' ? 0.89 : 0.80,
    friction: type === 'trampoline' ? 1.0 : 0.95,
  };
}

// Draw hoop exactly like the game
function drawHoop(ctx: CanvasRenderingContext2D, hx: number, hy: number, innerHalf: number, rimThick: number, selected: boolean, rotationDeg = 0) {
  const outerHalf = innerHalf + rimThick;
  const rot = rotationDeg * Math.PI / 180;

  ctx.save();
  ctx.translate(hx, hy);
  if (rot) ctx.rotate(rot);

  if (selected) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-outerHalf - 8, -36, (outerHalf + 8) * 2, 88);
    ctx.setLineDash([]);
  }

  // Net
  const netTop = RIM_H / 2, netBot = netTop + 42;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    const topX = -innerHalf + t * innerHalf * 2;
    const botX = -innerHalf * 0.65 + t * innerHalf * 1.3;
    ctx.beginPath(); ctx.moveTo(topX, netTop); ctx.lineTo(botX, netBot); ctx.stroke();
  }
  [0.3, 0.6, 1.0].forEach(frac => {
    const ny = netTop + (netBot - netTop) * frac;
    const shrink = 0.35 * frac;
    ctx.beginPath();
    ctx.moveTo(-innerHalf * (1 - shrink), ny);
    ctx.lineTo(innerHalf * (1 - shrink), ny);
    ctx.stroke();
  });

  // Opening line
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-innerHalf, 0); ctx.lineTo(innerHalf, 0); ctx.stroke();

  // Left rim
  ctx.fillStyle = '#e83232';
  ctx.fillRect(-outerHalf, -RIM_H / 2, rimThick, RIM_H);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(-outerHalf, -RIM_H / 2, rimThick, 3);

  // Right rim
  ctx.fillStyle = '#e83232';
  ctx.fillRect(innerHalf, -RIM_H / 2, rimThick, RIM_H);
  ctx.fillStyle = '#ff6666';
  ctx.fillRect(innerHalf, -RIM_H / 2, rimThick, 3);

  ctx.restore();
}

export default function LevelEditorScreen({ onBack, onTest, initialData, mode = 'admin', onSaveToCloud }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  const [tool, setTool] = useState<Tool>('select');
  const [hoops, setHoops] = useState<EditorHoop[]>(initialData?.hoops ?? []);
  const [obstacles, setObstacles] = useState<EditorObstacle[]>(initialData?.obstacles ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [levelName, setLevelName] = useState(initialData?.name ?? 'New Level');
  const [makesNeeded, setMakesNeeded] = useState(initialData?.makesNeeded ?? 3);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawPreview, setDrawPreview] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [cloudSaveState, setCloudSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const drawingRef = useRef<{ x1: number; y1: number } | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ch = Math.min(window.innerHeight, 844);

  const liveRef = useRef({ hoops, obstacles, selectedId, drawPreview, tool });
  liveRef.current = { hoops, obstacles, selectedId, drawPreview, tool };

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = CW / rect.width;
    const sy = ch / rect.height;
    if ('touches' in e) {
      const t = e.touches[0] || (e as React.TouchEvent).changedTouches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
  }

  function hitTest(x: number, y: number, h: EditorHoop[], obs: EditorObstacle[]): string | null {
    for (const hoop of [...h].reverse()) {
      const dx = x - hoop.baseX, dy = y - hoop.baseY;
      if (Math.sqrt(dx * dx + dy * dy) < hoop.innerHalf + hoop.rimThick + 14) return hoop.id;
    }
    for (const o of [...obs].reverse()) {
      const dx = o.x2 - o.x1, dy = o.y2 - o.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let t = ((x - o.x1) * dx + (y - o.y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      if (Math.hypot(x - (o.x1 + t * dx), y - (o.y1 + t * dy)) < 18) return o.id;
    }
    return null;
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pos = getPos(e);
    const { tool: t, hoops: h, obstacles: obs } = liveRef.current;

    if (t === 'select') {
      const hit = hitTest(pos.x, pos.y, h, obs);
      setSelectedId(hit);
      if (hit) {
        const hoop = h.find(hh => hh.id === hit);
        if (hoop) dragRef.current = { id: hit, offsetX: pos.x - hoop.baseX, offsetY: pos.y - hoop.baseY };
        else dragRef.current = { id: hit, offsetX: 0, offsetY: 0 };
      }
    } else if (t === 'hoop') {
      if (pos.y > DROP_H + 20) {
        const h2 = makeHoop(pos.x, pos.y);
        setHoops(prev => [...prev, h2]);
        setSelectedId(h2.id);
        setTool('select');
        setDrawerOpen(true);
      }
    } else if (t === 'metal' || t === 'trampoline') {
      drawingRef.current = { x1: pos.x, y1: pos.y };
      setDrawPreview({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    }
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pos = getPos(e);
    if (drawingRef.current) {
      setDrawPreview({ ...drawingRef.current, x2: pos.x, y2: pos.y });
    } else if (dragRef.current) {
      const { id, offsetX, offsetY } = dragRef.current;
      setHoops(prev => prev.map(h =>
        h.id === id ? { ...h, baseX: Math.round(pos.x - offsetX), baseY: Math.round(pos.y - offsetY) } : h
      ));
    }
  }

  function onPointerUp(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pos = getPos(e);
    const { tool: t } = liveRef.current;
    if (drawingRef.current && (t === 'metal' || t === 'trampoline')) {
      const { x1, y1 } = drawingRef.current;
      if (Math.hypot(pos.x - x1, pos.y - y1) > 20) {
        const o = makeObstacle(x1, y1, pos.x, pos.y, t);
        setObstacles(prev => [...prev, o]);
        setSelectedId(o.id);
        setTool('select');
        setDrawerOpen(true);
      }
      drawingRef.current = null;
      setDrawPreview(null);
    }
    dragRef.current = null;
  }

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = CW;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    function render() {
      frameRef.current++;
      const f = frameRef.current;
      const { hoops: h, obstacles: obs, selectedId: sel, drawPreview: dp, tool: t } = liveRef.current;

      ctx.fillStyle = '#1a1035';
      ctx.fillRect(0, 0, CW, ch);

      // Grid dots
      ctx.fillStyle = 'rgba(100,100,160,0.22)';
      for (let gx = 20; gx < CW; gx += 20)
        for (let gy = DROP_H + 20; gy < ch; gy += 20)
          ctx.fillRect(gx - 1, gy - 1, 2, 2);

      // Drop zone
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, CW, DROP_H);
      ctx.strokeStyle = '#00ffff44'; ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(0, DROP_H); ctx.lineTo(CW, DROP_H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#00ffff44';
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('DROP ZONE', CW / 2, DROP_H / 2);

      // Ball preview in drop zone
      const ballX = CW / 2;
      const ballY = DROP_H / 2 + 15;
      ctx.globalAlpha = 0.4 + 0.15 * Math.sin(f * 0.05);
      ctx.fillStyle = '#ff8c00';
      for (let dy = -BALL_R; dy <= BALL_R; dy++) {
        const hw = Math.round(Math.sqrt(BALL_R * BALL_R - dy * dy));
        ctx.fillRect(Math.round(ballX) - hw, Math.round(ballY + dy), hw * 2, 1);
      }
      // Ball lines
      ctx.strokeStyle = '#cc5500'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ballX - BALL_R, ballY); ctx.lineTo(ballX + BALL_R, ballY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ballX, ballY - BALL_R); ctx.lineTo(ballX, ballY + BALL_R); ctx.stroke();
      ctx.globalAlpha = 1;

      // Obstacles
      ctx.lineCap = 'round';
      for (const o of obs) {
        const isSel = o.id === sel;
        if (isSel) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14; }
        ctx.strokeStyle = o.type === 'trampoline' ? '#ffd700' : '#b0b0b0';
        ctx.lineWidth = o.thick;
        ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = isSel ? '#ffd700' : (o.type === 'trampoline' ? '#ffaa00' : '#cccccc');
        for (const ep of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
          ctx.beginPath(); ctx.arc(ep.x, ep.y, 5, 0, Math.PI * 2); ctx.fill();
        }
        if (isSel) {
          ctx.fillStyle = o.type === 'trampoline' ? '#ffd700' : '#cccccc';
          ctx.font = "7px 'Press Start 2P', monospace";
          ctx.textAlign = 'center';
          ctx.fillText(o.type.toUpperCase(), (o.x1 + o.x2) / 2, Math.min(o.y1, o.y2) - 14);
        }
      }

      // Hoops
      for (const hoop of h) {
        drawHoop(ctx, hoop.baseX, hoop.baseY, hoop.innerHalf, hoop.rimThick, hoop.id === sel, hoop.rotation ?? 0);
        ctx.fillStyle = hoop.id === sel ? '#ffd700' : '#8888bb';
        ctx.font = "7px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        const labelY = hoop.baseY - (hoop.innerHalf + hoop.rimThick + 14);
        ctx.fillText(hoop.pattern.toUpperCase(), hoop.baseX, labelY);
      }

      // Drawing preview
      if (dp) {
        ctx.strokeStyle = t === 'trampoline' ? '#ffd70088' : '#b0b0b088';
        ctx.lineWidth = t === 'trampoline' ? 10 : 5;
        ctx.lineCap = 'round';
        ctx.setLineDash([8, 5]);
        ctx.beginPath(); ctx.moveTo(dp.x1, dp.y1); ctx.lineTo(dp.x2, dp.y2); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Tool cursor hint
      if (t !== 'select' && t !== 'metal' && t !== 'trampoline') {
        const pulse = 0.5 + 0.5 * Math.sin(f * 0.1);
        ctx.globalAlpha = pulse * 0.5;
        ctx.fillStyle = '#00ffff';
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        ctx.fillText('TAP BELOW TO PLACE', CW / 2, ch * 0.5);
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const selHoop = hoops.find(h => h.id === selectedId) ?? null;
  const selObs = obstacles.find(o => o.id === selectedId) ?? null;

  function updateHoop(updates: Partial<EditorHoop>) {
    if (!selectedId) return;
    setHoops(prev => prev.map(h => h.id === selectedId ? { ...h, ...updates } : h));
  }
  function updateObs(updates: Partial<EditorObstacle>) {
    if (!selectedId) return;
    setObstacles(prev => prev.map(o => o.id === selectedId ? { ...o, ...updates } : o));
  }
  function deleteSelected() {
    setHoops(prev => prev.filter(h => h.id !== selectedId));
    setObstacles(prev => prev.filter(o => o.id !== selectedId));
    setSelectedId(null);
  }
  function saveJSON() {
    const data: LevelData = { name: levelName, makesNeeded, hoops, obstacles };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${levelName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveMenuOpen(false);
  }

  function openFile() {
    setSaveMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function saveToCloud() {
    if (!onSaveToCloud) return;
    setCloudSaveState('saving');
    try {
      await onSaveToCloud({ name: levelName, makesNeeded, hoops, obstacles });
      setCloudSaveState('saved');
      setTimeout(() => setCloudSaveState('idle'), 2000);
    } catch {
      setCloudSaveState('error');
      setTimeout(() => setCloudSaveState('idle'), 3000);
    }
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as LevelData;
        setLevelName(data.name ?? 'Imported Level');
        setMakesNeeded(data.makesNeeded ?? 3);
        setHoops((data.hoops ?? []).map(h => ({ ...h, id: uid() })));
        setObstacles((data.obstacles ?? []).map(o => ({ ...o, id: uid() })));
        setSelectedId(null);
      } catch {
        alert('Could not read that file — make sure it is a valid level JSON.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-opened
    e.target.value = '';
  }

  const patterns: HoopPattern[] = ['still', 'linear', 'linear_v', 'rectangle', 'circle', 'figure8'];
  const showAmpX = selHoop && !['still', 'linear_v'].includes(selHoop.pattern);
  const showAmpY = selHoop && ['linear_v', 'circle', 'figure8', 'rectangle'].includes(selHoop.pattern);
  const hasContent = hoops.length > 0 || obstacles.length > 0;

  const drawerH = drawerOpen ? (selHoop || selObs ? 340 : 160) : 48;

  return (
    <div style={{
      width: '100%', height: '100dvh',
      background: '#1a1035',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: "'Press Start 2P', monospace",
      position: 'relative',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.5)',
        borderBottom: '1px solid #222244',
        flexShrink: 0, gap: 8,
        zIndex: 10,
      }}>
        <button onClick={onBack} style={smallBtn}>← BACK</button>
        <input
          value={levelName}
          onChange={e => setLevelName(e.target.value)}
          style={{
            background: 'transparent', color: '#ffd700',
            border: 'none', borderBottom: '1px solid #444',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 8, padding: '4px 6px',
            flex: 1, minWidth: 0, textAlign: 'center',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onTest({ name: levelName, makesNeeded, hoops, obstacles })}
            disabled={!hasContent}
            style={{ ...smallBtn, color: hasContent ? '#00ff88' : '#333', borderColor: hasContent ? '#00ff88' : '#333' }}
          >▶ TEST</button>

          {/* Save button — user mode: simple cloud save; admin mode: dropdown with file save + open */}
          {mode === 'user' ? (
            <button
              onClick={saveToCloud}
              disabled={!hasContent || cloudSaveState === 'saving'}
              style={{
                ...smallBtn,
                color: cloudSaveState === 'saved' ? '#00ff88'
                     : cloudSaveState === 'error' ? '#ff4444'
                     : hasContent ? '#ff69b4' : '#333',
                borderColor: cloudSaveState === 'saved' ? '#00ff88'
                           : cloudSaveState === 'error' ? '#ff4444'
                           : hasContent ? '#ff69b4' : '#333',
              }}
            >
              {cloudSaveState === 'saving' ? '...' : cloudSaveState === 'saved' ? '✓ SAVED' : cloudSaveState === 'error' ? '✗ ERR' : '☁ SAVE'}
            </button>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSaveMenuOpen(o => !o)}
                style={{ ...smallBtn, color: '#4488ff', borderColor: '#4488ff', paddingRight: 10 }}
              >↓ SAVE ▾</button>

              {saveMenuOpen && (
                <>
                  {/* Backdrop to close on outside tap */}
                  <div
                    onClick={() => setSaveMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  />
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: '#0d0d20', border: '2px solid #4488ff',
                    boxShadow: '4px 4px 0 rgba(0,0,0,0.6)',
                    zIndex: 100, minWidth: 130,
                    display: 'flex', flexDirection: 'column',
                  }}>
                    <button
                      onClick={saveJSON}
                      disabled={!hasContent}
                      style={{
                        ...smallBtn, border: 'none', borderBottom: '1px solid #222244',
                        color: hasContent ? '#4488ff' : '#444', padding: '10px 14px',
                        textAlign: 'left', borderRadius: 0,
                      }}
                    >↓ SAVE</button>
                    <button
                      onClick={openFile}
                      style={{
                        ...smallBtn, border: 'none',
                        color: '#ffd700', padding: '10px 14px',
                        textAlign: 'left', borderRadius: 0,
                      }}
                    >📂 OPEN FILE</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={onFileSelected}
        />
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            imageRendering: 'pixelated',
            width: '100%', height: '100%',
            cursor: tool === 'select' ? 'pointer' : 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
      </div>

      {/* Bottom drawer */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: drawerH,
        background: '#0d0d20',
        borderTop: '2px solid #222244',
        transition: 'height 0.2s ease',
        display: 'flex', flexDirection: 'column',
        zIndex: 20,
      }}>
        {/* Drawer handle */}
        <button
          onClick={() => { setDrawerOpen(o => !o); }}
          style={{
            background: 'transparent',
            border: 'none', borderBottom: '1px solid #222244',
            color: '#555577', cursor: 'pointer',
            padding: '10px', fontSize: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 8, fontFamily: "'Press Start 2P', monospace", color: '#666688' }}>
            {tool !== 'select' ? `● ${tool.toUpperCase()} SELECTED` :
             selectedId ? `● ${selHoop ? 'HOOP' : selObs?.type.toUpperCase()} PROPERTIES` :
             `${hoops.length}H · ${obstacles.length}OBS`}
          </span>
          <span>{drawerOpen ? '▼' : '▲'}</span>
        </button>

        {drawerOpen && (
          <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px' }}>

            {/* Asset picker — always visible when drawer is open and nothing selected for props */}
            {!selHoop && !selObs && (
              <>
                <div style={{ color: '#444466', fontSize: 6, marginBottom: 8 }}>PLACE ASSET</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <AssetButton
                    label="HOOP"
                    active={tool === 'hoop'}
                    color="#e83232"
                    icon={<HoopIcon />}
                    onClick={() => { setTool('hoop'); setSelectedId(null); }}
                  />
                  <AssetButton
                    label="METAL"
                    active={tool === 'metal'}
                    color="#aaaaaa"
                    icon={<BarIcon color="#b0b0b0" />}
                    onClick={() => { setTool('metal'); setSelectedId(null); }}
                  />
                  <AssetButton
                    label="TRAMP"
                    active={tool === 'trampoline'}
                    color="#ffd700"
                    icon={<BarIcon color="#ffd700" />}
                    onClick={() => { setTool('trampoline'); setSelectedId(null); }}
                  />
                  {tool !== 'select' && (
                    <AssetButton
                      label="CANCEL"
                      active={false}
                      color="#555"
                      icon={<span style={{ fontSize: 16 }}>✕</span>}
                      onClick={() => setTool('select')}
                    />
                  )}
                </div>

                <div style={{ color: '#444466', fontSize: 6, marginBottom: 6 }}>MAKES TO ADVANCE</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setMakesNeeded(n)} style={{
                      flex: 1, padding: '7px',
                      background: makesNeeded === n ? '#ffd70022' : 'transparent',
                      color: makesNeeded === n ? '#ffd700' : '#555',
                      border: `2px solid ${makesNeeded === n ? '#ffd700' : '#333'}`,
                      fontFamily: "'Press Start 2P', monospace", fontSize: 9, cursor: 'pointer',
                    }}>{n}</button>
                  ))}
                </div>

                {hasContent && (
                  <button onClick={() => { setHoops([]); setObstacles([]); setSelectedId(null); }} style={clearBtn}>
                    CLEAR ALL
                  </button>
                )}
              </>
            )}

            {/* Hoop properties */}
            {selHoop && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#ff6666', fontSize: 8 }}>HOOP</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setSelectedId(null); setTool('select'); }} style={smallBtn}>← BACK</button>
                    <button onClick={deleteSelected} style={{ ...smallBtn, color: '#ff4444', borderColor: '#ff4444' }}>DELETE</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <PropLabel>PATTERN</PropLabel>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {patterns.map(p => (
                        <button key={p} onClick={() => updateHoop({ pattern: p })} style={{
                          padding: '5px 8px',
                          background: selHoop.pattern === p ? '#ff666622' : 'transparent',
                          color: selHoop.pattern === p ? '#ff6666' : '#555',
                          border: `1px solid ${selHoop.pattern === p ? '#ff6666' : '#333'}`,
                          fontFamily: "'Press Start 2P', monospace", fontSize: 6, cursor: 'pointer',
                        }}>{p.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>

                  {selHoop.pattern !== 'still' && (
                    <div>
                      <PropLabel>SPEED: {selHoop.speed.toFixed(1)}</PropLabel>
                      <input type="range" min={0.5} max={5} step={0.5} value={selHoop.speed}
                        onChange={e => updateHoop({ speed: +e.target.value })} style={slider} />
                    </div>
                  )}

                  <div>
                    <PropLabel>SIZE: {selHoop.innerHalf * 2}px</PropLabel>
                    <input type="range" min={20} max={80} step={2} value={selHoop.innerHalf}
                      onChange={e => updateHoop({ innerHalf: +e.target.value })} style={slider} />
                  </div>

                  <div>
                    <PropLabel>TILT: {selHoop.rotation ?? 0}°</PropLabel>
                    <input type="range" min={0} max={359} step={1} value={selHoop.rotation ?? 0}
                      onChange={e => updateHoop({ rotation: +e.target.value })} style={slider} />
                  </div>

                  {showAmpX && (
                    <div>
                      <PropLabel>AMP X: {selHoop.ampX}px</PropLabel>
                      <input type="range" min={20} max={170} step={5} value={selHoop.ampX}
                        onChange={e => updateHoop({ ampX: +e.target.value })} style={slider} />
                    </div>
                  )}

                  {showAmpY && (
                    <div>
                      <PropLabel>AMP Y: {selHoop.ampY}px</PropLabel>
                      <input type="range" min={20} max={250} step={10} value={selHoop.ampY}
                        onChange={e => updateHoop({ ampY: +e.target.value })} style={slider} />
                    </div>
                  )}

                  {selHoop.pattern !== 'still' && (
                    <div>
                      <PropLabel>OFFSET: {selHoop.frameOffset}</PropLabel>
                      <input type="range" min={0} max={60} step={5} value={selHoop.frameOffset}
                        onChange={e => updateHoop({ frameOffset: +e.target.value })} style={slider} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Obstacle properties */}
            {selObs && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: selObs.type === 'trampoline' ? '#ffd700' : '#aaaaaa', fontSize: 8 }}>
                    {selObs.type.toUpperCase()}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setSelectedId(null); setTool('select'); }} style={smallBtn}>← BACK</button>
                    <button onClick={deleteSelected} style={{ ...smallBtn, color: '#ff4444', borderColor: '#ff4444' }}>DELETE</button>
                  </div>
                </div>

                <PropLabel>BOUNCINESS: {selObs.restitution.toFixed(2)}</PropLabel>
                <input type="range" min={0.2} max={1.0} step={0.05} value={selObs.restitution}
                  onChange={e => updateObs({ restitution: +e.target.value })} style={slider} />

                <PropLabel>THICKNESS: {selObs.thick}px</PropLabel>
                <input type="range" min={3} max={20} step={1} value={selObs.thick}
                  onChange={e => updateObs({ thick: +e.target.value })} style={slider} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Asset button with icon
function AssetButton({ label, active, color, icon, onClick }: {
  label: string; active: boolean; color: string;
  icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 5, padding: '8px 4px',
      background: active ? color + '22' : 'transparent',
      border: `2px solid ${active ? color : '#2a2a44'}`,
      cursor: 'pointer',
    }}>
      <div style={{ height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <span style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 6, color: active ? color : '#555577',
      }}>{label}</span>
    </button>
  );
}

// Mini hoop icon
function HoopIcon() {
  return (
    <svg width="40" height="20" viewBox="0 0 40 20">
      <rect x="2" y="7" width="6" height="6" fill="#e83232" />
      <rect x="32" y="7" width="6" height="6" fill="#e83232" />
      <line x1="8" y1="10" x2="32" y2="10" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <line x1="8" y1="13" x2="14" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1="20" y1="13" x2="20" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
      <line x1="32" y1="13" x2="26" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
    </svg>
  );
}

// Mini bar icon
function BarIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="10" viewBox="0 0 40 10">
      <line x1="4" y1="5" x2="36" y2="5" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <circle cx="4" cy="5" r="3" fill={color} />
      <circle cx="36" cy="5" r="3" fill={color} />
    </svg>
  );
}

const PropLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ color: '#555577', fontSize: 6, marginBottom: 3, marginTop: 6 }}>{children}</div>
);

const slider: React.CSSProperties = { width: '100%', accentColor: '#4488ff', margin: 0 };

const smallBtn: React.CSSProperties = {
  background: 'transparent', color: '#555577',
  border: '1px solid #333355',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 6, padding: '6px 8px', cursor: 'pointer',
};

const clearBtn: React.CSSProperties = {
  background: '#1a0000', color: '#ff4444',
  border: '1px solid #442222',
  fontFamily: "'Press Start 2P', monospace",
  fontSize: 6, padding: '7px', cursor: 'pointer', width: '100%',
};
