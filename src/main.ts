import './style.css';
import { catSvg } from './game/catSvg';
import { levels, type CatVariant, type LevelConfig } from './game/levels';

const appNode = document.querySelector<HTMLDivElement>('#app');
if (!appNode) throw new Error('Missing #app root');
const app: HTMLDivElement = appNode;

const STORAGE_KEY = 'find-that-cat:meta:v2';
const LEGACY_KEY = 'find-that-cat:progress:v1';
const RUN_LENGTH = 10;

const CAT_ROSTER: Array<{ id: string; name: string; variant: CatVariant; note: string }> = [
  { id: 'juzi', name: '橘子', variant: 'normal', note: '第一位入住猫窝的居民' },
  { id: 'meiqiu', name: '煤球', variant: 'dark-fur', note: '喜欢躲在最暗的角落' },
  { id: 'naitang', name: '奶糖', variant: 'light-fur', note: '毛色像晒过太阳的奶油' },
  { id: 'lanmei', name: '蓝莓', variant: 'blue-left-eye', note: '有一只特别醒目的蓝眼睛' },
  { id: 'huajuan', name: '花卷', variant: 'pink-left-ear', note: '左耳总是粉粉的' },
  { id: 'doubao', name: '豆包', variant: 'cheek-dot-left', note: '脸上有一颗小小的痣' },
  { id: 'xiaohu', name: '小虎', variant: 'four-stripes', note: '额头纹路特别整齐' },
  { id: 'baiwei', name: '白尾', variant: 'white-tail-tip', note: '尾巴尖像蘸了牛奶' }
];

const HOUSE_NAMES = ['纸箱', '小猫窝', '温暖猫房', '猫咖', '猫咪公寓'];
const HOUSE_COSTS = [120, 250, 450, 700];

type MetaProgress = {
  catFood: number;
  houseLevel: number;
  unlockedCats: string[];
  totalRuns: number;
  totalFinds: number;
  bestStage: number;
  bestStreak: number;
};

type RunState = {
  stages: LevelConfig[];
  index: number;
  targetIndex: number;
  cells: CatVariant[];
  mistakes: number;
  maxMistakes: number;
  streak: number;
  bestStreak: number;
  hintTokens: number;
  food: number;
  streakFoodBonus: number;
  bonusPerFind: number;
  startedAt: number;
  locked: boolean;
};

type UpgradeId = 'extra-slot' | 'clear-mistakes' | 'cat-eye' | 'combo-food';

type Upgrade = {
  id: UpgradeId;
  icon: string;
  title: string;
  description: string;
};

const UPGRADES: Upgrade[] = [
  { id: 'extra-slot', icon: '❤️', title: '更稳一点', description: '失误槽 +1，并清除 1 个失误' },
  { id: 'clear-mistakes', icon: '🧹', title: '重新集中', description: '立刻清除最多 2 个失误' },
  { id: 'cat-eye', icon: '👁️', title: '猫眼', description: '获得 1 次免费提示' },
  { id: 'combo-food', icon: '🐟', title: '连击奖励', description: '之后每次找对额外 +3 猫粮' }
];

let meta = loadMeta();
let run: RunState | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function track(event: string, data: Record<string, unknown> = {}): void {
  console.info('[analytics]', event, data);
}

function loadMeta(): MetaProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<MetaProgress> | null;
    if (saved) {
      const unlocked = Array.isArray(saved.unlockedCats) ? saved.unlockedCats.filter((id) => CAT_ROSTER.some((cat) => cat.id === id)) : [];
      return {
        catFood: Math.max(0, Math.round(saved.catFood ?? 0)),
        houseLevel: clamp(Math.round(saved.houseLevel ?? 1), 1, HOUSE_NAMES.length),
        unlockedCats: unlocked.length ? unlocked : ['juzi'],
        totalRuns: Math.max(0, Math.round(saved.totalRuns ?? 0)),
        totalFinds: Math.max(0, Math.round(saved.totalFinds ?? 0)),
        bestStage: clamp(Math.round(saved.bestStage ?? 0), 0, RUN_LENGTH),
        bestStreak: Math.max(0, Math.round(saved.bestStreak ?? 0))
      };
    }
  } catch {
    // fall through to migration/default
  }

  let legacyWins = 0;
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}') as { totalWins?: number };
    legacyWins = Math.max(0, Math.round(legacy.totalWins ?? 0));
  } catch {
    legacyWins = 0;
  }

  return {
    catFood: Math.min(80, legacyWins * 2),
    houseLevel: 1,
    unlockedCats: ['juzi'],
    totalRuns: 0,
    totalFinds: legacyWins,
    bestStage: 0,
    bestStreak: 0
  };
}

