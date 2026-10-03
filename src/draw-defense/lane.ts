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
    <section class="dd-stage-wrap">
      <canvas id="battlefield" width="960" height="540" aria-label="横版推线战场，可直接在左侧战场画兵"></canvas>

      <div class="dd-top-overlay">
        <div class="dd-base-hp player"><span>我方基地</span><strong id="playerHp">1000</strong></div>
        <div class="dd-center-hud">
          <span>Wave <strong id="waveStat">0 / 5</strong></span>
          <span>墨水 <strong id="inkStat">80 / 120</strong></span>
          <span>金币 <strong id="goldStat">0</strong></span>
        </div>
        <div class="dd-base-hp enemy"><span>敌方基地</span><strong id="enemyHp">1000</strong></div>
      </div>

      <div class="dd-battle-status" id="battleStatus">在左侧战场直接画 ○ △ □ 召唤部队</div>
      <div class="dd-toast" id="toast"></div>
      <div class="dd-draw-result" id="recognitionText">等待绘制</div>
    </section>

    <aside class="dd-side-panel">
      <header class="dd-panel-head">
        <div>
          <p>DRAW DEFENSE · V0.3</p>
          <h1>画兵推线</h1>
        </div>
        <div class="dd-panel-actions">
          <button class="dd-btn dd-btn-primary" id="startBattle">开始</button>
          <button class="dd-btn" id="restartBattle">重开</button>
        </div>
      </header>

      <section class="dd-howto">
        <strong>直接在战场画</strong>
        <div class="dd-shapes">
          <span><b>□</b> 战士 ×3</span>
          <span><b>△</b> 弓手 ×2</span>
          <span><b>○</b> 法师 ×1</span>
        </div>
        <p>左侧亮区是召唤区。画在哪里，部队就从哪里出现并向右推进。</p>
      </section>

      <section class="dd-upgrade-section">
        <div class="dd-section-title">
          <strong>兵种升级</strong>
          <span>之后新出的同类单位都会变强</span>
        </div>
        <div class="dd-upgrades" id="upgradePanel"></div>
      </section>

      <section class="dd-tip-card">
        <strong>布阵思路</strong>
        <p>战士画前面卡线，弓箭手和法师画在后面。墨水会自动回复，击杀也会返还。</p>
      </section>
    </aside>

    <div class="dd-portrait-blocker">
      <div class="dd-rotate-icon">↻</div>
      <strong>请把手机横过来</strong>
      <span>这个版本按横屏设计</span>
    </div>
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

const canvas = mustCanvas('battlefield');
const ctx = mustContext(canvas);
const playerHpEl = mustElement<HTMLElement>('playerHp');
const enemyHpEl = mustElement<HTMLElement>('enemyHp');
const waveStat = mustElement<HTMLElement>('waveStat');
const inkStat = mustElement<HTMLElement>('inkStat');
const goldStat = mustElement<HTMLElement>('goldStat');
const battleStatus = mustElement<HTMLElement>('battleStatus');
const recognitionText = mustElement<HTMLElement>('recognitionText');
const upgradePanel = mustElement<HTMLElement>('upgradePanel');
const toast = mustElement<HTMLElement>('toast');
const startBattleButton = mustElement<HTMLButtonElement>('startBattle');
const restartBattleButton = mustElement<HTMLButtonElement>('restartBattle');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_BASE_X = 58;
const ENEMY_BASE_X = WIDTH - 58;
const MAX_BASE_HP = 1000;
const MAX_INK = 120;
const TOTAL_WAVES = 5;
const DEPLOY_LIMIT_X = WIDTH * 0.55;
const TOP_PLAY_Y = 110;
const BOTTOM_PLAY_Y = HEIGHT - 58;

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
  warrior: { name: '战士', symbol: '□', cost: 24, squad: 3, hp: 150, speed: 43, range: 34, damage: 22, rate: 0.72, splash: 0 },
  archer: { name: '弓箭手', symbol: '△', cost: 30, squad: 2, hp: 78, speed: 38, range: 158, damage: 14, rate: 0.62, splash: 0 },
  mage: { name: '法师', symbol: '○', cost: 40, squad: 1, hp: 92, speed: 34, range: 136, damage: 32, rate: 1.18, splash: 60 }
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
let drawing = false;
let strokePoints: Point[] = [];

