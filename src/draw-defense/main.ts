import './style.css';

type Point = { x: number; y: number };
type UnitType = 'mage' | 'archer' | 'warrior';
type EnemyKind = 'grunt' | 'runner' | 'tank' | 'boss';

type Unit = {
  type: UnitType;
  spotIndex: number;
  level: number;
  cooldown: number;
};

type Enemy = {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  distance: number;
  slowUntil: number;
  dead: boolean;
};

type SpawnItem = { at: number; kind: EnemyKind };

type Effect = {
  kind: 'line' | 'blast' | 'slash';
  from: Point;
  to: Point;
  radius: number;
  life: number;
  maxLife: number;
};

const app = document.querySelector<HTMLDivElement>('#draw-defense-app');
if (!app) throw new Error('Missing #draw-defense-app');

app.innerHTML = `
  <main class="dd-shell">
    <header class="dd-topbar">
      <div class="dd-title-wrap">
        <h1>画个守卫</h1>
        <p>Draw Defense · V0.1 Prototype</p>
      </div>
      <a class="dd-back" href="./">← 找猫</a>
    </header>

    <section class="dd-stats">
      <div class="dd-stat"><span>Wave</span><strong id="waveStat">0 / 5</strong></div>
      <div class="dd-stat"><span>Castle</span><strong id="lifeStat">❤️ 10</strong></div>
      <div class="dd-stat"><span>Gold</span><strong id="goldStat">💰 240</strong></div>
    </section>

    <section class="dd-battle-card">
      <canvas id="battlefield" width="390" height="500" aria-label="塔防战场"></canvas>
      <div class="dd-toast" id="toast"></div>
    </section>

    <section class="dd-controls">
      <div class="dd-wave-row">
        <div class="dd-status" id="statusText">先画一个形状召唤守卫，也可以直接开始第一波。</div>
        <button class="dd-btn dd-btn-primary" id="waveButton">开始 Wave 1</button>
      </div>

      <section class="dd-draw-card">
        <div class="dd-draw-head">
          <div>
            <strong>手画召唤</strong>
            <p>闭合画完后自动识别，再点战场上的空建造点。</p>
          </div>
          <div class="dd-recognition" id="recognitionText">等待绘制</div>
        </div>

        <div class="dd-pad-wrap">
          <canvas id="drawPad" width="460" height="150" aria-label="手画识别区域"></canvas>
          <div class="dd-pad-hint" id="padHint"><span>○</span><span>△</span><span>□</span></div>
        </div>

        <div class="dd-legend">
          <div class="dd-class"><strong>○ 法师 · 110</strong><span>慢速范围群伤</span></div>
          <div class="dd-class"><strong>△ 弓箭手 · 90</strong><span>高速远程单体</span></div>
          <div class="dd-class"><strong>□ 战士 · 70</strong><span>近战重击减速</span></div>
        </div>

        <div class="dd-actions">
          <button class="dd-btn" id="clearDraw">清除绘制</button>
          <button class="dd-btn dd-btn-danger" id="cancelSummon">取消召唤</button>
        </div>

        <section class="dd-unit-panel" id="unitPanel"></section>
      </section>
    </section>

    <p class="dd-help">玩法原型：画 ○ / △ / □ → 选位置 → 自动战斗 → 点击已放单位升级。第 5 波有 Boss。</p>
  </main>
`;

function mustCanvas(id: string): HTMLCanvasElement {
  const node = document.querySelector<HTMLCanvasElement>(`#${id}`);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

function mustElement<T extends HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`#${id}`);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

const battleCanvas = mustCanvas('battlefield');
const battleCtx = battleCanvas.getContext('2d');
if (!battleCtx) throw new Error('2D canvas unavailable');

const drawCanvas = mustCanvas('drawPad');
const drawCtx = drawCanvas.getContext('2d');
if (!drawCtx) throw new Error('2D canvas unavailable');

