import './style.css';

type Point = { x: number; y: number };
type UnitType = 'mage' | 'archer' | 'warrior';
type EnemyKind = 'grunt' | 'runner' | 'tank' | 'boss';
type Side = 'player' | 'enemy';

type Fighter = {
  id: number;
  side: Side;
  type?: UnitType;
  kind?: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  damage: number;
  rate: number;
  cooldown: number;
  splash: number;
  size: number;
  dead: boolean;
};

type Effect = {
  kind: 'shot' | 'blast' | 'slash' | 'base-hit';
  from: Point;
  to: Point;
  radius: number;
  life: number;
  maxLife: number;
  side: Side;
};

const root = document.querySelector<HTMLDivElement>('#draw-defense-app');
if (!root) throw new Error('Missing #draw-defense-app');

root.innerHTML = `
  <main class="dd-shell">
    <header class="dd-topbar">
      <div>
        <p class="dd-eyebrow">DRAW DEFENSE · V0.2</p>
        <h1>画兵推线</h1>
      </div>
      <div class="dd-header-actions">
        <span id="battleStatus">准备阶段</span>
        <button class="dd-btn dd-btn-primary" id="startBattle">开始战斗</button>
        <button class="dd-btn" id="restartBattle">重开</button>
      </div>
    </header>

    <section class="dd-hud">
      <div class="dd-hud-side player"><span>我方基地</span><strong id="playerHp">1000</strong></div>
      <div class="dd-hud-center">
        <div><span>Wave</span><strong id="waveStat">0 / 5</strong></div>
        <div><span>墨水</span><strong id="inkStat">80 / 120</strong></div>
        <div><span>金币</span><strong id="goldStat">0</strong></div>
      </div>
      <div class="dd-hud-side enemy"><span>敌方基地</span><strong id="enemyHp">1000</strong></div>
    </section>

    <section class="dd-battle-card">
      <canvas id="battlefield" width="960" height="420" aria-label="横版推线战场"></canvas>
      <div class="dd-toast" id="toast"></div>
      <div class="dd-rotate-note">横屏体验更好 ↻</div>
    </section>

    <section class="dd-bottom-grid">
      <section class="dd-draw-card">
        <div class="dd-section-head">
          <div>
            <strong>画一个兵种，立刻从左边暴兵</strong>
            <p>○ 法师 · △ 弓箭手 · □ 战士</p>
          </div>
          <div id="recognitionText" class="dd-recognition">等待绘制</div>
        </div>
        <div class="dd-pad-wrap">
          <canvas id="drawPad" width="430" height="130" aria-label="手画召唤区域"></canvas>
          <div class="dd-pad-hint" id="padHint"><span>○</span><span>△</span><span>□</span></div>
        </div>
        <div class="dd-resource-note">墨水自动回复，击杀也会返还墨水。画一次直接出一小队兵。</div>
      </section>

      <section class="dd-army-card">
        <div class="dd-section-head">
          <div>
            <strong>兵种升级</strong>
            <p>升级后，之后出的同类单位都会变强</p>
          </div>
        </div>
        <div class="dd-upgrades" id="upgradePanel"></div>
      </section>
    </section>

    <p class="dd-help">目标：把战线从左向右推过去，打爆敌方基地。战士顶线，弓箭手远程持续输出，法师清群怪。</p>
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

function mustContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('2D canvas unavailable');
  return context;
}

const battleCanvas = mustCanvas('battlefield');
const ctx = mustContext(battleCanvas);
const drawCanvas = mustCanvas('drawPad');
const drawCtx = mustContext(drawCanvas);
const playerHpEl = mustElement<HTMLElement>('playerHp');
const enemyHpEl = mustElement<HTMLElement>('enemyHp');
const waveStat = mustElement<HTMLElement>('waveStat');
const inkStat = mustElement<HTMLElement>('inkStat');
const goldStat = mustElement<HTMLElement>('goldStat');
const battleStatus = mustElement<HTMLElement>('battleStatus');
const recognitionText = mustElement<HTMLElement>('recognitionText');
const padHint = mustElement<HTMLElement>('padHint');
const upgradePanel = mustElement<HTMLElement>('upgradePanel');
const toast = mustElement<HTMLElement>('toast');
const startBattleButton = mustElement<HTMLButtonElement>('startBattle');
const restartBattleButton = mustElement<HTMLButtonElement>('restartBattle');

const WIDTH = battleCanvas.width;
const HEIGHT = battleCanvas.height;
const GROUND_Y = 322;
const PLAYER_BASE_X = 62;
const ENEMY_BASE_X = WIDTH - 62;
const MAX_BASE_HP = 1000;
const MAX_INK = 120;
const TOTAL_WAVES = 5;

const UNIT_META: Record<UnitType, {
  name: string;
  symbol: string;
  cost: number;
  squad: number;
  hp: number;
  speed: number;
  range: number;
  damage: number;
  rate: number;
  splash: number;
}> = {
  warrior: { name: '战士', symbol: '□', cost: 24, squad: 3, hp: 150, speed: 43, range: 30, damage: 22, rate: 0.72, splash: 0 },
  archer: { name: '弓箭手', symbol: '△', cost: 30, squad: 2, hp: 78, speed: 38, range: 150, damage: 14, rate: 0.62, splash: 0 },
  mage: { name: '法师', symbol: '○', cost: 40, squad: 1, hp: 92, speed: 34, range: 128, damage: 32, rate: 1.18, splash: 58 }
};

const levels: Record<UnitType, number> = { warrior: 1, archer: 1, mage: 1 };

let fighters: Fighter[] = [];
let effects: Effect[] = [];
let nextId = 1;
let playerBaseHp = MAX_BASE_HP;
let enemyBaseHp = MAX_BASE_HP;
let ink = 80;
let gold = 0;
let gameTime = 0;
let battleStarted = false;
let gameOver = false;
let currentWave = 0;
let nextSpawnAt = 0;
let bossSpawned = false;
let toastTimer: number | null = null;
let upgradeRenderKey = '';

function playerStats(type: UnitType): Omit<Fighter, 'id' | 'side' | 'type' | 'x' | 'y' | 'cooldown' | 'dead'> {
  const meta = UNIT_META[type];
  const level = levels[type];
  const scale = 1 + (level - 1) * 0.34;
  return {
    hp: meta.hp * scale,
    maxHp: meta.hp * scale,
    speed: meta.speed * (1 + (level - 1) * 0.05),
    range: meta.range + (level - 1) * (type === 'warrior' ? 2 : 8),
    damage: meta.damage * scale,
    rate: Math.max(0.34, meta.rate - (level - 1) * 0.06),
    splash: meta.splash + (level - 1) * 9,
    size: type === 'warrior' ? 16 : 14
  };
}

function enemyStats(kind: EnemyKind): Omit<Fighter, 'id' | 'side' | 'kind' | 'x' | 'y' | 'cooldown' | 'dead'> {
  const waveScale = 1 + Math.max(0, currentWave - 1) * 0.16;
  if (kind === 'runner') return { hp: 62 * waveScale, maxHp: 62 * waveScale, speed: 58, range: 26, damage: 12 * waveScale, rate: 0.72, splash: 0, size: 13 };
  if (kind === 'tank') return { hp: 230 * waveScale, maxHp: 230 * waveScale, speed: 22, range: 30, damage: 24 * waveScale, rate: 0.9, splash: 0, size: 19 };
  if (kind === 'boss') return { hp: 820, maxHp: 820, speed: 18, range: 40, damage: 42, rate: 0.88, splash: 0, size: 27 };
  return { hp: 92 * waveScale, maxHp: 92 * waveScale, speed: 35, range: 28, damage: 15 * waveScale, rate: 0.78, splash: 0, size: 15 };
}

function laneY(index: number, side: Side): number {
  const offsets = [-18, 0, 18, -9, 9];
  return GROUND_Y + offsets[index % offsets.length] + (side === 'enemy' ? 2 : 0);
}

function summon(type: UnitType): void {
  if (gameOver) return;
  const meta = UNIT_META[type];
  if (ink < meta.cost) {
    showToast(`墨水不够：${meta.name}需要 ${meta.cost}`, 'bad');
    recognitionText.textContent = '墨水不足';
    return;
  }

  ink -= meta.cost;
  for (let i = 0; i < meta.squad; i += 1) {
    const stats = playerStats(type);
    fighters.push({
      id: nextId++,
      side: 'player',
      type,
      x: PLAYER_BASE_X + 34 - i * 9,
      y: laneY(i + nextId, 'player'),
      ...stats,
      cooldown: Math.random() * 0.3,
      dead: false
    });
  }
  showToast(`${meta.symbol} ${meta.name} ×${meta.squad} 出击`, 'good');
}

function spawnEnemy(kind: EnemyKind): void {
  const stats = enemyStats(kind);
  fighters.push({
    id: nextId++,
    side: 'enemy',
    kind,
    x: ENEMY_BASE_X - 36,
    y: laneY(nextId, 'enemy'),
    ...stats,
    cooldown: Math.random() * 0.35,
    dead: false
  });
}

function chooseEnemyKind(wave: number): EnemyKind {
  const roll = Math.random();
  if (wave === 1) return roll < 0.78 ? 'grunt' : 'runner';
  if (wave === 2) return roll < 0.5 ? 'grunt' : roll < 0.82 ? 'runner' : 'tank';
  if (wave === 3) return roll < 0.42 ? 'grunt' : roll < 0.68 ? 'runner' : 'tank';
  if (wave === 4) return roll < 0.34 ? 'grunt' : roll < 0.62 ? 'runner' : 'tank';
  return roll < 0.25 ? 'grunt' : roll < 0.5 ? 'runner' : 'tank';
}

function spawnLogic(): void {
  currentWave = Math.min(TOTAL_WAVES, Math.floor(gameTime / 18) + 1);
  const intervals = [2.25, 1.8, 1.5, 1.22, 1.0];

  if (gameTime >= nextSpawnAt) {
    spawnEnemy(chooseEnemyKind(currentWave));
    nextSpawnAt = gameTime + intervals[currentWave - 1];
  }

  if (currentWave === 5 && !bossSpawned && gameTime >= 76) {
    bossSpawned = true;
    spawnEnemy('boss');
    showToast('BOSS 从右侧压过来了！', 'bad');
  }
}

function findTarget(unit: Fighter): Fighter | null {
  const opponents = fighters.filter((candidate) => !candidate.dead && candidate.side !== unit.side);
  if (opponents.length === 0) return null;
  const directional = opponents.filter((candidate) => unit.side === 'player' ? candidate.x >= unit.x - 12 : candidate.x <= unit.x + 12);
  const pool = directional.length > 0 ? directional : opponents;
  pool.sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x));
  return pool[0] ?? null;
}

function applyDamage(target: Fighter, damage: number, attacker: Fighter): void {
  if (target.dead) return;
  target.hp -= damage;
  if (target.hp > 0) return;

  target.dead = true;
  if (attacker.side === 'player') {
    gold += target.kind === 'boss' ? 120 : target.kind === 'tank' ? 18 : target.kind === 'runner' ? 10 : 12;
    ink = Math.min(MAX_INK, ink + (target.kind === 'boss' ? 18 : 4));
  }
}

function attackFighter(attacker: Fighter, target: Fighter): void {
  attacker.cooldown = attacker.rate;
  const from = { x: attacker.x, y: attacker.y - 20 };
  const to = { x: target.x, y: target.y - 20 };

  if (attacker.side === 'player' && attacker.type === 'mage') {
    for (const candidate of fighters) {
      if (candidate.dead || candidate.side === attacker.side) continue;
      if (Math.abs(candidate.x - target.x) <= attacker.splash) applyDamage(candidate, attacker.damage, attacker);
    }
    effects.push({ kind: 'blast', from, to, radius: attacker.splash, life: 0.28, maxLife: 0.28, side: attacker.side });
    return;
  }

  applyDamage(target, attacker.damage, attacker);
  effects.push({
    kind: attacker.range > 60 ? 'shot' : 'slash',
    from,
    to,
    radius: 0,
    life: attacker.range > 60 ? 0.16 : 0.12,
    maxLife: attacker.range > 60 ? 0.16 : 0.12,
    side: attacker.side
  });
}

function attackBase(unit: Fighter): void {
  unit.cooldown = unit.rate;
  const attackingEnemy = unit.side === 'player';
  if (attackingEnemy) enemyBaseHp = Math.max(0, enemyBaseHp - unit.damage);
  else playerBaseHp = Math.max(0, playerBaseHp - unit.damage);

  effects.push({
    kind: 'base-hit',
    from: { x: unit.x, y: unit.y - 18 },
    to: { x: attackingEnemy ? ENEMY_BASE_X : PLAYER_BASE_X, y: GROUND_Y - 38 },
    radius: 22,
    life: 0.2,
    maxLife: 0.2,
    side: unit.side
  });

  if (enemyBaseHp <= 0) endGame(true);
  if (playerBaseHp <= 0) endGame(false);
}

function updateFighters(dt: number): void {
  for (const unit of fighters) {
    if (unit.dead) continue;
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    const target = findTarget(unit);
    const targetDistance = target ? Math.abs(target.x - unit.x) : Infinity;

    if (target && targetDistance <= unit.range + target.size * 0.6) {
      if (unit.cooldown <= 0) attackFighter(unit, target);
      continue;
    }

    const baseDistance = unit.side === 'player' ? ENEMY_BASE_X - unit.x : unit.x - PLAYER_BASE_X;
    if (baseDistance <= unit.range + 28) {
      if (unit.cooldown <= 0) attackBase(unit);
      continue;
    }

    unit.x += (unit.side === 'player' ? 1 : -1) * unit.speed * dt;
  }

  fighters = fighters.filter((fighter) => !fighter.dead && fighter.x > 10 && fighter.x < WIDTH - 10);
}

function endGame(win: boolean): void {
  if (gameOver) return;
  gameOver = true;
  battleStarted = false;
  battleStatus.textContent = win ? '胜利' : '失败';
  showToast(win ? '敌方基地被推平了！' : '我方基地失守', win ? 'good' : 'bad');

  const modal = document.createElement('div');
  modal.className = 'dd-modal';
  modal.innerHTML = `
    <section class="dd-modal-card">
      <div class="big">${win ? '⚔️' : '💥'}</div>
      <h2>${win ? '推进成功' : '防线崩溃'}</h2>
      <p>${win ? '你的部队一路从左侧推到了敌方基地。' : '调整暴兵节奏和升级顺序，再打一局。'}</p>
      <button class="dd-btn dd-btn-primary" data-restart>再来一局</button>
    </section>
  `;
  document.body.append(modal);
  modal.querySelector('[data-restart]')?.addEventListener('click', () => {
    modal.remove();
    resetGame();
  });
}

function upgradeCost(type: UnitType): number {
  return 70 + (levels[type] - 1) * 70;
}

function upgrade(type: UnitType): void {
  if (levels[type] >= 3) return;
  const cost = upgradeCost(type);
  if (gold < cost) {
    showToast(`金币不足，还差 ${Math.ceil(cost - gold)}`, 'bad');
    return;
  }
  gold -= cost;
  levels[type] += 1;
  showToast(`${UNIT_META[type].name} 升到 Lv.${levels[type]}`, 'good');
  upgradeRenderKey = '';
}

function renderUpgradesIfNeeded(): void {
  const key = `${Math.floor(gold)}:${levels.warrior}:${levels.archer}:${levels.mage}`;
  if (key === upgradeRenderKey) return;
  upgradeRenderKey = key;

  const order: UnitType[] = ['warrior', 'archer', 'mage'];
  upgradePanel.innerHTML = order.map((type) => {
    const meta = UNIT_META[type];
    const level = levels[type];
    const maxed = level >= 3;
    const cost = upgradeCost(type);
    return `
      <div class="dd-upgrade-item">
        <div class="dd-unit-symbol ${type}">${meta.symbol}</div>
        <div class="dd-upgrade-copy">
          <strong>${meta.name} <em>Lv.${level}</em></strong>
          <span>${type === 'warrior' ? '3人一队 · 前排顶线' : type === 'archer' ? '2人一队 · 远程单体' : '1人 · 范围清场'}</span>
        </div>
        <button class="dd-btn dd-upgrade-btn" data-upgrade="${type}" ${maxed || gold < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `升级 ${cost}`}
        </button>
      </div>
    `;
  }).join('');
}

function update(dt: number): void {
  if (!gameOver) {
    ink = Math.min(MAX_INK, ink + dt * 7.2);
    if (battleStarted) {
      gameTime += dt;
      spawnLogic();
      updateFighters(dt);
    }
  }

  effects = effects.map((effect) => ({ ...effect, life: effect.life - dt })).filter((effect) => effect.life > 0);
  playerHpEl.textContent = `${Math.ceil(playerBaseHp)}`;
  enemyHpEl.textContent = `${Math.ceil(enemyBaseHp)}`;
  waveStat.textContent = `${currentWave} / ${TOTAL_WAVES}`;
  inkStat.textContent = `${Math.floor(ink)} / ${MAX_INK}`;
  goldStat.textContent = `${Math.floor(gold)}`;
  renderUpgradesIfNeeded();
}

function drawBackground(): void {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#202a35');
  sky.addColorStop(0.62, '#344147');
  sky.addColorStop(0.63, '#4f4d3f');
  sky.addColorStop(1, '#23251f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let x = 150; x < WIDTH; x += 170) ctx.fillRect(x, 75 + (x % 80), 2, 150);

  ctx.fillStyle = '#5d5945';
  ctx.fillRect(0, GROUND_Y + 20, WIDTH, HEIGHT - GROUND_Y);
  ctx.fillStyle = '#7c7354';
  ctx.fillRect(0, GROUND_Y + 18, WIDTH, 4);

  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, 65);
  ctx.lineTo(WIDTH / 2, GROUND_Y + 15);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '700 12px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  ctx.fillText('FRONT LINE', WIDTH / 2, 58);
}

function drawBase(side: Side): void {
  const x = side === 'player' ? PLAYER_BASE_X : ENEMY_BASE_X;
  const hp = side === 'player' ? playerBaseHp : enemyBaseHp;
  ctx.save();
  ctx.translate(x, GROUND_Y + 15);
  if (side === 'enemy') ctx.scale(-1, 1);
  ctx.fillStyle = side === 'player' ? '#688fb8' : '#aa5e5e';
  ctx.fillRect(-32, -92, 64, 92);
  ctx.fillStyle = '#222730';
  ctx.fillRect(-15, -48, 30, 48);
  ctx.fillStyle = side === 'player' ? '#83add6' : '#c77979';
  ctx.beginPath();
  ctx.moveTo(-42, -92);
  ctx.lineTo(0, -126);
  ctx.lineTo(42, -92);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const barWidth = 96;
  const ratio = Math.max(0, hp / MAX_BASE_HP);
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(x - barWidth / 2, 28, barWidth, 9);
  ctx.fillStyle = side === 'player' ? '#87c3ef' : '#ed8989';
  ctx.fillRect(x - barWidth / 2, 28, barWidth * ratio, 9);
}

function drawShapeHead(unit: Fighter): void {
  const size = unit.size;
  ctx.lineWidth = 3;
  ctx.strokeStyle = unit.side === 'player' ? '#eef6ff' : '#ffd9d9';
  ctx.fillStyle = unit.side === 'player' ? '#547ea8' : '#8f4c4c';

  if (unit.side === 'enemy') {
    ctx.beginPath();
    ctx.moveTo(-size * 0.7, -size * 1.5);
    ctx.lineTo(0, -size * 2.15);
    ctx.lineTo(size * 0.7, -size * 1.5);
    ctx.lineTo(0, -size * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }

  if (unit.type === 'mage') {
    ctx.beginPath();
    ctx.arc(0, -size * 1.55, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (unit.type === 'archer') {
    ctx.beginPath();
    ctx.moveTo(0, -size * 2.3);
    ctx.lineTo(size * 0.82, -size * 0.9);
    ctx.lineTo(-size * 0.82, -size * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(-size * 0.7, -size * 2.15, size * 1.4, size * 1.4);
    ctx.strokeRect(-size * 0.7, -size * 2.15, size * 1.4, size * 1.4);
  }
}

function drawFighter(unit: Fighter): void {
  ctx.save();
  ctx.translate(unit.x, unit.y);
  if (unit.side === 'enemy') ctx.scale(-1, 1);
  drawShapeHead(unit);
  ctx.strokeStyle = unit.side === 'player' ? '#dfeeff' : '#ffe4e4';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -unit.size * 0.8);
  ctx.lineTo(0, unit.size * 0.25);
  ctx.moveTo(0, -unit.size * 0.35);
  ctx.lineTo(unit.size * 0.85, 0);
  ctx.moveTo(0, -unit.size * 0.35);
  ctx.lineTo(-unit.size * 0.75, 0);
  ctx.moveTo(0, unit.size * 0.25);
  ctx.lineTo(unit.size * 0.62, unit.size);
  ctx.moveTo(0, unit.size * 0.25);
  ctx.lineTo(-unit.size * 0.62, unit.size);
  ctx.stroke();

  if (unit.side === 'player' && unit.type === 'archer') {
    ctx.strokeStyle = '#d7bb7b';
    ctx.beginPath();
    ctx.arc(unit.size * 0.85, -unit.size * 0.05, unit.size * 0.58, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else if (unit.side === 'player' && unit.type === 'mage') {
    ctx.strokeStyle = '#d8a8ff';
    ctx.beginPath();
    ctx.moveTo(unit.size * 0.72, 0);
    ctx.lineTo(unit.size * 1.15, -unit.size * 1.05);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#d9d9d9';
    ctx.beginPath();
    ctx.moveTo(unit.size * 0.75, 0);
    ctx.lineTo(unit.size * 1.2, -unit.size * 0.55);
    ctx.stroke();
  }
  ctx.restore();

  const barWidth = Math.max(22, unit.size * 2.1);
  const ratio = Math.max(0, unit.hp / unit.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(unit.x - barWidth / 2, unit.y - unit.size * 2.8, barWidth, 4);
  ctx.fillStyle = unit.side === 'player' ? '#85ccff' : '#ff8b8b';
  ctx.fillRect(unit.x - barWidth / 2, unit.y - unit.size * 2.8, barWidth * ratio, 4);
}

function drawEffects(): void {
  for (const effect of effects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.side === 'player' ? '#b9dcff' : '#ffb0b0';
    ctx.fillStyle = effect.side === 'player' ? 'rgba(162,207,255,.24)' : 'rgba(255,132,132,.22)';
    ctx.lineWidth = effect.kind === 'shot' ? 2 : 4;
    if (effect.kind === 'blast') {
      ctx.beginPath();
      ctx.arc(effect.to.x, effect.to.y, effect.radius * (1.1 - alpha * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(effect.from.x, effect.from.y);
      ctx.lineTo(effect.to.x, effect.to.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function render(): void {
  drawBackground();
  drawBase('player');
  drawBase('enemy');
  for (const fighter of [...fighters].sort((a, b) => a.y - b.y)) drawFighter(fighter);
  drawEffects();

  if (!battleStarted && !gameOver) {
    ctx.fillStyle = 'rgba(7,10,14,.58)';
    ctx.fillRect(WIDTH / 2 - 175, 118, 350, 76);
    ctx.fillStyle = '#f7f4ea';
    ctx.font = '800 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('先画兵，再开始战斗', WIDTH / 2, 150);
    ctx.font = '500 13px system-ui';
    ctx.fillStyle = '#c9ced5';
    ctx.fillText('你的部队会从左侧自动向右推进', WIDTH / 2, 176);
  }
}

function showToast(message: string, tone: 'good' | 'bad'): void {
  toast.textContent = message;
  toast.className = `dd-toast is-show ${tone}`;
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.className = 'dd-toast';
    toastTimer = null;
  }, 1300);
}

function resetGame(): void {
  fighters = [];
  effects = [];
  playerBaseHp = MAX_BASE_HP;
  enemyBaseHp = MAX_BASE_HP;
  ink = 80;
  gold = 0;
  gameTime = 0;
  battleStarted = false;
  gameOver = false;
  currentWave = 0;
  nextSpawnAt = 0;
  bossSpawned = false;
  levels.warrior = 1;
  levels.archer = 1;
  levels.mage = 1;
  upgradeRenderKey = '';
  startBattleButton.disabled = false;
  startBattleButton.textContent = '开始战斗';
  battleStatus.textContent = '准备阶段';
  recognitionText.textContent = '等待绘制';
  clearDrawing();
  update(0);
}

startBattleButton.addEventListener('click', () => {
  if (battleStarted || gameOver) return;
  battleStarted = true;
  currentWave = 1;
  nextSpawnAt = 0;
  startBattleButton.disabled = true;
  startBattleButton.textContent = '战斗中';
  battleStatus.textContent = 'Wave 1';
  showToast('敌军从右侧出现，往前推！', 'good');
});

restartBattleButton.addEventListener('click', resetGame);

upgradePanel.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade]');
  if (!button) return;
  upgrade(button.dataset.upgrade as UnitType);
});

let drawing = false;
let drawPoints: Point[] = [];

function canvasPoint(event: PointerEvent): Point {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (drawCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (drawCanvas.height / rect.height)
  };
}

function clearDrawing(): void {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawPoints = [];
  padHint.classList.remove('is-hidden');
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  return Math.hypot(point.x - (lineStart.x + t * dx), point.y - (lineStart.y + t * dy));
}

function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > epsilon) {
    const left = simplify(points.slice(0, index + 1), epsilon);
    const right = simplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function recognize(points: Point[]): UnitType | null {
  if (points.length < 12) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const diagonal = Math.hypot(width, height);
  if (width < 28 || height < 28 || diagonal < 45) return null;

  const closure = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  if (closure > diagonal * 0.42) return null;

  const simplified = simplify(points, diagonal * 0.075);
  const corners = Math.max(0, simplified.length - 1);
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const radii = points.map((point) => Math.hypot(point.x - center.x, point.y - center.y));
  const meanRadius = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  const variance = radii.reduce((sum, value) => sum + (value - meanRadius) ** 2, 0) / radii.length;
  const radialNoise = Math.sqrt(variance) / Math.max(1, meanRadius);

  if (radialNoise < 0.19 && corners > 5) return 'mage';
  if (corners <= 4) return 'archer';
  if (corners <= 6) return 'warrior';
  return radialNoise < 0.25 ? 'mage' : 'warrior';
}

function finishDrawing(): void {
  if (!drawing) return;
  drawing = false;
  const result = recognize(drawPoints);
  if (!result) {
    recognitionText.textContent = '没识别出来';
    showToast('尽量一笔闭合画 ○ △ □', 'bad');
    window.setTimeout(clearDrawing, 500);
    return;
  }

  const meta = UNIT_META[result];
  recognitionText.textContent = `${meta.symbol} ${meta.name}`;
  summon(result);
  window.setTimeout(clearDrawing, 260);
}

drawCanvas.addEventListener('pointerdown', (event) => {
  drawing = true;
  drawPoints = [canvasPoint(event)];
  drawCanvas.setPointerCapture(event.pointerId);
  padHint.classList.add('is-hidden');
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.strokeStyle = '#f2c477';
  drawCtx.lineWidth = 7;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  drawCtx.beginPath();
  drawCtx.moveTo(drawPoints[0].x, drawPoints[0].y);
});

drawCanvas.addEventListener('pointermove', (event) => {
  if (!drawing) return;
  const point = canvasPoint(event);
  drawPoints.push(point);
  drawCtx.lineTo(point.x, point.y);
  drawCtx.stroke();
});

drawCanvas.addEventListener('pointerup', finishDrawing);
drawCanvas.addEventListener('pointercancel', finishDrawing);

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  if (battleStarted && !gameOver) battleStatus.textContent = `Wave ${currentWave} · ${Math.floor(gameTime)}s`;
  render();
  requestAnimationFrame(frame);
}

resetGame();
requestAnimationFrame(frame);
