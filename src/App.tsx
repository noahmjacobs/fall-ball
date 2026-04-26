import React, { useState, useEffect, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import NameEntryModal from './components/NameEntryModal';
import { submitScore } from './firebase';

type Screen = 'start' | 'game' | 'gameover' | 'leaderboard';

interface GameResult { score: number; level: number; }

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [playerName, setPlayerName] = useState('');
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [personalBest, setPersonalBest] = useState(0);

  useEffect(() => {
    const savedName = localStorage.getItem('fallball_name') || '';
    const savedBest = parseInt(localStorage.getItem('fallball_best') || '0', 10);
    setPlayerName(savedName);
    setPersonalBest(savedBest);
  }, []);

  const handlePlay = useCallback(() => {
    if (!playerName) {
      setShowNameEntry(true);
    } else {
      setScreen('game');
    }
  }, [playerName]);

  const handleNameSubmit = useCallback((name: string) => {
    setPlayerName(name);
    localStorage.setItem('fallball_name', name);
    setShowNameEntry(false);
    setScreen('game');
  }, []);

  const handleGameOver = useCallback(async (score: number, level: number) => {
    setLastResult({ score, level });
    if (score > personalBest) {
      setPersonalBest(score);
      localStorage.setItem('fallball_best', score.toString());
    }
    if (playerName) {
      try { await submitScore(playerName, score, level); } catch (_) {}
    }
    setScreen('gameover');
  }, [playerName, personalBest]);

  return (
    <div style={{
      width: '100%', maxWidth: 390, height: '100dvh',
      margin: '0 auto', position: 'relative', overflow: 'hidden',
      background: '#1a1035'
    }}>
      {showNameEntry && <NameEntryModal onSubmit={handleNameSubmit} />}

      {screen === 'start' && (
        <StartScreen onPlay={handlePlay} onLeaderboard={() => setScreen('leaderboard')} />
      )}
      {screen === 'game' && (
        <GameScreen onGameOver={handleGameOver} personalBest={personalBest} />
      )}
      {screen === 'gameover' && lastResult && (
        <GameOverScreen
          score={lastResult.score}
          level={lastResult.level}
          personalBest={personalBest}
          playerName={playerName}
          onTryAgain={() => setScreen('game')}
          onLeaderboard={() => setScreen('leaderboard')}
        />
      )}
      {screen === 'leaderboard' && (
        <LeaderboardScreen
          playerName={playerName}
          onBack={() => setScreen('start')}
        />
      )}
    </div>
  );
}