const waveStat = mustElement<HTMLElement>('waveStat');
const lifeStat = mustElement<HTMLElement>('lifeStat');
const goldStat = mustElement<HTMLElement>('goldStat');
const statusText = mustElement<HTMLElement>('statusText');
const waveButton = mustElement<HTMLButtonElement>('waveButton');
const recognitionText = mustElement<HTMLElement>('recognitionText');
const unitPanel = mustElement<HTMLElement>('unitPanel');
const padHint = mustElement<HTMLElement>('padHint');
const toast = mustElement<HTMLElement>('toast');

const WIDTH = battleCanvas.width;
const HEIGHT = battleCanvas.height;
const TOTAL_WAVES = 5;

const PATH: Point[] = [
  { x: -24, y: 82 },
  { x: 132, y: 82 },
  { x: 132, y: 198 },
  { x: 300, y: 198 },
  { x: 300, y: 346 },
  { x: 414, y: 346 }
];

const BUILD_SPOTS: Point[] = [
  { x: 72, y: 142 },
  { x: 72, y: 37 },
  { x: 185, y: 134 },
  { x: 188, y: 250 },
  { x: 250, y: 144 },
  { x: 350, y: 145 },
  { x: 248, y: 302 },
  { x: 344, y: 286 },
  { x: 242, y: 405 }
];

const UNIT_META: Record<UnitType, { name: string; symbol: string; cost: number }> = {
  mage: { name: '法师', symbol: '○', cost: 110 },
  archer: { name: '弓箭手', symbol: '△', cost: 90 },
  warrior: { name: '战士', symbol: '□', cost: 70 }
};

const pathSegments = PATH.slice(0, -1).map((point, index) => {
  const next = PATH[index + 1];
  const length = Math.hypot(next.x - point.x, next.y - point.y);
  return { from: point, to: next, length };
});
const pathLength = pathSegments.reduce((sum, segment) => sum + segment.length, 0);

let gold = 240;
let castleLife = 10;
let currentWave = 0;
let waveRunning = false;
let gameOver = false;
let gameTime = 0;
let waveTime = 0;
let spawnPlan: SpawnItem[] = [];
let spawnIndex = 0;
let enemyId = 1;
let selectedSummon: UnitType | null = null;
let selectedUnitSpot: number | null = null;
let units: Unit[] = [];
let enemies: Enemy[] = [];
let effects: Effect[] = [];
let toastTimer: number | null = null;

function wavePlan(wave: number): SpawnItem[] {
  const plan: SpawnItem[] = [];
  const add = (count: number, kind: EnemyKind, interval: number, start: number): number => {
    for (let i = 0; i < count; i += 1) plan.push({ at: start + i * interval, kind });
    return start + count * interval;
  };

  if (wave === 1) add(8, 'grunt', 0.78, 0);
  if (wave === 2) {
    let t = add(7, 'grunt', 0.7, 0);
    add(5, 'runner', 0.55, t + 0.4);
  }
  if (wave === 3) {
    let t = add(6, 'grunt', 0.62, 0);
    t = add(4, 'tank', 1.05, t + 0.3);
    add(5, 'grunt', 0.55, t + 0.2);
  }
  if (wave === 4) {
    let t = add(7, 'runner', 0.46, 0);
    t = add(6, 'grunt', 0.52, t + 0.2);
    add(4, 'tank', 0.92, t + 0.2);
  }
  if (wave === 5) {
    let t = add(6, 'grunt', 0.52, 0);
    t = add(5, 'runner', 0.45, t + 0.2);
    t = add(3, 'tank', 0.85, t + 0.25);
    plan.push({ at: t + 0.8, kind: 'boss' });
  }

  return plan.sort((a, b) => a.at - b.at);
}

function enemyStats(kind: EnemyKind): Omit<Enemy, 'id' | 'distance' | 'slowUntil' | 'dead'> {
  const waveScale = 1 + Math.max(0, currentWave - 1) * 0.12;
  if (kind === 'runner') return { kind, hp: 34 * waveScale, maxHp: 34 * waveScale, speed: 71, reward: 13 };
  if (kind === 'tank') return { kind, hp: 126 * waveScale, maxHp: 126 * waveScale, speed: 29, reward: 28 };
  if (kind === 'boss') return { kind, hp: 520, maxHp: 520, speed: 23, reward: 140 };
  return { kind, hp: 58 * waveScale, maxHp: 58 * waveScale, speed: 43, reward: 16 };
}

