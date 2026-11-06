import {
  COIN_TYPES,
  CoinTypeId,
  ObstacleConfig,
  SaisenBoxConfig,
  StageConfig,
} from './stages';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const THROW_ORIGIN: Vec3 = {
  x: 0,
  y: 1.65,
  z: 5.6,
};

export const GRAVITY = -9.8;

export interface ActiveCoinState {
  active: boolean;
  coinType: CoinTypeId;
  pos: Vec3;
  vel: Vec3;
  rot: Vec3;
  rotVel: Vec3;
  elapsed: number;
  hitBell: boolean;
  passedRing: boolean;
  hitObstacle: boolean;
  bounces: number;
  bounceCooldown: number;
  rimKiss: boolean;
  outcome: 'flying' | 'scored' | 'trap' | 'missed';
  outcomeReason: string;
  scoredBoxId?: string;
}

export interface StepEvents {
  scored: boolean;
  cleanCenterShot: boolean;
  trapTriggered: boolean;
  bellHit: boolean;
  ringPassed: boolean;
  woodBounce: boolean;
  obstacleBounce: boolean;
  missed: boolean;
  hitPosition?: Vec3;
}

export type LandingTargetKind =
  | 'real_box'
  | 'fake_box'
  | 'obstacle'
  | 'ground';

export interface TrajectoryPreviewResult {
  points: Vec3[];
  landingPoint: Vec3;
  landingTarget: LandingTargetKind;
  targetBoxLabel?: string;
  willHitBell: boolean;
  willPassRing: boolean;
}

/**
 * Converts yaw (deg, -35 to +35), pitch (deg, 15 to 75), and power (10 to 100)
 * into a 3D launch velocity vector.
 */
export function computeLaunchVelocity(
  yawDeg: number,
  pitchDeg: number,
  powerPct: number
): Vec3 {
  const clampedYaw = Math.max(-40, Math.min(40, yawDeg));
  const clampedPitch = Math.max(15, Math.min(78, pitchDeg));
  const clampedPower = Math.max(10, Math.min(100, powerPct));

  // Map power 10..100 to speed 4.88..12.98 m/s (power 50% = 8.48 m/s)
  const speed = 3.98 + (clampedPower / 100) * 9.0;
  const pitchRad = (clampedPitch * Math.PI) / 180;
  const yawRad = (clampedYaw * Math.PI) / 180;

  const horizontalSpeed = speed * Math.cos(pitchRad);
  const vx = horizontalSpeed * Math.sin(yawRad);
  const vy = speed * Math.sin(pitchRad);
  const vz = -horizontalSpeed * Math.cos(yawRad);

  return { x: vx, y: vy, z: vz };
}

/**
 * Evaluates instantaneous crosswind at stage time t.
 */
export function getWindAtTime(stage: StageConfig, timeSec: number): number {
  if (stage.windGustAmplitude === 0) {
    return stage.baseWindX;
  }
  return (
    stage.baseWindX +
    Math.sin(timeSec * stage.windGustSpeed) * stage.windGustAmplitude
  );
}

/**
 * Evaluates a Saisen box center position at stage time t.
 */
export function getBoxPositionAtTime(
  box: SaisenBoxConfig,
  timeSec: number
): Vec3 {
  const t = timeSec * box.speed + box.phase;
  let x = box.baseX;
  let y = box.baseY;
  let z = box.baseZ;

  switch (box.motion) {
    case 'horizontal':
      x += Math.sin(t) * box.amplitudeX;
      break;
    case 'vertical':
      y += (Math.sin(t) * 0.5 + 0.5) * box.amplitudeY;
      break;
    case 'figure8':
      x += Math.sin(t) * box.amplitudeX;
      y += Math.sin(t * 2) * box.amplitudeY;
      z += Math.cos(t) * box.amplitudeZ;
      break;
    case 'pendulum':
      x += Math.sin(t) * box.amplitudeX;
      y += Math.abs(Math.cos(t)) * box.amplitudeY;
      break;
    case 'zigzag': {
      const wave = (2 / Math.PI) * Math.asin(Math.sin(t));
      x += wave * box.amplitudeX;
      break;
    }
    case 'static':
    default:
      break;
  }

  return { x, y, z };
}

/**
 * Evaluates an obstacle's center position at stage time t.
 */
export function getObstaclePositionAtTime(
  obs: ObstacleConfig,
  timeSec: number
): Vec3 {
  const t = timeSec * obs.speed + obs.phase;
  return {
    x: obs.baseX + Math.sin(t) * obs.amplitudeX,
    y: obs.baseY + Math.abs(Math.sin(t * 2)) * obs.amplitudeY,
    z: obs.baseZ,
  };
}

