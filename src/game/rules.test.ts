import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from './stages';
import {
  calculateShotScore,
  computeTrajectoryPreview,
  computeTrajectoryPreviewDetailed,
  createThrownCoin,
  evaluateOmikujiRank,
  getBoxPositionAtTime,
  stepCoinPhysics,
} from './physics';

test('Stage 1 recommended angle and power lands directly in the real Saisen box', () => {
  const stage1 = STAGES[0];
  const coin = createThrownCoin(
    '5yen',
    stage1.recommendedYaw,
    stage1.recommendedPitch,
    stage1.recommendedPower
  );

  let scored = false;
  for (let i = 0; i < 120; i++) {
    const events = stepCoinPhysics(coin, stage1, 0, 1 / 60);
    if (events.scored) {
      scored = true;
      break;
    }
    if (coin.outcome !== 'flying') break;
  }

  assert.equal(scored, true, 'Stage 1 default recommended throw should score');
  assert.equal(coin.outcome, 'scored');

  // Detailed trajectory preview should also report real_box target on Stage 1
  const preview = computeTrajectoryPreviewDetailed(
    stage1.recommendedYaw,
    stage1.recommendedPitch,
    stage1.recommendedPower,
    '5yen',
    stage1,
    0
  );
  assert.equal(preview.landingTarget, 'real_box');
});

test('Stage 2 crosswind deflects 5yen coin more than heavy 50yen coin, and recommended aim scores', () => {
  const stage2 = STAGES[1];
  const traj5 = computeTrajectoryPreview(0, 45, 55, '5yen', stage2, 0, 20);
  const traj50 = computeTrajectoryPreview(0, 45, 55, '50yen', stage2, 0, 20);

  const end5X = traj5[traj5.length - 1].x;
  const end50X = traj50[traj50.length - 1].x;

  assert.ok(end5X > end50X, '5-yen coin should drift further right in wind than 50-yen coin');
  assert.ok(end50X > 0, 'Both coins drift somewhat right in positive wind');

  const coin = createThrownCoin(
    '5yen',
    stage2.recommendedYaw,
    stage2.recommendedPitch,
    stage2.recommendedPower
  );
  let scored = false;
  for (let i = 0; i < 120; i++) {
    const ev = stepCoinPhysics(coin, stage2, 0, 1 / 60);
    if (ev.scored) {
      scored = true;
      break;
    }
    if (coin.outcome !== 'flying') break;
  }
  assert.equal(scored, true, 'Stage 2 recommended wind-compensated throw should score');
});

test('Stage 3 moving box changes X coordinate over time', () => {
  const stage3Box = STAGES[2].boxes[0];
  const posT0 = getBoxPositionAtTime(stage3Box, 0);
  const posT1 = getBoxPositionAtTime(stage3Box, 1.1);

  assert.equal(posT0.x, 0);
  assert.ok(Math.abs(posT1.x) > 1.0, 'Moving box should displace horizontally');
});

test('Stage 4 fake box triggers trap outcome while real box scores', () => {
  const stage4 = STAGES[3];
  // Center box at (0, 0, -2.1) is a fake trap box
  const coinFake = createThrownCoin('5yen', 0, 45, 50);
  let trapHit = false;
  for (let i = 0; i < 120; i++) {
    const ev = stepCoinPhysics(coinFake, stage4, 0, 1 / 60);
    if (ev.trapTriggered) {
      trapHit = true;
      break;
    }
    if (coinFake.outcome !== 'flying') break;
  }
  assert.equal(trapHit, true, 'Throwing straight into center fake box on Stage 4 triggers trap');
  assert.equal(coinFake.outcome, 'trap');

  // Detailed trajectory preview on fake box reports fake_box
  const fakePreview = computeTrajectoryPreviewDetailed(0, 45, 50, '5yen', stage4, 0);
  assert.equal(fakePreview.landingTarget, 'fake_box');

  // Recommended right throw hits the real box at X = +2.5
  const coinReal = createThrownCoin(
    '5yen',
    stage4.recommendedYaw,
    stage4.recommendedPitch,
    stage4.recommendedPower
  );
  let realHit = false;
  for (let i = 0; i < 120; i++) {
    const ev = stepCoinPhysics(coinReal, stage4, 0, 1 / 60);
    if (ev.scored) {
      realHit = true;
      break;
    }
    if (coinReal.outcome !== 'flying') break;
  }
  assert.equal(realHit, true, 'Recommended yaw on Stage 4 scores in the real box on the right');
});

