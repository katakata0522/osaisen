import React from 'react';
import { STAGES, StageConfig } from '../game/stages';
import { OmikujiRank } from '../game/physics';

export interface RunSnapshot {
  isVictory: boolean;
  stage: StageConfig;
  score: number;
  bestScore: number;
  hits: number;
  targetHits: number;
  coinsRemaining: number;
  omikuji: OmikujiRank;
}

interface StatusModalProps {
  gameState: 'paused' | 'gameover';
  snapshot: RunSnapshot | null;
  onResume: () => void;
  onRestart: () => void;
  onNextStage: () => void;
  onReturnTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  gameState,
  snapshot,
  onResume,
  onRestart,
  onNextStage,
  onReturnTitle,
}) => {
  if (gameState === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/65">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-modal-title"
          className="w-full max-w-md rounded-2xl p-6 text-center"
          style={{
            backgroundColor: '#281409',
            border: '3px solid #d4a638',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.7)',
          }}
        >
          <div className="text-xs font-bold text-[#ffd166] tracking-wider mb-1">
            一息休憩中
          </div>
          <h2
            id="pause-modal-title"
            className="font-display text-2xl font-bold text-[#fff8ec] mb-5"
          >
            参拝を一時停止中
          </h2>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 rounded-xl font-bold text-base text-[#fff8ec] bg-[#d62828] hover:bg-[#e63946] border-2 border-[#ffd166] cursor-pointer whitespace-nowrap"
            >
              参拝を再開する [Esc / P]
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-[#ffd166] bg-[#3e2210] hover:bg-[#522e16] border border-[#b07d3c] cursor-pointer whitespace-nowrap"
            >
              この幕を最初からやり直す
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-[#d8c3a5] bg-[#1f1007] hover:bg-[#2e180b] border border-[#5c361a] cursor-pointer whitespace-nowrap"
            >
              タイトル・幕選択へ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const hasNextStage = snapshot.stage.id < STAGES.length;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcome-modal-title"
        className="w-full max-w-lg rounded-2xl p-6 md:p-7 text-center"
        style={{
          backgroundColor: '#281409',
          border: snapshot.isVictory ? '3px solid #ffd166' : '3px solid #e63946',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75)',
        }}
      >
        <div className="text-xs font-bold tracking-widest text-[#f3c65f] mb-1">
          {snapshot.stage.chapterTitle}「{snapshot.stage.name}」結果発表
        </div>

        <h2
          id="outcome-modal-title"
          className="font-display text-xl sm:text-3xl md:text-4xl font-bold text-[#fff8ec] mb-2 whitespace-nowrap"
        >
          {snapshot.isVictory
            ? hasNextStage
              ? '御利益達成！ステージクリア'
              : '全八幕 完全制覇！大願成就'
            : 'お賽銭切れ…参拝失敗'}
        </h2>

        <p className="text-sm text-[#e6d5b8] mb-5">
          {snapshot.isVictory
            ? `おみくじ判定：【${snapshot.omikuji}】 見事な放物線でお賽銭箱へ奉納されました！`
            : 'あと少し！風向きや箱の動き・角度を微調整してもう一度挑戦しよう。'}
        </p>

        {/* 3 Tabular-Nums Mastery / Progress Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-3 bg-[#1a0d05] border border-[#5c361a]">
            <div className="text-[11px] font-bold text-[#d8c3a5]">奉納成功数</div>
            <div className="font-mono-num text-2xl font-extrabold text-[#ffd166] mt-1">
              {Math.round(snapshot.hits)}/{Math.round(snapshot.targetHits)}
            </div>
          </div>

          <div className="rounded-xl p-3 bg-[#1a0d05] border border-[#5c361a]">
            <div className="text-[11px] font-bold text-[#d8c3a5]">獲得した徳</div>
            <div className="font-mono-num text-2xl font-extrabold text-[#fff8ec] mt-1">
              {Math.round(snapshot.score)}
            </div>
          </div>

          <div className="rounded-xl p-3 bg-[#1a0d05] border border-[#5c361a]">
            <div className="text-[11px] font-bold text-[#d8c3a5]">おみくじ判定</div>
            <div className="font-display text-xl font-bold text-[#f4a261] mt-1">
              {snapshot.omikuji}
            </div>
          </div>
        </div>

        {/* Primary Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {snapshot.isVictory && hasNextStage ? (
            <button
              type="button"
              data-start="true"
              onClick={onNextStage}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-base text-[#fff8ec] bg-[#d62828] hover:bg-[#e63946] border-2 border-[#ffd166] cursor-pointer whitespace-nowrap"
              style={{ boxShadow: '0 4px 0 #780000' }}
            >
              次の幕へ進む（第{snapshot.stage.id + 1}幕）
            </button>
          ) : null}

          <button
            type="button"
            data-start={!snapshot.isVictory || !hasNextStage ? 'true' : undefined}
            onClick={onRestart}
            className={`w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-base cursor-pointer whitespace-nowrap ${
              !snapshot.isVictory || !hasNextStage
                ? 'bg-[#d62828] text-[#fff8ec] border-2 border-[#ffd166]'
                : 'bg-[#3e2210] text-[#ffd166] border border-[#b07d3c]'
            }`}
          >
            もう一度挑戦する
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-bold text-sm text-[#d8c3a5] bg-[#1f1007] hover:bg-[#2e180b] border border-[#5c361a] cursor-pointer whitespace-nowrap"
          >
            タイトルへ戻る
          </button>
        </div>
      </div>
    </div>
  );
};
