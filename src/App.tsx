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
import { supabase } from './lib/supabase';
import { useAuthStore } from './lib/auth-store';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'console'>('landing');
  const [activeProjectRef, setActiveProjectRef] = useState<string>('wzyrmzfgdtzaqmkhtbuk');
  const [activeServiceRoleKey, setActiveServiceRoleKey] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [initialUserData, setInitialUserData] = useState<{ email: string; name: string; orgName: string } | undefined>(undefined);
  const [pendingConsoleAction, setPendingConsoleAction] = useState<(() => void) | null>(null);

  const { session, setSession } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        if (pendingConsoleAction) {
          pendingConsoleAction();
          setPendingConsoleAction(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, pendingConsoleAction]);

  const handleLaunchConsole = async (projectRef?: string, serviceRoleKey?: string, initialData?: { name: string; email: string; orgName: string }) => {
    if (projectRef) setActiveProjectRef(projectRef);
    if (serviceRoleKey) setActiveServiceRoleKey(serviceRoleKey);
    if (initialData) setInitialUserData(initialData);

    const executeLaunch = () => {
      setCurrentView('console');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!session) {
      // Instant Anonymous Sign-in using enabled Supabase feature
      try {
        const { data, error } = await supabase.auth.signInAnonymously({
          options: {
            data: {
              full_name: initialData?.name || 'Guest User',
              org_name: initialData?.orgName || 'Default Org',
            }
          }
        });

        if (!error && data?.session) {
          setSession(data.session);
          executeLaunch();
          return;
        }
      } catch (err) {
        console.warn('Anonymous sign in fallback:', err);
      }

      setPendingConsoleAction(() => executeLaunch);
      setShowAuthModal(true);
    } else {
      executeLaunch();
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setCurrentView('console');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pendingConsoleAction) {
      pendingConsoleAction();
      setPendingConsoleAction(null);
    }
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentView === 'console' && session) {
    return (
      <DashboardConsole
        projectRef={activeProjectRef}
        serviceRoleKey={activeServiceRoleKey}
        onBackToLanding={handleBackToLanding}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-paper text-ink font-body selection:bg-acid selection:text-ink">
      <div className="noise" aria-hidden="true"></div>
      <Header onLaunchConsole={() => handleLaunchConsole()} />
      <main id="main">
        <Hero onLaunchConsole={() => handleLaunchConsole()} />
        <Ticker />
        <Work />
        <Services />
        <Process />
        <Contact onLaunchConsole={(ref, key) => handleLaunchConsole(ref, key)} />
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
  );
}
