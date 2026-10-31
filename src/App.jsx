import React, { useEffect, useState, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigationType, Navigate, matchPath } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Public layout components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Public pages
import HomePage           from './pages/HomePage';
import MachineryPage      from './pages/MachineryPage';
import MachineDetailsPage from './pages/MachineDetailsPage';
import WorkshopPage       from './pages/WorkshopPage';
import AboutPage          from './pages/AboutPage';
import ContactPage        from './pages/ContactPage';
import InventoryPage      from './pages/InventoryPage';
import InventoryDetailsPage from './pages/InventoryDetailsPage';

// Admin pages (lazy loaded)
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout'));

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

// Scroll to top on every route change (including same-page navigation, but excluding browser back/forward)
const ScrollToTop = () => {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.key, navType]);

  return null;
};

// Intersection Observer for scroll animations — runs on every route change
const AnimationObserver = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    });

    const animatedElements = document.querySelectorAll('.fade-up');
    animatedElements.forEach(el => {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Subpage routes that need a top-offset on mobile (excludes '/' homepage)
// ─────────────────────────────────────────────────────────────────────────────
const SUBPAGE_ROUTES = [
  '/maskiner',
  '/maskiner/:slug',
  '/verkstad',
  '/om-oss',
  '/kontakt',
  '/losore',
  '/losore/:slug',
];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC LAYOUT – Navbar + public routes + Footer + mobile CTA
// ─────────────────────────────────────────────────────────────────────────────
function PublicLayout() {
  const { pathname } = useLocation();

  const isSubpage = SUBPAGE_ROUTES.some(pattern =>
    matchPath({ path: pattern, end: false }, pathname)
  );

  return (
    <LanguageProvider>
    <div className="app-container">
      <ScrollToTop />
      <AnimationObserver />
      <Navbar />
      <main className={isSubpage ? 'subpage-main' : ''}>
        <Routes>
          <Route path="/"                 element={<HomePage />} />
          <Route path="/maskiner"         element={<MachineryPage />} />
          <Route path="/maskiner/:slug"   element={<MachineDetailsPage />} />
          <Route path="/verkstad"         element={<WorkshopPage />} />
          <Route path="/om-oss"           element={<AboutPage />} />
          <Route path="/kontakt"          element={<ContactPage />} />
          <Route path="/losore"           element={<InventoryPage />} />
          <Route path="/losore/:slug"       element={<InventoryDetailsPage />} />
          {/* Fallback: unknown public routes → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />

      {/* Fixed Mobile CTA - Borttagen enligt önskemål */}
      {/* <MobileCta /> */}

      <style>{`
        /*
         * Subpage top offset.
         * Compensates for the fixed header so content never slides behind the navbar.
         */
        @media (max-width: 1023px) {
          .subpage-main {
            padding-top: 80px;
          }
        }
        @media (min-width: 1024px) {
          .subpage-main {
            padding-top: 110px;
          }
        }
      `}</style>
    </div>
    </LanguageProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────
function App() {
  const [isRecovering, setIsRecovering] = useState(() => {
    // Om hash innehåller access_token (implicit flow) eller type=recovery är det ett supabase-auth-anrop
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return hash.includes('type=recovery') || hash.includes('type=invite') || hash.includes('access_token=') || search.includes('code=');
  });

  const [diagnosticLogs, setDiagnosticLogs] = useState(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const recovering = hash.includes('type=recovery') || hash.includes('type=invite') || hash.includes('access_token=') || search.includes('code=');
    if (!recovering) return [];
    return [
      "current URL: " + window.location.href,
      "current hash (maskerad): " + hash.replace(/=(.*?)(&|$)/g, "=***$2"),
      "Waiting for Supabase to process recovery URL..."
    ];
  });
  
  const addLog = (msg) => {
    console.log("[Auth Flow]", msg);
    setDiagnosticLogs(prev => [...prev, msg]);
  };

  useEffect(() => {
    if (isRecovering) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        addLog(`Auth event received: ${event}`);
        
        if (event === 'PASSWORD_RECOVERY') {
          addLog("PASSWORD_RECOVERY event received");
          addLog(`Recovery session exists: ${!!session}`);
          if (session?.user) addLog(`Recovery user exists: true (${session.user.id})`);
          addLog("Navigating to update password page...");
          
          setIsRecovering(false);
          // Ge React en ms att rendera HashRouter innan vi styr om
          setTimeout(() => {
            window.location.hash = '#/admin/update-password';
          }, 50);
        } else if (event === 'SIGNED_IN') {
          const hashStr = window.location.hash || '';
          if (hashStr.includes('type=recovery') || hashStr.includes('type=invite')) {
            addLog("SIGNED_IN with recovery/invite token. Navigating to update password...");
            setIsRecovering(false);
            setTimeout(() => {
              window.location.hash = '#/admin/update-password';
            }, 50);
          } else {
            addLog("SIGNED_IN event received. Navigating to admin...");
            setIsRecovering(false);
            setTimeout(() => {
              window.location.hash = '#/admin';
            }, 50);
          }
        }
      });
      
      const timeoutId = setTimeout(() => {
        addLog("Timeout (3s). Supabase skickade inget event. Släpper fram routern.");
        setIsRecovering(false);
      }, 3000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeoutId);
      };
    }
  }, [isRecovering]);

  if (isRecovering) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '100vw', boxSizing: 'border-box' }}>
        <h2>Verifierar inloggningslänk...</h2>
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f4f4f4', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
          <h4 style={{ marginTop: 0 }}>Diagnostik (Säker):</h4>
          {diagnosticLogs.map((log, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: '#555', wordBreak: 'break-all', overflowWrap: 'break-word' }}>
              {log}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          {/* Admin routes – completely separate layout, no Navbar/Footer */}
          <Route path="/admin/*" element={
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Laddar admin...</div>}>
              <AdminLayout />
            </Suspense>
          } />

          {/* Public routes – with Navbar, Footer and mobile CTA */}
          <Route path="/*" element={<PublicLayout />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
