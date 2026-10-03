import './style.css';
import { adService } from './services/adService';
import { catSvg } from './game/catSvg';
import { getLevel, levels, type CatVariant, type LevelConfig } from './game/levels';

const appNode = document.querySelector<HTMLDivElement>('#app');
if (!appNode) throw new Error('Missing #app root');
const app: HTMLDivElement = appNode;

const STORAGE_KEY = 'find-that-cat:progress:v1';
const TOTAL_LEVELS = levels.length;

type Progress = {
  highestUnlocked: number;
  totalWins: number;
  completed: boolean;
};

type RoundState = {
  level: LevelConfig;
  targetIndex: number;
  remainingMs: number;
  lastTickAt: number;
  timerId: number | null;
  finished: boolean;
  hintUsed: boolean;
  extraTimeUsed: boolean;
  continueUsed: boolean;
  startedAt: number;
};

let progress = loadProgress();
let round: RoundState | null = null;
let adBusy = false;

function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Progress>;
    return {
      highestUnlocked: clamp(Math.round(parsed.highestUnlocked ?? 1), 1, TOTAL_LEVELS),
      totalWins: Math.max(0, Math.round(parsed.totalWins ?? 0)),
      completed: Boolean(parsed.completed)
    };
  } catch {
    return { highestUnlocked: 1, totalWins: 0, completed: false };
  }
}

function saveProgress(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function track(event: string, data: Record<string, unknown> = {}): void {
  console.info('[analytics]', event, data);
}

function renderHome(): void {
  stopTimer();
  round = null;
  const primaryLabel = progress.completed ? '再来一轮' : `继续挑战 · Lv.${progress.highestUnlocked}`;

  app.innerHTML = `
    <main class="screen home-screen">
      <section class="brand-card">
        <div class="hero-cat">${catSvg('normal')}</div>
        <p class="eyebrow">眼力挑战</p>
        <h1>找出那只猫</h1>
        <p class="subtitle">一群猫里，只有一只不一样。</p>
      </section>

      <section class="home-stats" aria-label="游戏进度">
        <div><strong>${progress.highestUnlocked}</strong><span>最高关卡</span></div>
        <div><strong>${progress.totalWins}</strong><span>累计找到</span></div>
        <div><strong>${TOTAL_LEVELS}</strong><span>V1 总关数</span></div>
      </section>

      <section class="home-actions">
        <button class="btn btn-primary btn-large" data-action="continue">${primaryLabel}</button>
        ${progress.highestUnlocked > 1 || progress.completed ? '<button class="btn btn-ghost" data-action="restart-all">从第 1 关开始</button>' : ''}
      </section>

      <p class="home-tip">点错会扣时间。找不到时可以用一次提示。</p>
      <p class="version">V1 · Browser MVP</p>
    </main>
  `;

  app.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
    track('game_start', { level: progress.completed ? 1 : progress.highestUnlocked, source: 'home' });
    startLevel(progress.completed ? 1 : progress.highestUnlocked);
  });

  app.querySelector('[data-action="restart-all"]')?.addEventListener('click', () => {
    track('game_start', { level: 1, source: 'restart_all' });
    startLevel(1);
  });
}

function startLevel(levelId: number): void {
  stopTimer();
  const level = getLevel(levelId);
  const targetIndex = randomInt(level.rows * level.cols);
  const cells = buildCells(level, targetIndex);

  round = {
    level,
    targetIndex,
    remainingMs: level.timeLimitSec * 1000,
    lastTickAt: performance.now(),
    timerId: null,
    finished: false,
    hintUsed: false,
    extraTimeUsed: false,
    continueUsed: false,
    startedAt: performance.now()
  };

  app.innerHTML = `
    <main class="screen game-screen">
      <header class="topbar">
        <button class="icon-btn" data-action="home" aria-label="返回首页">‹</button>
        <div class="level-block">
          <span>LEVEL</span>
          <strong>${level.id}<small> / ${TOTAL_LEVELS}</small></strong>
        </div>
        <div class="timer" id="timer" aria-live="polite">${formatTime(round.remainingMs)}</div>
      </header>

      <div class="level-progress"><span style="width:${(level.id / TOTAL_LEVELS) * 100}%"></span></div>

      <section class="prompt-card">
        <span class="prompt-label">这一关</span>
        <h2>${level.targetPrompt}</h2>
        <p>点错一次 -${level.wrongPenaltySec} 秒</p>
      </section>

      <section class="cat-grid" id="catGrid" style="--cols:${level.cols}" aria-label="猫咪搜索区域">
        ${cells.map((variant, index) => `
          <button class="cat-tile" data-index="${index}" aria-label="第 ${index + 1} 只猫">
            ${catSvg(variant)}
          </button>
        `).join('')}
      </section>

      <section class="assist-row">
        <button class="btn btn-assist" data-action="hint">💡 提示</button>
        <button class="btn btn-assist" data-action="extra-time">📺 +10 秒</button>
      </section>

      <div class="feedback" id="feedback" aria-live="polite"></div>
    </main>
  `;

  app.querySelector('[data-action="home"]')?.addEventListener('click', () => {
    track('level_exit', { level: level.id, remaining_ms: round?.remainingMs ?? 0 });
    renderHome();
  });

  app.querySelector('#catGrid')?.addEventListener('click', onGridClick);
  app.querySelector('[data-action="hint"]')?.addEventListener('click', useHint);
  app.querySelector('[data-action="extra-time"]')?.addEventListener('click', useExtraTime);

  track('level_start', { level: level.id, rows: level.rows, cols: level.cols });
  startTimer();
}

