import type { CatVariant } from './levels';

function eyeSvg(side: 'left' | 'right', variant: CatVariant): string {
  const x = side === 'left' ? 37 : 63;
  const isClosed = variant === `closed-${side}-eye`;
  const isBlue = variant === `blue-${side}-eye`;
  const isTiny = variant === `tiny-${side}-pupil`;
  const isOffset = variant === `${side}-eye-offset`;

  if (isClosed) {
    return `<path d="M ${x - 6} 53 Q ${x} 58 ${x + 6} 53" fill="none" stroke="#3d2d25" stroke-width="4.2" stroke-linecap="round"/>`;
  }

  const pupilX = x + (isOffset ? (side === 'left' ? -3.5 : 3.5) : 0);
  const pupilRadius = isTiny ? 1.7 : 3.4;
  const iris = isBlue ? '#5ba4cf' : '#514238';

  return [
    `<ellipse cx="${x}" cy="53" rx="7.1" ry="7.8" fill="#fffaf2"/>`,
    `<circle cx="${pupilX}" cy="53.5" r="${pupilRadius + 1.7}" fill="${iris}"/>`,
    `<circle cx="${pupilX}" cy="53.5" r="${pupilRadius}" fill="#241d19"/>`,
    `<circle cx="${pupilX - 1.2}" cy="51.8" r="1.15" fill="#ffffff" opacity="0.9"/>`
  ].join('');
}

function earPath(side: 'left' | 'right', variant: CatVariant): string {
  const small = variant === `small-${side}-ear`;
  const notch = variant === `ear-notch-${side}`;

  if (side === 'left') {
    if (small) return 'M20 40 L27 21 L37 38 Z';
    if (notch) return 'M17 40 L27 12 L30 22 L34 18 L39 38 Z';
    return 'M17 40 L27 12 L39 38 Z';
  }

  if (small) return 'M63 38 L73 21 L80 40 Z';
  if (notch) return 'M61 38 L66 18 L70 22 L73 12 L83 40 Z';
  return 'M61 38 L73 12 L83 40 Z';
}

export function catSvg(variant: CatVariant): string {
  const fur = variant === 'dark-fur' ? '#b76d2f' : variant === 'light-fur' ? '#f3c47d' : '#e6a153';
  const leftInner = variant === 'pink-left-ear' ? '#ff7f96' : '#eeb0aa';
  const rightInner = variant === 'pink-right-ear' ? '#ff7f96' : '#eeb0aa';

  const leftWhiskers = variant === 'no-left-whiskers'
    ? ''
    : '<path d="M31 68 L8 63 M31 72 L7 73 M32 76 L12 83" stroke="#5a463b" stroke-width="2.5" stroke-linecap="round"/>';
  const rightWhiskers = variant === 'no-right-whiskers'
    ? ''
    : '<path d="M69 68 L92 63 M69 72 L93 73 M68 76 L88 83" stroke="#5a463b" stroke-width="2.5" stroke-linecap="round"/>';

  const stripeCount = variant === 'two-stripes' ? 2 : variant === 'four-stripes' ? 4 : 3;
  const stripeXs = stripeCount === 2 ? [45, 55] : stripeCount === 4 ? [40, 47, 54, 61] : [43, 50, 57];
  const stripes = stripeXs
    .map((x, index) => `<path d="M${x} 28 Q${x + (index % 2 === 0 ? -1.5 : 1.5)} 35 ${x} 40" fill="none" stroke="#9c612f" stroke-width="3.2" stroke-linecap="round"/>`)
    .join('');

  const nose = variant === 'no-nose'
    ? ''
    : '<path d="M46 65 Q50 62 54 65 L50 70 Z" fill="#7f4e45"/>';

  const mouth = variant === 'flat-mouth'
    ? '<path d="M43 75 L57 75" fill="none" stroke="#5d4036" stroke-width="2.8" stroke-linecap="round"/>'
    : '<path d="M50 69 L50 72 M50 72 Q45 78 40 74 M50 72 Q55 78 60 74" fill="none" stroke="#5d4036" stroke-width="2.6" stroke-linecap="round"/>';

  return `
    <svg class="cat-svg" viewBox="0 0 100 100" role="img" aria-label="猫">
      <path d="M74 70 Q94 75 91 52" fill="none" stroke="${fur}" stroke-width="10" stroke-linecap="round"/>
      <path d="${earPath('left', variant)}" fill="${fur}" stroke="#a76b39" stroke-width="2" stroke-linejoin="round"/>
      <path d="${earPath('right', variant)}" fill="${fur}" stroke="#a76b39" stroke-width="2" stroke-linejoin="round"/>
      <path d="M22 35 L27 19 L34 35 Z" fill="${leftInner}" opacity="0.95"/>
      <path d="M66 35 L73 19 L78 35 Z" fill="${rightInner}" opacity="0.95"/>
      <circle cx="50" cy="59" r="34" fill="${fur}" stroke="#a76b39" stroke-width="2"/>
      ${stripes}
      ${eyeSvg('left', variant)}
      ${eyeSvg('right', variant)}
      ${nose}
      ${mouth}
      ${leftWhiskers}
      ${rightWhiskers}
    </svg>
  `;
}