function playerStats(type: UnitType): Omit<Fighter, 'id' | 'side' | 'type' | 'x' | 'y' | 'cooldown' | 'dead'> {
  const base = UNIT_META[type];
  const level = levels[type];
  const scale = 1 + (level - 1) * 0.32;
  return {
    hp: base.hp * scale,
    maxHp: base.hp * scale,
    speed: base.speed,
    range: base.range + (level - 1) * 8,
    damage: base.damage * scale,
    rate: Math.max(0.32, base.rate - (level - 1) * 0.045),
    splash: base.splash ? base.splash + (level - 1) * 8 : 0,
    size: type === 'warrior' ? 17 : 15
  };
}

function enemyStats(kind: EnemyKind): Omit<Fighter, 'id' | 'side' | 'kind' | 'x' | 'y' | 'cooldown' | 'dead'> {
  const waveScale = 1 + Math.max(0, currentWave - 1) * 0.15;
  if (kind === 'runner') return { hp: 62 * waveScale, maxHp: 62 * waveScale, speed: 54, range: 28, damage: 16 * waveScale, rate: 0.62, splash: 0, size: 13 };
  if (kind === 'tank') return { hp: 245 * waveScale, maxHp: 245 * waveScale, speed: 25, range: 31, damage: 28 * waveScale, rate: 0.95, splash: 0, size: 20 };
  if (kind === 'boss') return { hp: 1050, maxHp: 1050, speed: 19, range: 36, damage: 48, rate: 0.82, splash: 46, size: 27 };
  return { hp: 100 * waveScale, maxHp: 100 * waveScale, speed: 36, range: 29, damage: 18 * waveScale, rate: 0.72, splash: 0, size: 15 };
}

function startBattle(): void {
  if (gameOver || battleStarted) return;
  battleStarted = true;
  currentWave = 1;
  nextSpawnAt = gameTime + 0.5;
  battleStatus.textContent = 'Wave 1 · 敌军开始推进';
  startBattleButton.disabled = true;
  showToast('战斗开始！直接在左侧战场画兵', 'good');
}

function restartBattle(): void {
  fighters = [];
  effects = [];
  nextId = 1;
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
  strokePoints = [];
  drawing = false;
  levels.warrior = 1;
  levels.archer = 1;
  levels.mage = 1;
  startBattleButton.disabled = false;
  battleStatus.textContent = '在左侧战场直接画 ○ △ □ 召唤部队';
  recognitionText.textContent = '等待绘制';
  upgradeRenderKey = '';
  updateUi();
}

function spawnPlayerSquad(type: UnitType, at: Point): void {
  const meta = UNIT_META[type];
  if (ink < meta.cost) {
    showToast(`墨水不足，需要 ${meta.cost}`, 'bad');
    return;
  }
  if (!battleStarted) startBattle();
  ink -= meta.cost;

  for (let i = 0; i < meta.squad; i += 1) {
    const stats = playerStats(type);
    fighters.push({
      id: nextId++,
      side: 'player',
      type,
      x: clamp(at.x - i * 13, PLAYER_BASE_X + 38, DEPLOY_LIMIT_X - 10),
      y: clamp(at.y + (i - (meta.squad - 1) / 2) * 19, TOP_PLAY_Y + 20, BOTTOM_PLAY_Y - 15),
      ...stats,
      cooldown: Math.random() * 0.25,
      dead: false
    });
  }

  recognitionText.textContent = `${meta.symbol} ${meta.name} ×${meta.squad}`;
  showToast(`${meta.name}从这里出击`, 'good');
}

function spawnEnemy(kind: EnemyKind): void {
  const stats = enemyStats(kind);
  const y = randomBetween(TOP_PLAY_Y + 38, BOTTOM_PLAY_Y - 22);
  fighters.push({
    id: nextId++,
    side: 'enemy',
    kind,
    x: ENEMY_BASE_X - 43,
    y,
    ...stats,
    cooldown: Math.random() * 0.3,
    dead: false
  });
}

