import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  COIN_TYPES,
  CoinTypeId,
  ObstacleConfig,
  SaisenBoxConfig,
  StageConfig,
} from '../game/stages';
import {
  ActiveCoinState,
  LandingTargetKind,
  THROW_ORIGIN,
  computeTrajectoryPreviewDetailed,
  getBellPositionAtTime,
  getBonusRingPositionAtTime,
  getBoxPositionAtTime,
  getObstaclePositionAtTime,
  getWindAtTime,
  stepCoinPhysics,
} from '../game/physics';

export interface ShrineSceneProps {
  gameState: 'title' | 'playing' | 'paused' | 'gameover';
  stage: StageConfig;
  runKey: number;
  coinType: CoinTypeId;
  coinsLeft: number;
  yaw: number;
  pitch: number;
  power: number;
  activeCoinRef: React.MutableRefObject<ActiveCoinState | null>;
  onUpdateAim: (yawDelta: number, pitchDelta: number) => void;
  onTriggerThrow: () => void;
  onShotEvent: (event: {
    type: 'scored' | 'trap' | 'missed' | 'bell' | 'ring' | 'bounce';
    cleanCenter?: boolean;
    hitBell?: boolean;
    passedRing?: boolean;
    reason?: string;
  }) => void;
  onTelemetryUpdate?: (info: {
    windX: number;
    landingTarget: LandingTargetKind;
    targetBoxLabel?: string;
    willHitBell: boolean;
    willPassRing: boolean;
  }) => void;
}

// Pre-allocated math scratch objects outside render loop (Zero GC)
const _dummy = new THREE.Object3D();
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _color = new THREE.Color();

function createWoodGrainBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = 115 + Math.sin(y * 0.15) * 18 + (Math.random() - 0.5) * 20;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPlaqueTexture(
  label: string,
  isFake: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Background paper / wood plaque
  ctx.fillStyle = isFake ? '#3a1525' : '#fdfaf2';
  ctx.fillRect(0, 0, 256, 256);

  // Border frame
  ctx.strokeStyle = isFake ? '#ff4d6d' : '#1e1b18';
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 228, 228);

  // Inner subtle border
  ctx.strokeStyle = isFake ? '#a82040' : '#d4a638';
  ctx.lineWidth = 4;
  ctx.strokeRect(26, 26, 204, 204);

  // Vertical Kanji calligraphy
  ctx.fillStyle = isFake ? '#ffccd5' : '#14110f';
  ctx.font = 'bold 92px "Kaisei Decol", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = Array.from(label);
  if (chars.length === 2) {
    ctx.fillText(chars[0], 128, 86);
    ctx.fillText(chars[1], 128, 178);
  } else {
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, 128, 66 + idx * 64);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildSaisenBoxGroup(
  boxCfg: SaisenBoxConfig,
  woodBump: THREE.CanvasTexture,
  maxAnisotropy: number
): THREE.Group {
  const group = new THREE.Group();
  const { width: w, height: h, depth: d, isFake, fakeTell } = boxCfg;

  const mainWoodColor = isFake
    ? fakeTell === 'darkWood'
      ? 0x4a2030
      : 0x6e2b23
    : 0x9c5a25;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: mainWoodColor,
    roughness: 0.72,
    metalness: 0.08,
    bumpMap: woodBump,
    bumpScale: 0.015,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: isFake ? 0x3b1219 : 0x784115,
    roughness: 0.45,
    metalness: 0.15,
    bumpMap: woodBump,
    bumpScale: 0.01,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: isFake ? 0x9e2a2b : 0xe0b243,
    roughness: 0.25,
    metalness: 0.85,
  });

  const slotDarkMat = new THREE.MeshBasicMaterial({
    color: isFake ? 0x240008 : 0x120a04,
  });

  // 1. Main lower chest body (pivot at bottom-center y=0)
  const bodyMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.92, h * 0.82, d * 0.92),
    bodyMat
  );
  bodyMesh.position.y = h * 0.41;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Flared upper offering frame (4 walls forming the bevelled rim)
  const frameH = h * 0.22;
  const frameY = h - frameH * 0.5;
  const wallT = 0.14;

  const frontRim = new THREE.Mesh(
    new THREE.BoxGeometry(w, frameH, wallT),
    rimMat
  );
  frontRim.position.set(0, frameY, d * 0.5 - wallT * 0.5);
  frontRim.castShadow = true;
  group.add(frontRim);

  const backRim = new THREE.Mesh(
    new THREE.BoxGeometry(w, frameH, wallT),
    rimMat
  );
  backRim.position.set(0, frameY, -d * 0.5 + wallT * 0.5);
  backRim.castShadow = true;
  group.add(backRim);

  const leftRim = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, frameH, d - wallT * 2),
    rimMat
  );
  leftRim.position.set(-w * 0.5 + wallT * 0.5, frameY, 0);
  leftRim.castShadow = true;
  group.add(leftRim);

  const rightRim = new THREE.Mesh(
    new THREE.BoxGeometry(wallT, frameH, d - wallT * 2),
    rimMat
  );
  rightRim.position.set(w * 0.5 - wallT * 0.5, frameY, 0);
  rightRim.castShadow = true;
  group.add(rightRim);

  // 3. Dark inner recessed floor inside the slot
  const innerRecess = new THREE.Mesh(
    new THREE.PlaneGeometry(w - wallT * 1.8, d - wallT * 1.8),
    slotDarkMat
  );
  innerRecess.rotation.x = -Math.PI / 2;
  innerRecess.position.y = h - 0.14;
  group.add(innerRecess);

  // 4. Wooden Slats (格子) across the top opening
  const numSlats = 5;
  const slatGeo = new THREE.BoxGeometry(w - wallT * 2, 0.05, 0.055);
  for (let i = 0; i < numSlats; i++) {
    const frac = (i + 1) / (numSlats + 1) - 0.5;
    const slat = new THREE.Mesh(slatGeo, rimMat);
    slat.position.set(0, h - 0.03, frac * (d - wallT * 2));
    group.add(slat);
  }

  // 5. Fake box tell: subtle jagged mimic teeth or danger trim inside the slot
  if (isFake && fakeTell === 'teeth') {
    const toothMat = new THREE.MeshStandardMaterial({
      color: 0xfff0f3,
      roughness: 0.3,
    });
    const toothGeo = new THREE.ConeGeometry(0.06, 0.14, 4);
    for (let i = -3; i <= 3; i++) {
      const tFront = new THREE.Mesh(toothGeo, toothMat);
      tFront.rotation.x = Math.PI;
      tFront.position.set(i * 0.22, h - 0.01, d * 0.5 - wallT - 0.04);
      group.add(tFront);
    }
  }

  // 6. Brass corner brackets (錺金具)
  const bracketGeo = new THREE.BoxGeometry(0.14, frameH + 0.02, 0.14);
  const corners = [
    [-w * 0.5 + 0.05, d * 0.5 - 0.05],
    [w * 0.5 - 0.05, d * 0.5 - 0.05],
    [-w * 0.5 + 0.05, -d * 0.5 + 0.05],
    [w * 0.5 - 0.05, -d * 0.5 + 0.05],
  ];
  corners.forEach(([cx, cz]) => {
    const br = new THREE.Mesh(bracketGeo, brassMat);
    br.position.set(cx, frameY, cz);
    group.add(br);
  });

  // 7. Front Calligraphy Plaque (奉納 / 没収 / ワナ)
  const plaqueTex = createPlaqueTexture(boxCfg.label, isFake, maxAnisotropy);
  const plaqueMat = new THREE.MeshStandardMaterial({
    map: plaqueTex,
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.05,
  });
  const plaqueMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.34, h * 0.58, 0.05),
    plaqueMat
  );
  plaqueMesh.name = 'calligraphyPlaque';
  plaqueMesh.position.set(0, h * 0.42, d * 0.46 + 0.02);
  group.add(plaqueMesh);

  // 8. If box moves horizontally, add cute wooden wheels/rollers underneath
  if (boxCfg.motion === 'horizontal' || boxCfg.motion === 'zigzag') {
    const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions = [
      [-w * 0.38, 0.15, d * 0.35],
      [w * 0.38, 0.15, d * 0.35],
      [-w * 0.38, 0.15, -d * 0.35],
      [w * 0.38, 0.15, -d * 0.35],
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, brassMat);
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    });
  }

  // 9. If box floats (figure8 / vertical), add a golden cloud cushion underneath
  if (boxCfg.motion === 'figure8' || boxCfg.motion === 'vertical') {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0x5c3d00,
      emissiveIntensity: 0.25,
      roughness: 0.35,
      metalness: 0.3,
    });
    const puffs = [
      [0, -0.05, 0, 0.65],
      [-0.65, -0.02, 0.1, 0.48],
      [0.65, -0.02, 0.1, 0.48],
      [-0.35, -0.04, -0.35, 0.42],
      [0.35, -0.04, -0.35, 0.42],
    ];
    puffs.forEach(([px, py, pz, pr]) => {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(pr, 16, 12),
        cloudMat
      );
      puff.scale.set(1.2, 0.45, 1.0);
      puff.position.set(px, py, pz);
      group.add(puff);
    });
  }

  // 10. Soft radial contact shadow disc underneath (above stone slabs at y=0.06)
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(w, d) * 0.65, 24),
    new THREE.MeshBasicMaterial({
      color: 0x1a0f08,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
  );
  shadowDisc.name = 'groundContactShadow';
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.064;
  group.add(shadowDisc);

  return group;
}

