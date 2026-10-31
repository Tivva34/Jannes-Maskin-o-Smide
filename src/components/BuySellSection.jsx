import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';
import ContactModal from './ContactModal';

const BuySellSection = ({ onOpenModal }) => {
  const { t } = useLang();
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <section className="buy-sell-section">
      <div className="buy-sell-container">

        {/* Sälj */}
        <div className="buy-sell-half buy-sell-bg-secondary">
          <div className="mobile-center buy-sell-text-wrap" style={{ margin: '0 auto', width: '100%' }}>
            <span className="eyebrow">{t('buySell.sellEyebrow')}</span>
            <h2 className="mb-6">{t('buySell.sellHeading')}</h2>
            <p className="mb-10" style={{ fontSize: '1.125rem', whiteSpace: 'pre-line' }}>{t('buySell.sellDesc')}</p>
            {onOpenModal ? (
              <button 
                onClick={onOpenModal} 
                className="btn btn-primary mobile-center-self" 
              >
                {t('buySell.sellCta')}
              </button>
            ) : (
              <Link to="/kontakt" className="btn btn-primary mobile-center-self">
                {t('buySell.sellCta')}
              </Link>
            )}
          </div>
        </div>

        {/* Köp */}
        <div className="buy-sell-half buy-sell-bg-tertiary buy-sell-text-center relative-overflow">
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
            <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{t('buySell.buyEyebrow')}</span>
            <h2 className="mb-6">{t('buySell.buyHeading')}</h2>
            <p className="mb-10" style={{ fontSize: '1.125rem' }}>{t('buySell.buyDesc')}</p>
            <div className="buy-sell-buttons">
              <Link to="/maskiner" className="btn btn-secondary">
                {t('buySell.buyCta')}
              </Link>
              <button 
                onClick={() => setIsContactModalOpen(true)}
                className="btn btn-primary"
              >
                {t('nav.contactCta')}
              </button>
            </div>
          </div>
        </div>

      </div>
      <ContactModal 
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        subject="buy"
      />
      <style>{`
        .buy-sell-section {
          padding: 0;
        }

        .buy-sell-container {
          display: flex;
          flex-wrap: wrap;
        }

        .buy-sell-half {
          flex: 1 1 50%;
          min-width: 300px;
          padding: clamp(4rem, 10vw, 6rem) clamp(2.5rem, 5vw, 4rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .buy-sell-bg-secondary {
          background-color: var(--bg-secondary);
        }

        .buy-sell-bg-tertiary {
          background-color: var(--bg-tertiary);
        }

        .buy-sell-text-center {
          text-align: center;
        }

        .relative-overflow {
          position: relative;
          overflow: hidden;
        }

        .buy-sell-text-wrap {
          max-width: 480px;
          display: flex;
          flex-direction: column;
        }

        .buy-sell-buttons {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }
      `}</style>
    </section>
  );
};

export default BuySellSection;