function buildCells(level: LevelConfig, targetIndex: number): CatVariant[] {
  const total = level.rows * level.cols;
  const cells: CatVariant[] = Array.from({ length: total }, () => 'normal');
  cells[targetIndex] = level.targetVariant;

  if (!level.decoyVariants?.length || !level.decoyRatio) return cells;

  const available = Array.from({ length: total }, (_, index) => index).filter((index) => index !== targetIndex);
  shuffle(available);
  const count = Math.min(available.length, Math.floor((total - 1) * level.decoyRatio));

  for (let i = 0; i < count; i += 1) {
    cells[available[i]] = level.decoyVariants[i % level.decoyVariants.length];
  }

  return cells;
}

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function onGridClick(event: Event): void {
  if (!round || round.finished || adBusy) return;
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('.cat-tile');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (index === round.targetIndex) {
    handleSuccess(button);
    return;
  }

  round.remainingMs = Math.max(0, round.remainingMs - round.level.wrongPenaltySec * 1000);
  updateTimerDisplay();
  button.classList.remove('is-wrong');
  void button.offsetWidth;
  button.classList.add('is-wrong');
  window.setTimeout(() => button.classList.remove('is-wrong'), 420);
  showFeedback(`点错啦 -${round.level.wrongPenaltySec}秒`, 'bad');
  track('wrong_tap', { level: round.level.id, index, remaining_ms: Math.round(round.remainingMs) });

  if (round.remainingMs <= 0) handleTimeout();
}

function handleSuccess(button: HTMLButtonElement): void {
  if (!round) return;
  const finishedRound = round;
  finishedRound.finished = true;
  stopTimer();
  button.classList.add('is-correct');

  const elapsedMs = Math.round(performance.now() - finishedRound.startedAt);
  const completedLevel = finishedRound.level.id;
  progress.totalWins += 1;

  if (completedLevel < TOTAL_LEVELS) {
    progress.highestUnlocked = Math.max(progress.highestUnlocked, completedLevel + 1);
  } else {
    progress.highestUnlocked = TOTAL_LEVELS;
    progress.completed = true;
  }
  saveProgress();

  showFeedback('找到啦！', 'good');
  track('level_complete', { level: completedLevel, elapsed_ms: elapsedMs, remaining_ms: Math.round(finishedRound.remainingMs) });

  window.setTimeout(() => {
    if (round !== finishedRound) return;
    if (completedLevel >= TOTAL_LEVELS) {
      renderVictory();
    } else {
      startLevel(completedLevel + 1);
    }
  }, 850);
}

function renderVictory(): void {
  stopTimer();
  round = null;
  app.innerHTML = `
    <main class="screen victory-screen">
      <section class="victory-card">
        <div class="victory-icon">🏆</div>
        <p class="eyebrow">V1 通关</p>
        <h1>30 只特别的猫<br/>都被你找到了</h1>
        <p>累计找到 ${progress.totalWins} 次</p>
        <button class="btn btn-primary btn-large" data-action="again">从第 1 关再来一次</button>
        <button class="btn btn-ghost" data-action="home">回到首页</button>
      </section>
    </main>
  `;

  app.querySelector('[data-action="again"]')?.addEventListener('click', () => startLevel(1));
  app.querySelector('[data-action="home"]')?.addEventListener('click', renderHome);
  track('game_complete', { total_wins: progress.totalWins });
}

function startTimer(): void {
  if (!round || round.finished || round.timerId !== null) return;
  round.lastTickAt = performance.now();
  round.timerId = window.setInterval(tick, 100);
  updateTimerDisplay();
}

function stopTimer(): void {
  if (!round || round.timerId === null) return;
  window.clearInterval(round.timerId);
  round.timerId = null;
}