function saveMeta(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

function houseBenefits(level = meta.houseLevel): { slots: number; hints: number; bonusPerFind: number } {
  return {
    slots: level >= 3 ? 6 : 5,
    hints: level >= 2 ? 2 : 1,
    bonusPerFind: level >= 4 ? 2 : 0
  };
}

function houseBenefitText(level = meta.houseLevel): string {
  if (level === 1) return '每局 5 个失误槽 · 1 次提示';
  if (level === 2) return '每局 5 个失误槽 · 2 次提示';
  if (level === 3) return '每局 6 个失误槽 · 2 次提示';
  if (level === 4) return '每局 6 个失误槽 · 每次找对额外 +2 猫粮';
  return '最高等级 · 6 个失误槽 · 2 次提示 · 猫粮加成';
}

function currentHouseName(): string {
  return HOUSE_NAMES[meta.houseLevel - 1];
}

function renderHome(): void {
  run = null;
  const featured = CAT_ROSTER.find((cat) => meta.unlockedCats.includes(cat.id)) ?? CAT_ROSTER[0];
  const nextCost = meta.houseLevel < HOUSE_NAMES.length ? HOUSE_COSTS[meta.houseLevel - 1] : null;
  const canUpgrade = nextCost !== null && meta.catFood >= nextCost;
  const nextCat = CAT_ROSTER.find((cat) => !meta.unlockedCats.includes(cat.id));

  app.innerHTML = `
    <main class="screen home-screen v2-home">
      <section class="home-hero-card">
        <div class="home-house-badge">🏠 ${currentHouseName()} · Lv.${meta.houseLevel}</div>
        <div class="hero-cat">${catSvg(featured.variant)}</div>
        <p class="eyebrow">10关一局 · 收集猫咪</p>
        <h1>找出那只猫</h1>
        <p class="subtitle">别只拼眼力。保住失误槽，叠连击，把新猫带回家。</p>
      </section>

      <section class="meta-strip">
        <div><strong>🐟 ${meta.catFood}</strong><span>猫粮</span></div>
        <div><strong>${meta.unlockedCats.length}/${CAT_ROSTER.length}</strong><span>猫咪图鉴</span></div>
        <div><strong>${meta.bestStreak}</strong><span>最高连击</span></div>
      </section>

      <button class="btn btn-primary btn-large main-cta" data-action="start-run">
        开始一局 · 10个挑战
        <small>通关可带回${nextCat ? `「${nextCat.name}」` : '额外猫粮'}</small>
      </button>

      <section class="house-card">
        <div class="house-copy">
          <span class="card-kicker">猫窝成长</span>
          <strong>${currentHouseName()} · Lv.${meta.houseLevel}</strong>
          <p>${houseBenefitText()}</p>
        </div>
        ${nextCost === null
          ? '<div class="house-max">MAX</div>'
          : `<button class="btn ${canUpgrade ? 'btn-primary' : 'btn-ghost'} house-upgrade" data-action="upgrade-house" ${canUpgrade ? '' : 'disabled'}>升级<br/><small>🐟 ${nextCost}</small></button>`}
      </section>

      <section class="collection-card">
        <div class="section-title-row">
          <div><span class="card-kicker">猫咪图鉴</span><strong>已经入住 ${meta.unlockedCats.length} 只</strong></div>
          <button class="text-btn" data-action="collection">查看全部 ›</button>
        </div>
        <div class="cat-preview-row">
          ${CAT_ROSTER.slice(0, 5).map((cat) => `
            <div class="mini-cat ${meta.unlockedCats.includes(cat.id) ? '' : 'is-locked'}" title="${meta.unlockedCats.includes(cat.id) ? cat.name : '未解锁'}">
              ${meta.unlockedCats.includes(cat.id) ? catSvg(cat.variant) : '<span>?</span>'}
            </div>
          `).join('')}
        </div>
      </section>

      <p class="home-tip">点错会占一个失误槽；每过 2 关可以选一次局内升级。</p>
      <p class="version">Cat V2 · Retention Prototype</p>
    </main>
  `;

  app.querySelector('[data-action="start-run"]')?.addEventListener('click', startRun);
  app.querySelector('[data-action="upgrade-house"]')?.addEventListener('click', upgradeHouse);
  app.querySelector('[data-action="collection"]')?.addEventListener('click', renderCollection);
}

function upgradeHouse(): void {
  if (meta.houseLevel >= HOUSE_NAMES.length) return;
  const cost = HOUSE_COSTS[meta.houseLevel - 1];
  if (meta.catFood < cost) return;
  meta.catFood -= cost;
  meta.houseLevel += 1;
  saveMeta();
  track('house_upgrade', { level: meta.houseLevel, cost });
  renderHome();
}

function renderCollection(): void {
  app.innerHTML = `
    <main class="screen collection-screen">
      <header class="simple-header">
        <button class="icon-btn" data-action="home" aria-label="返回">‹</button>
        <div><span class="card-kicker">COLLECTION</span><h2>猫咪图鉴</h2></div>
        <div class="collection-count">${meta.unlockedCats.length}/${CAT_ROSTER.length}</div>
      </header>
      <section class="collection-grid">
        ${CAT_ROSTER.map((cat) => {
          const unlocked = meta.unlockedCats.includes(cat.id);
          return `
            <article class="collection-item ${unlocked ? '' : 'is-locked'}">
              <div class="collection-cat">${unlocked ? catSvg(cat.variant) : '<span class="lock-mark">?</span>'}</div>
              <strong>${unlocked ? cat.name : '？？？'}</strong>
              <p>${unlocked ? cat.note : '完成整局挑战后会有新猫入住'}</p>
            </article>
          `;
        }).join('')}
      </section>
    </main>
  `;
  app.querySelector('[data-action="home"]')?.addEventListener('click', renderHome);
}

function startRun(): void {
  const benefits = houseBenefits();
  run = {
    stages: buildRunStages(),
    index: 0,
    targetIndex: 0,
    cells: [],
    mistakes: 0,
    maxMistakes: benefits.slots,
    streak: 0,
    bestStreak: 0,
    hintTokens: benefits.hints,
    food: 0,
    streakFoodBonus: 0,
    bonusPerFind: benefits.bonusPerFind,
    startedAt: performance.now(),
    locked: false
  };
  meta.totalRuns += 1;
  saveMeta();
  track('run_start', { house_level: meta.houseLevel, stage_ids: run.stages.map((stage) => stage.id) });
  beginStage();
}

function buildRunStages(): LevelConfig[] {
  const easy = shuffleCopy(levels.slice(0, 10)).slice(0, 3);
  const medium = shuffleCopy(levels.slice(10, 20)).slice(0, 4);
  const hard = shuffleCopy(levels.slice(20, 30)).slice(0, 3);
  return [...easy, ...medium, ...hard];
}

function shuffleCopy<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function playableLevel(source: LevelConfig): LevelConfig {
  return {
    ...source,
    rows: Math.min(source.rows, 9),
    cols: Math.min(source.cols, 9)
  };
}

function beginStage(): void {
  if (!run) return;
  const level = playableLevel(run.stages[run.index]);
  run.targetIndex = Math.floor(Math.random() * (level.rows * level.cols));
  run.cells = buildCells(level, run.targetIndex);
  run.locked = false;
  renderStage(level);
  track('stage_start', { run_stage: run.index + 1, source_level: level.id, rows: level.rows, cols: level.cols });
}

function buildCells(level: LevelConfig, targetIndex: number): CatVariant[] {
  const total = level.rows * level.cols;
  const cells: CatVariant[] = Array.from({ length: total }, () => 'normal');
  cells[targetIndex] = level.targetVariant;

  if (!level.decoyVariants?.length || !level.decoyRatio) return cells;
  const candidates = Array.from({ length: total }, (_, index) => index).filter((index) => index !== targetIndex);
  const shuffled = shuffleCopy(candidates);
  const count = Math.min(shuffled.length, Math.floor((total - 1) * level.decoyRatio));
  for (let i = 0; i < count; i += 1) {
    cells[shuffled[i]] = level.decoyVariants[i % level.decoyVariants.length];
  }
  return cells;
}

function renderStage(level: LevelConfig): void {
  if (!run) return;
  app.innerHTML = `
    <main class="screen game-screen v2-game">
      <header class="run-header">
        <button class="icon-btn" data-action="quit" aria-label="退出本局">‹</button>
        <div class="run-progress-block">
          <div class="run-progress-copy"><span>本局进度</span><strong>${run.index + 1} / ${RUN_LENGTH}</strong></div>
          <div class="run-progress-dots">${Array.from({ length: RUN_LENGTH }, (_, i) => `<i class="${i < run.index ? 'done' : i === run.index ? 'active' : ''}"></i>`).join('')}</div>
        </div>
        <div class="run-food">🐟 <strong>${run.food}</strong></div>
      </header>

      <section class="run-status-card">
        <div class="mistake-block">
          <span>失误槽</span>
          <div class="mistake-slots" id="mistakeSlots">${renderMistakeSlots()}</div>
        </div>
        <div class="streak-block">
          <span>连击</span>
          <strong id="streakValue">🔥 ${run.streak}</strong>
        </div>
        <button class="hint-chip" data-action="hint" ${run.hintTokens <= 0 ? 'disabled' : ''}>💡 ${run.hintTokens}</button>
      </section>

      <section class="prompt-card v2-prompt">
        <span class="prompt-label">找出唯一不同</span>
        <h2>${level.targetPrompt}</h2>
        <p>这关没有倒计时，别乱点。</p>
      </section>

      <section class="cat-grid v2-grid" id="catGrid" style="--cols:${level.cols}" aria-label="猫咪搜索区域">
        ${run.cells.map((variant, index) => `
          <button class="cat-tile" data-index="${index}" aria-label="第 ${index + 1} 只猫">
            ${catSvg(variant)}
          </button>
        `).join('')}
      </section>

      <div class="feedback" id="feedback" aria-live="polite"></div>
    </main>
  `;

  app.querySelector('[data-action="quit"]')?.addEventListener('click', confirmQuitRun);
  app.querySelector('[data-action="hint"]')?.addEventListener('click', useHint);
  app.querySelector('#catGrid')?.addEventListener('click', onGridClick);
}

function renderMistakeSlots(): string {
  if (!run) return '';
  return Array.from({ length: run.maxMistakes }, (_, index) => `<i class="${index < run.mistakes ? 'filled' : ''}">${index < run.mistakes ? '✕' : ''}</i>`).join('');
}

function refreshRunHud(): void {
  if (!run) return;
  const slots = app.querySelector<HTMLElement>('#mistakeSlots');
  const streak = app.querySelector<HTMLElement>('#streakValue');
  if (slots) slots.innerHTML = renderMistakeSlots();
  if (streak) streak.textContent = `🔥 ${run.streak}`;
}

function onGridClick(event: Event): void {
  if (!run || run.locked) return;
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('.cat-tile');
  if (!button) return;
  const index = Number(button.dataset.index);

  if (index === run.targetIndex) {
    handleCorrect(button);
    return;
  }

  run.mistakes += 1;
  run.streak = 0;
  button.classList.remove('is-wrong');
  void button.offsetWidth;
  button.classList.add('is-wrong');
  window.setTimeout(() => button.classList.remove('is-wrong'), 420);
  refreshRunHud();
  showFeedback(`失误 ${run.mistakes}/${run.maxMistakes}`, 'bad');
  track('wrong_tap', { run_stage: run.index + 1, mistakes: run.mistakes, max_mistakes: run.maxMistakes });

  if (run.mistakes >= run.maxMistakes) failRun();
}

function handleCorrect(button: HTMLButtonElement): void {
  if (!run) return;
  run.locked = true;
  run.streak += 1;
  run.bestStreak = Math.max(run.bestStreak, run.streak);
  const streakBonus = Math.min(run.streak, 5) * 2;
  const reward = 8 + streakBonus + run.streakFoodBonus + run.bonusPerFind;
  run.food += reward;
  meta.totalFinds += 1;
  button.classList.add('is-correct');
  refreshRunHud();
  showFeedback(`找到！ +${reward} 🐟`, 'good');
  track('stage_complete', { run_stage: run.index + 1, streak: run.streak, reward, mistakes: run.mistakes });

  window.setTimeout(() => {
    if (!run) return;
    run.index += 1;
    meta.bestStage = Math.max(meta.bestStage, run.index);
    meta.bestStreak = Math.max(meta.bestStreak, run.bestStreak);
    saveMeta();

    if (run.index >= RUN_LENGTH) {
      completeRun();
      return;
    }

    if ([2, 4, 6, 8].includes(run.index)) {
      renderUpgradeChoice();
      return;
    }

    beginStage();
  }, 650);
}

function useHint(): void {
  if (!run || run.locked || run.hintTokens <= 0) return;
  run.hintTokens -= 1;
  const target = app.querySelector<HTMLButtonElement>(`.cat-tile[data-index="${run.targetIndex}"]`);
  const hintButton = app.querySelector<HTMLButtonElement>('[data-action="hint"]');
  if (hintButton) {
    hintButton.textContent = `💡 ${run.hintTokens}`;
    hintButton.disabled = run.hintTokens <= 0;
  }
  target?.classList.add('is-hint');
  window.setTimeout(() => target?.classList.remove('is-hint'), 1400);
  track('hint_used', { run_stage: run.index + 1, remaining: run.hintTokens });
}

function renderUpgradeChoice(): void {
  if (!run) return;
  run.locked = true;
  const choices = shuffleCopy(UPGRADES).slice(0, 3);
  app.innerHTML = `
    <main class="screen upgrade-screen">
      <section class="upgrade-intro">
        <span class="card-kicker">完成 ${run.index} / ${RUN_LENGTH}</span>
        <h1>选一个升级</h1>
        <p>这次选择只在本局生效。</p>
      </section>
      <section class="upgrade-choice-grid">
        ${choices.map((upgrade) => `
          <button class="upgrade-choice" data-upgrade="${upgrade.id}">
            <span class="upgrade-icon">${upgrade.icon}</span>
            <strong>${upgrade.title}</strong>
            <p>${upgrade.description}</p>
          </button>
        `).join('')}
      </section>
      <div class="upgrade-run-summary">
        <span>当前失误 ${run.mistakes}/${run.maxMistakes}</span>
        <span>🔥 ${run.streak} 连击</span>
        <span>🐟 ${run.food}</span>
      </div>
    </main>
  `;

  app.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => applyUpgrade(button.dataset.upgrade as UpgradeId));
  });
}

