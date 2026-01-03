import { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { MiningDashboard } from './components/MiningDashboard';
import { AdminPanel } from './components/AdminPanel';
import { SplashScreen } from './components/SplashScreen';
import { Toaster } from './components/ui/sonner';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { getSupabaseClient } from './utils/supabase/client';
import { Shield } from 'lucide-react';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const supabase = getSupabaseClient();

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setAccessToken(session.access_token);
        setUserId(session.user.id);

        // Check if user is admin (email contains 'admin')
        if (session.user.email?.includes('admin')) {
          setIsAdmin(true);
        }
      }

      // Hide splash screen after checking session
      setShowSplash(false);
    };

    checkSession();
  }, []);

  const handleAuthSuccess = (token: string, uid: string) => {
    setAccessToken(token);
    setUserId(uid);
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();

    await supabase.auth.signOut();
    setAccessToken(null);
    setUserId(null);
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

  // Show splash screen
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // If not authenticated, show auth screen
  if (!accessToken || !userId) {
    return (
      <>
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
        <Toaster />
      </>
    );
  }

  // If admin and viewing admin panel
  if (isAdmin && showAdminPanel) {
    return (
      <>
        <AdminPanel
          accessToken={accessToken}
          onBack={() => setShowAdminPanel(false)}
        />
        <Toaster />
      </>
    );
  }

  // Show mining dashboard
  return (
    <>
      <div className="relative">
        <MiningDashboard
          accessToken={accessToken}
          userId={userId}
          onLogout={handleLogout}
        />
        {isAdmin && (
          <button
            onClick={() => setShowAdminPanel(true)}
            className="fixed bottom-4 right-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-full shadow-2xl hover:from-blue-700 hover:to-cyan-700 transition-all transform hover:scale-105 flex items-center gap-2"
          >
            <Shield className="size-5" />
            Admin Panel
          </button>
        )}
      </div>
      <Toaster />
    </>
  );
}