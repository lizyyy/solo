
import type { BusSwipeRecord } from '../../shared/types';

export function makeBusDedupKey(r: Partial<BusSwipeRecord>): string {
  return r.cardId + '|' + r.swipeTime + '|' + r.route + '|' + r.location;
}
