import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const Hero = ({ onOpenContact }) => {
  const { t } = useLang();

  return (
    <section id="home" className="hero-section">
      {/* Background Image */}
      <div className="hero-bg" style={{ backgroundImage: `url("${import.meta.env.BASE_URL}images/hero_bg_logo.jpg")` }} />
      {/* Overlay to improve text readability */}
      <div className="hero-overlay" />

      <div className="container" style={{ position: 'relative', zIndex: 1, paddingTop: '2rem' }}>
        <div className="hero-content" style={{ maxWidth: '800px' }}>
          <h1 className="fade-up delay-200 hero-title" style={{ marginBottom: '1.5rem' }}>
            {t('hero.title1')} <br />
            <span style={{ color: 'var(--accent-primary)' }}>{t('hero.title2')}</span>
          </h1>

          <p className="fade-up delay-300 hero-subtitle">
            {t('hero.subtitle')}
          </p>

          <div className="fade-up delay-300 hero-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '4rem' }}>
            <Link to="/maskiner" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              {t('hero.ctaMachines')} <ArrowRight size={18} />
            </Link>
            {onOpenContact ? (
              <button onClick={onOpenContact} className="btn btn-secondary hero-btn-secondary">
                <Phone size={18} /> {t('hero.ctaContact')}
              </button>
            ) : (
              <Link to="/kontakt" className="btn btn-secondary hero-btn-secondary">
                <Phone size={18} /> {t('hero.ctaContact')}
              </Link>
            )}
          </div>

          {/* Tag row */}
          <div className="hero-tags fade-up delay-300">
            <span>{t('hero.tag1')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{t('hero.tag2')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{t('hero.tag3')}</span>
            <span style={{ color: 'var(--accent-primary)' }}>•</span>
            <span>{t('hero.tag4')}</span>
          </div>
        </div>
      </div>

      <style>{`
        .hero-section {
          position: relative;
          min-height: calc(100vh - 110px);
          display: flex;
          align-items: center;
          margin-top: 110px; /* Start exactly below the desktop header */
          overflow: hidden;
        }

        .hero-bg {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: -2;
          background-size: cover;
          background-position: center calc(50% + 2rem);
          background-repeat: no-repeat;
        }
        
        .hero-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: -1;
          background: linear-gradient(to right, rgba(18, 20, 21, 0.8) 0%, rgba(18, 20, 21, 0.4) 100%);
        }

        .hero-tags {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 1.5rem;
          font-size: 0.9375rem;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        
        @media (max-width: 1024px) {
          .hero-content {
            text-align: center;
          }
          .hero-subtitle {
            margin-left: auto;
            margin-right: auto;
          }
          .hero-buttons {
            justify-content: center;
            margin-bottom: 2rem !important;
          }
          .hero-section {
            margin-top: 100px; /* Start exactly below the mobile/tablet header */
            padding-bottom: 3rem;
            display: flex;
            flex-direction: column;
            min-height: calc(100svh - 100px);
          }
          .hero-bg {
            position: relative;
            width: 100%;
            height: auto;
            aspect-ratio: 16 / 9;
            background-image: url("${import.meta.env.BASE_URL}images/hero_logo.jpg") !important;
            background-position: center;
            background-size: cover;
            background-color: #121415;
          }
          .hero-overlay {
            display: none;
          }
        }

        @media (max-width: 400px) {
          .hero-section .container {
            padding-top: 1rem !important;
          }
          .hero-subtitle {
            margin-bottom: 1rem !important;
          }
          .hero-buttons {
            margin-bottom: 1rem !important;
          }
          .hero-tags {
            margin-top: 1.5rem;
            justify-content: center;
          }
        }
        @media (min-width: 401px) and (max-width: 1024px) {
          .hero-section .container {
            padding-top: 3rem !important;
          }
          .hero-subtitle {
            margin-bottom: 2rem !important;
          }
          .hero-buttons {
            margin-bottom: 2.5rem !important;
          }
          .hero-tags {
            margin-top: 2.5rem;
            justify-content: center;
          }
        }

        /* ── Hero Text Colors ── */
        .hero-title {
          color: #ffffff;
        }
        .hero-subtitle {
          color: rgba(255,255,255,0.8);
          font-size: 1.25rem;
          margin-bottom: 2.5rem;
          max-width: 600px;
        }
        .hero-btn-secondary {
          background-color: rgba(255,255,255,0.05);
          color: #ffffff;
          border-color: rgba(255,255,255,0.2);
          cursor: pointer;
          font-family: inherit;
          text-decoration: none;
        }
        .hero-btn-secondary:hover {
          background-color: rgba(255,255,255,0.1);
        }

        /* Prevent tagline wrapping on all standard mobiles */
        @media (max-width: 480px) {
          .hero-tags {
            flex-wrap: nowrap;
            white-space: nowrap;
            font-size: 0.625rem;
            gap: 0.4rem;
            letter-spacing: 0.01em;
          }
        }
        @media (min-width: 481px) and (max-width: 1024px) {
          .hero-tags {
            font-size: 0.75rem;
            gap: 0.75rem;
          }
        }
        
        /* Mobile Color Adaptations */
        @media (max-width: 1024px) {
          .hero-title {
            color: var(--text-primary);
          }
          .hero-subtitle {
            color: var(--text-secondary);
          }
          .hero-btn-secondary {
            background-color: transparent;
            color: var(--text-primary);
            border-color: var(--border-color);
          }
          .hero-btn-secondary:hover {
            background-color: var(--bg-surface);
            color: var(--text-primary);
            border-color: var(--text-primary);
          }
          .hero-tags {
            color: var(--text-muted);
          }
        }

        @media (min-width: 1025px) {
          .hero-content {
            transform: translateY(2rem);
          }
        }
      `}</style>
    </section>
  );
};

export default Hero;
