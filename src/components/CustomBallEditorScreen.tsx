import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  type CustomSlot, type CustomBallData,
  loadCustomBallData, renderPixelsToDataUrl, isCustomBallPixel,
} from './BallSkinsScreen';

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID = 32;
const BALL_CX = GRID / 2;   // 16
const BALL_CY = GRID / 2;   // 16
const BALL_R  = 15;

const PALETTE: string[] = [
  '#ffffff', '#cccccc', '#999999', '#555555',
  '#222222', '#000000', '#8B4513', '#cc8844',
  '#ff3333', '#ff8800', '#ffee00', '#44cc44',
  '#00cccc', '#4488ff', '#9933cc', '#ff44bb',
];

const BRUSH_SIZES = [1, 3, 5];
const ZOOM_CELLS = [6, 8, 12, 20];

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeInitialPixels(): string[] {
  return Array.from({ length: GRID * GRID }, (_, i) => {
    const col = i % GRID, row = Math.floor(i / GRID);
    return isCustomBallPixel(col, row) ? '#ffffff' : '';
  });
}

function applyBrush(pixels: string[], gridX: number, gridY: number, diameter: number, color: string): string[] {
  const next = [...pixels];
  const half = Math.floor((diameter - 1) / 2);
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const col = gridX + dx, row = gridY + dy;
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) continue;
      if (!isCustomBallPixel(col, row)) continue;
      next[row * GRID + col] = color;
    }
  }
  return next;
}

function floodFill(pixels: string[], startCol: number, startRow: number, fillColor: string): string[] {
  if (!isCustomBallPixel(startCol, startRow)) return pixels;
  const next = [...pixels];
  const target = next[startRow * GRID + startCol];
  if (target === fillColor) return pixels;
  const queue: number[] = [startRow * GRID + startCol];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (visited.has(idx)) continue;
    visited.add(idx);
    const col = idx % GRID, row = Math.floor(idx / GRID);
    if (!isCustomBallPixel(col, row)) continue;
    if (next[idx] !== target) continue;
    next[idx] = fillColor;
    if (col > 0) queue.push(idx - 1);
    if (col < GRID - 1) queue.push(idx + 1);
    if (row > 0) queue.push(idx - GRID);
    if (row < GRID - 1) queue.push(idx + GRID);
  }
  return next;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  slot: CustomSlot;
  onBack: () => void;
  onSaved: (slot: CustomSlot) => void;
}

const CANVAS_W = 280;
const CANVAS_H = 300;