function spawnEnemy(kind: EnemyKind): void {
  const base = enemyStats(kind);
  enemies.push({
    id: enemyId++,
    ...base,
    distance: 0,
    slowUntil: 0,
    dead: false
  });
}

function startWave(): void {
  if (gameOver || waveRunning || currentWave >= TOTAL_WAVES) return;
  currentWave += 1;
  waveRunning = true;
  waveTime = 0;
  spawnIndex = 0;
  spawnPlan = wavePlan(currentWave);
  selectedUnitSpot = null;
  renderUnitPanel();
  setStatus(currentWave === TOTAL_WAVES ? 'Boss 波开始。最后一波守住就赢！' : `Wave ${currentWave} 开始，注意敌人路线。`);
  updateUi();
}

function finishWave(): void {
  waveRunning = false;
  if (currentWave >= TOTAL_WAVES) {
    showEnd(true);
    return;
  }
  const bonus = 35 + currentWave * 10;
  gold += bonus;
  showToast(`Wave ${currentWave} 守住了！奖励 ${bonus} 金币`, 'good');
  setStatus(`波次完成。现在可以补守卫或升级，再开始 Wave ${currentWave + 1}。`);
  updateUi();
}

function update(dt: number): void {
  if (gameOver) return;
  gameTime += dt;

  if (waveRunning) {
    waveTime += dt;
    while (spawnIndex < spawnPlan.length && spawnPlan[spawnIndex].at <= waveTime) {
      spawnEnemy(spawnPlan[spawnIndex].kind);
      spawnIndex += 1;
    }
  }

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const speedFactor = enemy.slowUntil > gameTime ? 0.48 : 1;
    enemy.distance += enemy.speed * speedFactor * dt;
    if (enemy.distance >= pathLength) {
      enemy.dead = true;
      const damage = enemy.kind === 'boss' ? 4 : 1;
      castleLife = Math.max(0, castleLife - damage);
      showToast(`城堡受到 ${damage} 点伤害`, 'bad');
      if (castleLife <= 0) showEnd(false);
    }
  }

  for (const unit of units) {
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (unit.cooldown <= 0) attackWithUnit(unit);
  }

  effects = effects
    .map((effect) => ({ ...effect, life: effect.life - dt }))
    .filter((effect) => effect.life > 0);
  enemies = enemies.filter((enemy) => !enemy.dead);

  if (waveRunning && spawnIndex >= spawnPlan.length && enemies.length === 0 && !gameOver) finishWave();
  updateUi();
}

function unitStats(unit: Unit): { damage: number; range: number; rate: number; splash: number } {
  const levelScale = 1 + (unit.level - 1) * 0.52;
  if (unit.type === 'archer') return { damage: 10 * levelScale, range: 122 + unit.level * 7, rate: 0.42 - unit.level * 0.035, splash: 0 };
  if (unit.type === 'mage') return { damage: 20 * levelScale, range: 105 + unit.level * 5, rate: 1.18 - unit.level * 0.08, splash: 34 + unit.level * 8 };
  return { damage: 24 * levelScale, range: 58 + unit.level * 3, rate: 0.82 - unit.level * 0.06, splash: 0 };
}

function attackWithUnit(unit: Unit): void {
  const spot = BUILD_SPOTS[unit.spotIndex];
  const stats = unitStats(unit);
  const candidates = enemies
    .filter((enemy) => !enemy.dead && distance(spot, pointAtDistance(enemy.distance)) <= stats.range)
    .sort((a, b) => b.distance - a.distance);
  const target = candidates[0];
  if (!target) return;

  const targetPoint = pointAtDistance(target.distance);
  unit.cooldown = stats.rate;

  if (unit.type === 'mage') {
    for (const enemy of enemies) {
      if (!enemy.dead && distance(targetPoint, pointAtDistance(enemy.distance)) <= stats.splash) damageEnemy(enemy, stats.damage);
    }
    effects.push({ kind: 'blast', from: spot, to: targetPoint, radius: stats.splash, life: 0.28, maxLife: 0.28 });
    return;
  }

  if (unit.type === 'warrior') {
    damageEnemy(target, stats.damage);
    target.slowUntil = Math.max(target.slowUntil, gameTime + 0.9);
    effects.push({ kind: 'slash', from: spot, to: targetPoint, radius: 20, life: 0.18, maxLife: 0.18 });
    return;
  }

  damageEnemy(target, stats.damage);
  effects.push({ kind: 'line', from: spot, to: targetPoint, radius: 0, life: 0.13, maxLife: 0.13 });
}

