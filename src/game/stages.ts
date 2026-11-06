export type CoinTypeId = '5yen' | '50yen' | '100yen';

export interface CoinSpec {
  id: CoinTypeId;
  name: string;
  shortLabel: string;
  description: string;
  keyHint: string;
  mass: number;
  windFactor: number;
  restitution: number;
  basePoints: number;
  radius: number;
  hasHole: boolean;
  colorHex: number;
  accentHex: string;
}

export const COIN_TYPES: Record<CoinTypeId, CoinSpec> = {
  '5yen': {
    id: '5yen',
    name: '五円玉（ご縁）',
    shortLabel: '5円玉',
    description: '標準バランス・ご縁の基本硬貨',
    keyHint: '1',
    mass: 1.0,
    windFactor: 1.0,
    restitution: 0.45,
    basePoints: 100,
    radius: 0.24,
    hasHole: true,
    colorHex: 0xd4a638,
    accentHex: '#e5b842',
  },
  '50yen': {
    id: '50yen',
    name: '五十円玉（重厚）',
    shortLabel: '50円玉',
    description: '重くて横風に強い・強風ステージ向き',
    keyHint: '2',
    mass: 1.65,
    windFactor: 0.35,
    restitution: 0.35,
    basePoints: 150,
    radius: 0.23,
    hasHole: true,
    colorHex: 0xcfd6de,
    accentHex: '#94a3b8',
  },
  '100yen': {
    id: '100yen',
    name: '百円玉（高反発）',
    shortLabel: '100円玉',
    description: 'よく弾む・大鈴コンボや跳ね返し狙い',
    keyHint: '3',
    mass: 1.2,
    windFactor: 0.75,
    restitution: 0.72,
    basePoints: 200,
    radius: 0.25,
    hasHole: false,
    colorHex: 0xe2e8f0,
    accentHex: '#cbd5e1',
  },
};

export type BoxMotionPattern =
  | 'static'
  | 'horizontal'
  | 'vertical'
  | 'figure8'
  | 'pendulum'
  | 'zigzag';

export interface SaisenBoxConfig {
  id: string;
  isFake: boolean;
  label: string;
  fakeTell?: 'shake' | 'teeth' | 'darkWood';
  baseX: number;
  baseY: number;
  baseZ: number;
  width: number;
  height: number;
  depth: number;
  motion: BoxMotionPattern;
  amplitudeX: number;
  amplitudeY: number;
  amplitudeZ: number;
  speed: number;
  phase: number;
}

export interface ObstacleConfig {
  id: string;
  kind: 'daruma' | 'komainu' | 'fan_barrier';
  label: string;
  baseX: number;
  baseY: number;
  baseZ: number;
  radius: number;
  height: number;
  amplitudeX: number;
  amplitudeY: number;
  speed: number;
  phase: number;
}

export interface BonusRingConfig {
  enabled: boolean;
  baseX: number;
  baseY: number;
  baseZ: number;
  radius: number;
  amplitudeX: number;
  speed: number;
}

export interface StageConfig {
  id: number;
  chapterTitle: string;
  name: string;
  subtitle: string;
  gimmickSummary: string;
  hintText: string;
  targetHits: number;
  initialCoins: number;
  baseWindX: number;
  windGustAmplitude: number;
  windGustSpeed: number;
  hasSacredBell: boolean;
  bellY: number;
  bellZ: number;
  bellSwingAmplitude: number;
  bellSwingSpeed: number;
  bonusRing?: BonusRingConfig;
  boxes: SaisenBoxConfig[];
  obstacles: ObstacleConfig[];
  recommendedYaw: number;
  recommendedPitch: number;
  recommendedPower: number;
}

