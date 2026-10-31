import { Phone, MapPin } from 'lucide-react';
import ContactForm from './ContactForm';
import { companyInfo } from '../data/company';
import { useLang } from '../contexts/LanguageContext';

const ContactSection = () => {
  const { t } = useLang();

  return (
    <section id="kontakt" className="section contact-section">
      <div className="container">
        <div className="text-center contact-header">
          <span className="eyebrow fade-up">{t('contact.eyebrow')}</span>
          <h2 className="fade-up delay-100">{t('contact.heading')}</h2>
        </div>

        <div className="contact-grid">

          {/* Kontaktinformation */}
          <div>
            <div className="contact-cards-grid">

              {/* Försäljning */}
              <div style={cardStyle}>
                <h3 className="contact-card-title">
                  {t('contact.sales')}
                </h3>
                <p className="contact-card-desc">
                  {companyInfo.contact.sales.name} <br />
                  <span className="contact-card-phone">{companyInfo.contact.sales.phone}</span>
                </p>
                <a href={companyInfo.contact.sales.phoneLink} className="btn btn-secondary contact-btn">
                  <Phone size={18} /> {t('contact.call')} {companyInfo.contact.sales.name}
                </a>
              </div>

              {/* Reparation */}
              <div style={cardStyle}>
                <h3 className="contact-card-title">
                  {t('contact.repair')}
                </h3>
                <p className="contact-card-desc">
                  {companyInfo.contact.repair.name} <br />
                  <span className="contact-card-phone">{companyInfo.contact.repair.phone}</span>
                </p>
                <a href={companyInfo.contact.repair.phoneLink} className="btn btn-secondary contact-btn">
                  <Phone size={18} /> {t('contact.call')} {companyInfo.contact.repair.name}
                </a>
              </div>
            </div>

            {/* Adress */}
            <div className="contact-address-wrap">
              <MapPin size={24} className="contact-address-icon" />
              <div>
                <h4 className="contact-address-title">
                  {companyInfo.name}
                </h4>
                <p className="contact-address-text">
                  {companyInfo.address.street}<br />
                  {companyInfo.address.zip} {companyInfo.address.city}
                </p>
                <a
                  href={companyInfo.contact.phoneLink}
                  className="contact-exchange-link"
                >
                  {t('contact.exchange')}: {companyInfo.contact.phone}
                </a>
              </div>
            </div>
          </div>

          {/* Formulär */}
          <div>
            <ContactForm />
          </div>

        </div>
      </div>

      <style>{`
        .contact-section {
          background-color: var(--bg-secondary);
          background-image: linear-gradient(to bottom, rgba(18, 20, 21, 0.9) 0%, rgba(18, 20, 21, 0.8) 100%), url("${import.meta.env.BASE_URL}images/hero_logo_no_text.jpg");
          background-size: cover;
          background-position: center;
          position: relative;
        }
        .contact-header {
          margin-bottom: 4rem;
        }
        .contact-header h2 {
          color: #ffffff;
        }
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4rem;
        }
        @media (min-width: 1024px) {
          .contact-grid { grid-template-columns: 1fr 1fr; }
        }
        .contact-cards-grid {
          display: grid;
          gap: 2rem;
          margin-bottom: 3rem;
        }
        .contact-card-title {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
        }
        .contact-card-desc {
          font-size: 1.125rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }
        .contact-card-phone {
          color: var(--text-secondary);
        }
        .contact-btn {
          width: 100%;
        }
        .contact-address-wrap {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }
        .contact-address-icon {
          flex-shrink: 0;
          margin-top: 0.25rem;
          color: var(--accent-primary);
        }
        .contact-address-title {
          font-size: 1.125rem;
          margin-bottom: 0.25rem;
          color: #ffffff;
        }
        .contact-address-text {
          margin: 0;
          color: rgba(255,255,255,0.9);
        }
        .contact-exchange-link {
          display: inline-block;
          margin-top: 1rem;
          font-weight: 600;
          color: #ffffff;
        }
      `}</style>
    </section>
  );
};

const cardStyle = {
  backgroundColor: 'var(--bg-surface)',
  padding: '2rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border-color)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
};

export default ContactSection;