function update(dt: number): void {
  if (gameOver) return;
  gameTime += dt;
  ink = Math.min(MAX_INK, ink + dt * 7.2);

  if (battleStarted) {
    updateWaves();
    updateFighters(dt);
  }

  effects = effects
    .map((effect) => ({ ...effect, life: effect.life - dt }))
    .filter((effect) => effect.life > 0);
  fighters = fighters.filter((fighter) => !fighter.dead);
  updateUi();
}

function updateWaves(): void {
  const waveDuration = 24;
  const nextWave = Math.min(TOTAL_WAVES, Math.floor(gameTime / waveDuration) + 1);
  if (nextWave > currentWave) {
    currentWave = nextWave;
    battleStatus.textContent = currentWave === TOTAL_WAVES ? 'Wave 5 · Boss 压境' : `Wave ${currentWave} · 敌军增强`;
    showToast(currentWave === TOTAL_WAVES ? 'Boss 来了！' : `进入 Wave ${currentWave}`, 'bad');
  }

  if (currentWave === TOTAL_WAVES && !bossSpawned && gameTime >= waveDuration * 4 + 5) {
    bossSpawned = true;
    spawnEnemy('boss');
  }

  if (gameTime >= nextSpawnAt) {
    const interval = Math.max(0.62, 1.72 - currentWave * 0.17);
    nextSpawnAt = gameTime + interval;
    const roll = Math.random();
    if (currentWave >= 4 && roll < 0.22) spawnEnemy('tank');
    else if (currentWave >= 2 && roll < 0.48) spawnEnemy('runner');
    else spawnEnemy('grunt');
  }
}

function updateFighters(dt: number): void {
  for (const fighter of fighters) {
    if (fighter.dead || gameOver) continue;
    fighter.cooldown = Math.max(0, fighter.cooldown - dt);

    const targets = fighters
      .filter((other) => other.side !== fighter.side && !other.dead)
      .map((other) => ({ fighter: other, distance: distance(fighter, other) }))
      .filter((entry) => entry.distance <= fighter.range)
      .sort((a, b) => a.distance - b.distance);

    const target = targets[0]?.fighter;
    if (target) {
      if (fighter.cooldown <= 0) attack(fighter, target);
      continue;
    }

    const enemyBaseX = fighter.side === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X;
    const baseDistance = Math.abs(fighter.x - enemyBaseX);
    if (baseDistance <= fighter.range + 24) {
      if (fighter.cooldown <= 0) attackBase(fighter);
      continue;
    }

    const direction = fighter.side === 'player' ? 1 : -1;
    fighter.x += direction * fighter.speed * dt;
  }
}

function attack(attacker: Fighter, target: Fighter): void {
  attacker.cooldown = attacker.rate;
  if (attacker.splash > 0) {
    for (const fighter of fighters) {
      if (fighter.side !== attacker.side && !fighter.dead && distance(fighter, target) <= attacker.splash) {
        dealDamage(fighter, attacker.damage);
      }
    }
    effects.push({ kind: 'blast', from: point(attacker), to: point(target), radius: attacker.splash, life: 0.23, maxLife: 0.23, side: attacker.side });
  } else {
    dealDamage(target, attacker.damage);
    effects.push({
      kind: attacker.range > 80 ? 'shot' : 'slash',
      from: point(attacker),
      to: point(target),
      radius: 0,
      life: 0.15,
      maxLife: 0.15,
      side: attacker.side
    });
  }
}

function attackBase(attacker: Fighter): void {
  attacker.cooldown = attacker.rate;
  const damage = attacker.damage * 0.68;
  if (attacker.side === 'player') {
    enemyBaseHp = Math.max(0, enemyBaseHp - damage);
    if (enemyBaseHp <= 0) finishGame(true);
  } else {
    playerBaseHp = Math.max(0, playerBaseHp - damage);
    if (playerBaseHp <= 0) finishGame(false);
  }
  effects.push({
    kind: 'base-hit',
    from: point(attacker),
    to: { x: attacker.side === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X, y: HEIGHT * 0.56 },
    radius: 32,
    life: 0.2,
    maxLife: 0.2,
    side: attacker.side
  });
}

