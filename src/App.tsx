import React, { useState, useEffect } from 'react';
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

import { savePendingAction, getPendingAction, clearPendingAction } from './lib/pending-intent';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'console'>('landing');
  const [activeProjectRef, setActiveProjectRef] = useState<string>('wzyrmzfgdtzaqmkhtbuk');
  const [activeServiceRoleKey, setActiveServiceRoleKey] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<string>('Pro');
  const [initialUserData, setInitialUserData] = useState<{ email: string; name: string; orgName: string; supabasePlan?: string } | undefined>(undefined);

  const { session, setSession } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      checkAndResumePendingAction(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      checkAndResumePendingAction(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  const checkAndResumePendingAction = (currentSession: any) => {
    // Only resume if user is authenticated with a real permanent account
    if (currentSession?.user && !currentSession.user.is_anonymous) {
      const pending = getPendingAction();
      if (pending && pending.type === 'CHECKOUT_PLAN') {
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
          />
        </ClickSpark>
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
        </div>
      </ClickSpark>
    </>
  );
}
