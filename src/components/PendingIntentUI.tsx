import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clearPendingAction, getInteractionHistory, inferActionContext, PendingAction } from '../lib/pending-intent';
import ConfirmCancelModal from './ConfirmCancelModal';
import { Zap, Loader2, StopCircle } from 'lucide-react';

interface PendingIntentUIProps {
  intent: PendingAction;
  mode: 'intercept' | 'resume';
  onComplete: () => void;
  onAbort: () => void;
}

export default function PendingIntentUI({ intent, mode, onComplete, onAbort }: PendingIntentUIProps) {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionText, setActionText] = useState(mode === 'intercept' ? 'saving your progress' : 'loading action');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const durationMs = 10000; // 10 seconds

  useEffect(() => {
    if (mode === 'resume') {
      const history = intent.interactionHistory || getInteractionHistory();
      inferActionContext(history).then(inferred => {
        setActionText(inferred);
      });
    }
  }, [mode, intent]);

  useEffect(() => {
    if (isPaused || showConfirm) return;

    const interval = 50;
    const increment = (interval / durationMs) * 100;

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timerRef.current!);
          onComplete();
          return 100;
        }
        return prev + increment;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, showConfirm, onComplete]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsPaused(true);
    holdTimerRef.current = setTimeout(() => {
      setShowConfirm(true);
    }, 600);
  };

  const handlePointerUpOrLeave = (e: React.PointerEvent) => {
    e.preventDefault();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    if (!showConfirm) {
      setIsPaused(false);
    }
  };

  const handleConfirmAbort = () => {
    clearPendingAction();
    setShowConfirm(false);
    onAbort();
  };

  const handleKeepGoing = () => {
    setShowConfirm(false);
    setIsPaused(false);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[90%] max-w-md pointer-events-none">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] overflow-hidden pointer-events-auto"
        >
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-orange flex-shrink-0" />
                <h4 className="font-display font-bold text-sm uppercase text-ink truncate">
                  {mode === 'intercept' ? 'Progress Saved! ⚡' : 'Welcome Back!'}
                </h4>
              </div>
              <p className="text-xs font-mono text-muted leading-tight">
                {mode === 'intercept' 
                  ? 'You just need a permanent account to finish connecting this database.' 
                  : `Want to pick up where you left off and ${actionText}?`}
              </p>
            </div>

            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUpOrLeave}
              onPointerLeave={handlePointerUpOrLeave}
              className="group relative flex flex-col items-center justify-center w-12 h-12 flex-shrink-0 rounded-full border-2 border-ink bg-white active:scale-95 transition-transform"
              title="Hold to Stop"
            >
              <StopCircle className="w-5 h-5 text-ink group-hover:text-orange transition-colors" />
              <span className="text-[0.45rem] font-bold uppercase mt-0.5">Hold</span>
            </button>
          </div>

          {/* Progress Bar Container */}
          <div className="h-1.5 w-full bg-line relative">
            <motion.div 
              className="absolute top-0 left-0 bottom-0 bg-neon"
              style={{ width: `${progress}%` }}
              layout
            />
          </div>
        </motion.div>
      </div>

      <ConfirmCancelModal 
        isOpen={showConfirm}
        onConfirm={handleConfirmAbort}
        onAbort={handleKeepGoing}
      />
    </>
  );
}
