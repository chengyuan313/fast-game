export type CatVariant =
  | 'normal'
  | 'dark-fur'
  | 'light-fur'
  | 'closed-left-eye'
  | 'closed-right-eye'
  | 'no-left-whiskers'
  | 'no-right-whiskers'
  | 'small-left-ear'
  | 'small-right-ear'
  | 'blue-left-eye'
  | 'blue-right-eye'
  | 'two-stripes'
  | 'four-stripes'
  | 'tiny-left-pupil'
  | 'tiny-right-pupil'
  | 'pink-left-ear'
  | 'pink-right-ear'
  | 'flat-mouth'
  | 'no-nose'
  | 'left-eye-offset'
  | 'right-eye-offset'
  | 'ear-notch-left'
  | 'ear-notch-right';

export type LevelConfig = {
  id: number;
  rows: number;
  cols: number;
  targetVariant: CatVariant;
  targetPrompt: string;
  timeLimitSec: number;
  wrongPenaltySec: number;
  decoyVariants?: CatVariant[];
  decoyRatio?: number;
};

export const levels: LevelConfig[] = [
  { id: 1, rows: 4, cols: 4, targetVariant: 'dark-fur', targetPrompt: '找出颜色最深的猫', timeLimitSec: 25, wrongPenaltySec: 2 },
  { id: 2, rows: 4, cols: 4, targetVariant: 'closed-right-eye', targetPrompt: '找出闭着右眼的猫', timeLimitSec: 24, wrongPenaltySec: 2 },
  { id: 3, rows: 4, cols: 5, targetVariant: 'no-right-whiskers', targetPrompt: '找出右边没有胡须的猫', timeLimitSec: 24, wrongPenaltySec: 2 },
  { id: 4, rows: 5, cols: 5, targetVariant: 'small-left-ear', targetPrompt: '找出左耳更小的猫', timeLimitSec: 23, wrongPenaltySec: 2 },
  { id: 5, rows: 5, cols: 5, targetVariant: 'blue-right-eye', targetPrompt: '找出右眼是蓝色的猫', timeLimitSec: 22, wrongPenaltySec: 2 },
  { id: 6, rows: 5, cols: 6, targetVariant: 'two-stripes', targetPrompt: '找出额头只有两条纹的猫', timeLimitSec: 22, wrongPenaltySec: 2 },
  { id: 7, rows: 6, cols: 6, targetVariant: 'flat-mouth', targetPrompt: '找出嘴巴是平的猫', timeLimitSec: 21, wrongPenaltySec: 2 },
  { id: 8, rows: 6, cols: 6, targetVariant: 'pink-left-ear', targetPrompt: '找出左耳更粉的猫', timeLimitSec: 21, wrongPenaltySec: 2 },
  { id: 9, rows: 6, cols: 7, targetVariant: 'no-nose', targetPrompt: '找出没有鼻子的猫', timeLimitSec: 20, wrongPenaltySec: 2 },
  { id: 10, rows: 6, cols: 7, targetVariant: 'tiny-right-pupil', targetPrompt: '找出右眼瞳孔更小的猫', timeLimitSec: 20, wrongPenaltySec: 2 },

  { id: 11, rows: 7, cols: 7, targetVariant: 'no-right-whiskers', targetPrompt: '找出右边没有胡须的猫', timeLimitSec: 20, wrongPenaltySec: 2, decoyVariants: ['no-left-whiskers'], decoyRatio: 0.1 },
  { id: 12, rows: 7, cols: 7, targetVariant: 'closed-right-eye', targetPrompt: '找出闭着右眼的猫', timeLimitSec: 19, wrongPenaltySec: 2, decoyVariants: ['closed-left-eye'], decoyRatio: 0.1 },
  { id: 13, rows: 7, cols: 8, targetVariant: 'blue-right-eye', targetPrompt: '找出右眼是蓝色的猫', timeLimitSec: 19, wrongPenaltySec: 2, decoyVariants: ['blue-left-eye'], decoyRatio: 0.1 },
  { id: 14, rows: 7, cols: 8, targetVariant: 'small-left-ear', targetPrompt: '找出左耳更小的猫', timeLimitSec: 18, wrongPenaltySec: 2, decoyVariants: ['small-right-ear'], decoyRatio: 0.11 },
  { id: 15, rows: 8, cols: 8, targetVariant: 'pink-left-ear', targetPrompt: '找出左耳更粉的猫', timeLimitSec: 18, wrongPenaltySec: 2, decoyVariants: ['pink-right-ear'], decoyRatio: 0.11 },
  { id: 16, rows: 8, cols: 8, targetVariant: 'tiny-right-pupil', targetPrompt: '找出右眼瞳孔更小的猫', timeLimitSec: 17, wrongPenaltySec: 2, decoyVariants: ['tiny-left-pupil'], decoyRatio: 0.11 },
  { id: 17, rows: 8, cols: 9, targetVariant: 'ear-notch-left', targetPrompt: '找出左耳有缺口的猫', timeLimitSec: 17, wrongPenaltySec: 2, decoyVariants: ['ear-notch-right'], decoyRatio: 0.12 },
  { id: 18, rows: 8, cols: 9, targetVariant: 'right-eye-offset', targetPrompt: '找出右眼瞳孔偏外的猫', timeLimitSec: 16, wrongPenaltySec: 2, decoyVariants: ['left-eye-offset'], decoyRatio: 0.12 },
  { id: 19, rows: 9, cols: 9, targetVariant: 'two-stripes', targetPrompt: '找出额头只有两条纹的猫', timeLimitSec: 16, wrongPenaltySec: 2, decoyVariants: ['four-stripes'], decoyRatio: 0.12 },
  { id: 20, rows: 9, cols: 9, targetVariant: 'no-right-whiskers', targetPrompt: '找出右边没有胡须的猫', timeLimitSec: 16, wrongPenaltySec: 2, decoyVariants: ['no-left-whiskers', 'flat-mouth'], decoyRatio: 0.14 },

  { id: 21, rows: 9, cols: 10, targetVariant: 'blue-right-eye', targetPrompt: '找出右眼是蓝色的猫', timeLimitSec: 15, wrongPenaltySec: 2, decoyVariants: ['blue-left-eye', 'tiny-right-pupil'], decoyRatio: 0.14 },
  { id: 22, rows: 9, cols: 10, targetVariant: 'ear-notch-right', targetPrompt: '找出右耳有缺口的猫', timeLimitSec: 15, wrongPenaltySec: 2, decoyVariants: ['ear-notch-left', 'small-right-ear'], decoyRatio: 0.14 },
  { id: 23, rows: 10, cols: 10, targetVariant: 'tiny-left-pupil', targetPrompt: '找出左眼瞳孔更小的猫', timeLimitSec: 15, wrongPenaltySec: 2, decoyVariants: ['tiny-right-pupil'], decoyRatio: 0.15 },
  { id: 24, rows: 10, cols: 10, targetVariant: 'pink-right-ear', targetPrompt: '找出右耳更粉的猫', timeLimitSec: 14, wrongPenaltySec: 2, decoyVariants: ['pink-left-ear'], decoyRatio: 0.15 },
  { id: 25, rows: 10, cols: 11, targetVariant: 'right-eye-offset', targetPrompt: '找出右眼瞳孔偏外的猫', timeLimitSec: 14, wrongPenaltySec: 2, decoyVariants: ['left-eye-offset', 'blue-right-eye'], decoyRatio: 0.16 },
  { id: 26, rows: 10, cols: 11, targetVariant: 'no-left-whiskers', targetPrompt: '找出左边没有胡须的猫', timeLimitSec: 14, wrongPenaltySec: 2, decoyVariants: ['no-right-whiskers', 'flat-mouth'], decoyRatio: 0.16 },
  { id: 27, rows: 11, cols: 11, targetVariant: 'four-stripes', targetPrompt: '找出额头有四条纹的猫', timeLimitSec: 13, wrongPenaltySec: 2, decoyVariants: ['two-stripes'], decoyRatio: 0.16 },
  { id: 28, rows: 11, cols: 11, targetVariant: 'small-right-ear', targetPrompt: '找出右耳更小的猫', timeLimitSec: 13, wrongPenaltySec: 2, decoyVariants: ['small-left-ear', 'ear-notch-right'], decoyRatio: 0.17 },
  { id: 29, rows: 11, cols: 12, targetVariant: 'closed-left-eye', targetPrompt: '找出闭着左眼的猫', timeLimitSec: 13, wrongPenaltySec: 2, decoyVariants: ['closed-right-eye', 'tiny-left-pupil'], decoyRatio: 0.17 },
  { id: 30, rows: 12, cols: 12, targetVariant: 'ear-notch-left', targetPrompt: '最后一关：找出左耳有缺口的猫', timeLimitSec: 12, wrongPenaltySec: 2, decoyVariants: ['ear-notch-right', 'small-left-ear', 'small-right-ear'], decoyRatio: 0.18 }
];

export function getLevel(id: number): LevelConfig {
  return levels[Math.max(0, Math.min(levels.length - 1, id - 1))];
}
