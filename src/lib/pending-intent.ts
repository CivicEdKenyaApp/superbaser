import { PLANS } from '../components/PaymentModal';

export interface PendingAction {
  type: 'CHECKOUT_PLAN' | 'CONNECT_PROJECT' | 'TRIGGER_BACKUP';
  payload: {
    planId?: string;
    billingCycle?: 'monthly' | 'yearly';
    projectRef?: string;
    userData?: { name?: string; email?: string; orgName?: string };
  };
  timestamp: number;
}

const PENDING_ACTION_KEY = 'superbaser_pending_action';

export function savePendingAction(action: Omit<PendingAction, 'timestamp'>): void {
  try {
    const data: PendingAction = {
      ...action,
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed saving pending action:', err);
  }
}

export function getPendingAction(): PendingAction | null {
  try {
    const raw = localStorage.getItem(PENDING_ACTION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PendingAction;
    // Expire actions older than 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      clearPendingAction();
      return null;
    }

    // Server-side validation: if action is CHECKOUT_PLAN, ensure planId is authoritative
    if (parsed.type === 'CHECKOUT_PLAN' && parsed.payload?.planId) {
      const validPlan = PLANS[parsed.payload.planId];
      if (!validPlan) {
        parsed.payload.planId = 'Pro';
      }
    }

    return parsed;
  } catch (err) {
    console.error('Failed reading pending action:', err);
    return null;
  }
}

export function clearPendingAction(): void {
  try {
    localStorage.removeItem(PENDING_ACTION_KEY);
  } catch (err) {
    console.error('Failed clearing pending action:', err);
  }
}