function damageEnemy(enemy: Enemy, amount: number): void {
  if (enemy.dead) return;
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    enemy.dead = true;
    gold += enemy.reward;
  }
}

function pointAtDistance(targetDistance: number): Point {
  let remaining = Math.max(0, targetDistance);
  for (const segment of pathSegments) {
    if (remaining <= segment.length) {
      const t = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t
      };
    }
    remaining -= segment.length;
  }
  return PATH[PATH.length - 1];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawBattlefield(): void {
  battleCtx.clearRect(0, 0, WIDTH, HEIGHT);
  battleCtx.fillStyle = '#2a3734';
  battleCtx.fillRect(0, 0, WIDTH, HEIGHT);

  battleCtx.strokeStyle = 'rgba(255,255,255,.035)';
  battleCtx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 30) {
    battleCtx.beginPath(); battleCtx.moveTo(x, 0); battleCtx.lineTo(x, HEIGHT); battleCtx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 30) {
    battleCtx.beginPath(); battleCtx.moveTo(0, y); battleCtx.lineTo(WIDTH, y); battleCtx.stroke();
  }

  battleCtx.lineCap = 'round';
  battleCtx.lineJoin = 'round';
  battleCtx.beginPath();
  battleCtx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i += 1) battleCtx.lineTo(PATH[i].x, PATH[i].y);
  battleCtx.strokeStyle = '#6d573f';
  battleCtx.lineWidth = 42;
  battleCtx.stroke();
  battleCtx.strokeStyle = '#b99a6a';
  battleCtx.lineWidth = 30;
  battleCtx.stroke();

  drawCastle();

  for (let i = 0; i < BUILD_SPOTS.length; i += 1) {
    const spot = BUILD_SPOTS[i];
    const unit = units.find((candidate) => candidate.spotIndex === i);
    if (unit) drawUnit(unit, spot, selectedUnitSpot === i);
    else drawBuildSpot(spot, selectedSummon !== null);
  }

  for (const enemy of enemies) drawEnemy(enemy);
  for (const effect of effects) drawEffect(effect);
}

function drawCastle(): void {
  battleCtx.save();
  battleCtx.translate(365, 346);
  battleCtx.fillStyle = '#d5d9e2';
  battleCtx.fillRect(-18, -24, 36, 44);
  battleCtx.fillStyle = '#8991a4';
  battleCtx.fillRect(-23, -31, 10, 16);
  battleCtx.fillRect(-5, -31, 10, 16);
  battleCtx.fillRect(13, -31, 10, 16);
  battleCtx.fillStyle = '#4b5264';
  battleCtx.fillRect(-6, 3, 12, 17);
  battleCtx.restore();
}

function drawBuildSpot(spot: Point, active: boolean): void {
  battleCtx.beginPath();
  battleCtx.arc(spot.x, spot.y, 22, 0, Math.PI * 2);
  battleCtx.fillStyle = active ? 'rgba(240,157,72,.19)' : 'rgba(14,18,21,.28)';
  battleCtx.fill();
  battleCtx.strokeStyle = active ? '#ef9d48' : '#61706c';
  battleCtx.lineWidth = active ? 2.5 : 1.5;
  battleCtx.stroke();
  battleCtx.fillStyle = active ? '#efb26f' : '#71817d';
  battleCtx.font = '700 16px system-ui';
  battleCtx.textAlign = 'center';
  battleCtx.textBaseline = 'middle';
  battleCtx.fillText('+', spot.x, spot.y - 1);
}

