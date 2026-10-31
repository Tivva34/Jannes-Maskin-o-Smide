import React from 'react';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { useLang } from '../contexts/LanguageContext';

const TransportSection = ({ onOpenModal }) => {
  const { t } = useLang();

  return (
    <section className="section transport-section">
      <div className="container">
        <div className="transport-wrapper">
          <div className="transport-content">
            <div className="transport-icon">
              <Truck size={32} />
            </div>
            <div>
              <h2 className="transport-heading">{t('transport.heading')}</h2>
              <p className="transport-desc">
                {t('transport.desc')}
              </p>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            {onOpenModal ? (
              <button 
                onClick={onOpenModal} 
                className="btn transport-btn" 
              >
                {t('transport.cta')}
              </button>
            ) : (
              <Link to="/kontakt" className="btn transport-btn">
                {t('transport.cta')}
              </Link>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .transport-section {
          background-color: var(--accent-primary);
          color: #000;
          padding: 4rem 0;
        }
        
        .transport-icon {
          background-color: #000;
          color: var(--accent-primary);
          padding: 1rem;
          border-radius: 50%;
        }
        
        .transport-heading {
          margin: 0;
          font-size: 2rem;
          color: #000;
        }
        
        .transport-desc {
          margin: 0;
          font-size: 1.125rem;
          color: rgba(0,0,0,0.8);
          margin-top: 0.5rem;
          max-width: 500px;
        }
        
        .transport-btn {
          background-color: #000;
          color: var(--accent-primary);
          padding: 1rem 2rem;
          font-size: 1.125rem;
          text-decoration: none;
          border: none;
          cursor: pointer;
        }

        .transport-btn:hover {
          background-color: #1a1a1a;
          color: var(--accent-primary);
        }

        .transport-wrapper {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
        }
        .transport-content {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex: 1 1 300px;
        }
        @media (max-width: 767px) {
          .transport-wrapper {
            flex-direction: column;
            text-align: center;
          }
          .transport-content {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
};

export default TransportSection;
