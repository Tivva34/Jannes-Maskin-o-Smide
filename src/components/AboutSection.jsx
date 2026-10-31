import { useLang } from '../contexts/LanguageContext';

const AboutSection = () => {
  const { t } = useLang();
  
  // Obs: om t('about.highlights') av någon anledning saknas används en reservlista
  const highlights = t('about.highlights') || [
    { title: "Erfarenhet", desc: "Sedan 2002" },
    { title: "Personlig service", desc: "Direkt kontakt med rätt person" },
    { title: "Maskiner & verkstad", desc: "Försäljning, reparation och tillverkning" },
    { title: "Lokalt", desc: "Exempelgatan 303, 999 93 Karlstad" }
  ];

  return (
    <section id="om-oss" className="section">
      <div className="container">
        <div className="about-grid">
          <div>
            <span className="eyebrow fade-up">Om Jannes Maskin & Smide</span>
            <h2 className="mb-6 fade-up delay-100">Ett maskinföretag med praktisk erfarenhet</h2>
            <p className="about-desc mb-8 fade-up delay-200">
              Jannes Maskin & Smide har erfarenhet av lantbruk och entreprenadmaskiner. Vi hjälper kunder med både maskinköp, reparationer och specialtillverkning. För oss är det viktigt att erbjuda utrustning och lösningar som vi själva vet fungerar i det praktiska arbetet.
            </p>

            <div className="highlights-grid">
              {highlights.map((item, idx) => (
                <div key={idx} className="highlight-item">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="about-image-wrapper">
            <img
              src={`${import.meta.env.BASE_URL}images/hero_logo.jpg`}
              alt="Jannes Maskin & Smide Logotyp"
              className="about-image"
            />
          </div>
        </div>
      </div>
      <style>{`
        .about-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4rem;
        }
        @media (min-width: 1024px) {
          .about-grid { 
            grid-template-columns: 1fr 1fr; 
          }
        }
        .about-desc {
          font-size: 1.25rem;
          max-width: 600px;
        }
        .highlights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
          gap: 2rem;
        }
        .highlight-item {
          padding-left: 1.5rem;
          border-left: 2px solid var(--accent-primary);
        }
        .highlight-item h4 {
          margin: 0;
          font-size: 1.125rem;
          color: var(--text-primary);
        }
        .highlight-item p {
          margin: 0;
          font-size: 0.9375rem;
          margin-top: 0.25rem;
          white-space: pre-line;
        }
        .about-image-wrapper {
          position: relative;
          border-radius: var(--radius-lg);
          overflow: hidden;
          min-height: 400px;
          display: flex;
          align-items: stretch;
          justify-content: center;
          box-shadow: var(--shadow-subtle);
          border: 1px solid var(--border-color);
        }
        .about-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </section>
  );
};

export default AboutSection;
