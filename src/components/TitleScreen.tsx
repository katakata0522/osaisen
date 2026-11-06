import React from 'react';
import { STAGES, StageConfig } from '../game/stages';

interface TitleScreenProps {
  selectedStageId: number;
  highestUnlockedStage: number;
  bestScore: number;
  onSelectStage: (stageId: number) => void;
  onStartGame: (stageId?: number) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedStageId,
  bestScore,
  onSelectStage,
  onStartGame,
}) => {
  const currentStage: StageConfig =
    STAGES.find((s) => s.id === selectedStageId) || STAGES[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 md:p-10 overflow-y-auto pointer-events-none">
      {/* Upper / Left Negative-Space Composition */}
      <div className="flex flex-col lg:flex-row items-start justify-between gap-4 sm:gap-6 w-full max-w-7xl mx-auto mt-1 sm:mt-2">
        {/* Custom Inline SVG Shrine Ema & 5-Yen Coin Emblem Lockup */}
        <div
          className="pointer-events-auto rounded-2xl p-6 md:p-7 max-w-xl"
          style={{
            backgroundColor: 'rgba(38, 20, 10, 0.92)',
            border: '3px solid #d4a638',
            boxShadow: '0 14px 32px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 235, 180, 0.25)',
          }}
        >
          <div className="flex items-center gap-4 mb-3">
            {/* Custom SVG 5-Yen Sacred Coin & Shimenawa Crest */}
            <svg
              viewBox="0 0 88 88"
              className="w-16 h-16 md:w-20 md:h-20 shrink-0"
              aria-hidden="true"
            >
              {/* Vermilion Torii Silhouette Backing */}
              <path
                d="M10 22 H78 L74 30 H14 Z M18 30 H70 V36 H18 Z M24 30 V78 H32 V30 Z M56 30 V78 H64 V30 Z"
                fill="#c92a1d"
                stroke="#2a1205"
                strokeWidth="2.5"
              />
              {/* 5-Yen Brass Coin */}
              <circle
                cx="44"
                cy="48"
                r="26"
                fill="#e5b842"
                stroke="#3b1d08"
                strokeWidth="3"
              />
              <circle
                cx="44"
                cy="48"
                r="21"
                fill="none"
                stroke="#fff3c4"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              {/* Central Hole of 5-Yen Coin */}
              <circle
                cx="44"
                cy="48"
                r="7.5"
                fill="#26140a"
                stroke="#8c5818"
                strokeWidth="2.5"
              />
              {/* Rice Ear Details */}
              <path
                d="M26 42 Q34 32 44 33 Q54 32 62 42"
                fill="none"
                stroke="#5c3809"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs md:text-sm font-bold tracking-wider text-[#f3c65f] mb-1 whitespace-nowrap">
                古き良き放物線アクション 3D参拝ゲーム
              </div>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-[#fff8ec] tracking-tight leading-tight whitespace-nowrap">
                お賽銭シュート！
              </h1>
              <p className="text-xs sm:text-sm md:text-base font-bold text-[#f4a261] mt-0.5 whitespace-nowrap">
                ～ご利益マシマシ参拝道～
              </p>
            </div>
          </div>

          <p className="text-sm text-[#e9dcc9] leading-relaxed mb-5">
            放物線の角度と強さを調整して、お賽銭箱へ五円玉を投げ入れよう！
            ステージが進むと「横風」「反復横跳びする賽銭箱」「偽物の罠箱」「邪魔するだるま」など懐かしのギミックが次々登場！
          </p>

          {/* Primary Start Action + Best Record */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartGame(selectedStageId);
              }}
              className="px-7 py-3.5 rounded-xl font-bold text-lg text-[#fff8ec] cursor-pointer transition-transform active:scale-95 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: '#d62828',
                border: '2px solid #ffd166',
                boxShadow: '0 5px 0 #780000, 0 8px 20px rgba(0,0,0,0.45)',
              }}
            >
              参拝スタート（{currentStage.chapterTitle}）
            </button>

            {bestScore > 0 && (
              <div className="text-sm text-[#f3c65f] font-mono-num">
                最高獲得徳：{Math.round(bestScore)} 徳
              </div>
            )}
          </div>
        </div>

        {/* Stage Selection Board (絵馬ステージ選択板) */}
        <div
          className="pointer-events-auto rounded-2xl p-5 w-full lg:w-[440px]"
          style={{
            backgroundColor: 'rgba(38, 20, 10, 0.92)',
            border: '2px solid #b07d3c',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-sm sm:text-base font-bold text-[#ffd166] whitespace-nowrap">
              参拝ステージ選択（全8幕）
            </h2>
            <span className="text-[11px] sm:text-xs text-[#d8c3a5] whitespace-nowrap">
              好きな幕から遊べます
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {STAGES.map((stg) => {
              const isSelected = stg.id === selectedStageId;
              return (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => onSelectStage(stg.id)}
                  className={`text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                    isSelected
                      ? 'bg-[#d62828] text-[#fff8ec] border border-[#ffd166]'
                      : 'bg-[#3a2010] text-[#e6d5b8] hover:bg-[#4f2d18] border border-[#6b4423]'
                  }`}
                >
                  {stg.chapterTitle}：{stg.name}
                </button>
              );
            })}
          </div>

          {/* Selected Stage Gimmick Preview */}
          <div
            className="rounded-xl p-3 text-xs"
            style={{
              backgroundColor: 'rgba(24, 12, 6, 0.85)',
              border: '1px solid #6b4423',
            }}
          >
            <div className="font-bold text-[#ffd166] text-sm mb-0.5">
              {currentStage.chapterTitle}「{currentStage.name}」
            </div>
            <div className="text-[#f4a261] mb-1">
              ギミック：{currentStage.gimmickSummary}
            </div>
            <div className="text-[#d8c3a5] leading-snug">
              {currentStage.hintText}
            </div>
          </div>
        </div>
      </div>

      {/* Flat Borderless Bottom Control Hint Line */}
      <div className="w-full text-center pointer-events-none mb-1">
        <p className="inline-block text-xs md:text-sm font-bold text-[#2a1508] bg-[#fff8ec]/85 px-4 py-1.5 rounded-md">
          操作方法：画面ドラッグ または 矢印キーで角度調整 · Spaceキー または「お賽銭を投げる」で奉納 · 1/2/3キーで硬貨切替 · Pキーで一時停止
        </p>
      </div>
    </div>
  );
};
