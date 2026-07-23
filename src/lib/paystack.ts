declare global {
  interface Window {
    PaystackPop?: any;
  }
}

export interface PaystackCheckoutOptions {
  email: string;
  amount: number; // In KES
  planCode?: string;
  metadata?: Record<string, any>;
  onSuccess: (reference: any) => void;
  onClose?: () => void;
}

export function loadPaystackScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.PaystackPop) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openPaystackCheckout(options: PaystackCheckoutOptions) {
  const isLoaded = await loadPaystackScript();
  if (!isLoaded) {
    throw new Error('Failed to load Paystack payment gateway.');
  }

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_8bc13d66cd7d3c25ccac36d6798324dfcc91cfc1';

  const handler = window.PaystackPop.setup({
    key: publicKey,
    email: options.email,
    amount: options.amount * 100, // Paystack unit
    currency: 'KES',
    plan: options.planCode || undefined,
    metadata: options.metadata || {},
    callback: function (response: any) {
      options.onSuccess(response);
    },
    onClose: function () {
      if (options.onClose) options.onClose();
    },
  });

  handler.openIframe();
}