function drawUnit(unit: Unit, spot: Point, selected: boolean): void {
  battleCtx.save();
  battleCtx.translate(spot.x, spot.y);
  if (selected) {
    battleCtx.beginPath(); battleCtx.arc(0, 0, 25, 0, Math.PI * 2);
    battleCtx.strokeStyle = '#f6c579'; battleCtx.lineWidth = 2; battleCtx.stroke();
  }

  battleCtx.strokeStyle = '#f0eadb';
  battleCtx.fillStyle = '#f0eadb';
  battleCtx.lineWidth = 2.4;
  battleCtx.lineCap = 'round';

  if (unit.type === 'mage') {
    battleCtx.beginPath(); battleCtx.arc(0, -10, 7, 0, Math.PI * 2); battleCtx.stroke();
    battleCtx.beginPath(); battleCtx.moveTo(0, -3); battleCtx.lineTo(0, 13); battleCtx.moveTo(0, 2); battleCtx.lineTo(-8, 7); battleCtx.moveTo(0, 2); battleCtx.lineTo(8, 6); battleCtx.moveTo(0, 13); battleCtx.lineTo(-6, 21); battleCtx.moveTo(0, 13); battleCtx.lineTo(6, 21); battleCtx.stroke();
    battleCtx.strokeStyle = '#cf7bff'; battleCtx.beginPath(); battleCtx.moveTo(10, -4); battleCtx.lineTo(10, 18); battleCtx.stroke();
    battleCtx.beginPath(); battleCtx.arc(10, -7, 3, 0, Math.PI * 2); battleCtx.fillStyle = '#cf7bff'; battleCtx.fill();
  } else if (unit.type === 'archer') {
    battleCtx.beginPath(); battleCtx.moveTo(0, -18); battleCtx.lineTo(-8, -5); battleCtx.lineTo(8, -5); battleCtx.closePath(); battleCtx.stroke();
    battleCtx.beginPath(); battleCtx.moveTo(0, -5); battleCtx.lineTo(0, 14); battleCtx.moveTo(0, 1); battleCtx.lineTo(-7, 6); battleCtx.moveTo(0, 1); battleCtx.lineTo(8, 4); battleCtx.moveTo(0, 14); battleCtx.lineTo(-6, 21); battleCtx.moveTo(0, 14); battleCtx.lineTo(6, 21); battleCtx.stroke();
    battleCtx.strokeStyle = '#f1c75b'; battleCtx.beginPath(); battleCtx.arc(10, 6, 7, -Math.PI / 2, Math.PI / 2); battleCtx.stroke();
  } else {
    battleCtx.strokeRect(-7, -17, 14, 14);
    battleCtx.beginPath(); battleCtx.moveTo(0, -3); battleCtx.lineTo(0, 14); battleCtx.moveTo(0, 2); battleCtx.lineTo(-8, 8); battleCtx.moveTo(0, 2); battleCtx.lineTo(8, 7); battleCtx.moveTo(0, 14); battleCtx.lineTo(-6, 21); battleCtx.moveTo(0, 14); battleCtx.lineTo(6, 21); battleCtx.stroke();
    battleCtx.strokeStyle = '#8fc9ff'; battleCtx.beginPath(); battleCtx.moveTo(-10, 1); battleCtx.lineTo(-10, 15); battleCtx.stroke();
    battleCtx.strokeStyle = '#e5e7eb'; battleCtx.beginPath(); battleCtx.moveTo(9, 1); battleCtx.lineTo(15, -8); battleCtx.stroke();
  }

  battleCtx.fillStyle = '#0e1118';
  battleCtx.beginPath(); battleCtx.arc(15, -17, 8, 0, Math.PI * 2); battleCtx.fill();
  battleCtx.fillStyle = '#f4b969';
  battleCtx.font = '700 9px system-ui'; battleCtx.textAlign = 'center'; battleCtx.textBaseline = 'middle';
  battleCtx.fillText(String(unit.level), 15, -17);
  battleCtx.restore();
}

