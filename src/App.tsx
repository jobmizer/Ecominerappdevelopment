import { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { MiningDashboard } from './components/MiningDashboard';
import { AdminPanel } from './components/AdminPanel';
import { Toaster } from './components/ui/sonner';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setAccessToken(session.access_token);
        setUserId(session.user.id);

        // Check if user is admin (email contains 'admin')
        if (session.user.email?.includes('admin')) {
          setIsAdmin(true);
        }
      }
    };

    checkSession();
  }, []);

  const handleAuthSuccess = (token: string, uid: string) => {
    setAccessToken(token);
    setUserId(uid);
  };

  const handleLogout = async () => {
    const supabase = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey
    );

    await supabase.auth.signOut();
    setAccessToken(null);
    setUserId(null);
    setIsAdmin(false);
    setShowAdminPanel(false);
  };

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
            className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
          >
            Admin Panel
          </button>
        )}
      </div>
      <Toaster />
    </>
  );
}