function dealDamage(target: Fighter, amount: number): void {
  target.hp -= amount;
  if (target.hp > 0 || target.dead) return;
  target.dead = true;
  if (target.side === 'enemy') {
    const reward = target.kind === 'boss' ? 160 : target.kind === 'tank' ? 22 : target.kind === 'runner' ? 11 : 9;
    gold += reward;
    ink = Math.min(MAX_INK, ink + (target.kind === 'boss' ? 30 : 3));
  }
}

function finishGame(victory: boolean): void {
  if (gameOver) return;
  gameOver = true;
  battleStatus.textContent = victory ? '敌方基地被摧毁' : '我方基地失守';
  const modal = document.createElement('div');
  modal.className = 'dd-modal';
  modal.innerHTML = `
    <section class="dd-modal-card">
      <div class="big">${victory ? '🏆' : '💥'}</div>
      <h2>${victory ? '推进成功' : '防线崩溃'}</h2>
      <p>${victory ? '你把战线一路推到了敌方基地。' : '调整出兵位置和升级顺序，再试一次。'}</p>
      <button class="dd-btn dd-btn-primary" data-restart>再来一局</button>
    </section>
  `;
  document.body.append(modal);
  modal.querySelector('[data-restart]')?.addEventListener('click', () => {
    modal.remove();
    restartBattle();
  });
}

function upgrade(type: UnitType): void {
  const level = levels[type];
  if (level >= 5) return;
  const cost = 70 + level * 55;
  if (gold < cost) {
    showToast(`金币不足，需要 ${cost}`, 'bad');
    return;
  }
  gold -= cost;
  levels[type] += 1;
  upgradeRenderKey = '';
  renderUpgradePanel();
  showToast(`${UNIT_META[type].name}升到 Lv.${levels[type]}`, 'good');
}

function updateUi(): void {
  playerHpEl.textContent = String(Math.ceil(playerBaseHp));
  enemyHpEl.textContent = String(Math.ceil(enemyBaseHp));
  waveStat.textContent = `${currentWave} / ${TOTAL_WAVES}`;
  inkStat.textContent = `${Math.floor(ink)} / ${MAX_INK}`;
  goldStat.textContent = String(Math.floor(gold));
  renderUpgradePanel();
}

function renderUpgradePanel(): void {
  const key = `${gold}|${levels.warrior}|${levels.archer}|${levels.mage}`;
  if (key === upgradeRenderKey) return;
  upgradeRenderKey = key;
  upgradePanel.innerHTML = (['warrior', 'archer', 'mage'] as UnitType[]).map((type) => {
    const level = levels[type];
    const cost = 70 + level * 55;
    const maxed = level >= 5;
    return `
      <article class="dd-upgrade-item">
        <div class="dd-unit-symbol ${type}">${UNIT_META[type].symbol}</div>
        <div class="dd-upgrade-copy">
          <strong>${UNIT_META[type].name} <em>Lv.${level}</em></strong>
          <span>${type === 'warrior' ? '前排顶线' : type === 'archer' ? '远程单体' : '范围群伤'}</span>
        </div>
        <button class="dd-btn dd-upgrade-btn" data-upgrade="${type}" ${maxed || gold < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `升级 ${cost}`}
        </button>
      </article>
    `;
  }).join('');

  upgradePanel.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => upgrade(button.dataset.upgrade as UnitType));
  });
}

function render(): void {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawBases();
  drawFighters();
  drawEffects();
  drawCurrentStroke();
}

