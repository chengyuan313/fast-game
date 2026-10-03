export type RewardPlacement = 'hint' | 'extra-time' | 'continue';

export interface AdService {
  showRewarded(placement: RewardPlacement): Promise<boolean>;
}

class MockAdService implements AdService {
  async showRewarded(placement: RewardPlacement): Promise<boolean> {
    window.dispatchEvent(new CustomEvent('mock-ad-start', { detail: { placement } }));
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    window.dispatchEvent(new CustomEvent('mock-ad-finish', { detail: { placement } }));
    return true;
  }
}

export const adService: AdService = new MockAdService();
