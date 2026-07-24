import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmCancelModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onAbort: () => void;
}

export default function ConfirmCancelModal({ isOpen, onConfirm, onAbort }: ConfirmCancelModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm bg-paper border-2 border-ink shadow-[12px_12px_0_#171714] p-6 space-y-6 text-ink font-mono"
          >
            <div className="flex items-center gap-3 border-b border-line pb-3">
              <AlertTriangle className="w-6 h-6 text-orange" />
              <h3 className="font-display font-bold text-lg uppercase tracking-tight">Are You Sure?</h3>
            </div>
            
            <p className="text-sm">
              You are about to cancel this action. Your entered data will be lost.
            </p>
            
            <div className="flex flex-col gap-3 pt-3">
              <button
                onClick={onConfirm}
                className="w-full py-3 bg-orange border border-ink text-ink font-bold uppercase hover:opacity-90 transition-opacity"
              >
                Yes, Stop Action
              </button>
              <button
                onClick={onAbort}
                className="w-full py-3 bg-ink border border-ink text-white font-bold uppercase shadow-[4px_4px_0_#c6f806] hover:-translate-y-0.5 transition-transform"
              >
                No, Keep Going
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