function buildObstacleGroup(obs: ObstacleConfig): THREE.Group {
  const group = new THREE.Group();

  if (obs.kind === 'daruma') {
    // Composite 6-part Daruma Doll (必勝だるま)
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xd9261c,
      roughness: 0.32,
      metalness: 0.1,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0xfcebd5,
      roughness: 0.65,
      metalness: 0.05,
    });
    const inkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1412,
      roughness: 0.8,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe6b830,
      roughness: 0.25,
      metalness: 0.8,
    });

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(obs.radius, 24, 20),
      redMat
    );
    body.scale.set(1.0, 1.12, 0.95);
    body.position.y = obs.radius * 1.02;
    body.castShadow = true;
    group.add(body);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(obs.radius * 0.62, 20, 16),
      faceMat
    );
    face.scale.set(1.05, 0.82, 0.55);
    face.position.set(0, obs.radius * 1.22, obs.radius * 0.58);
    group.add(face);

    const eyeGeo = new THREE.SphereGeometry(obs.radius * 0.14, 12, 12);
    const leftEye = new THREE.Mesh(eyeGeo, inkMat);
    leftEye.position.set(-obs.radius * 0.22, obs.radius * 1.26, obs.radius * 0.85);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, inkMat);
    rightEye.position.set(obs.radius * 0.22, obs.radius * 1.26, obs.radius * 0.85);
    group.add(rightEye);

    const browGeo = new THREE.BoxGeometry(obs.radius * 0.28, 0.06, 0.06);
    const leftBrow = new THREE.Mesh(browGeo, inkMat);
    leftBrow.rotation.z = 0.25;
    leftBrow.position.set(-obs.radius * 0.23, obs.radius * 1.44, obs.radius * 0.86);
    group.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, inkMat);
    rightBrow.rotation.z = -0.25;
    rightBrow.position.set(obs.radius * 0.23, obs.radius * 1.44, obs.radius * 0.86);
    group.add(rightBrow);

    const bellyBand = new THREE.Mesh(
      new THREE.TorusGeometry(obs.radius * 0.82, 0.045, 10, 24),
      goldMat
    );
    bellyBand.rotation.x = Math.PI / 2;
    bellyBand.position.y = obs.radius * 0.65;
    group.add(bellyBand);
  } else {
    // Guardian Komainu Statue (守護狛犬)
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x949ba1,
      roughness: 0.78,
      metalness: 0.05,
    });
    const maneMat = new THREE.MeshStandardMaterial({
      color: 0x6c757d,
      roughness: 0.55,
      metalness: 0.12,
    });
    const goldEyeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x92400e,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.8,
    });

    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(obs.radius * 1.6, 0.28, obs.radius * 1.6),
      maneMat
    );
    pedestal.position.y = 0.14;
    group.add(pedestal);

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(obs.radius * 0.55, obs.radius * 0.7, 0.7, 16),
      stoneMat
    );
    torso.position.y = 0.62;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(obs.radius * 0.95, 0.48, obs.radius * 0.95),
      stoneMat
    );
    head.position.set(0, 1.12, 0.08);
    head.castShadow = true;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.07, 10, 10);
    const eyeL = new THREE.Mesh(eyeGeo, goldEyeMat);
    eyeL.position.set(-0.16, 1.18, obs.radius * 0.55);
    group.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, goldEyeMat);
    eyeR.position.set(0.16, 1.18, obs.radius * 0.55);
    group.add(eyeR);
  }

  // Contact shadow disc (above stone slabs at y=0.06)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(obs.radius * 1.15, 20),
    new THREE.MeshBasicMaterial({
      color: 0x1a0f08,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.064;
  group.add(shadow);

  return group;
}

function buildCoinMesh(coinType: CoinTypeId): THREE.Group {
  const spec = COIN_TYPES[coinType];
  const group = new THREE.Group();

  const coinMat = new THREE.MeshStandardMaterial({
    color: spec.colorHex,
    roughness: 0.24,
    metalness: 0.88,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: spec.id === '5yen' ? 0xb58318 : 0x94a3b8,
    roughness: 0.48,
    metalness: 0.75,
  });

  if (spec.hasHole) {
    // Extruded ring shape with authentic center hole
    const shape = new THREE.Shape();
    shape.absarc(0, 0, spec.radius, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, spec.radius * 0.28, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
    });
    extrudeGeo.center();
    const coinBody = new THREE.Mesh(extrudeGeo, coinMat);
    coinBody.castShadow = true;
    group.add(coinBody);

    // Raised inner ring around the hole
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(spec.radius * 0.32, 0.018, 8, 24),
      rimMat
    );
    innerRing.position.z = 0.025;
    group.add(innerRing);
  } else {
    const cylGeo = new THREE.CylinderGeometry(
      spec.radius,
      spec.radius,
      0.05,
      28
    );
    cylGeo.rotateX(Math.PI / 2);
    const coinBody = new THREE.Mesh(cylGeo, coinMat);
    coinBody.castShadow = true;
    group.add(coinBody);
  }

  // Outer raised rim
  const outerRim = new THREE.Mesh(
    new THREE.TorusGeometry(spec.radius * 0.96, 0.02, 8, 28),
    rimMat
  );
  group.add(outerRim);

  return group;
}

