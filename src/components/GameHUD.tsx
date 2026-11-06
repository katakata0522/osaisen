import React, { useEffect, useState } from 'react';
import {
  COIN_TYPES,
  CoinTypeId,
  STAGES,
  StageConfig,
} from '../game/stages';
import { LandingTargetKind } from '../game/physics';

interface GameHUDProps {
  stage: StageConfig;
  score: number;
  hits: number;
  coinsLeft: number;
  streak: number;
  windX: number;
  landingTarget: LandingTargetKind;
  targetBoxLabel?: string;
  willHitBell?: boolean;
  willPassRing?: boolean;
  yaw: number;
  pitch: number;
  power: number;
  coinType: CoinTypeId;
  isCoinFlying: boolean;
  muted: boolean;
  bannerMessage: { text: string; tone: 'good' | 'bad' | 'info' } | null;
  onChangeYaw: (yaw: number) => void;
  onChangePitch: (pitch: number) => void;
  onChangePower: (power: number) => void;
  onSelectCoinType: (c: CoinTypeId) => void;
  onApplyRecommendedAim: () => void;
  onThrowCoin: () => void;
  onSelectStage: (stageId: number) => void;
  onToggleMute: () => void;
  onPauseGame: () => void;
  onRestartStage: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stage,
  score,
  hits,
  coinsLeft,
  streak,
  windX,
  landingTarget,
  targetBoxLabel,
  willHitBell,
  willPassRing,
  yaw,
  pitch,
  power,
  coinType,
  isCoinFlying,
  muted,
  bannerMessage,
  onChangeYaw,
  onChangePitch,
  onChangePower,
  onSelectCoinType,
  onApplyRecommendedAim,
  onThrowCoin,
  onSelectStage,
  onToggleMute,
  onPauseGame,
  onRestartStage,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [stageMenuOpen, setStageMenuOpen] = useState(false);

