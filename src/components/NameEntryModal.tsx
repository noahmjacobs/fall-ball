import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onSubmit: (name: string) => void;
}

export default function NameEntryModal({ onSubmit }: Props) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(10, 6, 30, 0.92)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      fontFamily: "'Press Start 2P', monospace",
    }}>
      {/* Pixel border box */}
      <div style={{
        border: '4px solid #ffd700',
        boxShadow: '0 0 0 2px #1a1035, 0 0 0 6px #ffd700, 8px 8px 0 rgba(0,0,0,0.5)',
        background: '#1a1035',
        padding: '32px 24px',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}>
        {/* Title */}
        <div style={{
          color: '#ffd700',
          fontSize: 11,
          textAlign: 'center',
          lineHeight: 2,
          textShadow: '2px 2px 0 #8B6914',
        }}>
          ENTER YOUR<br />NAME
        </div>

        {/* Basketball icon */}
        <div style={{ fontSize: 28, lineHeight: 1 }}>🏀</div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value.slice(0, 12).toUpperCase())}
          onKeyDown={handleKeyDown}
          maxLength={12}
          placeholder="PLAYER"
          style={{
            background: '#0d0920',
            border: '3px solid #00ffff',
            color: '#00ffff',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 12,
            padding: '10px 12px',
            width: '100%',
            textAlign: 'center',
            outline: 'none',
            letterSpacing: 2,
            boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.5)',
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
        />

        {/* Char count */}
        <div style={{
          color: '#555',
          fontSize: 8,
          marginTop: -16,
        }}>
          {name.length}/12 CHARS
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={name.trim().length === 0}
          style={{
            background: name.trim().length > 0 ? '#ffd700' : '#3a3020',
            color: name.trim().length > 0 ? '#1a1035' : '#666',
            border: 'none',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 12,
            padding: '12px 28px',
            cursor: name.trim().length > 0 ? 'pointer' : 'default',
            boxShadow: name.trim().length > 0
              ? '4px 4px 0 #8B6914, inset -2px -2px 0 rgba(0,0,0,0.5)'
              : 'none',
            letterSpacing: 1,
            transition: 'background 0.1s',
            imageRendering: 'pixelated',
          }}
          onMouseDown={e => {
            if (name.trim().length > 0) {
              (e.target as HTMLButtonElement).style.transform = 'translate(2px,2px)';
              (e.target as HTMLButtonElement).style.boxShadow = '2px 2px 0 #8B6914';
            }
          }}
          onMouseUp={e => {
            (e.target as HTMLButtonElement).style.transform = '';
            (e.target as HTMLButtonElement).style.boxShadow = name.trim().length > 0
              ? '4px 4px 0 #8B6914, inset -2px -2px 0 rgba(0,0,0,0.5)'
              : 'none';
          }}
        >
          LET'S GO!
        </button>

        <div style={{ color: '#444', fontSize: 7, textAlign: 'center', lineHeight: 2 }}>
          MAX 12 CHARACTERS
        </div>
      </div>
    </div>
  );
}
