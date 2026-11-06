import { useCallback, useEffect, useRef, useState } from 'react';
import { COIN_TYPES, CoinTypeId, STAGES, StageConfig } from './game/stages';
import {
  ActiveCoinState,
  LandingTargetKind,
  calculateShotScore,
  createThrownCoin,
  evaluateOmikujiRank,
} from './game/physics';
import { shrineAudio } from './game/audio';
import { ShrineScene3D } from './components/ShrineScene3D';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { RunSnapshot, StatusModal } from './components/StatusModal';

type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<GameState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [stageId, setStageId] = useState<number>(1);
  const [runKey, setRunKey] = useState<number>(1);
  const [highestUnlockedStage, setHighestUnlockedStage] = useState<number>(8);

  const currentStage: StageConfig =
    STAGES.find((s) => s.id === stageId) || STAGES[0];

  const [yaw, setYaw] = useState<number>(currentStage.recommendedYaw);
  const [pitch, setPitch] = useState<number>(currentStage.recommendedPitch);
  const [power, setPower] = useState<number>(currentStage.recommendedPower);
  const [coinType, setCoinType] = useState<CoinTypeId>('5yen');

  const [score, setScore] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [hits, setHits] = useState<number>(0);
  const [coinsLeft, setCoinsLeft] = useState<number>(currentStage.initialCoins);
  const [streak, setStreak] = useState<number>(0);
  const [windDisplay, setWindDisplay] = useState<number>(currentStage.baseWindX);
  const [landingTarget, setLandingTarget] = useState<LandingTargetKind>('real_box');
  const [targetBoxLabel, setTargetBoxLabel] = useState<string | undefined>(
    '奉納'
  );
  const [willHitBell, setWillHitBell] = useState<boolean>(false);
  const [willPassRing, setWillPassRing] = useState<boolean>(false);
  const [isCoinFlying, setIsCoinFlying] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [bannerMessage, setBannerMessage] = useState<{
    text: string;
    tone: 'good' | 'bad' | 'info';
  } | null>({
    text: `${currentStage.chapterTitle}「${currentStage.name}」：お賽銭を奉納しよう！`,
    tone: 'info',
  });
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  const activeCoinRef = useRef<ActiveCoinState | null>(null);
  const stageStartScoreRef = useRef<number>(0);
  const isResolvingOutcomeRef = useRef<boolean>(false);
  const lastTelemetryUpdateRef = useRef<number>(0);
  const bannerTimeoutRef = useRef<number>(0);
  const outcomeTimerRef = useRef<number>(0);

  // Sync gameState to document.body.dataset.state (Ultra Mode Game Shell requirement)
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(bannerTimeoutRef.current);
      window.clearTimeout(outcomeTimerRef.current);
    };
  }, []);

  const showBanner = useCallback(
    (text: string, tone: 'good' | 'bad' | 'info', durationMs = 2400) => {
      window.clearTimeout(bannerTimeoutRef.current);
      setBannerMessage({ text, tone });
      bannerTimeoutRef.current = window.setTimeout(() => {
        setBannerMessage(null);
      }, durationMs);
    },
    []
  );

  const initStage = useCallback(
    (
      targetStageId: number,
      switchToPlaying: boolean,
      carryScore?: number
    ) => {
      window.clearTimeout(outcomeTimerRef.current);
      isResolvingOutcomeRef.current = false;
      const stg = STAGES.find((s) => s.id === targetStageId) || STAGES[0];
      const baseScore =
        carryScore !== undefined ? carryScore : stageStartScoreRef.current;
      stageStartScoreRef.current = baseScore;
      activeCoinRef.current = null;
      setIsCoinFlying(false);
      setStageId(stg.id);
      setRunKey((k) => k + 1);
      setYaw(stg.recommendedYaw);
      setPitch(stg.recommendedPitch);
      setPower(stg.recommendedPower);
      setScore(baseScore);
      setHits(0);
      setCoinsLeft(stg.initialCoins);
      setStreak(0);
      setWindDisplay(stg.baseWindX);
      setRunSnapshot(null);

      if (switchToPlaying) {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        document.body.dataset.state = 'playing';
        setGameState('playing');
        showBanner(
          `${stg.chapterTitle}「${stg.name}」開始！目標：${stg.targetHits}枚奉納`,
          'info',
          2800
        );
      }
    },
    [showBanner]
  );

  const handleStartGame = useCallback(
    (chosenStageId?: number) => {
      const idToStart = chosenStageId ?? stageId;
      initStage(idToStart, true, 0);
    },
    [initStage, stageId]
  );

  const handleTriggerThrow = useCallback(() => {
    if (gameState !== 'playing') return;
    if (isResolvingOutcomeRef.current) return;
    if (activeCoinRef.current?.active || isCoinFlying) return;
    if (coinsLeft <= 0) return;

    const thrown = createThrownCoin(coinType, yaw, pitch, power);
    activeCoinRef.current = thrown;
    setIsCoinFlying(true);
    const nextCoins = Math.max(0, coinsLeft - 1);
    stateRef.current.coinsLeft = nextCoins;
    setCoinsLeft(nextCoins);
    shrineAudio.playThrow();
  }, [coinType, coinsLeft, gameState, isCoinFlying, pitch, power, yaw]);

  // Ref for mutable gameplay counters inside shot event callback & render_game_to_text
  const stateRef = useRef({
    score,
    bestScore,
    hits,
    coinsLeft,
    streak,
    coinType,
    currentStage,
    gameState,
    yaw,
    pitch,
    power,
    windDisplay,
    landingTarget,
    targetBoxLabel,
  });
  stateRef.current = {
    score,
    bestScore,
    hits,
    coinsLeft,
    streak,
    coinType,
    currentStage,
    gameState,
    yaw,
    pitch,
    power,
    windDisplay,
    landingTarget,
    targetBoxLabel,
  };

  useEffect(() => {
    (
      window as unknown as { render_game_to_text?: () => string }
    ).render_game_to_text = () => {
      const s = stateRef.current;
      const c = activeCoinRef.current;
      return JSON.stringify({
        state: s.gameState,
        stageId: s.currentStage.id,
        stageName: s.currentStage.name,
        score: s.score,
        bestScore: s.bestScore,
        hits: s.hits,
        targetHits: s.currentStage.targetHits,
        coinsLeft: s.coinsLeft,
        streak: s.streak,
        aim: {
          yaw: s.yaw,
          pitch: s.pitch,
          power: s.power,
          coinType: s.coinType,
          landingTarget: s.landingTarget,
          targetBoxLabel: s.targetBoxLabel,
        },
        windX: Number(s.windDisplay.toFixed(2)),
        activeCoin: c?.active
          ? {
              pos: {
                x: Number(c.pos.x.toFixed(2)),
                y: Number(c.pos.y.toFixed(2)),
                z: Number(c.pos.z.toFixed(2)),
              },
              outcome: c.outcome,
            }
          : null,
      });
    };
    return () => {
      delete (window as unknown as { render_game_to_text?: () => string })
        .render_game_to_text;
    };
  }, []);

  const handleShotEvent = useCallback(
    (event: {
      type: 'scored' | 'trap' | 'missed' | 'bell' | 'ring' | 'bounce';
      cleanCenter?: boolean;
      hitBell?: boolean;
      passedRing?: boolean;
      reason?: string;
    }) => {
      const st = stateRef.current;

      if (event.type === 'bell') {
        shrineAudio.playSuzuBell();
        showBanner('シャラン♪ 本坪鈴コンボ！（+350徳）', 'good', 1800);
        return;
      }

      if (event.type === 'ring') {
        shrineAudio.playRingPass();
        showBanner('開運の輪くぐり成功！（獲得徳2倍）', 'good', 1800);
        return;
      }

      if (event.type === 'bounce') {
        shrineAudio.playWoodKnock();
        return;
      }

      if (event.type === 'scored') {
        setIsCoinFlying(false);
        shrineAudio.playCoinClatter(Boolean(event.cleanCenter));

        const nextStreak = st.streak + 1;
        const nextHits = st.hits + 1;
        const breakdown = calculateShotScore({
          coinType: st.coinType,
          cleanCenterShot: Boolean(event.cleanCenter),
          hitBell: Boolean(event.hitBell),
          passedRing: Boolean(event.passedRing),
          streak: nextStreak,
        });

        const nextScore = st.score + breakdown.totalPoints;
        const nextBest = Math.max(st.bestScore, nextScore);

        setStreak(nextStreak);
        setHits(nextHits);
        setScore(nextScore);
        setBestScore(nextBest);
        showBanner(`チャリーン！ ${breakdown.headline}`, 'good', 2400);

        if (nextHits >= st.currentStage.targetHits) {
          // Stage Clear!
          const omikuji = evaluateOmikujiRank(
            nextHits,
            st.currentStage.targetHits,
            st.coinsLeft,
            nextScore
          );
          const snap: RunSnapshot = {
            isVictory: true,
            stage: st.currentStage,
            score: nextScore,
            bestScore: nextBest,
            hits: nextHits,
            targetHits: st.currentStage.targetHits,
            coinsRemaining: st.coinsLeft,
            omikuji,
          };
          setHighestUnlockedStage((prev) =>
            Math.max(prev, Math.min(STAGES.length, st.currentStage.id + 1))
          );
          isResolvingOutcomeRef.current = true;
          window.clearTimeout(outcomeTimerRef.current);
          outcomeTimerRef.current = window.setTimeout(() => {
            isResolvingOutcomeRef.current = false;
            shrineAudio.playStageClear();
            setRunSnapshot(snap);
            document.body.dataset.state = 'gameover';
            setGameState('gameover');
          }, 450);
        }
        return;
      }

      if (event.type === 'trap' || event.type === 'missed') {
        setIsCoinFlying(false);
        setStreak(0);

        if (event.type === 'trap') {
          shrineAudio.playTrapSpring();
          showBanner(
            `ボヨヨ〜ン！ ${event.reason || '偽物の賽銭箱だ！'}`,
            'bad',
            2400
          );
        } else {
          showBanner(event.reason || '惜しい！枠の外へ…', 'info', 2000);
        }

        // Check if out of coins and quota not met
        if (st.coinsLeft <= 0 && st.hits < st.currentStage.targetHits) {
          const snap: RunSnapshot = {
            isVictory: false,
            stage: st.currentStage,
            score: st.score,
            bestScore: st.bestScore,
            hits: st.hits,
            targetHits: st.currentStage.targetHits,
            coinsRemaining: 0,
            omikuji: '凶',
          };
          isResolvingOutcomeRef.current = true;
          window.clearTimeout(outcomeTimerRef.current);
          outcomeTimerRef.current = window.setTimeout(() => {
            isResolvingOutcomeRef.current = false;
            shrineAudio.playGameOver();
            setRunSnapshot(snap);
            document.body.dataset.state = 'gameover';
            setGameState('gameover');
          }, 480);
        }
      }
    },
    [showBanner]
  );

  const handleTelemetryUpdate = useCallback(
    (info: {
      windX: number;
      landingTarget: LandingTargetKind;
      targetBoxLabel?: string;
      willHitBell: boolean;
      willPassRing: boolean;
    }) => {
      const now = performance.now();
      if (now - lastTelemetryUpdateRef.current > 120) {
        lastTelemetryUpdateRef.current = now;
        setWindDisplay(info.windX);
        setLandingTarget(info.landingTarget);
        setTargetBoxLabel(info.targetBoxLabel);
        setWillHitBell(info.willHitBell);
        setWillPassRing(info.willPassRing);
      }
    },
    []
  );

  const handleUpdateAimDelta = useCallback(
    (yawDelta: number, pitchDelta: number) => {
      setYaw((prev) => Math.max(-35, Math.min(35, prev + yawDelta)));
      setPitch((prev) => Math.max(20, Math.min(75, prev + pitchDelta)));
    },
    []
  );

  // Unified Keyboard Input Listener on window
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartGame(stageId);
        }
        return;
      }

      if (gameState === 'gameover') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (runSnapshot?.isVictory && stageId < STAGES.length) {
            initStage(stageId + 1, true, runSnapshot.score);
          } else {
            initStage(stageId, true);
          }
        }
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (isResolvingOutcomeRef.current) return;
        e.preventDefault();
        setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        shrineAudio.muted = !shrineAudio.muted;
        setMuted(shrineAudio.muted);
        return;
      }

      if (e.code === 'KeyR' && gameState === 'playing') {
        e.preventDefault();
        initStage(stageId, true);
        return;
      }

      if (gameState !== 'playing') return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          setYaw((y) => Math.max(-35, y - 2));
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          setYaw((y) => Math.min(35, y + 2));
          break;
        case 'ArrowUp':
        case 'KeyW':
          e.preventDefault();
          setPitch((p) => Math.min(75, p + 2));
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          setPitch((p) => Math.max(20, p - 2));
          break;
        case 'BracketRight':
        case 'Equal':
          setPower((pw) => Math.min(95, pw + 3));
          break;
        case 'BracketLeft':
        case 'Minus':
          setPower((pw) => Math.max(20, pw - 3));
          break;
        case 'Digit1':
          setCoinType('5yen');
          showBanner(`硬貨切替：${COIN_TYPES['5yen'].name}`, 'info', 1400);
          break;
        case 'Digit2':
          setCoinType('50yen');
          showBanner(`硬貨切替：${COIN_TYPES['50yen'].name}`, 'info', 1400);
          break;
        case 'Digit3':
          setCoinType('100yen');
          showBanner(`硬貨切替：${COIN_TYPES['100yen'].name}`, 'info', 1400);
          break;
        case 'Space':
        case 'Enter':
          e.preventDefault();
          handleTriggerThrow();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    handleStartGame,
    handleTriggerThrow,
    initStage,
    runSnapshot,
    showBanner,
    stageId,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* Persistent 3D Shrine Scene Viewport */}
      <ShrineScene3D
        gameState={gameState}
        stage={currentStage}
        runKey={runKey}
        coinType={coinType}
        coinsLeft={coinsLeft}
        yaw={yaw}
        pitch={pitch}
        power={power}
        activeCoinRef={activeCoinRef}
        onUpdateAim={handleUpdateAimDelta}
        onTriggerThrow={handleTriggerThrow}
        onShotEvent={handleShotEvent}
        onTelemetryUpdate={handleTelemetryUpdate}
      />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          selectedStageId={stageId}
          highestUnlockedStage={highestUnlockedStage}
          bestScore={bestScore}
          onSelectStage={(id) => {
            const stg = STAGES.find((s) => s.id === id) || STAGES[0];
            setStageId(stg.id);
            setRunKey((k) => k + 1);
            setYaw(stg.recommendedYaw);
            setPitch(stg.recommendedPitch);
            setPower(stg.recommendedPower);
          }}
          onStartGame={handleStartGame}
        />
      )}

      {/* Playing HUD Overlay */}
      {gameState === 'playing' && (
        <GameHUD
          stage={currentStage}
          score={score}
          hits={hits}
          coinsLeft={coinsLeft}
          streak={streak}
          windX={windDisplay}
          landingTarget={landingTarget}
          targetBoxLabel={targetBoxLabel}
          willHitBell={willHitBell}
          willPassRing={willPassRing}
          yaw={yaw}
          pitch={pitch}
          power={power}
          coinType={coinType}
          isCoinFlying={isCoinFlying}
          muted={muted}
          bannerMessage={bannerMessage}
          onChangeYaw={setYaw}
          onChangePitch={setPitch}
          onChangePower={setPower}
          onSelectCoinType={(c) => {
            setCoinType(c);
            showBanner(`硬貨切替：${COIN_TYPES[c].name}`, 'info', 1400);
          }}
          onApplyRecommendedAim={() => {
            setYaw(currentStage.recommendedYaw);
            setPitch(currentStage.recommendedPitch);
            setPower(currentStage.recommendedPower);
            showBanner('ステージの基本推奨角度に合わせました！', 'info', 1600);
          }}
          onThrowCoin={handleTriggerThrow}
          onSelectStage={(id) => initStage(id, true, 0)}
          onToggleMute={() => {
            shrineAudio.muted = !shrineAudio.muted;
            setMuted(shrineAudio.muted);
          }}
          onPauseGame={() => {
            if (!isResolvingOutcomeRef.current) {
              setGameState('paused');
            }
          }}
          onRestartStage={() => initStage(stageId, true)}
        />
      )}

      {/* Pause & Victory / Game Over Status Modal */}
      {(gameState === 'paused' || gameState === 'gameover') && (
        <StatusModal
          gameState={gameState}
          snapshot={runSnapshot}
          onResume={() => setGameState('playing')}
          onRestart={() => initStage(stageId, true)}
          onNextStage={() =>
            initStage(
              Math.min(STAGES.length, stageId + 1),
              true,
              runSnapshot?.score ?? score
            )
          }
          onReturnTitle={() => {
            window.clearTimeout(outcomeTimerRef.current);
            isResolvingOutcomeRef.current = false;
            activeCoinRef.current = null;
            setIsCoinFlying(false);
            setGameState('title');
          }}
        />
      )}
    </main>
  );
}
