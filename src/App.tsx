import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Ticker from './components/Ticker';
import Work from './components/Work';
import Services from './components/Services';
import Process from './components/Process';
import Contact from './components/Contact';
import Footer from './components/Footer';
import DashboardConsole from './components/DashboardConsole';
import AuthModal from './components/AuthModal';
import ClickSpark from './components/ClickSpark';
import { SEO } from './components/SEO';
import { supabase } from './lib/supabase';
import { useAuthStore } from './lib/auth-store';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'console'>('landing');
  const [activeProjectRef, setActiveProjectRef] = useState<string>('wzyrmzfgdtzaqmkhtbuk');
  const [activeServiceRoleKey, setActiveServiceRoleKey] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [initialUserData, setInitialUserData] = useState<{ email: string; name: string; orgName: string } | undefined>(undefined);

  const { session, setSession } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  const handleLaunchConsole = async (projectRef?: string, serviceRoleKey?: string, initialData?: { name: string; email: string; orgName: string }) => {
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
          <Contact onLaunchConsole={(ref, key) => handleLaunchConsole(ref, key)} session={session} />
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
      </div>
    </ClickSpark>
    </>
  );
}