/**
 * Evaluates the Sacred Bell position at stage time t.
 */
export function getBellPositionAtTime(
  stage: StageConfig,
  timeSec: number
): Vec3 {
  const x =
    stage.bellSwingAmplitude > 0
      ? Math.sin(timeSec * stage.bellSwingSpeed) * stage.bellSwingAmplitude
      : 0;
  return {
    x,
    y: stage.bellY,
    z: stage.bellZ,
  };
}

/**
 * Evaluates the Bonus Golden Ring position at stage time t.
 */
export function getBonusRingPositionAtTime(
  stage: StageConfig,
  timeSec: number
): Vec3 | null {
  if (!stage.bonusRing || !stage.bonusRing.enabled) return null;
  const r = stage.bonusRing;
  return {
    x: r.baseX + Math.sin(timeSec * r.speed) * r.amplitudeX,
    y: r.baseY,
    z: r.baseZ,
  };
}

/**
 * Creates a fresh flying coin state on throw.
 */
export function createThrownCoin(
  coinType: CoinTypeId,
  yawDeg: number,
  pitchDeg: number,
  powerPct: number
): ActiveCoinState {
  const vel = computeLaunchVelocity(yawDeg, pitchDeg, powerPct);
  return {
    active: true,
    coinType,
    pos: { ...THROW_ORIGIN },
    vel,
    rot: { x: 0.3, y: 0, z: 0 },
    rotVel: { x: 11.0, y: 2.5, z: 1.2 },
    elapsed: 0,
    hitBell: false,
    passedRing: false,
    hitObstacle: false,
    bounces: 0,
    bounceCooldown: 0,
    rimKiss: false,
    outcome: 'flying',
    outcomeReason: '',
  };
}

/**
 * Advances the active coin by dt seconds and resolves collisions against
 * the sacred bell, bonus ring, obstacles, real/fake Saisen boxes, and ground.
 */