export const ShrineScene3D: React.FC<ShrineSceneProps> = ({
  gameState,
  stage,
  runKey,
  coinType,
  coinsLeft,
  yaw,
  pitch,
  power,
  activeCoinRef,
  onUpdateAim,
  onTriggerThrow,
  onShotEvent,
  onTelemetryUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so WebGL scene never tears down on HUD updates
  const propsRef = useRef({
    gameState,
    stage,
    runKey,
    coinType,
    coinsLeft,
    yaw,
    pitch,
    power,
    onUpdateAim,
    onTriggerThrow,
    onShotEvent,
    onTelemetryUpdate,
  });
  propsRef.current = {
    gameState,
    stage,
    runKey,
    coinType,
    coinsLeft,
    yaw,
    pitch,
    power,
    onUpdateAim,
    onTriggerThrow,
    onShotEvent,
    onTelemetryUpdate,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection (Three.js skill standard)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initWidth = container.clientWidth || window.innerWidth;
    const initHeight = container.clientHeight || window.innerHeight;
    renderer.setSize(initWidth, initHeight);
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Sky Background & Studio Environment Map
    const scene = new THREE.Scene();
    const horizonHex = 0xfcebd2;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.024);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(
      48,
      initWidth / initHeight,
      0.1,
      120
    );
    camera.position.set(0, 3.6, 8.6);
    camera.lookAt(0, 1.3, -1.8);

    // 4. Warm Key Light + Cool Hemisphere Fill + Rim Light
    const hemiLight = new THREE.HemisphereLight(0xaad4ff, 0x705138, 0.85);
    hemiLight.position.set(0, 25, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff1d0, 1.65);
    dirLight.position.set(7, 13, 8);
    dirLight.castShadow = !isSoftwareGl;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    const d = 8.5;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 32;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xffb703, 0.55);
    rimLight.position.set(-6, 7, -8);
    scene.add(rimLight);

    // 5. Build Permanent Shrine Courtyard & Architecture
    const woodBump = createWoodGrainBumpTexture(maxAnisotropy);

    // Ground Courtyard (境内)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xd9cbb8,
      roughness: 0.9,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      groundMat
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Stone Approach Path (参道石畳) — offset Y >= 0.02 to prevent Z-fighting
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8f9499,
      roughness: 0.82,
      metalness: 0.06,
    });
    const approachPath = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.04, 14),
      stoneMat
    );
    approachPath.position.set(0, 0.02, 2.2);
    approachPath.receiveShadow = true;
    scene.add(approachPath);

    // Stepping stone slabs
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xa4aab0,
      roughness: 0.7,
      metalness: 0.08,
    });
    for (let i = 0; i < 6; i++) {
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.03, 0.85),
        slabMat
      );
      slab.position.set(0, 0.045, 5.2 - i * 1.25);
      slab.receiveShadow = true;
      scene.add(slab);
    }

    // Shrine Hall (本殿) Composite Group in background
    const shrineGroup = new THREE.Group();
    const vermilionMat = new THREE.MeshStandardMaterial({
      color: 0xc92a1d,
      roughness: 0.42,
      metalness: 0.12,
    });
    const darkRoofMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.65,
      metalness: 0.25,
    });
    const cedarMat = new THREE.MeshStandardMaterial({
      color: 0xb57c43,
      roughness: 0.72,
      bumpMap: woodBump,
      bumpScale: 0.015,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xe6b830,
      roughness: 0.22,
      metalness: 0.88,
    });
    const whitePaperMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    });

    // Shrine raised stone foundation & wooden veranda
    const baseFoundation = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.9, 4.5),
      stoneMat
    );
    baseFoundation.position.set(0, 0.45, -5.6);
    baseFoundation.receiveShadow = true;
    shrineGroup.add(baseFoundation);

    // Wooden stairs leading up to the hall
    for (let s = 0; s < 3; s++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 0.26, 0.45),
        cedarMat
      );
      step.position.set(0, 0.13 + s * 0.26, -3.2 - s * 0.35);
      step.receiveShadow = true;
      shrineGroup.add(step);
    }

    // Vermilion Pillars (朱塗りの柱)
    const pillarGeo = new THREE.CylinderGeometry(0.24, 0.26, 4.4, 16);
    [-4.4, -2.0, 2.0, 4.4].forEach((px) => {
      const pillar = new THREE.Mesh(pillarGeo, vermilionMat);
      pillar.position.set(px, 2.9, -4.2);
      pillar.castShadow = true;
      shrineGroup.add(pillar);
    });

    // Main Crossbeam (貫・虹梁)
    const crossBeam = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, 0.42, 0.45),
      vermilionMat
    );
    crossBeam.position.set(0, 4.65, -4.15);
    shrineGroup.add(crossBeam);

    // Shimenawa Sacred Rope (大注連縄) + Shide paper zigzags (紙垂)
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xd8b467,
      roughness: 0.88,
      metalness: 0.05,
    });
    for (let r = -4; r <= 4; r++) {
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(0.24 - Math.abs(r) * 0.018, 12, 10),
        ropeMat
      );
      seg.scale.set(1.4, 0.85, 0.85);
      seg.position.set(r * 0.72, 4.42 + Math.cos(r * 0.3) * 0.08, -3.85);
      shrineGroup.add(seg);
    }
    [-2.1, -0.7, 0.7, 2.1].forEach((sx) => {
      const shide = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.45, 0.03),
        whitePaperMat
      );
      shide.position.set(sx, 4.05, -3.75);
      shide.rotation.z = 0.08;
      shrineGroup.add(shide);
    });

    // Grand Shrine Roof (切妻屋根) + Gold Chigi Finials (千木)
    const mainRoof = new THREE.Mesh(
      new THREE.ConeGeometry(7.8, 2.4, 4),
      darkRoofMat
    );
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(1.3, 1.0, 0.65);
    mainRoof.position.set(0, 6.2, -5.0);
    shrineGroup.add(mainRoof);

    const roofRidge = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.24, 0.35),
      goldTrimMat
    );
    roofRidge.position.set(0, 7.25, -5.0);
    shrineGroup.add(roofRidge);

    // Stone Lanterns (石灯籠) flanking the courtyard
    [-4.3, 4.3].forEach((lx) => {
      const lanternGroup = new THREE.Group();
      lanternGroup.position.set(lx, 0, -1.2);

      const lBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.35, 6),
        stoneMat
      );
      lBase.position.y = 0.175;
      lanternGroup.add(lBase);

      const lPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 1.1, 8),
        stoneMat
      );
      lPost.position.y = 0.9;
      lanternGroup.add(lPost);

      const lFireBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.42, 0.46),
         new THREE.MeshStandardMaterial({
          color: 0xffd166,
          emissive: 0xff9f1c,
          emissiveIntensity: 0.75,
          roughness: 0.3,
        })
      );
      lFireBox.position.y = 1.65;
      lanternGroup.add(lFireBox);

      const lRoof = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 0.38, 6),
        darkRoofMat
      );
      lRoof.position.y = 2.02;
      lanternGroup.add(lRoof);

      shrineGroup.add(lanternGroup);
    });

    // Pine / Sakura Trees in background perimeter (natural outdoor horizon)
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.85,
    });
    const sakuraFoliageMat = new THREE.MeshStandardMaterial({
      color: 0xffb3c6,
      roughness: 0.65,
    });
    const pineFoliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.75,
    });

    const treeCoords = [
      [-6.8, -3.5, true],
      [6.8, -3.5, true],
      [-8.2, 0.8, false],
      [8.2, 0.8, false],
      [-6.2, -7.2, false],
      [6.2, -7.2, false],
    ] as const;

    treeCoords.forEach(([tx, tz, isSakura]) => {
      const tGroup = new THREE.Group();
      tGroup.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.34, 2.4, 10),
        trunkMat
      );
      trunk.position.y = 1.2;
      tGroup.add(trunk);

      const fMat = isSakura ? sakuraFoliageMat : pineFoliageMat;
      [
        [0, 3.0, 0, 1.35],
        [-0.7, 2.5, 0.4, 0.95],
        [0.7, 2.6, -0.3, 1.0],
      ].forEach(([fx, fy, fz, fr]) => {
        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(fr, 14, 12),
          fMat
        );
        crown.position.set(fx, fy, fz);
        tGroup.add(crown);
      });
      scene.add(tGroup);
    });

    scene.add(shrineGroup);

    // 6. Pinwheels (風車) on both sides of the courtyard to visualize wind!
    const pinwheelRotors: THREE.Group[] = [];
    const bladeColors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4];
    [-3.1, 3.1].forEach((px) => {
      const pwGroup = new THREE.Group();
      pwGroup.position.set(px, 0, 1.2);

      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8),
        cedarMat
      );
      stick.position.y = 0.75;
      pwGroup.add(stick);

      const rotor = new THREE.Group();
      rotor.position.set(0, 1.48, 0.06);
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.14, 0.02),
          new THREE.MeshStandardMaterial({
            color: bladeColors[b],
            roughness: 0.35,
          })
        );
        blade.position.set(
          Math.cos((b * Math.PI) / 2) * 0.18,
          Math.sin((b * Math.PI) / 2) * 0.18,
          0
        );
        blade.rotation.z = (b * Math.PI) / 2 + 0.3;
        rotor.add(blade);
      }
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        goldTrimMat
      );
      rotor.add(hub);

      pwGroup.add(rotor);
      pinwheelRotors.push(rotor);
      scene.add(pwGroup);
    });

    // 7. Sacred Bell (本坪鈴) Group
    const bellGroup = new THREE.Group();
    const bellSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 20),
      goldTrimMat
    );
    bellGroup.add(bellSphere);

    const bellBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.055, 10, 28),
      goldTrimMat
    );
    bellBand.rotation.x = Math.PI / 2;
    bellGroup.add(bellBand);

    const bellRope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 1.5, 12),
      vermilionMat
    );
    bellRope.position.y = -1.1;
    bellGroup.add(bellRope);
    scene.add(bellGroup);

    // 8. Bonus Golden Ring (開運の輪) Group
    const bonusRingGroup = new THREE.Group();
    const torusRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.08, 14, 36),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xb45309,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.92,
      })
    );
    bonusRingGroup.add(torusRing);
    scene.add(bonusRingGroup);

    // 9. Dynamic Stage Container (Saisen Boxes & Obstacles rebuilt when stage.id changes)
    const stageContentGroup = new THREE.Group();
    scene.add(stageContentGroup);

    let currentBuiltStageId = -1;
    let currentBuiltRunKey = -1;
    let boxGroups: { cfg: SaisenBoxConfig; mesh: THREE.Group }[] = [];
    let obstacleGroups: { cfg: ObstacleConfig; mesh: THREE.Group }[] = [];
    let isDisposed = false;

    function disposeStageGroup(root: THREE.Object3D) {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => {
            if (!m) return;
            if (m.map && m.map !== woodBump) {
              m.map.dispose();
            }
            m.dispose();
          });
        }
      });
    }

    function rebuildStageEntities(stg: StageConfig) {
      while (stageContentGroup.children.length > 0) {
        const child = stageContentGroup.children[0];
        stageContentGroup.remove(child);
        disposeStageGroup(child);
      }
      boxGroups = stg.boxes.map((bCfg) => {
        const g = buildSaisenBoxGroup(bCfg, woodBump, maxAnisotropy);
        stageContentGroup.add(g);
        return { cfg: bCfg, mesh: g };
      });
      obstacleGroups = stg.obstacles.map((oCfg) => {
        const g = buildObstacleGroup(oCfg);
        stageContentGroup.add(g);
        return { cfg: oCfg, mesh: g };
      });
      currentBuiltStageId = stg.id;
    }

    // Refresh calligraphy plaque textures once web fonts finish loading
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (isDisposed) return;
        boxGroups.forEach(({ cfg, mesh }) => {
          const plaque = mesh.getObjectByName('calligraphyPlaque');
          if (
            plaque instanceof THREE.Mesh &&
            plaque.material instanceof THREE.MeshStandardMaterial
          ) {
            const oldTex = plaque.material.map;
            plaque.material.map = createPlaqueTexture(
              cfg.label,
              cfg.isFake,
              maxAnisotropy
            );
            plaque.material.needsUpdate = true;
            oldTex?.dispose();
          }
        });
      });
    }

    // 10. Coin Meshes (Pre-build all 3 coin types and toggle visibility)
    const coinMeshes: Record<CoinTypeId, THREE.Group> = {
      '5yen': buildCoinMesh('5yen'),
      '50yen': buildCoinMesh('50yen'),
      '100yen': buildCoinMesh('100yen'),
    };
    const coinRoot = new THREE.Group();
    coinRoot.add(coinMeshes['5yen']);
    coinRoot.add(coinMeshes['50yen']);
    coinRoot.add(coinMeshes['100yen']);
    scene.add(coinRoot);

    // 11. Parabolic Trajectory Preview Beads (InstancedMesh) + High-Visibility Target Reticle
    const MAX_TRAJ_STEPS = 30;
    const trajBeadMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.95,
    });
    const trajBeadMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.078, 12, 12),
      trajBeadMat,
      MAX_TRAJ_STEPS
    );
    trajBeadMesh.frustumCulled = false;
    scene.add(trajBeadMesh);

    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const landingReticle = new THREE.Group();
    const outerReticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.38, 28),
      reticleMat
    );
    outerReticleRing.rotation.x = -Math.PI / 2;
    landingReticle.add(outerReticleRing);

    const innerReticleDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 20),
      reticleMat
    );
    innerReticleDot.rotation.x = -Math.PI / 2;
    landingReticle.add(innerReticleDot);
    scene.add(landingReticle);

    // 12. Pooled Particle System (80 instances: cherry blossoms + celebration sparkles)
    const PARTICLE_COUNT = 80;
    const particleMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.03),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      PARTICLE_COUNT
    );
    particleMesh.frustumCulled = false;
    particleMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(PARTICLE_COUNT * 3),
      3
    );
    scene.add(particleMesh);

    interface ParticleSlot {
      active: boolean;
      isAmbientPetal: boolean;
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
      scale: number;
      colorHex: number;
    }

    const particles: ParticleSlot[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isAmbient = i < 28;
      particles.push({
        active: isAmbient,
        isAmbientPetal: isAmbient,
        x: (Math.random() - 0.5) * 14,
        y: 0.5 + Math.random() * 6,
        z: -5 + Math.random() * 11,
        vx: 0,
        vy: -0.45 - Math.random() * 0.35,
        vz: 0.15,
        life: Math.random() * 5,
        maxLife: 5,
        scale: isAmbient ? 0.9 : 1.0,
        colorHex: isAmbient ? 0xffccd5 : 0xffd700,
      });
    }

    function spawnBurst(pos: { x: number; y: number; z: number }, hex: number, count = 22) {
      let spawned = 0;
      for (let i = 28; i < PARTICLE_COUNT && spawned < count; i++) {
        const p = particles[i];
        p.active = true;
        p.x = pos.x;
        p.y = pos.y;
        p.z = pos.z;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.8;
        p.vx = Math.cos(angle) * speed;
        p.vy = 2.0 + Math.random() * 4.2;
        p.vz = Math.sin(angle) * speed;
        p.life = 0;
        p.maxLife = 0.65 + Math.random() * 0.35;
        p.scale = 1.3;
        p.colorHex = hex;
        spawned++;
      }
    }

    // 13. Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 14. Pointer / Drag Aiming & Click-to-Throw on Canvas
    let isPointerDown = false;
    let pointerDragged = false;
    let startClientX = 0;
    let startClientY = 0;
    let lastClientX = 0;
    let lastClientY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (propsRef.current.gameState !== 'playing') return;
      if (e.button !== 0) return;
      isPointerDown = true;
      pointerDragged = false;
      startClientX = e.clientX;
      startClientY = e.clientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown || propsRef.current.gameState !== 'playing') return;
      const dx = e.clientX - lastClientX;
      const dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (
        Math.hypot(e.clientX - startClientX, e.clientY - startClientY) > 6
      ) {
        pointerDragged = true;
      }

      if (pointerDragged) {
        propsRef.current.onUpdateAim(dx * 0.14, -dy * 0.14);
      }
    };

    const onPointerUp = () => {
      isPointerDown = false;
      pointerDragged = false;
    };

    const onPointerCancel = () => {
      isPointerDown = false;
      pointerDragged = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onPointerCancel);

    // ResizeObserver for crisp viewport sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // 15. Main Animation Loop with Software-WebGL afterDraw Pacing
    let frameId = 0;
    let stageTimeSec = 0;
    let lastTimestamp = performance.now();
    let bellHitFlash = 0;
    let cameraShake = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

      function renderSceneAtTime(dt: number, skipRender = false) {
      const {
        gameState: gState,
        stage: stg,
        runKey: rKey,
        coinType: cType,
        coinsLeft: cLeft,
        yaw: curYaw,
        pitch: curPitch,
        power: curPower,
        onShotEvent: emitEvent,
        onTelemetryUpdate: emitTelemetry,
      } = propsRef.current;

      if (currentBuiltStageId !== stg.id) {
        rebuildStageEntities(stg);
      }
      if (currentBuiltRunKey !== rKey) {
        currentBuiltRunKey = rKey;
        stageTimeSec = 0;
        bellHitFlash = 0;
        cameraShake = 0;
        for (let i = 28; i < PARTICLE_COUNT; i++) {
          particles[i].active = false;
        }
      }

      const prevStageTimeSec = stageTimeSec;
      if (gState !== 'paused') {
        stageTimeSec += dt;
      }

      const windX = getWindAtTime(stg, stageTimeSec);

      // Spin pinwheels strictly proportional to wind speed (silent when windX === 0)
      pinwheelRotors.forEach((rotor) => {
        rotor.rotation.z -= windX * 3.2 * dt;
      });

      // Update Saisen boxes transforms and keep ground contact shadow on the courtyard floor
      boxGroups.forEach(({ cfg, mesh }) => {
        const pos = getBoxPositionAtTime(cfg, stageTimeSec);
        mesh.position.set(pos.x, pos.y, pos.z);
        const shadowObj = mesh.getObjectByName('groundContactShadow');
        if (shadowObj) {
          shadowObj.position.y = 0.064 - pos.y;
          const heightScale = Math.max(0.55, 1 - pos.y * 0.2);
          shadowObj.scale.setScalar(heightScale);
        }
        if (cfg.isFake && cfg.fakeTell === 'shake') {
          mesh.rotation.z = Math.sin(stageTimeSec * 22 + cfg.phase) * 0.035;
        } else {
          mesh.rotation.z = 0;
        }
      });

      // Update Obstacles transforms
      obstacleGroups.forEach(({ cfg, mesh }) => {
        const pos = getObstaclePositionAtTime(cfg, stageTimeSec);
        mesh.position.set(pos.x, pos.y, pos.z);
        if (cfg.kind === 'daruma') {
          mesh.rotation.z = Math.sin(stageTimeSec * cfg.speed * 2) * 0.18;
        }
      });

      // Update Sacred Bell
      bellGroup.visible = stg.hasSacredBell;
      if (stg.hasSacredBell) {
        const bPos = getBellPositionAtTime(stg, stageTimeSec);
        bellGroup.position.set(bPos.x, bPos.y, bPos.z);
        if (bellHitFlash > 0) {
          bellHitFlash = Math.max(0, bellHitFlash - dt * 3);
          bellGroup.rotation.z =
            Math.sin(stageTimeSec * 38) * 0.22 * bellHitFlash;
        } else {
          bellGroup.rotation.z = 0;
        }
      }

      // Update Bonus Golden Ring
      const rPos = getBonusRingPositionAtTime(stg, stageTimeSec);
      if (rPos && stg.bonusRing) {
        bonusRingGroup.visible = true;
        bonusRingGroup.position.set(rPos.x, rPos.y, rPos.z);
        bonusRingGroup.scale.setScalar(stg.bonusRing.radius);
        bonusRingGroup.rotation.z = stageTimeSec * 0.8;
      } else {
        bonusRingGroup.visible = false;
      }

      // Toggle visible coin mesh type and hide hand coin when out of coins
      const activeCoin = activeCoinRef.current;
      const isFlying = Boolean(activeCoin && activeCoin.active);
      coinRoot.visible = isFlying || cLeft > 0 || gState === 'title';

      const visibleCoinId = isFlying ? activeCoin!.coinType : cType;
      (['5yen', '50yen', '100yen'] as CoinTypeId[]).forEach((id) => {
        coinMeshes[id].visible = id === visibleCoinId;
      });

      // Step Active Thrown Coin or Pose Coin at Hand Origin
      if (activeCoin && activeCoin.active && gState === 'playing') {
        const ev = stepCoinPhysics(activeCoin, stg, prevStageTimeSec, dt);

        coinRoot.position.set(
          activeCoin.pos.x,
          activeCoin.pos.y,
          activeCoin.pos.z
        );
        coinRoot.rotation.set(
          activeCoin.rot.x,
          activeCoin.rot.y,
          activeCoin.rot.z
        );

        if (ev.bellHit) {
          bellHitFlash = 1.0;
          if (ev.hitPosition) spawnBurst(ev.hitPosition, 0xffd700, 18);
          emitEvent({ type: 'bell' });
        }
        if (ev.ringPassed) {
          emitEvent({ type: 'ring' });
        }
        if (ev.woodBounce || ev.obstacleBounce) {
          emitEvent({ type: 'bounce' });
        }

        if (ev.scored) {
          cameraShake = 0.25;
          if (ev.hitPosition) spawnBurst(ev.hitPosition, 0xffe066, 30);
          emitEvent({
            type: 'scored',
            cleanCenter: ev.cleanCenterShot,
            hitBell: activeCoin.hitBell,
            passedRing: activeCoin.passedRing,
            reason: activeCoin.outcomeReason,
          });
          activeCoin.active = false;
        } else if (ev.trapTriggered) {
          cameraShake = 0.4;
          if (ev.hitPosition) spawnBurst(ev.hitPosition, 0xff4d6d, 26);
          emitEvent({
            type: 'trap',
            reason: activeCoin.outcomeReason,
          });
          activeCoin.active = false;
        } else if (ev.missed) {
          emitEvent({
            type: 'missed',
            reason: activeCoin.outcomeReason,
          });
          activeCoin.active = false;
        }
      } else {
        // Ready in player's hand at exact THROW_ORIGIN
        const bobY = Math.sin(stageTimeSec * 3.2) * 0.02;
        coinRoot.position.set(
          THROW_ORIGIN.x,
          THROW_ORIGIN.y + bobY,
          THROW_ORIGIN.z
        );
        coinRoot.rotation.set(
          THREE.MathUtils.degToRad(curPitch - 35),
          THREE.MathUtils.degToRad(-curYaw),
          Math.sin(stageTimeSec * 1.8) * 0.06
        );
      }

      // Update Parabolic Trajectory Arc Preview & Landing Target Status (only while playing)
      const showTrajectory =
        gState === 'playing' && !isFlying && cLeft > 0;
      trajBeadMesh.visible = showTrajectory;
      landingReticle.visible = showTrajectory;

      if (gState === 'playing') {
        const preview = computeTrajectoryPreviewDetailed(
          curYaw,
          curPitch,
          curPower,
          cType,
          stg,
          stageTimeSec,
          MAX_TRAJ_STEPS - 1
        );

        if (emitTelemetry) {
          emitTelemetry({
            windX,
            landingTarget: preview.landingTarget,
            targetBoxLabel: preview.targetBoxLabel,
            willHitBell: preview.willHitBell,
            willPassRing: preview.willPassRing,
          });
        }

        if (showTrajectory) {
          const pts = preview.points;
          for (let i = 0; i < MAX_TRAJ_STEPS; i++) {
            if (i < pts.length) {
              const pt = pts[i];
              const s = (1 - (i / MAX_TRAJ_STEPS) * 0.35) * 1.1;
              _dummy.position.set(pt.x, pt.y, pt.z);
              _dummy.scale.setScalar(s);
              _dummy.updateMatrix();
              trajBeadMesh.setMatrixAt(i, _dummy.matrix);
            } else {
              _dummy.position.set(0, -100, 0);
              _dummy.scale.setScalar(0.001);
              _dummy.updateMatrix();
              trajBeadMesh.setMatrixAt(i, _dummy.matrix);
            }
          }
          trajBeadMesh.instanceMatrix.needsUpdate = true;

          const lastPt = preview.landingPoint;
          landingReticle.position.set(
            lastPt.x,
            Math.max(0.075, lastPt.y),
            lastPt.z
          );
          if (preview.landingTarget === 'real_box') {
            reticleMat.color.setHex(0x10b981);
            trajBeadMat.color.setHex(0x10b981);
          } else if (preview.landingTarget === 'fake_box') {
            reticleMat.color.setHex(0xe11d48);
            trajBeadMat.color.setHex(0xe11d48);
          } else if (preview.landingTarget === 'obstacle') {
            reticleMat.color.setHex(0xea580c);
            trajBeadMat.color.setHex(0xea580c);
          } else {
            reticleMat.color.setHex(0xd97706);
            trajBeadMat.color.setHex(0xd97706);
          }
          landingReticle.scale.setScalar(1 + Math.sin(stageTimeSec * 6) * 0.12);
        }
      }

      // Update Pooled Particles (Cherry Blossoms & Sparkles)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        if (!p.active) {
          _dummy.position.set(0, -100, 0);
          _dummy.scale.setScalar(0.001);
          _dummy.updateMatrix();
          particleMesh.setMatrixAt(i, _dummy.matrix);
          continue;
        }

        if (p.isAmbientPetal) {
          p.x += (windX * 0.85 + Math.sin(stageTimeSec + i) * 0.4) * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < 0.1) {
            p.y = 6.2;
            p.x = (Math.random() - 0.5) * 14;
            p.z = -5 + Math.random() * 11;
          }
          if (p.x > 8) p.x = -8;
          if (p.x < -8) p.x = 8;
        } else {
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          p.vy -= 9.5 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
        }

        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(
          stageTimeSec * 3 + i,
          stageTimeSec * 2 + i,
          stageTimeSec + i
        );
        const fade = p.isAmbientPetal ? 1.0 : 1.0 - p.life / p.maxLife;
        _dummy.scale.setScalar(p.scale * fade);
        _dummy.updateMatrix();
        particleMesh.setMatrixAt(i, _dummy.matrix);
        _color.setHex(p.colorHex);
        particleMesh.setColorAt(i, _color);
      }
      particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) {
        particleMesh.instanceColor.needsUpdate = true;
      }

      // Camera Choreography (with responsive portrait pullback for mobile viewports)
      const portraitPullback =
        camera.aspect < 1 ? (1 - camera.aspect) * 4.2 : 0;

      if (gState === 'title') {
        const orbitAngle = Math.sin(stageTimeSec * 0.35) * 0.38;
        _vec3A.set(
          Math.sin(orbitAngle) * 7.4,
          3.45 + Math.sin(stageTimeSec * 0.5) * 0.2,
          Math.cos(orbitAngle) * 7.5 + portraitPullback
        );
        _vec3B.set(0, 1.5, -2.2);
      } else {
        const shakeOffset =
          cameraShake > 0
            ? (Math.random() - 0.5) * cameraShake * cameraShake * 0.6
            : 0;
        cameraShake = Math.max(0, cameraShake - dt * 2.2);

        const yawShift = (curYaw / 35) * 0.75;
        _vec3A.set(
          yawShift + shakeOffset,
          3.55 + portraitPullback * 0.18 + shakeOffset,
          9.0 + portraitPullback
        );
        _vec3B.set(yawShift * 0.5, 0.15, -1.8);
      }

      const dampAlpha = dt === 0 ? 1 : 1 - Math.exp(-6.5 * dt);
      camera.position.lerp(_vec3A, dampAlpha);
      camera.lookAt(_vec3B);

      if (!skipRender) {
        renderer.render(scene, camera);
      }
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(rawDt, 0.16);

      renderSceneAtTime(dt, false);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Deterministic time-stepping hook for automated browser verification
    (window as unknown as { advanceTime?: (ms: number) => void }).advanceTime =
      (ms: number) => {
        const stepMs = 1000 / 60;
        const steps = Math.max(1, Math.round(ms / stepMs));
        const dt = ms / 1000 / steps;
        for (let i = 0; i < steps; i++) {
          renderSceneAtTime(dt, i < steps - 1);
        }
        lastTimestamp = performance.now();
      };

    // Synchronous initial paint so t=0ms screenshots never show an unrendered canvas
    renderSceneAtTime(0);
    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      delete (window as unknown as { advanceTime?: (ms: number) => void })
        .advanceTime;
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onPointerCancel);
      disposeStageGroup(scene);
      woodBump.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      if (container.contains(domElem)) {
        container.removeChild(domElem);
      }
    };
  }, [activeCoinRef]);

  return (
    <div
      ref={mountRef}
      data-testid="shrine-3d-canvas"
      className="fixed inset-0 w-full h-full overflow-hidden cursor-crosshair"
    />
  );
};