function tick(): void {
  if (!round || round.finished) return;
  const now = performance.now();
  const delta = now - round.lastTickAt;
  round.lastTickAt = now;
  round.remainingMs = Math.max(0, round.remainingMs - delta);
  updateTimerDisplay();

  if (round.remainingMs <= 0) handleTimeout();
}

function updateTimerDisplay(): void {
  if (!round) return;
  const timer = app.querySelector<HTMLElement>('#timer');
  if (!timer) return;
  timer.textContent = formatTime(round.remainingMs);
  timer.classList.toggle('is-danger', round.remainingMs <= 5000);
}

function formatTime(ms: number): string {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}

function handleTimeout(): void {
  if (!round || round.finished) return;
  stopTimer();
  round.remainingMs = 0;
  updateTimerDisplay();
  track('level_timeout', { level: round.level.id, continue_used: round.continueUsed });

  const existing = app.querySelector('.modal-backdrop');
  if (existing) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="modal-card" role="dialog" aria-modal="true" aria-label="时间到">
      <div class="modal-emoji">🙀</div>
      <h2>时间到</h2>
      <p>目标猫还藏在原来的位置。</p>
      ${round.continueUsed ? '' : '<button class="btn btn-primary" data-action="continue-ad">📺 看视频 · +10秒继续</button>'}
      <button class="btn btn-ghost" data-action="retry">重新挑战</button>
    </section>
  `;
  app.append(modal);

  modal.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
    const levelId = round?.level.id ?? 1;
    track('level_retry', { level: levelId });
    startLevel(levelId);
  });

  modal.querySelector('[data-action="continue-ad"]')?.addEventListener('click', async () => {
    if (!round || adBusy) return;
    adBusy = true;
    const rewarded = await adService.showRewarded('continue');
    adBusy = false;
    if (!round || !rewarded) return;
    round.continueUsed = true;
    round.remainingMs = 10_000;
    modal.remove();
    showFeedback('+10秒，继续！', 'good');
    track('reward_continue', { level: round.level.id });
    startTimer();
  });
}

async function useHint(): Promise<void> {
  if (!round || round.finished || round.hintUsed || adBusy) return;
  adBusy = true;
  stopTimer();
  const rewarded = await adService.showRewarded('hint');
  adBusy = false;
  if (!round || !rewarded) {
    startTimer();
    return;
  }

  round.hintUsed = true;
  const button = app.querySelector<HTMLButtonElement>(`.cat-tile[data-index="${round.targetIndex}"]`);
  const hintButton = app.querySelector<HTMLButtonElement>('[data-action="hint"]');
  hintButton?.setAttribute('disabled', 'true');
  if (hintButton) hintButton.textContent = '💡 已提示';
  button?.classList.add('is-hint');
  window.setTimeout(() => button?.classList.remove('is-hint'), 1400);
  showFeedback('注意闪动的位置', 'good');
  track('reward_hint', { level: round.level.id });
  startTimer();
}

async function useExtraTime(): Promise<void> {
  if (!round || round.finished || round.extraTimeUsed || adBusy) return;
  adBusy = true;
  stopTimer();
  const rewarded = await adService.showRewarded('extra-time');
  adBusy = false;
  if (!round || !rewarded) {
    startTimer();
    return;
  }

  round.extraTimeUsed = true;
  round.remainingMs += 10_000;
  const extraButton = app.querySelector<HTMLButtonElement>('[data-action="extra-time"]');
  extraButton?.setAttribute('disabled', 'true');
  if (extraButton) extraButton.textContent = '✓ 已加时';
  updateTimerDisplay();
  showFeedback('+10秒', 'good');
  track('reward_extra_time', { level: round.level.id });
  startTimer();
}

function showFeedback(message: string, tone: 'good' | 'bad'): void {
  const feedback = app.querySelector<HTMLElement>('#feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `feedback is-visible ${tone}`;
  window.setTimeout(() => {
    if (feedback.textContent === message) feedback.className = 'feedback';
  }, 850);
}

function showMockAdOverlay(): void {
  if (document.querySelector('#mockAdOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'mockAdOverlay';
  overlay.className = 'ad-overlay';
  overlay.innerHTML = `
    <div class="ad-card">
      <span class="ad-badge">MOCK AD</span>
      <div class="ad-spinner"></div>
      <strong>模拟激励视频</strong>
      <small>接微信广告 SDK 时只替换 AdService</small>
    </div>
  `;
  document.body.append(overlay);
}

function hideMockAdOverlay(): void {
  document.querySelector('#mockAdOverlay')?.remove();
}

window.addEventListener('mock-ad-start', showMockAdOverlay);
window.addEventListener('mock-ad-finish', hideMockAdOverlay);

renderHome();