function drawBackground(): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#202d39');
  gradient.addColorStop(0.62, '#33464a');
  gradient.addColorStop(1, '#21302f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(109, 174, 219, .07)';
  ctx.fillRect(0, TOP_PLAY_Y, DEPLOY_LIMIT_X, BOTTOM_PLAY_Y - TOP_PLAY_Y);
  ctx.strokeStyle = 'rgba(135, 202, 244, .34)';
  ctx.setLineDash([8, 9]);
  ctx.beginPath();
  ctx.moveTo(DEPLOY_LIMIT_X, TOP_PLAY_Y);
  ctx.lineTo(DEPLOY_LIMIT_X, BOTTOM_PLAY_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.font = '700 14px system-ui';
  ctx.fillText('召唤区：直接画 ○ △ □', 92, TOP_PLAY_Y + 25);

  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  for (let y = TOP_PLAY_Y + 52; y < BOTTOM_PLAY_Y; y += 72) {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(WIDTH - 70, y);
    ctx.stroke();
  }
}

function drawBases(): void {
  drawBase(PLAYER_BASE_X, '#6eb8e7', true);
  drawBase(ENEMY_BASE_X, '#e27272', false);
}

function drawBase(x: number, color: string, left: boolean): void {
  const y = HEIGHT * 0.54;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,14,18,.7)';
  ctx.fillRect(-28, -65, 56, 130);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.82;
  ctx.fillRect(-20, -50, 40, 100);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0e141a';
  ctx.beginPath();
  if (left) {
    ctx.moveTo(20, -50); ctx.lineTo(41, -33); ctx.lineTo(20, -18);
  } else {
    ctx.moveTo(-20, -50); ctx.lineTo(-41, -33); ctx.lineTo(-20, -18);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFighters(): void {
  for (const fighter of fighters) {
    const color = fighter.side === 'player' ? '#9bd3f4' : '#f09a9a';
    ctx.save();
    ctx.translate(fighter.x, fighter.y);

    if (fighter.side === 'player') drawPlayerShape(fighter, color);
    else drawEnemyShape(fighter, color);

    const barWidth = fighter.size * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-barWidth / 2, -fighter.size - 12, barWidth, 4);
    ctx.fillStyle = fighter.side === 'player' ? '#77d29b' : '#e67777';
    ctx.fillRect(-barWidth / 2, -fighter.size - 12, barWidth * Math.max(0, fighter.hp / fighter.maxHp), 4);
    ctx.restore();
  }
}

function drawPlayerShape(fighter: Fighter, color: string): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = 'rgba(12,18,24,.82)';
  ctx.lineWidth = 3;
  const size = fighter.size;
  if (fighter.type === 'mage') {
    ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size, 1); ctx.lineTo(size + 15, -10); ctx.stroke();
  } else if (fighter.type === 'archer') {
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size, size); ctx.lineTo(-size, size); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(size + 4, 0, 11, -1.2, 1.2); ctx.stroke();
  } else {
    ctx.fillRect(-size, -size, size * 2, size * 2); ctx.strokeRect(-size, -size, size * 2, size * 2);
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(size + 14, -11); ctx.stroke();
  }
}

function drawEnemyShape(fighter: Fighter, color: string): void {
  const size = fighter.size;
  ctx.fillStyle = fighter.kind === 'boss' ? '#7b2530' : '#42272a';
  ctx.strokeStyle = color;
  ctx.lineWidth = fighter.kind === 'boss' ? 4 : 3;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(-size * 0.45, -4, 4, 4);
  ctx.fillRect(size * 0.18, -4, 4, 4);
}