export function stepCoinPhysics(
  coin: ActiveCoinState,
  stage: StageConfig,
  stageTimeSec: number,
  dt: number
): StepEvents {
  const events: StepEvents = {
    scored: false,
    cleanCenterShot: false,
    trapTriggered: false,
    bellHit: false,
    ringPassed: false,
    woodBounce: false,
    obstacleBounce: false,
    missed: false,
  };

  if (!coin.active || coin.outcome !== 'flying') {
    return events;
  }

  const clampedDt = Math.min(dt, 0.16);
  const substeps = Math.max(4, Math.ceil(clampedDt / 0.012));
  const subDt = clampedDt / substeps;
  const spec = COIN_TYPES[coin.coinType];
  const windX = getWindAtTime(stage, stageTimeSec);

  for (let s = 0; s < substeps; s++) {
    if (coin.outcome !== 'flying') break;

    const prevZ = coin.pos.z;
    const prevY = coin.pos.y;
    const simTime = stageTimeSec + (s / substeps) * clampedDt;

    if (coin.bounceCooldown > 0) {
      coin.bounceCooldown = Math.max(0, coin.bounceCooldown - subDt);
    }

    // Integrate velocity & position
    coin.vel.x += windX * spec.windFactor * subDt;
    coin.vel.y += GRAVITY * subDt;

    coin.pos.x += coin.vel.x * subDt;
    coin.pos.y += coin.vel.y * subDt;
    coin.pos.z += coin.vel.z * subDt;

    coin.rot.x += coin.rotVel.x * subDt;
    coin.rot.y += coin.rotVel.y * subDt;
    coin.rot.z += coin.rotVel.z * subDt;
    coin.elapsed += subDt;

    // 1. Check Bonus Golden Ring pass-through
    const ringPos = getBonusRingPositionAtTime(stage, simTime);
    if (ringPos && !coin.passedRing && stage.bonusRing) {
      const crossedRingPlane =
        (prevZ >= ringPos.z && coin.pos.z <= ringPos.z) ||
        Math.abs(coin.pos.z - ringPos.z) < 0.18;
      if (crossedRingPlane) {
        const dx = coin.pos.x - ringPos.x;
        const dy = coin.pos.y - ringPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= stage.bonusRing.radius * 0.98) {
          coin.passedRing = true;
          events.ringPassed = true;
        }
      }
    }

    // 2. Check Sacred Bell (本坪鈴) collision
    if (stage.hasSacredBell && !coin.hitBell) {
      const bellPos = getBellPositionAtTime(stage, simTime);
      const dx = coin.pos.x - bellPos.x;
      const dy = coin.pos.y - bellPos.y;
      const dz = coin.pos.z - bellPos.z;
      const dist = Math.hypot(dx, dy, dz);
      const bellRadius = 0.54;
      if (dist <= bellRadius + spec.radius && Math.abs(dy) <= 0.42) {
        coin.hitBell = true;
        events.bellHit = true;
        events.hitPosition = { ...coin.pos };
        // Guide the coin downward toward the primary real box below!
        const realBox = stage.boxes.find((b) => !b.isFake);
        if (realBox) {
          const targetPos = getBoxPositionAtTime(realBox, simTime + 0.35);
          coin.vel.x = (targetPos.x - coin.pos.x) * 2.15;
          coin.vel.z = (targetPos.z - coin.pos.z) * 2.15;
          coin.vel.y = -1.6;
        } else {
          coin.vel.y = -Math.abs(coin.vel.y) * 0.5;
          coin.vel.z *= 0.3;
        }
      }
    }

    // 3. Check Obstacle (Daruma / Komainu) collisions
    if (coin.bounceCooldown <= 0) {
      for (const obs of stage.obstacles) {
        const obsPos = getObstaclePositionAtTime(obs, simTime);
        const obsCenterY = obsPos.y + obs.height * 0.5;
        const dx = coin.pos.x - obsPos.x;
        const dy = coin.pos.y - obsCenterY;
        const dz = coin.pos.z - obsPos.z;
        const horizDist = Math.hypot(dx, dz);

        if (
          horizDist <= obs.radius + spec.radius * 0.85 &&
          Math.abs(dy) <= obs.height * 0.52 + spec.radius * 0.85
        ) {
          coin.hitObstacle = true;
          events.obstacleBounce = true;
          events.hitPosition = { ...coin.pos };
          coin.bounces += 1;
          coin.bounceCooldown = 0.08;
          const nx = horizDist > 0.001 ? dx / horizDist : 0;
          const nz = horizDist > 0.001 ? dz / horizDist : 1;
          coin.pos.x = obsPos.x + nx * (obs.radius + spec.radius + 0.04);
          coin.pos.z = obsPos.z + nz * (obs.radius + spec.radius + 0.04);
          coin.vel.x = nx * 3.4;
          coin.vel.z = Math.max(2.0, Math.abs(coin.vel.z) * spec.restitution);
          coin.vel.y = Math.max(2.4, Math.abs(coin.vel.y) * 0.6);
          break;
        }
      }
    }

    // 4. Check Saisen Boxes (Real & Fake)
    for (const box of stage.boxes) {
      const boxPos = getBoxPositionAtTime(box, simTime);
      const halfW = box.width * 0.5;
      const halfD = box.depth * 0.5;
      const topY = boxPos.y + box.height;
      const bottomY = boxPos.y;

      const relX = coin.pos.x - boxPos.x;
      const relZ = coin.pos.z - boxPos.z;

      // Top slot opening bounds (inner wooden grate area)
      const slotHalfW = halfW * 0.85;
      const slotHalfD = halfD * 0.84;

      const withinTopSlotXZ =
        Math.abs(relX) <= slotHalfW && Math.abs(relZ) <= slotHalfD;

      const crossedTopPlane =
        coin.vel.y <= 0.6 &&
        ((prevY >= topY - 0.22 && coin.pos.y <= topY + 0.18) ||
          (coin.pos.y <= topY + 0.14 && coin.pos.y >= topY - 0.5));

      if (withinTopSlotXZ && crossedTopPlane) {
        if (box.isFake) {
          coin.outcome = 'trap';
          coin.outcomeReason = `偽物箱「${box.label}」の罠が発動！`;
          coin.vel.y = 8.5;
          coin.vel.z = 3.5;
          coin.vel.x = (relX >= 0 ? 1 : -1) * 3.2;
          events.trapTriggered = true;
          events.hitPosition = { ...coin.pos };
          break;
        } else {
          coin.outcome = 'scored';
          coin.scoredBoxId = box.id;
          const centerDist = Math.hypot(
            relX / slotHalfW,
            relZ / slotHalfD
          );
          const isCleanCenter = centerDist < 0.55 && !coin.rimKiss;
          coin.outcomeReason = isCleanCenter
            ? 'ど真ん中ストライク奉納！'
            : 'お賽銭箱に無事奉納！';
          coin.pos.x = boxPos.x + relX * 0.35;
          coin.pos.y = topY - 0.12;
          coin.pos.z = boxPos.z + relZ * 0.35;
          coin.vel = { x: 0, y: 0, z: 0 };
          events.scored = true;
          events.cleanCenterShot = isCleanCenter;
          events.hitPosition = { ...coin.pos };
          break;
        }
      }

      // Check outer wooden rim / side wall collision (only if not already inside top slot opening)
      const withinOuterBoxXZ =
        Math.abs(relX) <= halfW + spec.radius * 0.85 &&
        Math.abs(relZ) <= halfD + spec.radius * 0.85;

      if (
        coin.bounceCooldown <= 0 &&
        withinOuterBoxXZ &&
        (!withinTopSlotXZ || coin.pos.y < topY - 0.25) &&
        coin.pos.y <= topY + spec.radius * 0.6 &&
        coin.pos.y >= bottomY
      ) {
        coin.bounces += 1;
        coin.bounceCooldown = 0.06;
        events.woodBounce = true;
        events.hitPosition = { ...coin.pos };

        if (coin.pos.y >= topY - 0.22) {
          // Rim kiss on top edge: gently hop inward toward the slot center!
          coin.rimKiss = true;
          coin.pos.y = topY + spec.radius * 0.65;
          coin.vel.y = Math.max(1.65, Math.abs(coin.vel.y) * 0.42);
          coin.vel.x = -relX * 1.45;
          coin.vel.z = -relZ * 1.45;
        } else {
          // Side wall bounce
          if (Math.abs(relX) / halfW > Math.abs(relZ) / halfD) {
            coin.pos.x =
              boxPos.x +
              Math.sign(relX || 1) * (halfW + spec.radius * 0.9);
            coin.vel.x = -coin.vel.x * spec.restitution;
          } else {
            coin.pos.z =
              boxPos.z +
              Math.sign(relZ || 1) * (halfD + spec.radius * 0.9);
            coin.vel.z = -coin.vel.z * spec.restitution;
          }
        }
      }
    }

    if (coin.outcome !== 'flying') break;

    // Helper to give human-friendly coaching on why the shot missed
    const diagnoseMissReason = (): string => {
      if (coin.hitObstacle || events.obstacleBounce) {
        return 'だるま・狛犬に弾かれた！角度を高くして飛び越えよう';
      }
      if (coin.rimKiss) {
        return '惜しい！お賽銭箱のフチに弾かれた！あとほんの少し！';
      }
      const realBox = stage.boxes.find((b) => !b.isFake);
      if (realBox) {
        const targetPos = getBoxPositionAtTime(realBox, simTime);
        const dz = coin.pos.z - targetPos.z;
        const dx = coin.pos.x - targetPos.x;
        if (dz > realBox.depth * 0.65) {
          return '手前に落ちた！投げる強さを少し上げてみよう';
        }
        if (dz < -realBox.depth * 0.85) {
          return '奥へ飛びすぎた！投げる強さを少し弱めよう';
        }
        if (dx > realBox.width * 0.55) {
          return '右へ外れた！左右の向きをもう少し左へ向けよう';
        }
        if (dx < -realBox.width * 0.55) {
          return '左へ外れた！左右の向きをもう少し右へ向けよう';
        }
      }
      return '惜しい！枠の外へ…放物線の着弾リングを箱に合わせよう';
    };

    // 5. Check Ground / Floor collision
    const floorY = spec.radius * 0.35;
    if (coin.pos.y <= floorY) {
      coin.pos.y = floorY;
      coin.bounces += 1;
      events.woodBounce = true;
      coin.vel.y = Math.abs(coin.vel.y) * spec.restitution * 0.65;
      coin.vel.x *= 0.72;
      coin.vel.z *= 0.72;

      if (
        coin.bounces >= 2 ||
        Math.hypot(coin.vel.x, coin.vel.y, coin.vel.z) < 1.35
      ) {
        coin.outcome = 'missed';
        coin.outcomeReason = diagnoseMissReason();
        events.missed = true;
        events.hitPosition = { ...coin.pos };
        break;
      }
    }

    // 6. Out of bounds / timeout check
    if (
      coin.elapsed > 4.5 ||
      coin.pos.z < -12 ||
      coin.pos.z > 10 ||
      Math.abs(coin.pos.x) > 10
    ) {
      coin.outcome = 'missed';
      coin.outcomeReason = diagnoseMissReason();
      events.missed = true;
      break;
    }
  }

  return events;
}

