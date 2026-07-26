import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Zap, AlertTriangle, Check, X, RefreshCw, Lock } from 'lucide-react';

interface AnonVsPermaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToPermanent: () => void;
}

export function AnonVsPermaModal({ isOpen, onClose, onSwitchToPermanent }: AnonVsPermaModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-in fade-in duration-300 font-mono">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="relative w-full max-w-2xl bg-paper border-2 border-ink shadow-[16px_16px_0_#171714] overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b-2 border-ink bg-panel shrink-0">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-neon" />
              <h2 className="font-display font-bold text-xl uppercase tracking-wider text-ink m-0">
                SuperBaser Account Comparison
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-ink hover:text-paper transition-colors border border-transparent hover:border-ink"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Reload Warning Banner */}
          <div className="bg-acid/20 border-b-2 border-ink px-4 py-3 flex items-start gap-3 shrink-0">
            <AlertTriangle className="w-5 h-5 text-orange flex-shrink-0 mt-0.5" />
            <div className="text-xs text-ink leading-relaxed">
              <strong className="uppercase font-bold block mb-0.5 text-ink">⚠️ Temporary Session Alert</strong>
              On browser reload or refresh, all anonymous guest configurations and local session data will be reset. Only Permanent Accounts have session permanence that preserves your connected projects, backups, and settings across reloads.
            </div>
          </div>

          {/* Comparison Grid */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Column 1: Anonymous Access */}
              <div className="border-2 border-ink bg-panel p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-xs font-bold uppercase text-muted tracking-wider">Free Temporary Access</span>
                  <span className="text-[10px] bg-ink/10 text-ink px-2 py-0.5 rounded font-bold uppercase">Guest</span>
                </div>
                <ul className="space-y-2.5 text-xs">
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>1 Connected Database (Temporary)</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>Read-Only Dashboard Exploration</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>Sample Schema & Status Inspection</span>
                  </li>
                  <li className="flex items-start gap-2 text-orange font-bold">
                    <RefreshCw className="w-4 h-4 text-orange flex-shrink-0 mt-0.5" />
                    <span>Resets on Page Reload / Refresh</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink/40">
                    <X className="w-4 h-4 text-ink/30 flex-shrink-0 mt-0.5" />
                    <span>No Live Automated Backups</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink/40">
                    <X className="w-4 h-4 text-ink/30 flex-shrink-0 mt-0.5" />
                    <span>No 1-Click Point-in-Time Restores</span>
                  </li>
                </ul>
              </div>

              {/* Column 2: Permanent Account */}
              <div className="border-2 border-ink bg-acid/10 p-4 space-y-4 relative overflow-hidden shadow-[4px_4px_0_#171714]">
                <div className="flex items-center justify-between border-b border-ink/20 pb-2">
                  <span className="text-xs font-bold uppercase text-ink tracking-wider">Permanent SuperBaser Account</span>
                  <span className="text-[10px] bg-neon text-ink px-2 py-0.5 font-bold uppercase border border-ink">Recommended</span>
                </div>
                <ul className="space-y-2.5 text-xs">
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span><strong>Permanent Session & Data Persistence</strong> (Survives Reloads)</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>Live SuperBaser Automated Backups</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>SuperBaser Encrypted Vault Storage</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>24-Hour & 1-Hour Scheduled Pipelines</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Check className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>1-Click Zero-Downtime Verified Restores</span>
                  </li>
                  <li className="flex items-start gap-2 text-ink">
                    <Lock className="w-4 h-4 text-[#347000] flex-shrink-0 mt-0.5" />
                    <span>AES-256 Envelope Key Security</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t-2 border-ink bg-panel flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-paper hover:bg-panel border-2 border-ink text-ink font-bold text-xs uppercase transition-all cursor-pointer"
            >
              Maybe Later
            </button>
            <button
              onClick={() => {
                onClose();
                onSwitchToPermanent();
              }}
              className="w-full sm:w-auto px-6 py-2.5 bg-acid hover:bg-orange border-2 border-ink text-ink font-bold text-xs uppercase shadow-[3px_3px_0_#171714] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Switch Now — Claim Free Account</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