  useEffect(() => {
    setStageMenuOpen(false);
  }, [stage.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const absWind = Math.abs(windX);
  const windLabel =
    absWind < 0.15
      ? '無風 0.0m/s'
      : windX > 0
      ? `右風 → ${absWind.toFixed(1)}m/s`
      : `← 左風 ${absWind.toFixed(1)}m/s`;

  // Generate target offering pip array
  const targetPips = Array.from({ length: stage.targetHits }, (_, i) => i < hits);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-3 md:p-5">
      {/* Top Perimeter Row: Left Stage/Score Cluster & Right Wind/Utility Cluster */}
      <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2 sm:gap-4 w-full">
        {/* Top-Left Cluster: Stage Plaque, Goal Pips, Remaining Coins, Score */}
        <div
          className="pointer-events-auto rounded-xl px-3 py-2 sm:px-4 sm:py-3 max-w-md w-full sm:w-auto"
          style={{
            backgroundColor: 'rgba(38, 20, 10, 0.9)',
            border: '2px solid #d4a638',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#ffd166] tracking-wider uppercase shrink-0">
              {stage.chapterTitle}
            </span>
            <span className="text-xs text-[#b08968] shrink-0" aria-hidden="true">
              ·
            </span>
            <h2 className="font-display text-base md:text-lg font-bold text-[#fff8ec] truncate sm:whitespace-nowrap">
              {stage.name}
            </h2>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                setStageMenuOpen((v) => !v);
              }}
              className="ml-auto px-2.5 py-1 rounded text-xs font-bold bg-[#4a2812] hover:bg-[#63371a] text-[#ffd166] border border-[#b07d3c] cursor-pointer whitespace-nowrap shrink-0"
            >
              幕切替 ▾
            </button>
          </div>

          <div className="text-xs text-[#f4a261] mt-0.5 mb-2">
            {stage.gimmickSummary}
          </div>

          {/* Stage Quick Switcher Dropdown */}
          {stageMenuOpen && (
            <div
              className="grid grid-cols-2 gap-1.5 p-2 rounded-lg mb-2"
              style={{
                backgroundColor: 'rgba(20, 10, 4, 0.96)',
                border: '1px solid #b07d3c',
              }}
            >
              {STAGES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setStageMenuOpen(false);
                    onSelectStage(s.id);
                  }}
                  className={`text-left px-2 py-1.5 rounded text-xs font-bold cursor-pointer truncate ${
                    s.id === stage.id
                      ? 'bg-[#d62828] text-white'
                      : 'bg-[#361c0c] text-[#e6d5b8] hover:bg-[#4f2d18]'
                  }`}
                >
                  {s.chapterTitle}：{s.name}
                </button>
              ))}
            </div>
          )}

          {/* Hero-to-Kicker Metrics Row */}
          <div className="flex flex-wrap items-center gap-5 pt-1 border-t border-[#5c361a]">
            {/* Goal Offering Sockets (目標奉納数) */}
            <div>
              <div className="text-[11px] font-bold text-[#d8c3a5] uppercase tracking-wider">
                目標奉納 ({Math.round(hits)}/{Math.round(stage.targetHits)})
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {targetPips.map((filled, idx) => (
                  <svg
                    key={idx}
                    viewBox="0 0 24 24"
                    className="w-6 h-6"
                    aria-label={filled ? '奉納済み' : '未奉納'}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      fill={filled ? '#e5b842' : '#26140a'}
                      stroke={filled ? '#fff3b0' : '#7f5539'}
                      strokeWidth="2"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3.2"
                      fill="#26140a"
                      stroke={filled ? '#996515' : '#5c3d28'}
                      strokeWidth="1.5"
                    />
                  </svg>
                ))}
              </div>
            </div>

            {/* Remaining Coins */}
            <div>
              <div className="text-[11px] font-bold text-[#d8c3a5] uppercase tracking-wider">
                残りお賽銭
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-mono-num text-2xl font-extrabold text-[#ffd166] leading-none">
                  {Math.round(coinsLeft)}
                </span>
                <span className="text-xs font-bold text-[#e6d5b8]">枚</span>
              </div>
            </div>

            {/* Earned Toku (Score) */}
            <div>
              <div className="text-[11px] font-bold text-[#d8c3a5] uppercase tracking-wider">
                獲得した徳
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  data-testid="hud-score"
                  className="font-mono-num text-2xl font-extrabold text-[#fff8ec] leading-none"
                >
                  {Math.round(score)}
                </span>
                <span className="text-xs font-bold text-[#f4a261]">
                  徳 {streak > 1 ? `(${streak}連続!)` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right Cluster: Live Wind + Trajectory Forecast Plaque & Utility SVG Buttons */}
        <div className="flex items-center sm:items-start justify-between sm:justify-end gap-1.5 sm:gap-2.5 w-full sm:w-auto pointer-events-auto">
          {/* Wind & Trajectory Forecast Plaque */}
          <div
            className="rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 sm:gap-3 min-w-0"
            style={{
              backgroundColor: 'rgba(38, 20, 10, 0.9)',
              border: '2px solid #b07d3c',
              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 sm:w-6 sm:h-6 shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M3 8h13a2.5 2.5 0 1 0-2.5-2.5M4 12h15.5a2.5 2.5 0 1 1-2.5 2.5M6 16h9a2 2 0 1 1-2 2"
                  fill="none"
                  stroke={absWind < 0.15 ? '#a8dadc' : '#ffd166'}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <div className="text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider">
                  境内の風向き
                </div>
                <div className="font-mono-num text-xs sm:text-sm font-bold text-[#fff8ec] whitespace-nowrap">
                  {windLabel}
                </div>
              </div>
            </div>

            <div className="pl-2 sm:pl-3 border-l border-[#5c361a] min-w-0">
              <div className="text-[10px] font-bold text-[#d8c3a5] uppercase tracking-wider">
                放物線の着弾予測
              </div>
              <div
                data-testid="hud-target-forecast"
                className={`text-[11px] sm:text-xs font-bold whitespace-nowrap ${
                  landingTarget === 'real_box'
                    ? 'text-[#34d399]'
                    : landingTarget === 'fake_box'
                    ? 'text-[#ff4d6d]'
                    : landingTarget === 'obstacle'
                    ? 'text-[#fb923c]'
                    : 'text-[#cbb69d]'
                }`}
              >
                {landingTarget === 'real_box'
                  ? willHitBell
                    ? `◎ 大鈴→「${targetBoxLabel ?? '奉納'}」`
                    : willPassRing
                    ? `◎ 輪×2→「${targetBoxLabel ?? '奉納'}」`
                    : `◎「${targetBoxLabel ?? '奉納'}」命中圏内`
                  : landingTarget === 'fake_box'
                  ? `⚠ 偽物「${targetBoxLabel ?? '罰'}」箱`
                  : landingTarget === 'obstacle'
                  ? `⚠「${targetBoxLabel ?? 'だるま'}」注意`
                  : '・ 石畳（枠外）'}
              </div>
            </div>
          </div>

          {/* Utility Buttons: Mute [M], Restart [R], Pause [P] */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? '音声をオンにする [M]' : '音声をミュートする [M]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              style={{
                backgroundColor: 'rgba(38, 20, 10, 0.9)',
                border: '2px solid #b07d3c',
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                {muted ? (
                  <path
                    d="M11 5L6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6"
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a9 9 0 0 1 0 14.14"
                    fill="none"
                    stroke="#ffd166"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="ステージをやり直す [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartStage();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              style={{
                backgroundColor: 'rgba(38, 20, 10, 0.9)',
                border: '2px solid #b07d3c',
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path
                  d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5"
                  fill="none"
                  stroke="#ffd166"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="一時停止 [P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPauseGame();
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              style={{
                backgroundColor: 'rgba(38, 20, 10, 0.9)',
                border: '2px solid #b07d3c',
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" fill="#ffd166" />
                <rect x="14" y="4" width="4" height="16" rx="1" fill="#ffd166" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Upper-Center Callout Toast (Anchored near top so it NEVER blocks the Saisen boxes in center!) */}
      <div className="flex flex-col items-center justify-start mt-1.5 mb-auto pointer-events-none">
        {bannerMessage && (
          <div
            className="px-5 py-1.5 rounded-xl font-display text-sm sm:text-base md:text-lg font-bold tracking-wide transition-transform"
            style={{
              backgroundColor:
                bannerMessage.tone === 'good'
                  ? 'rgba(180, 32, 20, 0.94)'
                  : bannerMessage.tone === 'bad'
                  ? 'rgba(58, 18, 38, 0.94)'
                  : 'rgba(38, 20, 10, 0.92)',
              border:
                bannerMessage.tone === 'good'
                  ? '2px solid #ffd166'
                  : bannerMessage.tone === 'bad'
                  ? '2px solid #ff4d6d'
                  : '2px solid #d4a638',
              color: '#fff8ec',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
            }}
          >
            {bannerMessage.text}
          </div>
        )}
      </div>

      {/* Unified Collapsible Bottom Control Dock (Three.js Skill Section 5 Contract) */}
      <div className="w-full max-w-[920px] mx-auto flex flex-col items-center pointer-events-auto">
        {/* Collapse / Expand Toggle Tab */}
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            setDockCollapsed((c) => !c);
          }}
          className="px-4 py-1 rounded-t-lg text-xs font-bold text-[#ffd166] cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: 'rgba(38, 20, 10, 0.92)',
            borderTop: '2px solid #b07d3c',
            borderLeft: '2px solid #b07d3c',
            borderRight: '2px solid #b07d3c',
          }}
        >
          {dockCollapsed ? '▴ 操作パネルを表示' : '▾ 操作パネルを隠す'}
        </button>

        {!dockCollapsed && (
          <div
            className="w-full rounded-2xl p-2.5 sm:p-3.5 flex flex-col gap-2.5"
            style={{
              backgroundColor: 'rgba(38, 20, 10, 0.94)',
              border: '2px solid #d4a638',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
            }}
          >
            {/* Row 1: 3 Spacious Trajectory Sliders with single-line whitespace-nowrap labels */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
              {/* Yaw (左右の向き) */}
              <label className="flex flex-col gap-1 bg-[#261307] px-3 py-1.5 rounded-xl border border-[#5c361a]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#e6d5b8] whitespace-nowrap shrink-0">
                    左右の向き (←/→)
                  </span>
                  <span className="font-mono-num font-bold text-[#ffd166] whitespace-nowrap shrink-0">
                    {Math.round(yaw)}°
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="左右の向き"
                  min={-35}
                  max={35}
                  step={1}
                  value={yaw}
                  onChange={(e) => onChangeYaw(Number(e.target.value))}
                  className="w-full accent-[#e5b842] cursor-pointer"
                />
              </label>

              {/* Pitch (放物線の角度) */}
              <label className="flex flex-col gap-1 bg-[#261307] px-3 py-1.5 rounded-xl border border-[#5c361a]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#e6d5b8] whitespace-nowrap shrink-0">
                    放物線の高さ・角度 (↑/↓)
                  </span>
                  <span className="font-mono-num font-bold text-[#ffd166] whitespace-nowrap shrink-0">
                    {Math.round(pitch)}°
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="放物線の角度"
                  min={20}
                  max={75}
                  step={1}
                  value={pitch}
                  onChange={(e) => onChangePitch(Number(e.target.value))}
                  className="w-full accent-[#e5b842] cursor-pointer"
                />
              </label>

              {/* Power (投げる強さ) */}
              <label className="flex flex-col gap-1 bg-[#261307] px-3 py-1.5 rounded-xl border border-[#5c361a]">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#e6d5b8] whitespace-nowrap shrink-0">
                    飛距離・強さ (-/+)
                  </span>
                  <span className="font-mono-num font-bold text-[#ffd166] whitespace-nowrap shrink-0">
                    {Math.round(power)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="投げる強さ"
                  min={20}
                  max={95}
                  step={1}
                  value={power}
                  onChange={(e) => onChangePower(Number(e.target.value))}
                  className="w-full accent-[#e5b842] cursor-pointer"
                />
              </label>
            </div>

            {/* Row 2: Coin Type Selector on Left + Assist & Primary Throw Button on Right */}
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 w-full">
              {/* Coin Selector (5円 / 50円 / 100円) with clear human trait tags */}
              <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                {(
                  [
                    ['5yen', '標準'],
                    ['50yen', '風に強い'],
                    ['100yen', '高得点'],
                  ] as const
                ).map(([id, trait]) => {
                  const spec = COIN_TYPES[id];
                  const active = coinType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectCoinType(id);
                      }}
                      className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-center sm:text-left transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#6b3915] border-2 border-[#ffd166] text-[#fff8ec]'
                          : 'bg-[#281408] border border-[#5c361a] text-[#cbb69d] hover:bg-[#3a1f0d]'
                      }`}
                    >
                      <div className="text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start gap-1 whitespace-nowrap">
                        <span>{spec.shortLabel}</span>
                        <span className="hidden md:inline text-[10px] text-[#ffd166]">
                          ({trait})
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-[#e6c280]">
                          +{spec.basePoints}徳
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Assist & Throw Primary Actions */}
              <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0 sm:ml-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onApplyRecommendedAim();
                  }}
                  className="px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-[#3e2210] hover:bg-[#543018] text-[#ffd166] border border-[#b07d3c] cursor-pointer whitespace-nowrap shrink-0"
                >
                  標準角度にセット
                </button>

                <button
                  type="button"
                  disabled={isCoinFlying || coinsLeft <= 0}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setStageMenuOpen(false);
                    onThrowCoin();
                  }}
                  className="flex-1 sm:flex-initial px-4 sm:px-7 py-2 rounded-xl font-bold text-sm sm:text-base text-[#fff8ec] cursor-pointer transition-transform active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0 text-center"
                  style={{
                    backgroundColor: '#d62828',
                    border: '2px solid #ffd166',
                    boxShadow: '0 4px 0 #780000',
                  }}
                >
                  お賽銭を投げる [Space]
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
