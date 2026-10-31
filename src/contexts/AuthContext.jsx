import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (currentUser) => {
      if (!currentUser) {
        if (mounted) setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (mounted) {
        if (!error && data) {
          setProfile(data);
        } else {
          // Reservlösning: Om migreringen inte har körts eller user_profiles misslyckas, 
          // kontrollera om användaren finns i den äldre tabellen `admins`.
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', currentUser.id)
            .single();

          if (!adminError && adminData) {
            setProfile({
              id: currentUser.id,
              role: 'superadmin',
              permissions: [],
              is_active: true
            });
          } else {
            setProfile(null);
          }
        }
      }
    };

    // Hämta befintlig session vid montering (hanterar siduppdatering)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    // Prenumerera på framtida ändringar i autentiseringsstatus (inloggning, utloggning, tokenuppdatering)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      fetchProfile(session?.user ?? null);

      // Om Supabase framgångsrikt hanterar en återställningslänk, dirigera användaren manuellt.
      // Detta undviker konflikter mellan HashRouter och Supabases implicita flödestokens i URL-hashen.
      if (event === 'PASSWORD_RECOVERY') {
        window.location.hash = '#/admin/update-password';
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Logga in med e-post och lösenord.
   * Returnerar { data, error } – anroparen hanterar felvisning.
   */
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  /**
   * Logga ut aktuell användare.
   * Returnerar { error } – anroparen hanterar felvisning.
   */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  /**
   * Återställ lösenord via e-post.
   */
  const resetPassword = async (email) => {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL || '/';

    // Skicka användaren till applikationens ROT, INTE direkt till hash-rutten.
    // Detta gör att Supabase kan placera tokens rent i hashen (#access_token=...) 
    // eller frågesträngen (?code=...) utan att krocka med React HashRouters egna rutter.
    // Lyssnaren onAuthStateChange fångar upp 'PASSWORD_RECOVERY' och navigerar rätt.
    const redirectUrl = `${baseUrl}${basePath}`.replace(/([^:]\/)\/+/g, "$1");

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { data, error };
  };

  /**
   * Uppdatera användarens lösenord.
   */
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth – konsumera AuthContext.
 * Kastar fel om den används utanför <AuthProvider>.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth måste användas inuti en <AuthProvider>');
  }
  return context;
};
