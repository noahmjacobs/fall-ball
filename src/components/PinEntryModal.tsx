import React, { useState, useEffect } from 'react';

interface Props {
  correctPin: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PinEntryModal({ correctPin, onSuccess, onCancel }: Props) {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);

  function handleDigit(d: string) {
    if (entered.length >= correctPin.length) return;
    const next = entered + d;
    setEntered(next);
    setError(false);

    if (next.length === correctPin.length) {
      if (next === correctPin) {
        setTimeout(onSuccess, 200);
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => { setEntered(''); setShake(false); }, 600);
      }
    }
  }

  function handleBackspace() {
    setEntered(prev => prev.slice(0, -1));
    setError(false);
  }

  // Keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [entered]);

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: '#12121f',
        border: `2px solid ${error ? '#ff4444' : '#333366'}`,
        padding: '32px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 20,
        animation: shake ? 'shake 0.5s ease' : undefined,
        minWidth: 260,
      }}>
        <style>{`
          @keyframes shake {
            0%,100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-8px); }
            80% { transform: translateX(8px); }
          }
        `}</style>

        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10, color: '#aaaaff', letterSpacing: 2,
        }}>
          ADMIN ACCESS
        </div>

        {/* PIN dots */}
        <div style={{ display: 'flex', gap: 12 }}>
          {Array.from({ length: correctPin.length }).map((_, i) => (
            <div key={i} style={{
              width: 16, height: 16,
              borderRadius: '50%',
              background: i < entered.length
                ? (error ? '#ff4444' : '#ffd700')
                : 'transparent',
              border: `2px solid ${error ? '#ff4444' : i < entered.length ? '#ffd700' : '#444466'}`,
              transition: 'all 0.1s',
            }} />
          ))}
        </div>

        {error && (
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 7, color: '#ff4444',
          }}>
            INCORRECT PIN
          </div>
        )}

        {/* Numpad */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {digits.map((d, i) => (
            <button
              key={i}
              onClick={() => {
                if (d === '⌫') handleBackspace();
                else if (d !== '') handleDigit(d);
              }}
              disabled={d === ''}
              style={{
                width: 56, height: 56,
                background: d === '' ? 'transparent' : '#1a1a2e',
                color: d === '⌫' ? '#ff6666' : '#ffffff',
                border: d === '' ? 'none' : '2px solid #333366',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: d === '⌫' ? 14 : 16,
                cursor: d === '' ? 'default' : 'pointer',
                borderRadius: 4,
                transition: 'transform 0.05s, background 0.05s',
              }}
              onMouseDown={e => { if (d !== '') e.currentTarget.style.background = '#2a2a4e'; }}
              onMouseUp={e => { if (d !== '') e.currentTarget.style.background = '#1a1a2e'; }}
              onTouchStart={e => { if (d !== '') e.currentTarget.style.background = '#2a2a4e'; }}
              onTouchEnd={e => { if (d !== '') e.currentTarget.style.background = '#1a1a2e'; }}
            >
              {d}
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          style={{
            background: 'transparent', color: '#444466',
            border: '1px solid #333',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 7, padding: '8px 20px', cursor: 'pointer',
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
