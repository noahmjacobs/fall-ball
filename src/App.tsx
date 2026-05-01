import React, { useState, useEffect, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import LevelSelectScreen from './components/LevelSelectScreen';
import ModeSelectScreen from './components/ModeSelectScreen';
import LevelCreatorScreen from './components/LevelCreatorScreen';
import LevelEditorScreen from './components/LevelEditorScreen';
import BallSkinsScreen, { type BallSkin } from './components/BallSkinsScreen';
import NameEntryModal from './components/NameEntryModal';
import { submitScore } from './firebase';
import type { LevelData } from './types/level';
import { loadCampaignLevels } from './levelLoader';

type Screen = 'start' | 'modeselect' | 'game' | 'gameover' | 'leaderboard' | 'levelselect' | 'skins' | 'levelcreator' | 'leveleditor';

interface GameResult { score: number; level: number; }

export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [playerName, setPlayerName] = useState('');
  const [showNameEntry, setShowNameEntry] = useState(false);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [personalBest, setPersonalBest] = useState(0);
  const [arcadeMode, setArcadeMode] = useState(false);
  const [arcadeStartLevel, setArcadeStartLevel] = useState(1);
  const [ballSkin, setBallSkin] = useState<BallSkin>('basketball');
  const [testLevelData, setTestLevelData] = useState<LevelData | null>(null);
  const [editorDraft, setEditorDraft] = useState<LevelData | null>(null);
  const [campaignLevels, setCampaignLevels] = useState<LevelData[]>([]);
  const [gameWon, setGameWon] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('fallball_name') || '';
    const savedBest = parseInt(localStorage.getItem('fallball_best') || '0', 10);
    const savedSkin = (localStorage.getItem('fallball_skin') || 'basketball') as BallSkin;
    setPlayerName(savedName);
    setPersonalBest(savedBest);
    setBallSkin(savedSkin);
    loadCampaignLevels().then(levels => setCampaignLevels(levels));
  }, []);

  const handleSkinSelect = useCallback((skin: BallSkin) => {
    setBallSkin(skin);
    localStorage.setItem('fallball_skin', skin);
  }, []);

  const handlePlay = useCallback(() => {
    setScreen('modeselect');
  }, []);

  const handleCampaign = useCallback(() => {
    if (!playerName) {
      setShowNameEntry(true);
    } else {
      setArcadeMode(false);
      setScreen('game');
    }
  }, [playerName]);

  const handleArcadeSelect = useCallback((level: number) => {
    setArcadeMode(true);
    setArcadeStartLevel(level);
    setScreen('game');
  }, []);

  const handleNameSubmit = useCallback((name: string) => {
    setPlayerName(name);
    localStorage.setItem('fallball_name', name);
    setShowNameEntry(false);
    setArcadeMode(false);
    setScreen('game');
  }, []);

  const handleGameOver = useCallback(async (score: number, level: number) => {
    setGameWon(false);
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

  const handleGameWon = useCallback(async (score: number, level: number) => {
    setGameWon(true);
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
        <StartScreen onPlay={handlePlay} onLeaderboard={() => setScreen('leaderboard')} onSkins={() => setScreen('skins')} ballSkin={ballSkin} />
      )}
      {screen === 'modeselect' && (
        <ModeSelectScreen
          onCampaign={handleCampaign}
          onArcade={() => setScreen('levelselect')}
          onLevelCreator={() => setScreen('levelcreator')}
          onBack={() => setScreen('start')}
        />
      )}
      {screen === 'levelcreator' && (
        <LevelCreatorScreen
          onAdminAccess={() => setScreen('leveleditor')}
          onBack={() => setScreen('modeselect')}
        />
      )}
      {screen === 'leveleditor' && (
        <LevelEditorScreen
          onBack={() => setScreen('levelcreator')}
          onTest={(data) => { setEditorDraft(data); setTestLevelData(data); setScreen('game'); }}
          initialData={editorDraft ?? undefined}
        />
      )}
      {screen === 'skins' && (
        <BallSkinsScreen currentSkin={ballSkin} onSelect={handleSkinSelect} onBack={() => setScreen('start')} />
      )}
      {screen === 'levelselect' && (
        <LevelSelectScreen onSelect={handleArcadeSelect} onBack={() => setScreen('modeselect')} totalLevels={9 + campaignLevels.length} />
      )}
      {screen === 'game' && (
        <GameScreen
          onGameOver={handleGameOver}
          onGameWon={handleGameWon}
          personalBest={personalBest}
          arcadeMode={testLevelData ? true : arcadeMode}
          startLevel={arcadeMode ? arcadeStartLevel : 1}
          onExit={() => {
            const dest = testLevelData ? 'leveleditor' : arcadeMode ? 'levelselect' : 'modeselect';
            setTestLevelData(null);
            setScreen(dest);
          }}
          ballSkin={ballSkin}
          testLevel={testLevelData ?? undefined}
          campaignLevels={campaignLevels}
        />
      )}
      {screen === 'gameover' && lastResult && (
        <GameOverScreen
          score={lastResult.score}
          level={lastResult.level}
          personalBest={personalBest}
          playerName={playerName}
          didWin={gameWon}
          onTryAgain={() => { setGameWon(false); setScreen('game'); }}
          onLeaderboard={() => setScreen('leaderboard')}
          onHome={() => { setGameWon(false); setScreen('start'); }}
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