export const STAGES: StageConfig[] = [
  {
    id: 1,
    chapterTitle: '第一幕',
    name: '初詣の基本',
    subtitle: 'まっすぐ狙って放物線を描こう',
    gimmickSummary: '静止したお賽銭箱',
    hintText: '角度45°・強さ50%前後でそのまま投げればピタッと入ります！まずは感覚を掴もう。',
    targetHits: 2,
    initialCoins: 6,
    baseWindX: 0,
    windGustAmplitude: 0,
    windGustSpeed: 0,
    hasSacredBell: true,
    bellY: 4.45,
    bellZ: -1.8,
    bellSwingAmplitude: 0,
    bellSwingSpeed: 0,
    boxes: [
      {
        id: 'stage1-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0,
        baseZ: -2.2,
        width: 2.3,
        height: 1.15,
        depth: 1.5,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0,
      },
    ],
    obstacles: [],
    recommendedYaw: 0,
    recommendedPitch: 45,
    recommendedPower: 50,
  },
  {
    id: 2,
    chapterTitle: '第二幕',
    name: '春風のいたずら',
    subtitle: '横風を読んで風上へ投げよう',
    gimmickSummary: '右向きの横風 ＋ 風車',
    hintText: '左から右へ風が吹いています。狙いを少し左（-10°付近）へ向けるか、重い「50円玉」を使おう！',
    targetHits: 2,
    initialCoins: 6,
    baseWindX: 2.6,
    windGustAmplitude: 0.5,
    windGustSpeed: 0.9,
    hasSacredBell: true,
    bellY: 4.45,
    bellZ: -2.0,
    bellSwingAmplitude: 0.4,
    bellSwingSpeed: 1.2,
    boxes: [
      {
        id: 'stage2-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0,
        baseZ: -2.5,
        width: 2.2,
        height: 1.15,
        depth: 1.45,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0,
      },
    ],
    obstacles: [],
    recommendedYaw: -15,
    recommendedPitch: 45,
    recommendedPower: 53,
  },
  {
    id: 3,
    chapterTitle: '第三幕',
    name: '反復横跳び賽銭箱',
    subtitle: '左右にスライドするお賽銭箱を先読み！',
    gimmickSummary: '左右移動するお賽銭箱',
    hintText: 'お賽銭箱がローラーで左右に動きます！真ん中を通過する手前のタイミングで投げよう。',
    targetHits: 2,
    initialCoins: 7,
    baseWindX: 0,
    windGustAmplitude: 0,
    windGustSpeed: 0,
    hasSacredBell: true,
    bellY: 4.45,
    bellZ: -2.2,
    bellSwingAmplitude: 0,
    bellSwingSpeed: 0,
    boxes: [
      {
        id: 'stage3-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0,
        baseZ: -2.5,
        width: 2.2,
        height: 1.15,
        depth: 1.45,
        motion: 'horizontal',
        amplitudeX: 2.5,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 1.35,
        phase: 0,
      },
    ],
    obstacles: [],
    recommendedYaw: 0,
    recommendedPitch: 46,
    recommendedPower: 55,
  },
  {
    id: 4,
    chapterTitle: '第四幕',
    name: '真贋の見極め',
    subtitle: '偽物の罠箱に騙されるな！',
    gimmickSummary: '本物1つ ＋ 偽物トラップ箱2つ',
    hintText: '「没収」「ワナ」と書かれた怪しい箱は偽物！白い札で「奉納」と書かれた右側の本物を狙おう。',
    targetHits: 2,
    initialCoins: 7,
    baseWindX: 0,
    windGustAmplitude: 0,
    windGustSpeed: 0,
    hasSacredBell: true,
    bellY: 4.45,
    bellZ: -2.3,
    bellSwingAmplitude: 0,
    bellSwingSpeed: 0,
    boxes: [
      {
        id: 'stage4-fake-left',
        isFake: true,
        label: '没収',
        fakeTell: 'teeth',
        baseX: -2.5,
        baseY: 0,
        baseZ: -2.4,
        width: 2.0,
        height: 1.15,
        depth: 1.4,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0,
      },
      {
        id: 'stage4-fake-center',
        isFake: true,
        label: 'ワナ',
        fakeTell: 'shake',
        baseX: 0,
        baseY: 0,
        baseZ: -2.1,
        width: 2.0,
        height: 1.15,
        depth: 1.4,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0.7,
      },
      {
        id: 'stage4-real-right',
        isFake: false,
        label: '奉納',
        baseX: 2.5,
        baseY: 0,
        baseZ: -2.5,
        width: 2.2,
        height: 1.15,
        depth: 1.45,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0,
      },
    ],
    obstacles: [],
    recommendedYaw: 17,
    recommendedPitch: 45,
    recommendedPower: 55,
  },
  {
    id: 5,
    chapterTitle: '第五幕',
    name: '転がるだるま防衛線',
    subtitle: '高い放物線で障害物を飛び越えろ！',
    gimmickSummary: '横切るだるま障害物 ＋ 大鈴コンボ',
    hintText: '手前をだるまが往復しています。角度を58°以上に上げて高い山なり軌道で越えるか、上の大鈴に当てて落とそう！',
    targetHits: 3,
    initialCoins: 8,
    baseWindX: -1.1,
    windGustAmplitude: 0.4,
    windGustSpeed: 1.0,
    hasSacredBell: true,
    bellY: 4.45,
    bellZ: -2.4,
    bellSwingAmplitude: 0.8,
    bellSwingSpeed: 1.4,
    boxes: [
      {
        id: 'stage5-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0,
        baseZ: -2.7,
        width: 2.25,
        height: 1.15,
        depth: 1.5,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0,
      },
    ],
    obstacles: [
      {
        id: 'stage5-daruma-1',
        kind: 'daruma',
        label: '必勝だるま',
        baseX: 0,
        baseY: 0,
        baseZ: 0.5,
        radius: 0.65,
        height: 1.35,
        amplitudeX: 2.2,
        amplitudeY: 0,
        speed: 1.8,
        phase: 0,
      },
      {
        id: 'stage5-komainu-2',
        kind: 'komainu',
        label: '守護狛犬',
        baseX: 0,
        baseY: 0,
        baseZ: -0.8,
        radius: 0.58,
        height: 1.25,
        amplitudeX: 2.0,
        amplitudeY: 0,
        speed: 1.4,
        phase: 3.14,
      },
    ],
    recommendedYaw: 11,
    recommendedPitch: 58,
    recommendedPower: 60,
  },
  {
    id: 6,
    chapterTitle: '第六幕',
    name: '幻惑のシャッフル参道',
    subtitle: '動く本物と動く偽物を見極めろ！',
    gimmickSummary: '動く本物 ＋ 動く偽物2つ ＋ そよ風',
    hintText: '本物の「奉納」箱と偽物の「没収」箱が交互に交差します！本物が中央に来た瞬間を狙い撃とう。',
    targetHits: 3,
    initialCoins: 8,
    baseWindX: 1.5,
    windGustAmplitude: 0.8,
    windGustSpeed: 1.1,
    hasSacredBell: true,
    bellY: 4.45,
    bellZ: -2.5,
    bellSwingAmplitude: 1.1,
    bellSwingSpeed: 1.5,
    boxes: [
      {
        id: 'stage6-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0,
        baseZ: -2.6,
        width: 2.15,
        height: 1.15,
        depth: 1.45,
        motion: 'horizontal',
        amplitudeX: 2.8,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 1.3,
        phase: 0,
      },
      {
        id: 'stage6-fake-1',
        isFake: true,
        label: '没収',
        fakeTell: 'teeth',
        baseX: 0,
        baseY: 0,
        baseZ: -1.4,
        width: 1.85,
        height: 1.1,
        depth: 1.3,
        motion: 'horizontal',
        amplitudeX: 2.6,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 1.3,
        phase: 1.57,
      },
      {
        id: 'stage6-fake-2',
        isFake: true,
        label: 'ハズレ',
        fakeTell: 'darkWood',
        baseX: -2.8,
        baseY: 0,
        baseZ: -2.6,
        width: 1.85,
        height: 1.1,
        depth: 1.3,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 1.5,
      },
    ],
    obstacles: [],
    recommendedYaw: -9,
    recommendedPitch: 47,
    recommendedPower: 56,
  },
  {
    id: 7,
    chapterTitle: '第七幕',
    name: '昇龍・空中浮遊賽銭箱',
    subtitle: '開運の輪をくぐらせて雲上の箱へ！',
    gimmickSummary: '上下左右に浮遊する箱 ＋ 開運の輪ボーナス',
    hintText: '金色の「開運の輪」を通してお賽銭箱に入れると徳ポイント2倍！上下の動きに合わせて投げよう。',
    targetHits: 3,
    initialCoins: 9,
    baseWindX: -1.8,
    windGustAmplitude: 1.2,
    windGustSpeed: 1.3,
    hasSacredBell: true,
    bellY: 4.5,
    bellZ: -2.8,
    bellSwingAmplitude: 1.2,
    bellSwingSpeed: 1.6,
    bonusRing: {
      enabled: true,
      baseX: 0,
      baseY: 3.65,
      baseZ: -0.6,
      radius: 1.15,
      amplitudeX: 1.2,
      speed: 1.1,
    },
    boxes: [
      {
        id: 'stage7-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0.85,
        baseZ: -2.8,
        width: 2.15,
        height: 1.15,
        depth: 1.45,
        motion: 'figure8',
        amplitudeX: 2.2,
        amplitudeY: 0.65,
        amplitudeZ: 0.4,
        speed: 1.2,
        phase: 0,
      },
      {
        id: 'stage7-fake',
        isFake: true,
        label: 'ワナ',
        fakeTell: 'shake',
        baseX: 2.6,
        baseY: 0,
        baseZ: -2.0,
        width: 1.9,
        height: 1.1,
        depth: 1.3,
        motion: 'static',
        amplitudeX: 0,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 0,
        phase: 0,
      },
    ],
    obstacles: [],
    recommendedYaw: 11,
    recommendedPitch: 52,
    recommendedPower: 60,
  },
  {
    id: 8,
    chapterTitle: '最終幕',
    name: '神々の試練・大晦日ラッシュ',
    subtitle: '全ギミック総登場！神業参拝を見せつけろ',
    gimmickSummary: '強風変化 ＋ 8の字移動 ＋ 偽物トラップ ＋ 守護だるま ＋ 開運の輪',
    hintText: '風向きと偽物箱、だるまの動きを見極めて「奉納」箱へ4枚納めれば伝説の【超大吉】達成！',
    targetHits: 4,
    initialCoins: 10,
    baseWindX: 2.2,
    windGustAmplitude: 2.4,
    windGustSpeed: 1.5,
    hasSacredBell: true,
    bellY: 4.3,
    bellZ: -2.7,
    bellSwingAmplitude: 1.5,
    bellSwingSpeed: 1.8,
    bonusRing: {
      enabled: true,
      baseX: 0,
      baseY: 3.65,
      baseZ: -0.6,
      radius: 1.1,
      amplitudeX: 1.6,
      speed: 1.35,
    },
    boxes: [
      {
        id: 'stage8-real',
        isFake: false,
        label: '奉納',
        baseX: 0,
        baseY: 0.4,
        baseZ: -2.8,
        width: 2.1,
        height: 1.15,
        depth: 1.45,
        motion: 'figure8',
        amplitudeX: 2.6,
        amplitudeY: 0.45,
        amplitudeZ: 0.5,
        speed: 1.45,
        phase: 0,
      },
      {
        id: 'stage8-fake-1',
        isFake: true,
        label: '没収',
        fakeTell: 'teeth',
        baseX: -2.4,
        baseY: 0,
        baseZ: -1.8,
        width: 1.85,
        height: 1.1,
        depth: 1.3,
        motion: 'horizontal',
        amplitudeX: 1.8,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 1.6,
        phase: 2.1,
      },
      {
        id: 'stage8-fake-2',
        isFake: true,
        label: 'ワナ',
        fakeTell: 'darkWood',
        baseX: 2.4,
        baseY: 0,
        baseZ: -1.8,
        width: 1.85,
        height: 1.1,
        depth: 1.3,
        motion: 'horizontal',
        amplitudeX: 1.8,
        amplitudeY: 0,
        amplitudeZ: 0,
        speed: 1.6,
        phase: 5.2,
      },
    ],
    obstacles: [
      {
        id: 'stage8-daruma',
        kind: 'daruma',
        label: '大晦日だるま',
        baseX: 0,
        baseY: 0,
        baseZ: -0.3,
        radius: 0.6,
        height: 1.3,
        amplitudeX: 2.5,
        amplitudeY: 0,
        speed: 2.0,
        phase: 1.0,
      },
    ],
    recommendedYaw: -13,
    recommendedPitch: 52,
    recommendedPower: 59,
  },
];