/**
 * Computes rich trajectory preview in 3D space using the exact same fine integration step
 * as stepCoinPhysics, stopping cleanly on box tops or ground and reporting target type.
 */
export function computeTrajectoryPreviewDetailed(
  yawDeg: number,
  pitchDeg: number,
  powerPct: number,
  coinType: CoinTypeId,
  stage: StageConfig,
  stageTimeSec: number,
  numSteps = 28
): TrajectoryPreviewResult {
  const points: Vec3[] = [];
  const vel = computeLaunchVelocity(yawDeg, pitchDeg, powerPct);
  const pos: Vec3 = { ...THROW_ORIGIN };
  const spec = COIN_TYPES[coinType];
  const windX = getWindAtTime(stage, stageTimeSec);

  const fineDt = 0.012;
  const maxFineSteps = 190;
  const sampleEvery = Math.max(1, Math.floor(maxFineSteps / (numSteps + 4)));

  let landingTarget: LandingTargetKind = 'ground';
  let targetBoxLabel: string | undefined;
  let willHitBell = false;
  let willPassRing = false;

  const ringPos = getBonusRingPositionAtTime(stage, stageTimeSec);
  const bellPos = stage.hasSacredBell
    ? getBellPositionAtTime(stage, stageTimeSec)
    : null;

  points.push({ x: pos.x, y: pos.y, z: pos.z });

  for (let step = 1; step <= maxFineSteps; step++) {
    const prevX = pos.x;
    const prevY = pos.y;
    const prevZ = pos.z;

    vel.x += windX * spec.windFactor * fineDt;
    vel.y += GRAVITY * fineDt;
    pos.x += vel.x * fineDt;
    pos.y += vel.y * fineDt;
    pos.z += vel.z * fineDt;

    if (step % sampleEvery === 0 && points.length < numSteps) {
      points.push({ x: pos.x, y: pos.y, z: pos.z });
    }

    // 1. Check Bonus Golden Ring pass-through at current snapshot
    if (ringPos && !willPassRing && stage.bonusRing) {
      const crossedRing =
        (prevZ >= ringPos.z && pos.z <= ringPos.z) ||
        Math.abs(pos.z - ringPos.z) < 0.18;
      if (crossedRing) {
        const dist = Math.hypot(pos.x - ringPos.x, pos.y - ringPos.y);
        if (dist <= stage.bonusRing.radius * 0.98) {
          willPassRing = true;
        }
      }
    }

    // 2. Check Sacred Bell (本坪鈴) collision and redirect downward toward real box
    if (bellPos && !willHitBell) {
      const dy = pos.y - bellPos.y;
      const dist = Math.hypot(
        pos.x - bellPos.x,
        dy,
        pos.z - bellPos.z
      );
      if (dist <= 0.54 + spec.radius && Math.abs(dy) <= 0.42) {
        willHitBell = true;
        const realBox = stage.boxes.find((b) => !b.isFake);
        if (realBox) {
          const targetPos = getBoxPositionAtTime(realBox, stageTimeSec + 0.35);
          vel.x = (targetPos.x - pos.x) * 2.15;
          vel.z = (targetPos.z - pos.z) * 2.15;
          vel.y = -1.6;
        } else {
          vel.y = -Math.abs(vel.y) * 0.5;
          vel.z *= 0.3;
        }
      }
    }

    // 3. Check Obstacle (Daruma / Komainu) collisions at current stageTimeSec
    let hitObstacle = false;
    for (const obs of stage.obstacles) {
      const obsPos = getObstaclePositionAtTime(obs, stageTimeSec);
      const obsCenterY = obsPos.y + obs.height * 0.5;
      const dx = pos.x - obsPos.x;
      const dy = pos.y - obsCenterY;
      const dz = pos.z - obsPos.z;
      const horizDist = Math.hypot(dx, dz);

      if (
        horizDist <= obs.radius + spec.radius * 0.85 &&
        Math.abs(dy) <= obs.height * 0.52 + spec.radius * 0.85
      ) {
        points.push({ x: pos.x, y: Math.max(0.15, pos.y), z: pos.z });
        landingTarget = 'obstacle';
        targetBoxLabel = obs.label;
        hitObstacle = true;
        break;
      }
    }
    if (hitObstacle) break;

    // 4. Check Saisen boxes (top slot opening & outer wooden wall)
    let hitBox = false;
    for (const box of stage.boxes) {
      const boxPos = getBoxPositionAtTime(box, stageTimeSec);
      const topY = boxPos.y + box.height;
      const halfW = box.width * 0.5;
      const halfD = box.depth * 0.5;
      const slotHalfW = halfW * 0.85;
      const slotHalfD = halfD * 0.84;

      // Top slot opening crossing
      if (vel.y <= 0 && prevY >= topY && pos.y <= topY) {
        const frac =
          prevY !== pos.y ? (topY - prevY) / (pos.y - prevY) : 0.5;
        const hitX = prevX + (pos.x - prevX) * frac;
        const hitZ = prevZ + (pos.z - prevZ) * frac;
        if (
          Math.abs(hitX - boxPos.x) <= slotHalfW &&
          Math.abs(hitZ - boxPos.z) <= slotHalfD
        ) {
          points.push({ x: hitX, y: topY + 0.04, z: hitZ });
          landingTarget = box.isFake ? 'fake_box' : 'real_box';
          targetBoxLabel = box.label;
          hitBox = true;
          break;
        }
      }

      // Outer wooden side wall impact (prevents preview beads from clipping through the front of the box)
      if (
        pos.y < topY - 0.08 &&
        pos.y >= boxPos.y &&
        Math.abs(pos.x - boxPos.x) <= halfW + spec.radius * 0.6 &&
        Math.abs(pos.z - boxPos.z) <= halfD + spec.radius * 0.6
      ) {
        points.push({ x: prevX, y: Math.max(0.12, prevY), z: prevZ });
        landingTarget = 'ground';
        hitBox = true;
        break;
      }
    }
    if (hitBox) break;

    // 5. Check Ground collision
    if (pos.y <= 0.08) {
      const frac = prevY !== pos.y ? (0.08 - prevY) / (pos.y - prevY) : 1;
      points.push({
        x: prevX + (pos.x - prevX) * frac,
        y: 0.08,
        z: prevZ + (pos.z - prevZ) * frac,
      });
      break;
    }
  }

  return {
    points,
    landingPoint: points[points.length - 1],
    landingTarget,
    targetBoxLabel,
    willHitBell,
    willPassRing,
  };
}