test('Stage 5 high parabolic arc clears Daruma & Komainu obstacles and scores, while low arc hits Daruma', () => {
  const stage5 = STAGES[4];
  const coin = createThrownCoin(
    '5yen',
    stage5.recommendedYaw,
    stage5.recommendedPitch,
    stage5.recommendedPower
  );
  let scored = false;
  for (let i = 0; i < 150; i++) {
    const ev = stepCoinPhysics(coin, stage5, 0, 1 / 60);
    if (ev.scored) {
      scored = true;
      break;
    }
    if (coin.outcome !== 'flying') break;
  }
  assert.equal(scored, true, 'Stage 5 high-angle lob clears obstacles and lands in the Saisen box');

  // Low-angle throw on Stage 5 at t=0 hits the Daruma obstacle in front
  const lowPreview = computeTrajectoryPreviewDetailed(0, 26, 48, '5yen', stage5, 0);
  assert.equal(lowPreview.landingTarget, 'obstacle');
  assert.equal(lowPreview.targetBoxLabel, '必勝だるま');
});

test('Sacred Bell high-angle shot triggers bell redirect into real Saisen box', () => {
  const stage1 = STAGES[0];
  const bellPreview = computeTrajectoryPreviewDetailed(0, 62, 68, '5yen', stage1, 0);
  assert.equal(bellPreview.willHitBell, true, 'High-angle shot hits the Sacred Bell');
  assert.equal(bellPreview.landingTarget, 'real_box', 'Sacred Bell redirect guides coin into real box');
});

test('Stage 6 real and fake moving boxes do not overlap at t=0, and Stage 7 bonus ring pass-through is detected', () => {
  const stage6 = STAGES[5];
  const realPos = getBoxPositionAtTime(stage6.boxes[0], 0);
  const fakePos = getBoxPositionAtTime(stage6.boxes[1], 0);
  assert.ok(
    Math.abs(realPos.x - fakePos.x) > 2.0,
    'Stage 6 real and fake boxes are separated horizontally at t=0'
  );

  const stage7 = STAGES[6];
  const ringPreview = computeTrajectoryPreviewDetailed(
    stage7.recommendedYaw,
    stage7.recommendedPitch,
    stage7.recommendedPower,
    '5yen',
    stage7,
    0
  );
  assert.equal(ringPreview.willPassRing, true, 'Stage 7 recommended throw passes through the Bonus Golden Ring');
});

test('Shot score calculation applies bell bonus, center bonus, and ring multiplier', () => {
  const res = calculateShotScore({
    coinType: '5yen',
    cleanCenterShot: true,
    hitBell: true,
    passedRing: true,
    streak: 2,
  });
  // (100 base + 150 center + 350 bell + 80 streak) * 2 = 1360
  assert.equal(res.totalPoints, 1360);
  assert.equal(evaluateOmikujiRank(2, 2, 3, 1360), '超大吉');
  assert.equal(evaluateOmikujiRank(1, 2, 0, 200), '凶');
});

test('Miss coaching diagnosis persists obstacle bounce across frames and identifies short/long throws', () => {
  const stage5 = STAGES[4];
  const lowCoin = createThrownCoin('5yen', 0, 26, 48);
  for (let i = 0; i < 180; i++) {
    stepCoinPhysics(lowCoin, stage5, 0, 1 / 60);
    if (lowCoin.outcome !== 'flying') break;
  }
  assert.equal(lowCoin.outcome, 'missed');
  assert.equal(lowCoin.hitObstacle, true);
  assert.ok(
    lowCoin.outcomeReason.includes('だるま・狛犬に弾かれた'),
    `Expected obstacle bounce coaching, got: ${lowCoin.outcomeReason}`
  );

  const stage1 = STAGES[0];
  const shortCoin = createThrownCoin('5yen', 0, 35, 25);
  for (let i = 0; i < 180; i++) {
    stepCoinPhysics(shortCoin, stage1, 0, 1 / 60);
    if (shortCoin.outcome !== 'flying') break;
  }
  assert.equal(shortCoin.outcome, 'missed');
  assert.ok(
    shortCoin.outcomeReason.includes('手前に落ちた'),
    `Expected short throw coaching, got: ${shortCoin.outcomeReason}`
  );

  const longCoin = createThrownCoin('5yen', 0, 35, 85);
  for (let i = 0; i < 180; i++) {
    stepCoinPhysics(longCoin, stage1, 0, 1 / 60);
    if (longCoin.outcome !== 'flying') break;
  }
  assert.equal(longCoin.outcome, 'missed');
  assert.ok(
    longCoin.outcomeReason.includes('奥へ飛びすぎた'),
    `Expected long throw coaching, got: ${longCoin.outcomeReason}`
  );
});