export default function CustomBallEditorScreen({ slot, onBack, onSaved }: Props) {
  const slotNum = slot === 'custom1' ? 1 : slot === 'custom2' ? 2 : 3;
  const existing = loadCustomBallData(slot);

  // ── Paint state ──────────────────────────────────────────────────────────
  const [pixels, setPixels] = useState<string[]>(() =>
    existing ? [...existing.pixels] : makeInitialPixels()
  );
  const [ballName, setBallName] = useState(existing?.name ?? `CUSTOM ${slotNum}`);
  const [color, setColor] = useState('#ff3333');
  const [brushSize, setBrushSize] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [tool, setTool] = useState<'draw' | 'erase' | 'fill'>('draw');
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewCol, setViewCol] = useState(0);
  const [viewRow, setViewRow] = useState(0);
  const [undoStack, setUndoStack] = useState<string[][]>([]);

  // ── Photo mode state ─────────────────────────────────────────────────────
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [photoScale, setPhotoScale] = useState(1);
  const [photoOffX, setPhotoOffX] = useState(0);
  const [photoOffY, setPhotoOffY] = useState(0);

  // ── Refs for event handlers ───────────────────────────────────────────────
  const pixelsRef    = useRef(pixels);
  const colorRef     = useRef(color);
  const brushRef     = useRef(brushSize);
  const toolRef      = useRef(tool);
  const viewColRef   = useRef(viewCol);
  const viewRowRef   = useRef(viewRow);
  const zoomIdxRef   = useRef(zoomIdx);
  const photoImgRef  = useRef<HTMLImageElement | null>(null);
  const photoModeRef = useRef(false);
  const photoScaleRef = useRef(1);
  const photoOffXRef = useRef(0);
  const photoOffYRef = useRef(0);

  useEffect(() => { pixelsRef.current  = pixels;    }, [pixels]);
  useEffect(() => { colorRef.current   = color;     }, [color]);
  useEffect(() => { brushRef.current   = brushSize; }, [brushSize]);
  useEffect(() => { toolRef.current    = tool;      }, [tool]);
  useEffect(() => { viewColRef.current = viewCol;   }, [viewCol]);
  useEffect(() => { viewRowRef.current = viewRow;   }, [viewRow]);
  useEffect(() => { zoomIdxRef.current = zoomIdx;   }, [zoomIdx]);
  useEffect(() => { photoModeRef.current  = photoMode;  }, [photoMode]);
  useEffect(() => { photoScaleRef.current = photoScale; }, [photoScale]);
  useEffect(() => { photoOffXRef.current  = photoOffX;  }, [photoOffX]);
  useEffect(() => { photoOffYRef.current  = photoOffY;  }, [photoOffY]);

  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const isPaintingRef      = useRef(false);
  const prevTwoRef         = useRef<{ cx: number; cy: number } | null>(null);
  const strokeBeforeRef    = useRef<string[] | null>(null);
  const lastPhotoTouchRef  = useRef<{ cx: number; cy: number } | null>(null);
  const lastPinchDistRef   = useRef(0);
  const lastPinchScaleRef  = useRef(1);

  // ── Layout helper ─────────────────────────────────────────────────────────
  const getOffset = useCallback((zi: number, vc: number, vr: number) => {
    const cs = ZOOM_CELLS[zi];
    const gridPxW = GRID * cs, gridPxH = GRID * cs;
    const offX = gridPxW <= CANVAS_W ? Math.floor((CANVAS_W - gridPxW) / 2) : -vc * cs;
    const offY = gridPxH <= CANVAS_H ? Math.floor((CANVAS_H - gridPxH) / 2) : -vr * cs;
    return { offX, offY, cs };
  }, []);

  // ── Canvas setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width  = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
  }, []);

  // ── Draw: pixel paint mode ────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx  = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const { offX, offY, cs } = getOffset(zoomIdxRef.current, viewColRef.current, viewRowRef.current);
    const px = pixelsRef.current;

    ctx.fillStyle = '#0d0b22';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const sx = offX + col * cs, sy = offY + row * cs;
        if (sx + cs <= 0 || sx >= CANVAS_W || sy + cs <= 0 || sy >= CANVAS_H) continue;
        if (isCustomBallPixel(col, row)) {
          ctx.fillStyle = px[row * GRID + col] || '#ffffff';
          ctx.fillRect(sx, sy, cs, cs);
          if (cs >= 8) {
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(sx + 0.25, sy + 0.25, cs - 0.5, cs - 0.5);
          }
        } else {
          ctx.fillStyle = '#181428';
          ctx.fillRect(sx, sy, cs, cs);
        }
      }
    }

    ctx.strokeStyle = '#5544aa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(offX + BALL_CX * cs, offY + BALL_CY * cs, BALL_R * cs, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [getOffset]);

  // ── Draw: photo positioning mode ──────────────────────────────────────────
  const drawPhotoCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = photoImgRef.current;
    if (!canvas || !img) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx  = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const { offX, offY, cs } = getOffset(zoomIdxRef.current, viewColRef.current, viewRowRef.current);

    ctx.fillStyle = '#0d0b22';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Dark surround for outside-ball area
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        if (!isCustomBallPixel(col, row)) {
          const sx = offX + col * cs, sy = offY + row * cs;
          if (sx + cs <= 0 || sx >= CANVAS_W || sy + cs <= 0 || sy >= CANVAS_H) continue;
          ctx.fillStyle = '#181428';
          ctx.fillRect(sx, sy, cs, cs);
        }
      }
    }

    // Photo clipped to ball circle
    const ballCXpx = offX + BALL_CX * cs;
    const ballCYpx = offY + BALL_CY * cs;
    const ballRpx  = BALL_R * cs;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballCXpx, ballCYpx, ballRpx, 0, Math.PI * 2);
    ctx.clip();
    const pScale = photoScaleRef.current;
    const photoW = img.naturalWidth  * pScale * cs;
    const photoH = img.naturalHeight * pScale * cs;
    const photoX = ballCXpx - photoW / 2 + photoOffXRef.current * cs;
    const photoY = ballCYpx - photoH / 2 + photoOffYRef.current * cs;
    ctx.drawImage(img, photoX, photoY, photoW, photoH);
    ctx.restore();

    // Circle outline
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(ballCXpx, ballCYpx, ballRpx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [getOffset]);

  // ── Unified redraw ────────────────────────────────────────────────────────
  useEffect(() => {
    if (photoMode) drawPhotoCanvas();
    else drawCanvas();
  }, [pixels, viewCol, viewRow, zoomIdx, photoMode, photoScale, photoOffX, photoOffY, drawCanvas, drawPhotoCanvas]);

  // ── Paint helpers ─────────────────────────────────────────────────────────
  function canvasToGrid(touchX: number, touchY: number) {
    const { offX, offY, cs } = getOffset(zoomIdxRef.current, viewColRef.current, viewRowRef.current);
    return {
      col: Math.floor((touchX - offX) / cs),
      row: Math.floor((touchY - offY) / cs),
    };
  }

  function paintAt(touchX: number, touchY: number) {
    const { col, row } = canvasToGrid(touchX, touchY);
    if (col < 0 || col >= GRID || row < 0 || row >= GRID) return;
    if (!isCustomBallPixel(col, row)) return;
    const t = toolRef.current;
    let next: string[];
    if (t === 'fill') {
      next = floodFill(pixelsRef.current, col, row, colorRef.current);
    } else {
      const paintColor = t === 'erase' ? '#ffffff' : colorRef.current;
      next = applyBrush(pixelsRef.current, col, row, brushRef.current, paintColor);
    }
    pixelsRef.current = next;
    setPixels(next);
    drawCanvas();
  }

  // ── Touch events ──────────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault();

    if (photoModeRef.current) {
      const t0 = e.touches[0];
      const centX = e.touches.length >= 2 ? (t0.clientX + e.touches[1].clientX) / 2 : t0.clientX;
      const centY = e.touches.length >= 2 ? (t0.clientY + e.touches[1].clientY) / 2 : t0.clientY;
      lastPhotoTouchRef.current = { cx: centX, cy: centY };
      if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - t0.clientX;
        const dy = e.touches[1].clientY - t0.clientY;
        lastPinchDistRef.current  = Math.sqrt(dx * dx + dy * dy);
        lastPinchScaleRef.current = photoScaleRef.current;
      }
      return;
    }

    if (e.touches.length === 1) {
      isPaintingRef.current = true;
      strokeBeforeRef.current = [...pixelsRef.current];
      prevTwoRef.current = null;
      const rect = canvasRef.current!.getBoundingClientRect();
      paintAt(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
    } else if (e.touches.length === 2) {
      isPaintingRef.current = false;
      prevTwoRef.current = {
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault();

    if (photoModeRef.current) {
      const t0 = e.touches[0];
      const centX = e.touches.length >= 2 ? (t0.clientX + e.touches[1].clientX) / 2 : t0.clientX;
      const centY = e.touches.length >= 2 ? (t0.clientY + e.touches[1].clientY) / 2 : t0.clientY;
      const cs = ZOOM_CELLS[zoomIdxRef.current];

      if (lastPhotoTouchRef.current) {
        const dx = (centX - lastPhotoTouchRef.current.cx) / cs;
        const dy = (centY - lastPhotoTouchRef.current.cy) / cs;
        photoOffXRef.current += dx;
        photoOffYRef.current += dy;
        setPhotoOffX(photoOffXRef.current);
        setPhotoOffY(photoOffYRef.current);
      }
      lastPhotoTouchRef.current = { cx: centX, cy: centY };

      if (e.touches.length === 2 && lastPinchDistRef.current > 0) {
        const dx   = e.touches[1].clientX - t0.clientX;
        const dy   = e.touches[1].clientY - t0.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const newScale = Math.max(0.01, lastPinchScaleRef.current * (dist / lastPinchDistRef.current));
        photoScaleRef.current = newScale;
        setPhotoScale(newScale);
      }

      drawPhotoCanvas();
      return;
    }

    const rect = canvasRef.current!.getBoundingClientRect();
    if (e.touches.length === 1 && isPaintingRef.current) {
      paintAt(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
    } else if (e.touches.length === 2 && prevTwoRef.current) {
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = cx - prevTwoRef.current.cx;
      const dy = cy - prevTwoRef.current.cy;
      prevTwoRef.current = { cx, cy };
      const zi = zoomIdxRef.current, cs = ZOOM_CELLS[zi];
      if (GRID * cs > CANVAS_W) {
        const maxVC = Math.max(0, GRID - Math.floor(CANVAS_W / cs));
        const newVC = Math.max(0, Math.min(maxVC, viewColRef.current - dx / cs));
        viewColRef.current = newVC; setViewCol(newVC);
      }
      if (GRID * cs > CANVAS_H) {
        const maxVR = Math.max(0, GRID - Math.floor(CANVAS_H / cs));
        const newVR = Math.max(0, Math.min(maxVR, viewRowRef.current - dy / cs));
        viewRowRef.current = newVR; setViewRow(newVR);
      }
      drawCanvas();
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (photoModeRef.current) {
      if (e.touches.length < 2) lastPinchDistRef.current = 0;
      if (e.touches.length === 0) lastPhotoTouchRef.current = null;
      return;
    }
    if (isPaintingRef.current && strokeBeforeRef.current) {
      const before = strokeBeforeRef.current;
      setUndoStack(s => [...s.slice(-19), before]);
      strokeBeforeRef.current = null;
    }
    if (e.touches.length === 0) {
      isPaintingRef.current = false;
      prevTwoRef.current = null;
    }
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    if (photoModeRef.current) return;
    isPaintingRef.current = true;
    strokeBeforeRef.current = [...pixelsRef.current];
    const rect = canvasRef.current!.getBoundingClientRect();
    paintAt(e.clientX - rect.left, e.clientY - rect.top);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (photoModeRef.current) {
      if (e.buttons !== 1) return;
      const cs = ZOOM_CELLS[zoomIdxRef.current];
      photoOffXRef.current += e.movementX / cs;
      photoOffYRef.current += e.movementY / cs;
      setPhotoOffX(photoOffXRef.current);
      setPhotoOffY(photoOffYRef.current);
      drawPhotoCanvas();
      return;
    }
    if (!isPaintingRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    paintAt(e.clientX - rect.left, e.clientY - rect.top);
  }

  function endStroke() {
    if (isPaintingRef.current && strokeBeforeRef.current) {
      const before = strokeBeforeRef.current;
      setUndoStack(s => [...s.slice(-19), before]);
      strokeBeforeRef.current = null;
    }
    isPaintingRef.current = false;
  }

  function handleWheel(e: React.WheelEvent) {
    if (!photoModeRef.current) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.01, photoScaleRef.current * factor);
    photoScaleRef.current = newScale;
    setPhotoScale(newScale);
    drawPhotoCanvas();
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Scale so shorter side fills ball diameter (30 grid cells)
      const ballDiam = BALL_R * 2;
      const minDim   = Math.min(img.naturalWidth, img.naturalHeight);
      const initScale = ballDiam / minDim;
      photoImgRef.current  = img;
      photoScaleRef.current = initScale;
      photoOffXRef.current  = 0;
      photoOffYRef.current  = 0;
      photoModeRef.current  = true;
      setPhotoImg(img);
      setPhotoScale(initScale);
      setPhotoOffX(0);
      setPhotoOffY(0);
      setPhotoMode(true);
      setPanelOpen(false);
    };
    img.src = url;
  }

  function applyPhoto() {
    const img = photoImgRef.current;
    if (!img) return;

    // Draw photo at grid scale onto a GRID×GRID canvas then sample each cell
    const tmp = document.createElement('canvas');
    tmp.width = GRID; tmp.height = GRID;
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.imageSmoothingEnabled = true;

    const pScale = photoScaleRef.current;
    const photoW = img.naturalWidth  * pScale;
    const photoH = img.naturalHeight * pScale;
    const photoX = BALL_CX - photoW / 2 + photoOffXRef.current;
    const photoY = BALL_CY - photoH / 2 + photoOffYRef.current;
    tmpCtx.drawImage(img, photoX, photoY, photoW, photoH);

    const newPixels = [...pixelsRef.current];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        if (!isCustomBallPixel(col, row)) continue;
        const d = tmpCtx.getImageData(col, row, 1, 1).data;
        if (d[3] > 0) {
          newPixels[row * GRID + col] =
            `#${d[0].toString(16).padStart(2, '0')}${d[1].toString(16).padStart(2, '0')}${d[2].toString(16).padStart(2, '0')}`;
        }
      }
    }

    setUndoStack(s => [...s.slice(-19), [...pixelsRef.current]]);
    pixelsRef.current = newPixels;
    setPixels(newPixels);
    photoImgRef.current = null;
    photoModeRef.current = false;
    setPhotoImg(null);
    setPhotoMode(false);
  }

  function cancelPhoto() {
    photoImgRef.current  = null;
    photoModeRef.current = false;
    setPhotoImg(null);
    setPhotoMode(false);
  }

  // ── Paint actions ─────────────────────────────────────────────────────────
  function handleUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    pixelsRef.current = [...prev];
    setPixels([...prev]);
    setUndoStack(s => s.slice(0, -1));
  }

  function handleClear() {
    const fresh = makeInitialPixels();
    setUndoStack(s => [...s.slice(-19), [...pixelsRef.current]]);
    pixelsRef.current = fresh;
    setPixels(fresh);
  }

  function handleZoom(delta: number) {
    const next = Math.max(0, Math.min(ZOOM_CELLS.length - 1, zoomIdx + delta));
    setZoomIdx(next); zoomIdxRef.current = next;
    setViewCol(0); viewColRef.current = 0;
    setViewRow(0); viewRowRef.current = 0;
  }

  function handleSave() {
    const dataUrl = renderPixelsToDataUrl(pixels);
    const name    = ballName.trim() || `CUSTOM ${slotNum}`;
    const data: CustomBallData = { name, pixels, dataUrl };
    localStorage.setItem(`fallball_${slot}`, JSON.stringify(data));
    onSaved(slot);
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cellSize = ZOOM_CELLS[zoomIdx];

  const toolBtn = (active: boolean, accent: string): React.CSSProperties => ({
    fontFamily: "'Press Start 2P', monospace",
    fontSize: 6, padding: '7px 6px', cursor: 'pointer', letterSpacing: 1,
    background: active ? accent + '22' : 'transparent',
    color: active ? accent : '#888899',
    border: `2px solid ${active ? accent : '#2a2448'}`,
  });

  const PANEL_W = 118;

  return (
    <div style={{
      width: '100%', height: '100dvh', position: 'relative',
      overflow: 'hidden', background: '#0d0b22',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      boxSizing: 'border-box',
    }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '2px solid #1e1a3a', flexShrink: 0,
      }}>
        <button
          onClick={photoMode ? cancelPhoto : onBack}
          style={{ background: 'transparent', color: '#aaaaff', border: '2px solid #444466', fontFamily: "'Press Start 2P', monospace", fontSize: 7, padding: '7px 11px', cursor: 'pointer', letterSpacing: 1 }}
          onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
          onMouseUp={e => (e.currentTarget.style.transform = '')}
        >{photoMode ? '✕ CANCEL' : '← BACK'}</button>
        <div style={{ fontSize: 8, color: photoMode ? '#ffaa00' : '#ffd700', letterSpacing: 2, textShadow: photoMode ? '2px 2px 0 #664400' : '2px 2px 0 #8B6914' }}>
          {photoMode ? 'POSITION PHOTO' : `CUSTOM BALL ${slotNum}`}
        </div>
        {photoMode ? (
          <button
            onClick={applyPhoto}
            style={{ background: '#004422', color: '#00ff88', border: '2px solid #00aa44', fontFamily: "'Press Start 2P', monospace", fontSize: 7, padding: '7px 12px', cursor: 'pointer', letterSpacing: 1, boxShadow: '3px 3px 0 #002211' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >APPLY ✓</button>
        ) : (
          <button
            onClick={handleSave}
            style={{ background: '#004422', color: '#00ff88', border: '2px solid #00aa44', fontFamily: "'Press Start 2P', monospace", fontSize: 7, padding: '7px 12px', cursor: 'pointer', letterSpacing: 1, boxShadow: '3px 3px 0 #002211' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onMouseUp={e => (e.currentTarget.style.transform = '')}
            onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
            onTouchEnd={e => (e.currentTarget.style.transform = '')}
          >SAVE</button>
        )}
      </div>

      {/* Canvas area + slide-out panel */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{ imageRendering: 'pixelated', cursor: photoMode ? 'grab' : 'crosshair', touchAction: 'none', display: 'block' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
          onWheel={handleWheel}
        />

        {/* Photo mode hint overlay */}
        {photoMode && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: '#00000088', padding: '5px 10px',
            fontSize: 5, color: '#ffffffaa', letterSpacing: 1, whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            DRAG: PAN  •  PINCH / SCROLL: ZOOM
          </div>
        )}

        {/* Tab handle — hidden in photo mode */}
        {!photoMode && (
          <div
            onClick={() => setPanelOpen(o => !o)}
            style={{
              position: 'absolute',
              right: panelOpen ? PANEL_W : 0,
              top: '50%', transform: 'translateY(-50%)',
              background: '#1e1a3a', border: '2px solid #3a3460',
              borderRight: 'none', padding: '10px 5px',
              cursor: 'pointer', zIndex: 30,
              transition: 'right 0.18s ease',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 5, color: '#aaaaff', writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: 2, lineHeight: 1.6 }}>
              {panelOpen ? '▶\nCLOSE' : '◀\nCOLORS'}
            </span>
          </div>
        )}

        {/* Slide-out color panel — hidden in photo mode */}
        {!photoMode && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: panelOpen ? PANEL_W : 0,
            background: '#12102a',
            borderLeft: panelOpen ? '2px solid #2a2448' : 'none',
            overflow: 'hidden',
            transition: 'width 0.18s ease',
            zIndex: 20,
            boxSizing: 'border-box',
          }}>
            <div style={{ width: PANEL_W, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
              {/* Color palette */}
              <div>
                <div style={{ fontSize: 5, color: '#666688', letterSpacing: 1, marginBottom: 7 }}>COLORS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {PALETTE.map(c => (
                    <div
                      key={c}
                      onClick={() => { setColor(c); colorRef.current = c; if (tool === 'erase') { setTool('draw'); toolRef.current = 'draw'; } }}
                      style={{
                        aspectRatio: '1', background: c, cursor: 'pointer',
                        outline: color === c && tool !== 'erase' ? '3px solid #ffffff' : '2px solid #2a2448',
                        outlineOffset: 1, boxSizing: 'border-box',
                      }}
                    />
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 18, height: 18, background: tool === 'erase' ? '#ffffff' : color, border: '2px solid #555577' }} />
                  <span style={{ fontSize: 5, color: '#666688', letterSpacing: 1 }}>
                    {tool === 'erase' ? 'ERASER' : color.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Brush size */}
              <div>
                <div style={{ fontSize: 5, color: '#666688', letterSpacing: 1, marginBottom: 6 }}>BRUSH SIZE</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {BRUSH_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => { setBrushSize(s); brushRef.current = s; }}
                      style={{ ...toolBtn(brushSize === s, '#00ffff'), flex: 1, padding: '6px 2px' }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div>
                <div style={{ fontSize: 5, color: '#666688', letterSpacing: 1, marginBottom: 6 }}>TOOL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <button onClick={() => { setTool('draw'); toolRef.current = 'draw'; }} style={toolBtn(tool === 'draw', '#00ffff')}>DRAW</button>
                  <button onClick={() => { setTool('erase'); toolRef.current = 'erase'; }} style={toolBtn(tool === 'erase', '#ff8844')}>ERASE</button>
                  <button onClick={() => { setTool('fill'); toolRef.current = 'fill'; }} style={toolBtn(tool === 'fill', '#ffee00')}>FILL</button>
                </div>
              </div>

              {/* Undo / Clear / Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 'auto' }}>
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  style={{ ...toolBtn(false, '#aaaaff'), opacity: undoStack.length > 0 ? 1 : 0.35 }}
                >UNDO</button>
                <button onClick={handleClear} style={toolBtn(false, '#ff6666')}>CLEAR</button>
                <div style={{ width: '100%', height: 1, background: '#2a2448', margin: '4px 0' }} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...toolBtn(false, '#ffaa00'),
                    background: '#1a1400',
                    borderColor: '#ffaa0088',
                    color: '#ffaa00',
                    padding: '8px 4px',
                    lineHeight: 1.6,
                  }}
                >📷 USE{'\n'}PHOTO</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{
        borderTop: '2px solid #1e1a3a', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 9, flexShrink: 0,
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
      }}>
        {photoMode ? (
          /* Photo mode bottom: just apply/cancel buttons */
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={cancelPhoto}
              style={{
                flex: 1, background: '#1a0808', color: '#ff6666',
                border: '3px solid #aa2222', boxShadow: '4px 4px 0 #440000',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 8, padding: '10px', cursor: 'pointer', letterSpacing: 1,
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
              onMouseUp={e => (e.currentTarget.style.transform = '')}
              onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
              onTouchEnd={e => (e.currentTarget.style.transform = '')}
            >CANCEL</button>
            <button
              onClick={applyPhoto}
              style={{
                flex: 1, background: '#0a2218', color: '#00ff88',
                border: '3px solid #00aa44', boxShadow: '4px 4px 0 #003311',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 8, padding: '10px', cursor: 'pointer', letterSpacing: 1,
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
              onMouseUp={e => (e.currentTarget.style.transform = '')}
              onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
              onTouchEnd={e => (e.currentTarget.style.transform = '')}
            >APPLY ✓</button>
          </div>
        ) : (
          <>
            {/* Zoom row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 6, color: '#555577', letterSpacing: 1 }}>ZOOM</span>
              <button
                onClick={() => handleZoom(-1)} disabled={zoomIdx === 0}
                style={{ ...toolBtn(false, '#aaaaff'), opacity: zoomIdx > 0 ? 1 : 0.35, padding: '5px 12px', fontSize: 11 }}
              >-</button>
              <span style={{ fontSize: 7, color: '#aaaaff', letterSpacing: 1, minWidth: 30, textAlign: 'center' }}>{cellSize}x</span>
              <button
                onClick={() => handleZoom(1)} disabled={zoomIdx === ZOOM_CELLS.length - 1}
                style={{ ...toolBtn(false, '#aaaaff'), opacity: zoomIdx < ZOOM_CELLS.length - 1 ? 1 : 0.35, padding: '5px 12px', fontSize: 11 }}
              >+</button>
              {GRID * cellSize > CANVAS_W && (
                <span style={{ fontSize: 5, color: '#444466', letterSpacing: 1, marginLeft: 4 }}>2-FINGER PAN</span>
              )}
            </div>

            {/* Name input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 6, color: '#888899', letterSpacing: 1, flexShrink: 0 }}>NAME</span>
              <input
                type="text"
                value={ballName}
                onChange={e => setBallName(e.target.value.toUpperCase().slice(0, 12))}
                maxLength={12}
                style={{
                  flex: 1, background: '#0d0b22', color: '#ffffff',
                  border: '2px solid #2a2448', fontFamily: "'Press Start 2P', monospace",
                  fontSize: 7, padding: '6px 8px', outline: 'none',
                  letterSpacing: 1, textTransform: 'uppercase',
                }}
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              style={{
                background: '#0a2218', color: '#00ff88',
                border: '3px solid #00aa44', boxShadow: '4px 4px 0 #003311',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 9, padding: '11px', cursor: 'pointer',
                letterSpacing: 2, width: '100%',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
              onMouseUp={e => (e.currentTarget.style.transform = '')}
              onTouchStart={e => (e.currentTarget.style.transform = 'translate(2px,2px)')}
              onTouchEnd={e => (e.currentTarget.style.transform = '')}
            >SAVE BALL</button>
          </>
        )}
      </div>
    </div>
  );
}
