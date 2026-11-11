import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Calendar, Tag, ChevronRight, X, ChevronLeft } from 'lucide-react';
import { getMachineBySlug, getSimilarMachines } from '../lib/machinesService';
import { useLang } from '../contexts/LanguageContext';
import QuoteModal from '../components/QuoteModal';
import ContactModal from '../components/ContactModal';
import TransportSection from '../components/TransportSection';

const MachineDetailsPage = () => {
  const { slug } = useParams();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [similarMachines, setSimilarMachines] = useState([]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteModalType, setQuoteModalType] = useState('machine');
  const [touchStart, setTouchStart] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const handleOpenQuoteModal = (type = 'machine') => {
    setQuoteModalType(type);
    setQuoteModalOpen(true);
  };
  
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalSubject] = useState('');
  const [touchEnd, setTouchEnd] = useState(null);
  const { t, tDb, lang } = useLang();

  // Piltangenter och Escape för bildvisare (lightbox)
  const handleKeyDown = useCallback((e) => {
    if (!lightboxOpen) return;
    if (e.key === 'Escape') {
      setLightboxOpen(false);
    } else if (machine?.machine_images && machine.machine_images.length > 1) {
      const currentIndex = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
      if (e.key === 'ArrowRight') {
        setSelectedImage(machine.machine_images[(currentIndex + 1) % machine.machine_images.length]);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImage(machine.machine_images[(currentIndex - 1 + machine.machine_images.length) % machine.machine_images.length]);
      }
    }
  }, [lightboxOpen, machine, selectedImage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Förhindra bakgrundsrullning när bildvisaren är öppen
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  useEffect(() => {
    const fetchMachine = async () => {
      setLoading(true);
      setError('');
      const { data, error: err } = await getMachineBySlug(slug);
      if (err || !data) {
        setError(t('machineDetail.errorDefault'));
      } else {
        setMachine(data);
        if (data.machine_images && data.machine_images.length > 0) {
          const primaryImg = data.machine_images.find(img => img.is_primary);
          setSelectedImage(primaryImg || data.machine_images[0]);
        }
        const { data: similarData } = await getSimilarMachines(data.id, data.category, 3);
        if (similarData) setSimilarMachines(similarData);
      }
      setLoading(false);
    };
    fetchMachine();
  }, [slug, t, lang]);

  useEffect(() => {
    if (machine) {
      const displayMachineName = lang === 'en' ? (machine.name_en || machine.name) : machine.name;
      document.title = `${displayMachineName} | Jannes Maskin & Smide`;
    }
    return () => {
      document.title = 'Jannes Maskin & Smide';
    };
  }, [machine, lang]);

  // Obs: t är stabil (memoiserad i kontexten) – vi hämtar medvetet bara om när slug eller språk ändras

  if (loading) {
    return (
      <div style={{ minHeight: 'clamp(400px, 60vh, 800px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: '1rem' }} />
        <span style={{ fontSize: '1.125rem' }}>{t('machineDetail.loading')}</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="container" style={{ padding: '6rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{t('machineDetail.errorTitle')}</h1>
        <p style={{ fontSize: '1.125rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>{error}</p>
        <Link to="/maskiner" className="btn btn-primary">
          {t('machineDetail.showAllMachines')}
        </Link>
      </div>
    );
  }

  const defaultImage = 'https://placehold.co/800x600/1e2123/a0a6aa?text=Bild+saknas';
  const mainImageUrl = selectedImage ? selectedImage.image_url : defaultImage;

  const displayMachineName = lang === 'en' ? (machine.name_en || machine.name) : machine.name;
  const displayMachineDesc = lang === 'en' ? (machine.description_en || machine.description) : machine.description;
  const displayFeatures = lang === 'en' ? (machine.features_en && machine.features_en.length > 0 ? machine.features_en : machine.features) : machine.features;
  const specsObject = lang === 'en' && machine.specs_en && Object.keys(machine.specs_en).length > 0 ? machine.specs_en : machine.specs;
  const specsEntries = specsObject ? Object.entries(specsObject) : [];

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (machine?.machine_images && machine.machine_images.length > 1) {
        const cur = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
        if (distanceX > 0) {
          // Svep vänster -> nästa bild
          if (cur < machine.machine_images.length - 1) {
            setSelectedImage(machine.machine_images[cur + 1]);
          }
        } else {
          // Svep höger -> föregående bild
          if (cur > 0) {
            setSelectedImage(machine.machine_images[cur - 1]);
          }
        }
      }
    }
  };

  return (
    <>
      <div style={{ backgroundColor: 'var(--bg-primary)', paddingBottom: '4rem' }}>

        {/* Brödsmulor */}
        <div style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', padding: '1rem 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Link to="/" style={{ color: 'var(--text-muted)' }}>{t('machineDetail.home')}</Link>
              <ChevronRight size={14} />
              <Link to="/maskiner" style={{ color: 'var(--text-muted)' }}>{t('machineDetail.machines')}</Link>
              <ChevronRight size={14} />
              <ChevronRight size={14} />
              <span style={{ color: 'var(--text-primary)' }}>{displayMachineName}</span>
            </div>
          </div>
        </div>

        <div className="container" style={{ marginTop: '3rem' }}>
          <Link to="/maskiner" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem', fontWeight: 500 }}>
            <ArrowLeft size={16} /> {t('machineDetail.back')}
          </Link>

          <div className="machine-details-grid">

            {/* Vänster – Bildgalleri */}
            <div className="fade-up machine-details-media" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
                position: 'relative',
                marginBottom: '1rem',
                aspectRatio: '4/3',
                maxHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'zoom-in',
                touchAction: 'pan-y',
              }}
                onClick={() => setLightboxOpen(true)}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEndHandler}
              >
                <img
                  src={mainImageUrl}
                  alt={selectedImage ? selectedImage.alt_text || displayMachineName : displayMachineName}
                  style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', padding: '1rem' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
                />
              </div>

              {/* Miniatyrbilder */}
              {machine.machine_images && machine.machine_images.length > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 80px), 1fr))', gap: '0.75rem' }}>
                  {machine.machine_images.map(img => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedImage(img)}
                      style={{
                        padding: 0,
                        background: 'none',
                        border: selectedImage?.id === img.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        aspectRatio: '1',
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <img
                        src={img.image_url}
                        alt={img.alt_text}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Höger – Maskininformation */}
            <div className="fade-up delay-100 machine-details-info" style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.2 }}>
                {displayMachineName}
              </h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                {/* machine.type och machine.year är databasdata */}
                {machine.type && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <Tag size={16} color="var(--accent-primary)" /> {tDb(machine.type, 'machinery.types')}
                  </div>
                )}
                {machine.year && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <Calendar size={16} color="var(--accent-primary)" /> {machine.year}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', fontFamily: 'Outfit, sans-serif' }}>
                {machine.price != null
                  ? `${machine.price.toLocaleString('sv-SE')} kr (exklusive moms)`
                  : t('machineDetail.priceOnRequest')}
              </div>

              {/* Beskrivning */}
              {displayMachineDesc && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {t('machineDetail.description')}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {displayMachineDesc}
                  </p>
                </div>
              )}

              {/* Egenskaper */}
              {displayFeatures && displayFeatures.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {t('machineDetail.features')}
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {displayFeatures.map((feature, idx) => (
                      <li key={idx} style={{ backgroundColor: 'var(--bg-surface)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9375rem', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specifikationer – rubrik översatt, nycklar/värden är databasdata */}
              {specsEntries.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    {t('machineDetail.specs')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {specsEntries.map(([key, value], idx) => (
                      <div key={idx} style={{ display: 'flex', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ flex: '1', color: 'var(--text-secondary)', fontWeight: 500 }}>{key}</span>
                        <span style={{ flex: '1', color: 'var(--text-primary)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Undre rad: Liknande maskiner till vänster och kontaktknappar till höger, startar på exakt samma höjd på desktop */}
            <div className="machine-details-bottom-row">
              {similarMachines.length > 0 ? (
                <div className="similar-machines-section">
                  <h3 className="similar-machines-title">
                    {t('machineDetail.similarMachines')}
                  </h3>
                  <div className="similar-machines-list">
                    {similarMachines.map(m => {
                      let thumbUrl = defaultImage;
                      if (m.machine_images && m.machine_images.length > 0) {
                        const primary = m.machine_images.find(img => img.is_primary);
                        thumbUrl = primary ? primary.image_url : m.machine_images[0].image_url;
                      }
                      const simName = lang === 'en' ? (m.name_en || m.name) : m.name;
                      return (
                        <Link
                          key={m.id}
                          to={`/maskiner/${m.slug}`}
                          className="similar-machine-card"
                        >
                          <div className="similar-machine-thumb">
                            <img src={thumbUrl} alt={simName} loading="lazy" />
                          </div>
                          <div className="similar-machine-info">
                            <div className="similar-machine-type">
                              {tDb(m.type, 'machinery.types')}
                            </div>
                            <div className="similar-machine-name">
                              {simName}
                            </div>
                            <div className="similar-machine-price">
                              {m.price != null
                                ? `${m.price.toLocaleString('sv-SE')} kr`
                                : t('machineDetail.priceOnRequestShort')}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="similar-machines-placeholder" />
              )}

              <div className="machine-details-actions">
                <button
                  onClick={() => handleOpenQuoteModal('machine')}
                  className="btn btn-primary"
                  style={{ padding: '1rem', fontSize: '1.125rem', width: '100%' }}
                >
                  {t('machineDetail.contactMachine')}
                </button>
                <a
                  href="tel:+46700000003"
                  className="btn btn-secondary"
                  style={{ padding: '1rem', fontSize: '1.125rem', display: 'flex', justifyContent: 'center' }}
                  onClick={(e) => {
                    if (window.innerWidth >= 768) {
                      e.preventDefault();
                      setShowPhoneModal(true);
                    }
                  }}
                >
                  <Phone size={18} /> {t('machineDetail.callSales')}
                </a>
              </div>
            </div>

          </div>

        </div>
      </div> {/* Slut på huvudinnehåll */}


      <style>{`
        .machine-details-grid {
          display: grid;
          grid-template-columns: 1fr;
          row-gap: 0;
          column-gap: 3rem;
        }

        /* Desktop (>= 992px): 2 kolumner */
        @media (min-width: 992px) {
          .machine-details-grid {
            grid-template-columns: 1fr 1fr;
            align-items: start;
          }
        }

        /* Bottenrad med liknande maskiner och kontaktknappar */
        .machine-details-bottom-row {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* Mobil och surfplatta (< 992px): Kontaktknapparna först, därefter liknande maskiner under båda knapparna */
        @media (max-width: 991px) {
          .machine-details-bottom-row .machine-details-actions {
            order: 1;
          }
          .machine-details-bottom-row .similar-machines-section {
            order: 2;
            margin-top: 1rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color);
          }
          .machine-details-bottom-row .similar-machines-placeholder {
            display: none;
          }
        }

        /* Desktop (>= 992px): Spänner över båda kolumnerna, med Liknande maskiner till vänster och kontaktknappar till höger på exakt samma höjd */
        @media (min-width: 992px) {
          .machine-details-bottom-row {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3rem;
            row-gap: 3rem;
            column-gap: 2.25rem;
            align-items: start;
            margin-top: 1rem;
          }
          .machine-details-bottom-row .similar-machines-section {
            grid-column: 1;
            margin-top: 0;
            padding-top: 0;
            border-top: none;
          }
          .machine-details-bottom-row .similar-machines-placeholder {
            grid-column: 1;
          }
          .machine-details-bottom-row .machine-details-actions {
            grid-column: 2;
            margin-top: 3.15rem;
            padding-top: 0;
          }
        }

        .machine-details-actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .similar-machines-title {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
        }
        .similar-machines-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .similar-machine-card {
          display: flex;
          flex-direction: row;
          background-color: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          overflow: hidden;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          color: inherit;
          min-height: 130px;
        }
        .similar-machine-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .similar-machine-thumb {
          width: 160px;
          min-width: 160px;
          max-width: 160px;
          background-color: var(--bg-primary);
          flex-shrink: 0;
          aspect-ratio: 4/3;
        }
        .similar-machine-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .similar-machine-info {
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          min-width: 0;
        }
        .similar-machine-type {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin-bottom: 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .similar-machine-name {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          font-size: 1.0625rem;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .similar-machine-price {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 1.0625rem;
          margin-top: auto;
          white-space: nowrap;
        }

        @media (max-width: 540px) {
          .similar-machine-card {
            flex-direction: column;
          }
          .similar-machine-thumb {
            width: 100%;
            min-width: 100%;
            max-width: 100%;
          }
        }
      `}</style>

      {/* Bildvisare (lightbox) */}
      {lightboxOpen && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', touchAction: 'none' }}
          onClick={() => setLightboxOpen(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEndHandler}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', zIndex: 10000 }}
          >
            <X size={32} />
          </button>

          {machine?.machine_images && machine.machine_images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cur = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
                setSelectedImage(machine.machine_images[(cur - 1 + machine.machine_images.length) % machine.machine_images.length]);
              }}
              style={{ position: 'absolute', left: '1rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', zIndex: 10000 }}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <img
            src={mainImageUrl}
            alt={selectedImage ? selectedImage.alt_text || displayMachineName : displayMachineName}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: 'clamp(400px, 90vh, 1000px)', objectFit: 'contain', display: 'block' }}
            onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
          />

          {machine?.machine_images && machine.machine_images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const cur = machine.machine_images.findIndex(img => img.id === selectedImage?.id);
                setSelectedImage(machine.machine_images[(cur + 1) % machine.machine_images.length]);
              }}
              style={{ position: 'absolute', right: '1rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', zIndex: 10000 }}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}

      {/* Telefonmodal */}
      {showPhoneModal && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setShowPhoneModal(false)}
        >
          <div 
            style={{ backgroundColor: 'var(--bg-primary)', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-heavy)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem', display: 'block' }} />
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>{t('machineDetail.callSales')}</h3>
            <a href="tel:+46700000003" style={{ fontSize: '2rem', marginBottom: '2rem', display: 'block', color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 'bold' }}>070 000 00 03</a>
            <button onClick={() => setShowPhoneModal(false)} className="btn btn-secondary" style={{ width: '100%', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Stäng
            </button>
          </div>
        </div>
      )}

      {/* Offertmodal */}
      <QuoteModal
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        machine={machine}
        preselectedType={quoteModalType}
      />
      
      <ContactModal 
        isOpen={contactModalOpen} 
        onClose={() => setContactModalOpen(false)} 
        subject={contactModalSubject} 
      />

      <TransportSection onOpenModal={() => handleOpenQuoteModal('machine_transport')} />
    </>
  );
};

export default MachineDetailsPage;