function drawEnemy(enemy: Enemy): void {
  const point = pointAtDistance(enemy.distance);
  battleCtx.save();
  battleCtx.translate(point.x, point.y);
  const radius = enemy.kind === 'boss' ? 16 : enemy.kind === 'tank' ? 12 : 9;
  battleCtx.beginPath(); battleCtx.arc(0, 0, radius, 0, Math.PI * 2);
  battleCtx.fillStyle = enemy.kind === 'runner' ? '#e5c34f' : enemy.kind === 'tank' ? '#956f58' : enemy.kind === 'boss' ? '#8e4b9e' : '#c76558';
  battleCtx.fill();
  battleCtx.strokeStyle = enemy.slowUntil > gameTime ? '#8fc9ff' : '#442f2a';
  battleCtx.lineWidth = 2; battleCtx.stroke();
  battleCtx.fillStyle = '#20242d';
  battleCtx.font = enemy.kind === 'boss' ? '700 12px system-ui' : '700 9px system-ui';
  battleCtx.textAlign = 'center'; battleCtx.textBaseline = 'middle';
  battleCtx.fillText(enemy.kind === 'boss' ? 'B' : enemy.kind === 'runner' ? 'R' : enemy.kind === 'tank' ? 'T' : '•', 0, 0);

  const barWidth = enemy.kind === 'boss' ? 40 : 26;
  battleCtx.fillStyle = 'rgba(15,17,24,.75)'; battleCtx.fillRect(-barWidth / 2, -radius - 9, barWidth, 4);
  battleCtx.fillStyle = '#72d58c'; battleCtx.fillRect(-barWidth / 2, -radius - 9, barWidth * Math.max(0, enemy.hp / enemy.maxHp), 4);
  battleCtx.restore();
}

function drawEffect(effect: Effect): void {
  const alpha = Math.max(0, effect.life / effect.maxLife);
  battleCtx.save();
  battleCtx.globalAlpha = alpha;
  if (effect.kind === 'line') {
    battleCtx.strokeStyle = '#f4d870'; battleCtx.lineWidth = 2;
    battleCtx.beginPath(); battleCtx.moveTo(effect.from.x, effect.from.y); battleCtx.lineTo(effect.to.x, effect.to.y); battleCtx.stroke();
  } else if (effect.kind === 'blast') {
    battleCtx.strokeStyle = '#cf7bff'; battleCtx.lineWidth = 4;
    battleCtx.beginPath(); battleCtx.arc(effect.to.x, effect.to.y, effect.radius * (1.15 - alpha * .15), 0, Math.PI * 2); battleCtx.stroke();
  } else {
    battleCtx.strokeStyle = '#d9efff'; battleCtx.lineWidth = 4;
    battleCtx.beginPath(); battleCtx.arc(effect.to.x, effect.to.y, effect.radius, -.8, .8); battleCtx.stroke();
  }
  battleCtx.restore();
}

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

battleCanvas.addEventListener('pointerdown', (event) => {
  if (gameOver) return;
  const point = canvasPoint(battleCanvas, event);
  let nearest = -1;
  let nearestDistance = Infinity;
  BUILD_SPOTS.forEach((spot, index) => {
    const d = distance(point, spot);
    if (d < nearestDistance) { nearest = index; nearestDistance = d; }
  });
  if (nearest < 0 || nearestDistance > 30) return;

  const existing = units.find((unit) => unit.spotIndex === nearest);
  if (existing) {
    selectedUnitSpot = nearest;
    selectedSummon = null;
    setRecognition('已选守卫', `${UNIT_META[existing.type].symbol} ${UNIT_META[existing.type].name} Lv.${existing.level}`);
    renderUnitPanel();
    return;
  }

  if (!selectedSummon) {
    showToast('先在下方画 ○、△ 或 □', 'bad');
    return;
  }

  const meta = UNIT_META[selectedSummon];
  if (gold < meta.cost) {
    showToast(`金币不足，需要 ${meta.cost}`, 'bad');
    return;
  }

  gold -= meta.cost;
  units.push({ type: selectedSummon, spotIndex: nearest, level: 1, cooldown: 0 });
  showToast(`${meta.name} 已部署`, 'good');
  selectedSummon = null;
  selectedUnitSpot = nearest;
  clearDrawPad();
  setRecognition('部署成功', '点击守卫可以升级');
  renderUnitPanel();
  updateUi();
});

