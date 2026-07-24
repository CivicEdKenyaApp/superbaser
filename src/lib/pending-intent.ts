import { PLANS } from '../components/PaymentModal';

export interface PendingAction {
  type: 'CHECKOUT_PLAN' | 'CONNECT_PROJECT' | 'TRIGGER_BACKUP';
  payload: {
    planId?: string;
    billingCycle?: 'monthly' | 'yearly';
    projectRef?: string;
    userData?: { name?: string; email?: string; orgName?: string };
    targetProjectName?: string;
    targetConnectionString?: string;
    targetProjectUrl?: string;
    targetServiceKey?: string;
  };
  interactionHistory?: string[];
  timestamp: number;
}

const PENDING_ACTION_KEY = 'superbaser_pending_action';
let interactionLog: string[] = [];

export function recordInteraction(action: string) {
  if (!action || action.trim() === '') return;
  interactionLog.push(action.trim());
  if (interactionLog.length > 5) interactionLog.shift();
}

export function getInteractionHistory(): string[] {
  return [...interactionLog];
}

export async function inferActionContext(history: string[]): Promise<string> {
  if (!history || history.length === 0) return 'continue your action';
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SB_GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a UX parser. Given this array of user actions, output exactly one short, lower-case verb phrase summarizing their ultimate intent. Do not output anything else, no quotes, no periods. Example: "connect your target database".'
          },
          {
            role: 'user',
            content: JSON.stringify(history)
          }
        ],
        temperature: 0.1,
        max_tokens: 15
      })
    });
    const data = await response.json();
    let text = data.choices[0].message.content.trim().toLowerCase();
    text = text.replace(/["'\.]/g, '');
    return text || 'continue your action';
  } catch (err) {
    console.error('Failed to infer action context:', err);
    return 'continue your action';
  }
}

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
