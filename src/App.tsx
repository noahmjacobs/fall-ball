import React, { useState, useEffect, useCallback } from 'react';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import LevelSelectScreen from './components/LevelSelectScreen';
import ModeSelectScreen from './components/ModeSelectScreen';
import LevelCreatorScreen from './components/LevelCreatorScreen';
import LevelEditorScreen from './components/LevelEditorScreen';
import CommunityLevelsScreen from './components/CommunityLevelsScreen';
import MyLevelsScreen from './components/MyLevelsScreen';
import CommunityLevelCompleteScreen from './components/CommunityLevelCompleteScreen';
import BallSkinsScreen, { type BallSkin, type BallTrail, refreshCustomBallCache, type CustomSlot } from './components/BallSkinsScreen';
import CustomBallEditorScreen from './components/CustomBallEditorScreen';
import NameEntryModal from './components/NameEntryModal';
import { submitScore, saveUserLevel, recordLevelCompletion } from './firebase';
import type { LevelData, UserLevel } from './types/level';

import { loadCampaignLevels } from './levelLoader';

type Screen =
  | 'start' | 'modeselect' | 'game' | 'gameover' | 'leaderboard'
  | 'levelselect' | 'skins' | 'levelcreator' | 'leveleditor'
  | 'communitylevels' | 'mylevels' | 'communitycomplete' | 'communityfail'
  | 'customballeditor';

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
  const [ballTrail, setBallTrail] = useState<BallTrail>('white');
  const [testLevelData, setTestLevelData] = useState<LevelData | null>(null);
  const [editorDraft, setEditorDraft] = useState<LevelData | null>(null);
  const [campaignLevels, setCampaignLevels] = useState<LevelData[]>([]);
  const [gameWon, setGameWon] = useState(false);
  const [customSlot, setCustomSlot] = useState<CustomSlot>('custom1');

  // Community levels / user editor state
  const [editorMode, setEditorMode] = useState<'admin' | 'user'>('admin');
  const [editorBackDest, setEditorBackDest] = useState<Screen>('levelcreator');
  const [editingUserLevelId, setEditingUserLevelId] = useState<string | null>(null);
  const [testLevelReturnScreen, setTestLevelReturnScreen] = useState<Screen>('leveleditor');
  const [currentCommunityLevel, setCurrentCommunityLevel] = useState<UserLevel | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('fallball_name') || '';
    const savedBest = parseInt(localStorage.getItem('fallball_best') || '0', 10);
    const savedSkin = (localStorage.getItem('fallball_skin') || 'basketball') as BallSkin;
    const savedTrail = (localStorage.getItem('fallball_trail') || 'white') as BallTrail;
    setPlayerName(savedName);
    setPersonalBest(savedBest);
    setBallSkin(savedSkin);
    setBallTrail(savedTrail);
    refreshCustomBallCache();
    loadCampaignLevels().then(levels => setCampaignLevels(levels));
  }, []);

  const handleSkinSelect = useCallback((skin: BallSkin) => {
    setBallSkin(skin);
    localStorage.setItem('fallball_skin', skin);
  }, []);

  const handleTrailSelect = useCallback((trail: BallTrail) => {
    setBallTrail(trail);
    localStorage.setItem('fallball_trail', trail);
  }, []);

  const handleCustomize = useCallback((slot: CustomSlot) => {
    setCustomSlot(slot);
    setScreen('customballeditor');
  }, []);

  const handleCustomBallSaved = useCallback((slot: CustomSlot) => {
    refreshCustomBallCache();
    setScreen('skins');
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
    // Community level fail — don't record completion, show fail screen
    if (testLevelReturnScreen === 'communitylevels' && currentCommunityLevel) {
      setTestLevelData(null);
      setScreen('communityfail');
      return;
    }
    // Campaign game over
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
  }, [playerName, personalBest, testLevelReturnScreen, currentCommunityLevel]);

  const handleGameWon = useCallback(async (score: number, level: number) => {
    // Community level completion — go to dedicated screen and record it
    if (testLevelReturnScreen === 'communitylevels' && currentCommunityLevel) {
      if (playerName) {
        try { await recordLevelCompletion(currentCommunityLevel.id, playerName); } catch (_) {}
      }
      setTestLevelData(null);
      setScreen('communitycomplete');
      return;
    }
    // Campaign win
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
  }, [playerName, personalBest, testLevelReturnScreen, currentCommunityLevel]);

  // ── Level Creator hub handlers ──────────────────────────────────────────────

  /** Admin access: open editor in admin mode */
  const handleAdminAccess = useCallback(() => {
    setEditorMode('admin');
    setEditorBackDest('levelcreator');
    setEditingUserLevelId(null);
    setEditorDraft(null);
    setScreen('leveleditor');
  }, []);

  /** User clicks "Create Level" */
  const handleCreateLevel = useCallback(() => {
    if (!playerName) { setShowNameEntry(true); return; }
    setEditorMode('user');
    setEditorBackDest('levelcreator');
    setEditingUserLevelId(null);
    setEditorDraft(null);
    setScreen('leveleditor');
  }, [playerName]);

  /** User edits an existing level from My Levels */
  const handleEditUserLevel = useCallback((level: UserLevel) => {
    setEditorMode('user');
    setEditorBackDest('mylevels');
    setEditingUserLevelId(level.id);
    setEditorDraft({ name: level.name, makesNeeded: level.makesNeeded, hoops: level.hoops, obstacles: level.obstacles });
    setScreen('leveleditor');
  }, []);

  /** Save level to Firebase (called by LevelEditorScreen in user mode) */
  const handleSaveToCloud = useCallback(async (data: LevelData) => {
    if (!playerName) throw new Error('No player name');
    const id = await saveUserLevel(playerName, data, editingUserLevelId ?? undefined);
    // On first save, store ID so subsequent saves are updates not creates
    setEditingUserLevelId(id);
  }, [playerName, editingUserLevelId]);

  /** Play a community level */
  const handlePlayCommunityLevel = useCallback((level: UserLevel) => {
    const data: LevelData = { name: level.name, makesNeeded: level.makesNeeded, hoops: level.hoops, obstacles: level.obstacles };
    setCurrentCommunityLevel(level);
    setTestLevelData(data);
    setTestLevelReturnScreen('communitylevels');
    setArcadeMode(false);
    setScreen('game');
  }, []);

  /** Test level from editor */
  const handleTestLevel = useCallback((data: LevelData) => {
    setEditorDraft(data);
    setTestLevelData(data);
    setTestLevelReturnScreen('leveleditor');
    setScreen('game');
  }, []);

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
          playerName={playerName}
          onAdminAccess={handleAdminAccess}
          onCreateLevel={handleCreateLevel}
          onCommunityLevels={() => setScreen('communitylevels')}
          onMyLevels={() => setScreen('mylevels')}
          onBack={() => setScreen('modeselect')}
        />
      )}
      {screen === 'leveleditor' && (
        <LevelEditorScreen
          onBack={() => setScreen(editorBackDest)}
          onTest={handleTestLevel}
          initialData={editorDraft ?? undefined}
          mode={editorMode}
          onSaveToCloud={editorMode === 'user' ? handleSaveToCloud : undefined}
        />
      )}
      {screen === 'communitylevels' && (
        <CommunityLevelsScreen
          playerName={playerName}
          onPlay={handlePlayCommunityLevel}
          onBack={() => setScreen('levelcreator')}
        />
      )}
      {screen === 'communitycomplete' && currentCommunityLevel && (
        <CommunityLevelCompleteScreen
          levelName={currentCommunityLevel.name}
          creatorName={currentCommunityLevel.creatorName}
          playerName={playerName}
          failed={false}
          onPlayAgain={() => handlePlayCommunityLevel(currentCommunityLevel)}
          onCommunity={() => { setCurrentCommunityLevel(null); setScreen('communitylevels'); }}
          onHome={() => { setCurrentCommunityLevel(null); setScreen('start'); }}
        />
      )}
      {screen === 'communityfail' && currentCommunityLevel && (
        <CommunityLevelCompleteScreen
          levelName={currentCommunityLevel.name}
          creatorName={currentCommunityLevel.creatorName}
          playerName={playerName}
          failed={true}
          onPlayAgain={() => handlePlayCommunityLevel(currentCommunityLevel)}
          onCommunity={() => { setCurrentCommunityLevel(null); setScreen('communitylevels'); }}
          onHome={() => { setCurrentCommunityLevel(null); setScreen('start'); }}
        />
      )}
      {screen === 'mylevels' && (
        <MyLevelsScreen
          playerName={playerName}
          onEdit={handleEditUserLevel}
          onBack={() => setScreen('levelcreator')}
        />
      )}
      {screen === 'skins' && (
        <BallSkinsScreen currentSkin={ballSkin} onSelect={handleSkinSelect} onBack={() => setScreen('start')} onCustomize={handleCustomize} currentTrail={ballTrail} onTrailSelect={handleTrailSelect} />
      )}
      {screen === 'customballeditor' && (
        <CustomBallEditorScreen slot={customSlot} onBack={() => setScreen('skins')} onSaved={handleCustomBallSaved} />
      )}
      {screen === 'levelselect' && (
        <LevelSelectScreen onSelect={handleArcadeSelect} onBack={() => setScreen('modeselect')} totalLevels={9 + campaignLevels.length} />
      )}
      {screen === 'game' && (
        <GameScreen
          onGameOver={handleGameOver}
          onGameWon={handleGameWon}
          personalBest={personalBest}
          arcadeMode={arcadeMode || (testLevelData !== null && testLevelReturnScreen === 'leveleditor')}
          startLevel={arcadeMode ? arcadeStartLevel : 1}
          onExit={() => {
            const dest: Screen = testLevelData ? testLevelReturnScreen : arcadeMode ? 'levelselect' : 'modeselect';
            setTestLevelData(null);
            setScreen(dest);
          }}
          ballSkin={ballSkin}
          ballTrail={ballTrail}
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
