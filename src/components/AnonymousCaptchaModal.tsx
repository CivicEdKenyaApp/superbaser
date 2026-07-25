import React, { useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface AnonymousCaptchaModalProps {
  onClose: () => void;
  onSuccess: (token: string) => Promise<void>;
}

export const AnonymousCaptchaModal: React.FC<AnonymousCaptchaModalProps> = ({ onClose, onSuccess }) => {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaToken) {
      setIsLoading(true);
      setError(null);
      try {
        await onSuccess(captchaToken);
      } catch (err: any) {
        setError(err.message || 'Verification failed. Please try again.');
        if (captchaRef.current) captchaRef.current.resetCaptcha();
        setCaptchaToken(null);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] w-full max-w-md relative z-10 animate-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute right-4 top-4 text-ink hover:text-orange transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8">
          <h2 className="text-xl font-bold font-mono tracking-tighter uppercase mb-2">Security Check</h2>
          <p className="text-sm text-ink/70 mb-6 font-mono">
            Please complete the captcha to launch the console as a guest.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500 text-red-600 font-mono text-xs">
                {error}
              </div>
            )}
            
            <div className="flex justify-center pt-2 pb-2">
              <HCaptcha
                ref={captchaRef}
                sitekey="4e508f3c-bc1a-47b8-ad16-c47643189a8a"
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setError(null);
                }}
                onExpire={() => setCaptchaToken(null)}
                theme="light"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !captchaToken}
              className="w-full mt-2 button flex items-center justify-center min-h-[50px] border border-ink bg-ink text-white font-mono font-bold text-xs uppercase tracking-widest hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[5px_5px_0_#c6f806] transition-all duration-200 disabled:opacity-70 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue ↗'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