function upgradeCost(unit: Unit): number {
  return Math.round(UNIT_META[unit.type].cost * (0.75 + unit.level * 0.65));
}

function renderUnitPanel(): void {
  const unit = selectedUnitSpot === null ? undefined : units.find((candidate) => candidate.spotIndex === selectedUnitSpot);
  if (!unit) {
    unitPanel.classList.remove('is-show');
    unitPanel.innerHTML = '';
    return;
  }
  const stats = unitStats(unit);
  const cost = upgradeCost(unit);
  const maxed = unit.level >= 3;
  unitPanel.classList.add('is-show');
  unitPanel.innerHTML = `
    <div class="dd-unit-row">
      <div class="dd-unit-copy">
        <strong>${UNIT_META[unit.type].symbol} ${UNIT_META[unit.type].name} · Lv.${unit.level}</strong>
        <span>攻击 ${Math.round(stats.damage)} · 射程 ${Math.round(stats.range)} · ${unit.type === 'mage' ? `范围 ${Math.round(stats.splash)}` : unit.type === 'warrior' ? '命中减速' : '高速单体'}</span>
      </div>
      <button class="dd-btn" id="upgradeUnit" ${maxed || gold < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `升级 ${cost}`}</button>
    </div>
  `;
  unitPanel.querySelector<HTMLButtonElement>('#upgradeUnit')?.addEventListener('click', () => {
    if (unit.level >= 3) return;
    const nextCost = upgradeCost(unit);
    if (gold < nextCost) return;
    gold -= nextCost;
    unit.level += 1;
    showToast(`${UNIT_META[unit.type].name} 升到 Lv.${unit.level}`, 'good');
    renderUnitPanel();
    updateUi();
  });
}

let drawing = false;
let strokePoints: Point[] = [];

drawCanvas.addEventListener('pointerdown', (event) => {
  if (gameOver) return;
  drawing = true;
  strokePoints = [canvasPoint(drawCanvas, event)];
  drawCanvas.setPointerCapture(event.pointerId);
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  padHint.classList.add('is-hidden');
  drawCtx.strokeStyle = '#f4b969';
  drawCtx.lineWidth = 5;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.beginPath();
  drawCtx.moveTo(strokePoints[0].x, strokePoints[0].y);
});

drawCanvas.addEventListener('pointermove', (event) => {
  if (!drawing) return;
  const point = canvasPoint(drawCanvas, event);
  strokePoints.push(point);
  drawCtx.lineTo(point.x, point.y);
  drawCtx.stroke();
});

function finishDrawing(): void {
  if (!drawing) return;
  drawing = false;
  const recognized = recognizeShape(strokePoints);
  if (!recognized) {
    selectedSummon = null;
    setRecognition('没认出来', '尽量一笔闭合画 ○ △ □');
    showToast('形状要闭合一些，再画一次', 'bad');
    return;
  }
  selectedSummon = recognized;
  selectedUnitSpot = null;
  renderUnitPanel();
  const meta = UNIT_META[recognized];
  setRecognition(`${meta.symbol} ${meta.name}`, `花费 ${meta.cost} · 请选择空位`);
  setStatus(`识别为${meta.name}。现在点战场上发亮的空建造点。`);
}

drawCanvas.addEventListener('pointerup', finishDrawing);
drawCanvas.addEventListener('pointercancel', finishDrawing);