function applyUpgrade(id: UpgradeId): void {
  if (!run) return;
  if (id === 'extra-slot') {
    run.maxMistakes += 1;
    run.mistakes = Math.max(0, run.mistakes - 1);
  }
  if (id === 'clear-mistakes') run.mistakes = Math.max(0, run.mistakes - 2);
  if (id === 'cat-eye') run.hintTokens += 1;
  if (id === 'combo-food') run.streakFoodBonus += 3;
  track('upgrade_pick', { id, run_stage: run.index, mistakes: run.mistakes, max_mistakes: run.maxMistakes });
  beginStage();
}

function confirmQuitRun(): void {
  if (!run) return;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="modal-card">
      <div class="modal-emoji">🐾</div>
      <h2>退出这一局？</h2>
      <p>本局猫粮不会带回猫窝。</p>
      <button class="btn btn-ghost" data-action="stay">继续找</button>
      <button class="btn btn-danger" data-action="leave">退出</button>
    </section>
  `;
  app.append(modal);
  modal.querySelector('[data-action="stay"]')?.addEventListener('click', () => modal.remove());
  modal.querySelector('[data-action="leave"]')?.addEventListener('click', renderHome);
}

function failRun(): void {
  if (!run || run.locked) return;
  run.locked = true;
  const savedFood = Math.floor(run.food * 0.4);
  meta.catFood += savedFood;
  meta.bestStage = Math.max(meta.bestStage, run.index);
  meta.bestStreak = Math.max(meta.bestStreak, run.bestStreak);
  saveMeta();
  track('run_failed', { completed: run.index, food_earned: run.food, food_saved: savedFood, best_streak: run.bestStreak });

  const snapshot = { completed: run.index, savedFood, bestStreak: run.bestStreak };
  run = null;
  app.innerHTML = `
    <main class="screen result-screen">
      <section class="result-card fail-card">
        <div class="result-emoji">🙀</div>
        <span class="card-kicker">本局结束</span>
        <h1>差一点</h1>
        <p>完成 ${snapshot.completed} / ${RUN_LENGTH} 个挑战</p>
        <div class="result-stats">
          <div><strong>🔥 ${snapshot.bestStreak}</strong><span>最高连击</span></div>
          <div><strong>🐟 ${snapshot.savedFood}</strong><span>带回猫粮</span></div>
        </div>
        <p class="result-note">失败也会带回 40% 猫粮，下次可以用来升级猫窝。</p>
        <button class="btn btn-primary btn-large" data-action="again">再来一局</button>
        <button class="btn btn-ghost" data-action="home">回猫窝</button>
      </section>
    </main>
  `;
  app.querySelector('[data-action="again"]')?.addEventListener('click', startRun);
  app.querySelector('[data-action="home"]')?.addEventListener('click', renderHome);
}

function completeRun(): void {
  if (!run) return;
  const finished = run;
  const clearBonus = 60;
  const totalReward = finished.food + clearBonus;
  meta.catFood += totalReward;
  meta.bestStage = RUN_LENGTH;
  meta.bestStreak = Math.max(meta.bestStreak, finished.bestStreak);

  const newCat = CAT_ROSTER.find((cat) => !meta.unlockedCats.includes(cat.id));
  if (newCat) meta.unlockedCats.push(newCat.id);
  else meta.catFood += 120;
  saveMeta();

  const elapsedSec = Math.round((performance.now() - finished.startedAt) / 1000);
  track('run_complete', { food: totalReward, best_streak: finished.bestStreak, new_cat: newCat?.id ?? null, elapsed_sec: elapsedSec });
  run = null;

  app.innerHTML = `
    <main class="screen result-screen">
      <section class="result-card win-card">
        <div class="result-emoji">🎉</div>
        <span class="card-kicker">10 / 10 通关</span>
        <h1>${newCat ? '有新猫入住！' : '完美通关！'}</h1>
        ${newCat ? `
          <div class="new-cat-reveal">${catSvg(newCat.variant)}</div>
          <h2>「${newCat.name}」</h2>
          <p>${newCat.note}</p>
        ` : '<p>图鉴已经集齐，本局额外获得 120 猫粮。</p>'}
        <div class="result-stats">
          <div><strong>🔥 ${finished.bestStreak}</strong><span>最高连击</span></div>
          <div><strong>🐟 ${totalReward}</strong><span>本局收入</span></div>
        </div>
        <button class="btn btn-primary btn-large" data-action="home">带回猫窝</button>
        <button class="btn btn-ghost" data-action="again">马上再来一局</button>
      </section>
    </main>
  `;
  app.querySelector('[data-action="home"]')?.addEventListener('click', renderHome);
  app.querySelector('[data-action="again"]')?.addEventListener('click', startRun);
}

function showFeedback(message: string, tone: 'good' | 'bad'): void {
  const feedback = app.querySelector<HTMLElement>('#feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `feedback ${tone} is-visible`;
  window.setTimeout(() => feedback.classList.remove('is-visible'), 700);
}

renderHome();