function drawEffects(): void {
  for (const effect of effects) {
    const alpha = Math.max(0, effect.life / effect.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.side === 'player' ? '#a9dcff' : '#ffaaaa';
    ctx.fillStyle = effect.side === 'player' ? 'rgba(155,211,244,.25)' : 'rgba(240,154,154,.25)';
    ctx.lineWidth = 3;
    if (effect.kind === 'blast' || effect.kind === 'base-hit') {
      ctx.beginPath(); ctx.arc(effect.to.x, effect.to.y, effect.radius * (1.15 - alpha * 0.15), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(effect.from.x, effect.from.y); ctx.lineTo(effect.to.x, effect.to.y); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCurrentStroke(): void {
  if (strokePoints.length < 2) return;
  ctx.save();
  ctx.strokeStyle = '#ffd988';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,210,110,.55)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
  for (let i = 1; i < strokePoints.length; i += 1) ctx.lineTo(strokePoints[i].x, strokePoints[i].y);
  ctx.stroke();
  ctx.restore();
}

function classifyStroke(points: Point[]): UnitType | null {
  if (points.length < 8) return null;
  const bounds = getBounds(points);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 24 || height < 24) return null;

  const closed = distance(points[0], points[points.length - 1]) < Math.max(width, height) * 0.36;
  if (!closed) return null;

  const simplified = simplify(points, Math.max(7, Math.min(width, height) * 0.075));
  const vertices = normalizedVertices(simplified);
  const ratio = width / Math.max(1, height);

  if (vertices <= 3) return 'archer';
  if (vertices >= 5 || ratio < 0.72 || ratio > 1.38) return 'mage';

  const circularity = estimateCircularity(points, bounds);
  if (circularity > 0.77) return 'mage';
  return 'warrior';
}

function getBounds(points: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];
  const result: Point[] = [points[0]];
  let anchor = points[0];
  for (let i = 1; i < points.length - 1; i += 1) {
    if (distance(anchor, points[i]) >= tolerance) {
      result.push(points[i]);
      anchor = points[i];
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function normalizedVertices(points: Point[]): number {
  if (points.length < 3) return points.length;
  let corners = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1]; const b = points[i]; const c = points[i + 1];
    const angle1 = Math.atan2(a.y - b.y, a.x - b.x);
    const angle2 = Math.atan2(c.y - b.y, c.x - b.x);
    let diff = Math.abs(angle1 - angle2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 2.35) corners += 1;
  }
  return Math.max(2, corners + 1);
}

function estimateCircularity(points: Point[], bounds: ReturnType<typeof getBounds>): number {
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const radii = points.map((p) => distance(p, center));
  const mean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  if (mean <= 0) return 0;
  const variance = radii.reduce((sum, value) => sum + Math.abs(value - mean), 0) / radii.length;
  return Math.max(0, 1 - variance / mean);
}

function strokeCentroid(points: Point[]): Point {
  const bounds = getBounds(points);
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

function canvasPoint(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (gameOver) return;
  const p = canvasPoint(event);
  if (p.x > DEPLOY_LIMIT_X || p.y < TOP_PLAY_Y || p.y > BOTTOM_PLAY_Y) {
    showToast('请在左侧亮色召唤区画兵', 'bad');
    return;
  }
  drawing = true;
  strokePoints = [p];
  canvas.setPointerCapture(event.pointerId);
  recognitionText.textContent = '识别中…';
});

canvas.addEventListener('pointermove', (event) => {
  if (!drawing) return;
  const p = canvasPoint(event);
  strokePoints.push({
    x: clamp(p.x, PLAYER_BASE_X + 28, DEPLOY_LIMIT_X - 4),
    y: clamp(p.y, TOP_PLAY_Y + 4, BOTTOM_PLAY_Y - 4)
  });
});

function finishStroke(event: PointerEvent): void {
  if (!drawing) return;
  drawing = false;
  try { canvas.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
  const points = [...strokePoints];
  strokePoints = [];
  const type = classifyStroke(points);
  if (!type) {
    recognitionText.textContent = '没认出来，再画一次';
    showToast('尽量闭合地画 ○ △ □', 'bad');
    return;
  }
  spawnPlayerSquad(type, strokeCentroid(points));
}

canvas.addEventListener('pointerup', finishStroke);
canvas.addEventListener('pointercancel', finishStroke);

startBattleButton.addEventListener('click', startBattle);
restartBattleButton.addEventListener('click', restartBattle);

function showToast(message: string, tone: 'good' | 'bad'): void {
  toast.textContent = message;
  toast.className = `dd-toast is-show ${tone}`;
  if (toastTimer !== null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.className = 'dd-toast'; }, 1250);
}

function point(fighter: Fighter): Point { return { x: fighter.x, y: fighter.y }; }
function distance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function randomBetween(min: number, max: number): number { return min + Math.random() * (max - min); }

let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

renderUpgradePanel();
updateUi();
requestAnimationFrame(frame);
