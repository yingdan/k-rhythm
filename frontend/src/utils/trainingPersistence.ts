import { TradeRecord } from '../api/aiReview';
import { KlineBar, TradeAnnotation } from '../components/kline/KlineChart';

export interface TrainingSnapshot {
  symbolCode: string;
  tradeHistory: TradeRecord[];
  annotations: TradeAnnotation[];
  savedAt: string;
}

const guestKey = 'pending_training_snapshot';
const userKey = (userId: string) => `training_snapshot_${userId}`;
const returnToKey = 'pending_training_return_to';

export const saveGuestTrainingSnapshot = (snapshot: TrainingSnapshot) => {
  localStorage.setItem(guestKey, JSON.stringify(snapshot));
  localStorage.setItem(returnToKey, `/training/${snapshot.symbolCode}`);
};

export const saveUserTrainingSnapshot = (userId: string, snapshot: TrainingSnapshot) => {
  localStorage.setItem(userKey(userId), JSON.stringify(snapshot));
};

export const loadUserTrainingSnapshot = (userId: string, symbolCode: string) => {
  const stored = localStorage.getItem(userKey(userId));
  if (!stored) return null;

  try {
    const snapshot = JSON.parse(stored) as TrainingSnapshot;
    return snapshot.symbolCode === symbolCode ? snapshot : null;
  } catch {
    return null;
  }
};

export const migrateGuestTrainingSnapshot = (userId: string) => {
  const stored = localStorage.getItem(guestKey);
  if (stored) {
    localStorage.setItem(userKey(userId), stored);
    localStorage.removeItem(guestKey);
  }
};

export const consumePendingTrainingReturnTo = () => {
  const returnTo = localStorage.getItem(returnToKey);
  localStorage.removeItem(returnToKey);
  return returnTo;
};

export const buildTrainingSnapshot = (
  symbolCode: string,
  tradeHistory: TradeRecord[],
  annotations: TradeAnnotation[],
): TrainingSnapshot => ({
  symbolCode,
  tradeHistory,
  annotations,
  savedAt: new Date().toISOString(),
});

export const createContextBars = (bars: KlineBar[], currentIndex: number, radius = 5) => {
  const start = Math.max(0, currentIndex - radius);
  const end = Math.min(bars.length, currentIndex + radius + 1);
  return bars.slice(start, end);
};
