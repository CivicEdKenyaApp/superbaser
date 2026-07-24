import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Header from './components/Header';
import Hero from './components/Hero';
import Ticker from './components/Ticker';
import Work from './components/Work';
import Services from './components/Services';
import Process from './components/Process';
import PricingSection from './components/PricingSection';
import Contact from './components/Contact';
import Footer from './components/Footer';
import DashboardConsole from './components/DashboardConsole';
import AuthModal from './components/AuthModal';
import PaymentModal from './components/PaymentModal';
import ClickSpark from './components/ClickSpark';
import { SEO } from './components/SEO';
import { supabase } from './lib/supabase';
import { useAuthStore } from './lib/auth-store';

import { savePendingAction, getPendingAction, clearPendingAction, recordInteraction } from './lib/pending-intent';
import PendingIntentUI from './components/PendingIntentUI';
export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'console'>('landing');
  const [activeProjectRef, setActiveProjectRef] = useState<string>('wzyrmzfgdtzaqmkhtbuk');
  const [activeServiceRoleKey, setActiveServiceRoleKey] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<string>('Pro');
  const [initialUserData, setInitialUserData] = useState<{ email: string; name: string; orgName: string; supabasePlan?: string } | undefined>(undefined);
  const [intentUIMode, setIntentUIMode] = useState<'intercept' | 'resume' | null>(null);
  const [activePendingIntent, setActivePendingIntent] = useState<any | null>(null);
  const [showResetToast, setShowResetToast] = useState(false);
  const lastViewRef = useRef(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('sb_last_view') : null);

  const { session, setSession } = useAuthStore();

  useEffect(() => {
    sessionStorage.setItem('sb_last_view', currentView);
  }, [currentView]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, input[type="submit"]');
      if (clickable) {
        const text = clickable.getAttribute('aria-label') || (clickable as HTMLElement).innerText;
        if (text) recordInteraction(`Clicked ${text.trim().substring(0, 40)}`);
      } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const name = target.getAttribute('name') || target.getAttribute('placeholder') || 'input field';
        recordInteraction(`Interacted with ${name}`);
      }
    };
    document.addEventListener('click', handleGlobalClick, true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && !session.user.is_anonymous) {
        setCurrentView((prev) => prev === 'landing' ? 'console' : prev);
      } else if (session?.user?.is_anonymous) {
        if (lastViewRef.current === 'console') {
          setTimeout(() => setShowResetToast(true), 1500);
        }
      }
      checkAndResumePendingAction(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user && !session.user.is_anonymous) {
        setCurrentView((prev) => prev === 'landing' ? 'console' : prev);
      }
      checkAndResumePendingAction(session);
    });

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [setSession]);

  const checkAndResumePendingAction = (currentSession: any) => {
    // Only resume if user is authenticated with a real permanent account
    if (currentSession?.user && !currentSession.user.is_anonymous) {
      const pending = getPendingAction();
      if (pending) {
        if (pending.type === 'CHECKOUT_PLAN') {
          clearPendingAction();
          const planToUse = pending.payload.planId || 'Pro';
          setSelectedPlanForPayment(planToUse);
          if (pending.payload.userData) {
            setInitialUserData({
              email: pending.payload.userData.email || currentSession.user.email || '',
              name: pending.payload.userData.name || currentSession.user.user_metadata?.full_name || '',
              orgName: pending.payload.userData.orgName || 'Primary Workspace',
              supabasePlan: planToUse,
            });
          }
          setShowPaymentModal(true);
        } else {
          // Connect target database or other intents
          setActivePendingIntent(pending);
          setIntentUIMode('resume');
        }
      }
    }
  };

  const handleLaunchConsole = async (
    projectRef?: string,
    serviceRoleKey?: string,
    initialData?: { name: string; email: string; orgName: string; supabasePlan?: string }
  ) => {
    if (projectRef) setActiveProjectRef(projectRef);
    if (serviceRoleKey) setActiveServiceRoleKey(serviceRoleKey);
    if (initialData) setInitialUserData(initialData);

    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;

    if (!activeSession) {
      try {
        await supabase.auth.signInAnonymously({
          options: {
            data: {
              full_name: initialData?.name || 'Operations Guest',
              org_name: initialData?.orgName || 'Primary Workspace',
              supabase_plan: initialData?.supabasePlan || 'Pro',
            }
          }
        });
      } catch (err) {
        console.error("Anonymous auth error", err);
      }
    }

    setCurrentView('console');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPaymentModal = (
    plan: string = 'Pro',
    userData?: { name: string; email: string; orgName: string; supabasePlan: string }
  ) => {
    const isRealAccount = session?.user && !session.user.is_anonymous;

    if (!isRealAccount) {
      // Save pending intent so payment resumes post-authentication
      savePendingAction({
        type: 'CHECKOUT_PLAN',
        payload: {
          planId: plan,
          billingCycle: 'monthly',
          userData: userData ? { name: userData.name, email: userData.email, orgName: userData.orgName } : undefined,
        },
      });

      if (userData) {
        setInitialUserData(userData);
      }
      // Open AuthModal first
      setShowAuthModal(true);
    } else {
      setSelectedPlanForPayment(plan);
      if (userData) {
        setInitialUserData(userData);
      }
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = (plan: string) => {
    setShowPaymentModal(false);
    handleLaunchConsole(undefined, undefined, {
      name: initialUserData?.name || 'Operations Guest',
      email: initialUserData?.email || '',
      orgName: initialUserData?.orgName || 'Primary Workspace',
      supabasePlan: plan,
    });
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setCurrentView('console');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentView === 'console') {
    return (
      <>
        <SEO title="SuperBaser Console - Dashboard" />
        <ClickSpark sparkColor="#3FCF8E" sparkSize={14} sparkRadius={28} sparkCount={12} duration={500}>
          <DashboardConsole
            projectRef={activeProjectRef}
            serviceRoleKey={activeServiceRoleKey}
            onBackToLanding={handleBackToLanding}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onTriggerIntercept={(intent) => {
              setActivePendingIntent(intent);
              setIntentUIMode('intercept');
            }}
          />
        </ClickSpark>
        {intentUIMode && activePendingIntent && (
          <PendingIntentUI 
            mode={intentUIMode}
            intent={activePendingIntent}
            onComplete={() => {
              if (intentUIMode === 'intercept') {
                setShowAuthModal(true);
                setIntentUIMode(null);
              } else {
                window.dispatchEvent(new CustomEvent('RESUME_PENDING_ACTION', { detail: activePendingIntent }));
                setIntentUIMode(null);
                clearPendingAction();
              }
            }}
            onAbort={() => {
              setIntentUIMode(null);
              setActivePendingIntent(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <SEO />
      <ClickSpark sparkColor="#3FCF8E" sparkSize={14} sparkRadius={28} sparkCount={12} duration={500}>
        <div className="relative min-h-screen bg-paper text-ink font-body selection:bg-acid selection:text-ink">
          <div className="noise" aria-hidden="true"></div>
          <Header onLaunchConsole={() => handleLaunchConsole()} />
          <main id="main">
            <Hero onLaunchConsole={() => handleLaunchConsole()} />
            <Ticker />
            <Work />
            <Services />
            <Process />
            <PricingSection onSelectPlan={(plan) => handleOpenPaymentModal(plan)} />
            <Contact
              onLaunchConsole={(ref, key, data) => handleLaunchConsole(ref, key, data)}
              onOpenPaymentModal={(plan, data) => handleOpenPaymentModal(plan, data)}
              session={session}
            />
          </main>
          <Footer />
          
          {showAuthModal && (
            <AuthModal 
              initialEmail={initialUserData?.email}
              initialName={initialUserData?.name}
              initialOrgName={initialUserData?.orgName}
              onClose={() => setShowAuthModal(false)} 
              onSuccess={handleAuthSuccess} 
            />
          )}

          {showPaymentModal && (
            <PaymentModal
              initialPlan={selectedPlanForPayment}
              initialData={initialUserData}
              onClose={() => setShowPaymentModal(false)}
              onSuccess={handlePaymentSuccess}
            />
          )}

          {intentUIMode && activePendingIntent && (
            <PendingIntentUI 
              mode={intentUIMode}
              intent={activePendingIntent}
              onComplete={() => {
                if (intentUIMode === 'intercept') {
                  setShowAuthModal(true);
                  setIntentUIMode(null);
                } else {
                  window.dispatchEvent(new CustomEvent('RESUME_PENDING_ACTION', { detail: activePendingIntent }));
                  setIntentUIMode(null);
                  clearPendingAction();
                }
              }}
              onAbort={() => {
                setIntentUIMode(null);
                setActivePendingIntent(null);
              }}
            />
          )}

          {showResetToast && (
            <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-paper border-2 border-ink shadow-[8px_8px_0_#171714] p-4 max-w-sm flex items-start gap-4">
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-ink uppercase text-xs font-mono">Session Reset</h4>
                  <p className="text-muted text-[0.65rem] font-mono leading-relaxed">
                    Your temporary session was reset upon refresh. Sign up to save your progress and maintain continuous access.
                  </p>
                </div>
                <button onClick={() => setShowResetToast(false)} className="text-muted hover:text-ink transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </ClickSpark>
    </>
  );
}
