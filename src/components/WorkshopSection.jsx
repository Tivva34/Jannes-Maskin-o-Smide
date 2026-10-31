import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Hammer, Settings } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const WorkshopSection = ({ onOpenModal }) => {
  const { t } = useLang();

  const services = [
    {
      icon: <Wrench size={32} color="var(--accent-primary)" />,
      title: t('workshop.service1Title'),
      desc: t('workshop.service1Desc'),
    },
    {
      icon: <Settings size={32} color="var(--accent-primary)" />,
      title: t('workshop.service2Title'),
      desc: t('workshop.service2Desc'),
    },
    {
      icon: <Hammer size={32} color="var(--accent-primary)" />,
      title: t('workshop.service3Title'),
      desc: t('workshop.service3Desc'),
    },
  ];

  return (
    <section id="verkstad" className="section workshop-section">
      <div className="container">
        <div className="workshop-header">
          <span className="eyebrow fade-up" style={{ color: 'var(--accent-primary)' }}>{t('workshop.eyebrow')}</span>
          <h2 className="workshop-title fade-up delay-100">{t('workshop.heading')}</h2>
          <p className="workshop-desc fade-up delay-200">{t('workshop.desc')}</p>
        </div>

        <div className="workshop-grid">
          {services.map((service, idx) => (
            <div key={idx} className="workshop-card mobile-center">
              <div className="icon-container mb-6">{service.icon}</div>
              <h3 className="workshop-card-title">{service.title}</h3>
              <p style={{ margin: 0 }}>{service.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center" style={{ marginTop: '4rem' }}>
          {onOpenModal ? (
            <button 
              onClick={onOpenModal} 
              className="btn btn-primary" 
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '1rem' }}
            >
              {t('workshop.cta')}
            </button>
          ) : (
            <Link to="/kontakt" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              {t('workshop.cta')}
            </Link>
          )}
        </div>
      </div>
      <style>{`
        .workshop-section {
          background-color: var(--bg-tertiary);
          background-image: linear-gradient(to bottom, rgba(18, 20, 21, 0.9) 0%, rgba(18, 20, 21, 0.8) 100%), url("${import.meta.env.BASE_URL}images/hero_logo_no_text.jpg");
          background-size: cover;
          background-position: center;
          position: relative;
        }
        
        .workshop-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 5rem;
        }
        
        .workshop-title {
          max-width: 800px;
          margin-bottom: 1.5rem;
          color: #ffffff;
        }
        
        .workshop-desc {
          max-width: 600px;
          font-size: 1.25rem;
          margin: 0;
          color: rgba(255,255,255,0.9);
        }
        
        .workshop-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
          gap: var(--gap, 2rem);
        }
        
        .workshop-card {
          background-color: var(--bg-primary);
          border-radius: var(--radius-lg);
          padding: 3rem 2rem;
          border: 1px solid var(--border-color);
          transition: transform var(--transition-normal);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        
        .workshop-card:hover {
          transform: translateY(-8px);
        }
        
        .workshop-card-title {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }
      `}</style>
    </section>
  );
};

export default WorkshopSection;
