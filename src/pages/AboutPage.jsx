import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tractor, Hammer } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';
import ContactModal from '../components/ContactModal';

/* ─────────────────────────────────────────────────────────────
   Om Jannes Maskin & Smide – /om-oss
   ───────────────────────────────────────────────────────────── */

const AboutPage = () => {
  const { t } = useLang();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState('');

  const handleOpenContact = (subject = '') => {
    setContactSubject(subject);
    setContactModalOpen(true);
  };

  useEffect(() => {
    document.title = 'Om oss | Jannes Maskin & Smide';
    return () => { document.title = 'Jannes Maskin & Smide'; };
  }, []);

  return (
    <>
      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section
        className="section about-hero-section"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div className="container">
          <div className="about-hero-inner">

            {/* Text */}
            <div className="about-hero-text">
              <span className="eyebrow fade-up">{t('about.eyebrow')}</span>

              <h1 className="fade-up delay-100 about-title" style={{ marginBottom: '1.5rem' }}>
                <span style={{ color: 'var(--text-primary)' }}>{t('about.nameRow1')}</span>
                <br />
                <span style={{ color: 'var(--accent-primary)' }}>{t('about.nameRow2')}</span>
              </h1>
              <p
                className="fade-up delay-200"
                style={{ fontSize: '1.2rem', lineHeight: '1.7', marginBottom: '2.5rem' }}
              >
                {t('about.intro')}
              </p>
              <div className="about-hero-buttons fade-up delay-200">
                <button onClick={() => handleOpenContact('')} className="btn btn-primary" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {t('about.ctaContact')} <ArrowRight size={18} />
                </button>
                <Link to="/maskiner" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  {t('about.ctaMachines')}
                </Link>
              </div>
            </div>

            {/* Logo */}
            <div className="about-hero-logo fade-up delay-300">
              <div className="about-hero-logo-wrap">
                <img
                  src={`${import.meta.env.BASE_URL}images/hero_logo.jpg`}
                  alt="Jannes Maskin & Smide – logotyp"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. Familjeföretaget ─────────────────────────────────── */}
      <section className="section" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="container">
          <div className="about-family-text" style={{ maxWidth: '720px' }}>
            <span className="eyebrow fade-up">{t('about.familyEyebrow')}</span>
            <h2 className="fade-up delay-100" style={{ marginBottom: '1.5rem' }}>
              {t('about.familyHeading')}
            </h2>
            <p className="fade-up delay-100" style={{ fontSize: '1.125rem', lineHeight: '1.75' }}>
              {t('about.familyP1')}
            </p>
            <p className="fade-up delay-200" style={{ fontSize: '1.125rem', lineHeight: '1.75' }}>
              {t('about.familyP2')}
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Vad vi gör ───────────────────────────────────────── */}
      <section className="section" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div className="container">
          <div className="about-what-text">
            <span className="eyebrow fade-up" style={{ display: 'block', marginBottom: '0.75rem' }}>
              {t('about.whatEyebrow')}
            </span>
            <h2 className="fade-up delay-100" style={{ marginBottom: '3rem', maxWidth: '480px' }}>
              {t('about.whatHeading')}
            </h2>
          </div>

          <div className="about-cards">

            {/* Maskiner */}
            <div className="about-card fade-up delay-100">
              <div className="about-card-icon">
                <Tractor size={36} color="var(--accent-primary)" strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '1.375rem', marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
                {t('about.machinesTitle')}
              </h3>
              <p style={{ flexGrow: 1 }}>{t('about.machinesDesc')}</p>
              <Link
                to="/maskiner"
                className="btn btn-secondary about-card-btn"
                style={{ textDecoration: 'none', marginTop: '1.5rem' }}
              >
                {t('about.machinesCta')}
              </Link>
            </div>

            {/* Smide */}
            <div className="about-card fade-up delay-200">
              <div className="about-card-icon">
                <Hammer size={36} color="var(--accent-primary)" strokeWidth={1.5} />
              </div>
              <h3 style={{ fontSize: '1.375rem', marginBottom: '0.875rem', color: 'var(--text-primary)' }}>
                {t('about.smideTitle')}
              </h3>
              <p style={{ flexGrow: 1 }}>{t('about.smideDesc')}</p>
              <button
                onClick={() => handleOpenContact('manufacturing')}
                className="btn btn-secondary about-card-btn"
                style={{ marginTop: '1.5rem', cursor: 'pointer', border: 'none', fontFamily: 'inherit', fontSize: '1rem' }}
              >
                {t('about.smideCta')}
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ── 4. Avslutande CTA ───────────────────────────────────── */}
      <section
        className="section"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: 'clamp(3rem, 6vw, 5rem)',
          paddingBottom: 'clamp(3rem, 6vw, 5rem)',
        }}
      >
        <div className="container">
          <div className="about-cta fade-up">
            <div className="about-cta-text">
              <h2 style={{ marginBottom: '1rem' }}>{t('about.ctaHeading')}</h2>
              <p style={{ maxWidth: '520px', marginBottom: 0 }}>{t('about.ctaDesc')}</p>
            </div>
            <div className="about-cta-buttons">
              <button onClick={() => handleOpenContact('requested')} className="btn btn-primary" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {t('about.ctaContact2')} <ArrowRight size={18} />
              </button>
              <Link to="/maskiner" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                {t('about.ctaMachines2')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Styles ──────────────────────────────────────────────── */}
      <style>{`
        .about-hero-section {
          padding-top: 2rem !important;
        }
        @media (min-width: 768px) {
          .about-hero-section {
            padding-top: 4rem !important;
            min-height: calc(100svh - 93px);
            display: flex;
            align-items: center;
          }
        }
        @media (min-width: 1025px) {
          .about-hero-section {
            min-height: 100vh;
          }
        }
        .about-hero-inner {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
          align-items: center;
        }
        @media (min-width: 1024px) {
          .about-hero-inner {
            grid-template-columns: 1.2fr 1fr;
            gap: 5rem;
          }
        }
        .about-hero-text { max-width: 640px; }
        .about-hero-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }
        @media (max-width: 1023px) {
          .about-hero-inner {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 0;
          }
          .about-hero-text {
            display: contents;
          }
          .about-hero-text > .eyebrow {
            order: 1;
            margin-bottom: 1rem;
          }
          .about-hero-logo {
            order: 2;
            margin-bottom: 1rem;
          }
          .about-hero-text > h1.about-title {
            order: 3;
            margin-bottom: 1rem !important;
          }
          .about-hero-text > p {
            order: 4;
            margin-bottom: 2rem !important;
          }
          .about-hero-buttons {
            order: 5;
            justify-content: center;
            width: 100%;
          }
          
          .about-family-text, .about-what-text, .about-cta-text, .about-card {
            text-align: center;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .about-cta-buttons {
            justify-content: center;
          }
          .about-card-icon {
            margin-left: auto;
            margin-right: auto;
          }
          .about-card-btn {
            align-self: center;
          }
        }
        @media (min-width: 1024px) {
          .about-card-btn {
            align-self: flex-start;
          }
        }
        .about-hero-logo {
          display: flex;
          justify-content: center;
        }
        .about-hero-logo-wrap {
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: stretch;
          justify-content: center;
          width: 100%;
          max-width: 480px;
          min-height: 300px;
          box-shadow: var(--shadow-subtle);
          overflow: hidden;
        }
        .about-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .about-cards { grid-template-columns: 1fr 1fr; }
        }
        .about-card {
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          transition: transform var(--transition-normal), box-shadow var(--transition-normal);
        }
        .about-card:hover {
          transform: translateY(-6px);
          box-shadow: var(--shadow-hover);
        }
        .about-card-icon {
          margin-bottom: 1.5rem;
          width: 64px;
          height: 64px;
          background-color: var(--bg-tertiary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border-color);
        }
        .about-cta {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          align-items: center;
        }
        @media (min-width: 768px) {
          .about-cta {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
          }
        }
        .about-cta-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          flex-shrink: 0;
        }
        @media (max-width: 767px) {
          .about-hero-text > h1.about-title {
            display: none !important;
          }
        }
      `}</style>
      {/* ── Contact Modal ───────────────────────────────────────── */}
      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        subject={contactSubject}
      />
    </>
  );
};

export default AboutPage;
