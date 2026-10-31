import { Link } from 'react-router-dom';
import { useLang } from '../contexts/LanguageContext';

const ManufacturingSection = ({ onOpenModal }) => {
  const { t } = useLang();

  return (
    <section className="manufacturing-section">
      <div className="manufacturing-container">

        {/* Image Side */}
        <div className="manufacturing-image" />

        {/* Content Side */}
        <div className="manufacturing-content">
          <div className="mobile-center manufacturing-text-wrap">
            <span className="eyebrow">{t('manufacturing.eyebrow')}</span>
            <h2 className="mb-6">{t('manufacturing.heading')}</h2>
            <p className="mb-10" style={{ fontSize: '1.125rem' }}>{t('manufacturing.desc')}</p>
            
            {onOpenModal ? (
              <button 
                onClick={onOpenModal} 
                className="btn btn-primary" 
              >
                {t('manufacturing.cta')}
              </button>
            ) : (
              <Link to="/kontakt" className="btn btn-primary">
                {t('manufacturing.cta')}
              </Link>
            )}
          </div>
        </div>

      </div>
      <style>{`
        .manufacturing-section {
          /* Remove default section padding since this is a full-bleed block */
          padding: 0;
        }
        
        .manufacturing-container {
          display: flex;
          flex-wrap: wrap;
          min-height: 600px;
        }

        .manufacturing-image {
          flex: 1 1 50%;
          min-width: 300px;
          background-image: url("https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2070&auto=format&fit=crop");
          background-size: cover;
          background-position: center;
          min-height: 400px;
        }

        .manufacturing-content {
          flex: 1 1 50%;
          min-width: 300px;
          background-color: var(--bg-secondary);
          padding: clamp(4rem, 10vw, 6rem) clamp(2.5rem, 5vw, 4rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .manufacturing-text-wrap {
          max-width: 480px;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </section>
  );
};

export default ManufacturingSection;