/**
 * Backwards-compatible array wrapper for trajectory points.
 */
export function computeTrajectoryPreview(
  yawDeg: number,
  pitchDeg: number,
  powerPct: number,
  coinType: CoinTypeId,
  stage: StageConfig,
  stageTimeSec: number,
  numSteps = 28
): Vec3[] {
  return computeTrajectoryPreviewDetailed(
    yawDeg,
    pitchDeg,
    powerPct,
    coinType,
    stage,
    stageTimeSec,
    numSteps
  ).points;
}

export interface ShotScoreBreakdown {
  totalPoints: number;
  basePoints: number;
  centerBonus: number;
  bellBonus: number;
  ringMultiplier: number;
  streakBonus: number;
  headline: string;
}

export function calculateShotScore(params: {
  coinType: CoinTypeId;
  cleanCenterShot: boolean;
  hitBell: boolean;
  passedRing: boolean;
  streak: number;
}): ShotScoreBreakdown {
  const spec = COIN_TYPES[params.coinType];
  const basePoints = spec.basePoints;
  const centerBonus = params.cleanCenterShot ? 150 : 0;
  const bellBonus = params.hitBell ? 350 : 0;
  const streakBonus = Math.max(0, (params.streak - 1) * 80);
  const ringMultiplier = params.passedRing ? 2 : 1;

  const raw = basePoints + centerBonus + bellBonus + streakBonus;
  const totalPoints = raw * ringMultiplier;

  const tags: string[] = [];
  if (params.passedRing) tags.push('開運の輪×2');
  if (params.hitBell) tags.push('大鈴コンボ');
  if (params.cleanCenterShot) tags.push('ど真ん中大吉');
  else tags.push('奉納成功');

  return {
    totalPoints,
    basePoints,
    centerBonus,
    bellBonus,
    ringMultiplier,
    streakBonus,
    headline: `${tags.join('・')}！ +${totalPoints}徳`,
  };
}

export type OmikujiRank = '超大吉' | '大吉' | '中吉' | '吉' | '凶';

export function evaluateOmikujiRank(
  hits: number,
  targetHits: number,
  coinsRemaining: number,
  score: number
): OmikujiRank {
  if (hits < targetHits) return '凶';
  if (coinsRemaining >= 3 || score >= targetHits * 350) return '超大吉';
  if (coinsRemaining >= 2 || score >= targetHits * 220) return '大吉';
  if (coinsRemaining >= 1) return '中吉';
  return '吉';
}