function recognizeShape(points: Point[]): UnitType | null {
  if (points.length < 8) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const width = maxX - minX; const height = maxY - minY;
  const diagonal = Math.hypot(width, height);
  if (diagonal < 35 || width < 18 || height < 18) return null;

  const closure = distance(points[0], points[points.length - 1]) / diagonal;
  if (closure > 0.42) return null;

  const closed = [...points, points[0]];
  let perimeter = 0;
  let twiceArea = 0;
  for (let i = 0; i < closed.length - 1; i += 1) {
    perimeter += distance(closed[i], closed[i + 1]);
    twiceArea += closed[i].x * closed[i + 1].y - closed[i + 1].x * closed[i].y;
  }
  const area = Math.abs(twiceArea) / 2;
  if (perimeter <= 0 || area <= 0) return null;
  const circularity = 4 * Math.PI * area / (perimeter * perimeter);
  const fillRatio = area / Math.max(1, width * height);

  if (circularity >= 0.79 && fillRatio < 0.9) return 'mage';
  if (fillRatio >= 0.66 || circularity >= 0.68) return 'warrior';
  return 'archer';
}

function clearDrawPad(): void {
  drawing = false;
  strokePoints = [];
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  padHint.classList.remove('is-hidden');
}

mustElement<HTMLButtonElement>('clearDraw').addEventListener('click', () => {
  clearDrawPad();
  selectedSummon = null;
  setRecognition('等待绘制', '');
  setStatus('画 ○ 召唤法师，△ 召唤弓箭手，□ 召唤战士。');
});

mustElement<HTMLButtonElement>('cancelSummon').addEventListener('click', () => {
  selectedSummon = null;
  selectedUnitSpot = null;
  clearDrawPad();
  renderUnitPanel();
  setRecognition('已取消', '');
});

waveButton.addEventListener('click', startWave);

function setRecognition(primary: string, secondary: string): void {
  recognitionText.innerHTML = secondary ? `${primary}<br><small>${secondary}</small>` : primary;
}

function setStatus(text: string): void {
  statusText.textContent = text;
}

function showToast(message: string, tone: 'good' | 'bad'): void {
  toast.textContent = message;
  toast.className = `dd-toast is-show ${tone}`;
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.className = 'dd-toast';
    toastTimer = null;
  }, 1500);
}

function updateUi(): void {
  waveStat.textContent = `${currentWave} / ${TOTAL_WAVES}`;
  lifeStat.textContent = `❤️ ${castleLife}`;
  goldStat.textContent = `💰 ${gold}`;
  waveButton.disabled = waveRunning || gameOver || currentWave >= TOTAL_WAVES;
  waveButton.textContent = waveRunning ? `Wave ${currentWave} 战斗中` : currentWave >= TOTAL_WAVES ? '最终波次' : `开始 Wave ${currentWave + 1}`;
  if (selectedUnitSpot !== null) renderUnitPanel();
}

function showEnd(win: boolean): void {
  if (gameOver) return;
  gameOver = true;
  waveRunning = false;
  const modal = document.createElement('div');
  modal.className = 'dd-modal';
  modal.innerHTML = `
    <section class="dd-modal-card">
      <div class="big">${win ? '🏆' : '💥'}</div>
      <h2>${win ? '守住了！' : '城堡失守'}</h2>
      <p>${win ? '你撑过了 5 波，并击退了 Boss。下一版会加入局内三选一强化和职业进阶。' : `你撑到 Wave ${currentWave}。重新调整放置位置和升级顺序再试一次。`}</p>
      <button class="dd-btn dd-btn-primary" id="restartGame">再来一局</button>
    </section>
  `;
  document.body.append(modal);
  modal.querySelector<HTMLButtonElement>('#restartGame')?.addEventListener('click', () => {
    modal.remove();
    resetGame();
  });
}

function resetGame(): void {
  gold = 240;
  castleLife = 10;
  currentWave = 0;
  waveRunning = false;
  gameOver = false;
  gameTime = 0;
  waveTime = 0;
  spawnPlan = [];
  spawnIndex = 0;
  selectedSummon = null;
  selectedUnitSpot = null;
  units = [];
  enemies = [];
  effects = [];
  clearDrawPad();
  renderUnitPanel();
  setRecognition('等待绘制', '');
  setStatus('先画一个形状召唤守卫，也可以直接开始第一波。');
  updateUi();
}

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  update(dt);
  drawBattlefield();
  window.requestAnimationFrame(frame);
}

resetGame();
window.requestAnimationFrame(frame);
