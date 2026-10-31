import { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MachineryCard from './MachineryCard';
import { getPublicMachines } from '../lib/machinesService';
import { useLang } from '../contexts/LanguageContext';

const MachinerySection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [machines, setMachines] = useState([]);
  
  const [showAll, setShowAll] = useState(false);
  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const updateParams = (updates) => {
    if ('showAll' in updates) {
      setShowAll(updates.showAll);
    }
    // Auto-reset showAll if we are changing filters
    if (('category' in updates || 'q' in updates) && updates.showAll !== true) {
      setShowAll(false);
    }

    const newParams = new URLSearchParams(searchParams);
    let hasUrlUpdates = false;
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'showAll') return;
      hasUrlUpdates = true;
      if (value === null || value === '' || (key === 'category' && value === 'all')) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    
    if (hasUrlUpdates) {
      setSearchParams(newParams, { replace: true, preventScrollReset: true });
    }
  };
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [currentPage, setCurrentPage] = useState(0);
  
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const { t } = useLang();

  const CATEGORIES = ['all', 'tractor', 'construction', 'agriculture', 'implements', 'trailers', 'road_snow', 'other'];

  useEffect(() => {
    const fetchMachines = async () => {
      setLoading(true);
      const { data } = await getPublicMachines();
      if (data) setMachines(data);
      setLoading(false);
    };
    fetchMachines();
  }, []);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      checkScroll();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [machines]);

  const scrollBy = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const filteredMachines = machines.filter(m => {
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const searchableText = [
      m.name,
      m.name_en,
      m.type,
      ...(m.features || []),
      ...(m.features_en || [])
    ].filter(Boolean).join(' ').toLowerCase();

    return searchableText.includes(q);
  });

  const displayedMachines = showAll ? filteredMachines : filteredMachines.slice(0, 6);

  return (
    <section id="maskiner" className="section">
      <div className="container">
        <div className="mobile-center machinery-header">
          <span className="eyebrow fade-up">{t('machinery.eyebrow')}</span>
          <h2 className="mb-4 fade-up delay-100">{t('machinery.heading')}</h2>
          <p className="machinery-desc fade-up delay-200">{t('machinery.desc')}</p>
        </div>

        <div className="machinery-filters">
          {/* Search Input */}
          <div className="search-wrapper">
            <div className="search-icon">
              <Search size={20} />
            </div>
            <input
              type="search"
              className="search-input"
              placeholder={t('machinery.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => updateParams({ q: e.target.value, showAll: true })}
            />
            {searchQuery && (
              <button
                onClick={() => updateParams({ q: '' })}
                aria-label={t('machinery.clearSearch')}
                className="search-clear"
              >
                <X size={18} />
              </button>
            )}
          </div>

            {/* Categories */}
            {isMobile ? (
              <div className="fade-up mobile-category-nav delay-100">
                <button
                  className="nav-arrow"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  aria-label="Föregående kategorier"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="mobile-categories-wrapper">
                  {CATEGORIES.slice(currentPage * 2, (currentPage + 1) * 2).map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => updateParams({ category: cat, showAll: false })}
                        className={`category-btn ${isActive ? 'active' : ''}`}
                      >
                        {t(`machinery.categories.${cat}`)}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="nav-arrow"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(CATEGORIES.length / 2) - 1, p + 1))}
                  disabled={currentPage >= Math.ceil(CATEGORIES.length / 2) - 1}
                  aria-label="Nästa kategorier"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            ) : (
              <div className="category-nav-container">
                {canScrollLeft && (
                  <button
                    onClick={() => scrollBy(-200)}
                    aria-label="Visa tidigare kategorier"
                    className="scroll-btn"
                  >
                    <div className="scroll-icon-wrapper">
                      <ChevronLeft size={20} />
                    </div>
                  </button>
                )}

                <div
                  ref={scrollContainerRef}
                  onScroll={checkScroll}
                  className="category-scroll-container"
                >
                  {CATEGORIES.map(cat => {
                    const isActive = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => updateParams({ category: cat, showAll: false })}
                        className={`category-btn-desktop ${isActive ? 'active' : ''}`}
                      >
                        {t(`machinery.categories.${cat}`)}
                      </button>
                    );
                  })}
                </div>

                {canScrollRight && (
                  <button
                    onClick={() => scrollBy(200)}
                    aria-label="Visa fler kategorier"
                    className="scroll-btn"
                  >
                    <div className="scroll-icon-wrapper">
                      <ChevronRight size={20} />
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          <style>{`
            .machinery-header {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              margin-bottom: 2rem;
            }
            .machinery-desc {
              max-width: 600px;
              font-size: 1.25rem;
            }
            .machinery-filters {
              display: flex;
              flex-direction: column;
              gap: 1rem;
              margin-bottom: 3rem;
            }
            .search-wrapper {
              position: relative;
              width: 100%;
              max-width: 400px;
            }
            .search-icon {
              position: absolute;
              left: 1rem;
              top: 50%;
              transform: translateY(-50%);
              color: var(--text-muted);
              pointer-events: none;
              display: flex;
              align-items: center;
            }
            .search-input {
              width: 100%;
              padding: 0.875rem 2.5rem 0.875rem 3rem;
              border-radius: 9999px;
              border: 1px solid var(--border-color);
              background-color: var(--bg-surface);
              color: var(--text-primary);
              font-size: 1rem;
              outline: none;
              transition: border-color 0.2s;
            }
            .search-input:focus {
              border-color: var(--accent-primary);
            }
            .search-clear {
              position: absolute;
              right: 1rem;
              top: 50%;
              transform: translateY(-50%);
              background: none;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              padding: 0.25rem;
              display: flex;
              align-items: center;
            }
            
            .category-btn {
              flex: 1;
              padding: 0.5rem 0.5rem;
              border-radius: 9999px;
              border: 1px solid var(--border-color);
              background-color: var(--bg-secondary);
              color: var(--text-primary);
              cursor: pointer;
              font-weight: 600;
              font-size: 0.85rem;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              transition: all 0.2s ease-in-out;
              text-align: center;
            }
            .category-btn.active, .category-btn-desktop.active {
              border-color: var(--accent-primary);
              background-color: var(--accent-primary);
              color: var(--text-inverse);
            }
            .category-btn-desktop {
              flex-shrink: 0;
              padding: 0.4rem 1rem;
              border-radius: 9999px;
              border: 1px solid var(--border-color);
              background-color: var(--bg-secondary);
              color: var(--text-primary);
              cursor: pointer;
              font-weight: 600;
              font-size: 0.9rem;
              white-space: nowrap;
              transition: all 0.2s ease-in-out;
            }

            .scroll-btn {
              flex-shrink: 0;
              background: none;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0.25rem;
              color: var(--text-primary);
              cursor: pointer;
            }
            .scroll-icon-wrapper {
              background: var(--bg-surface);
              border-radius: 50%;
              padding: 4px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .category-scroll-container {
              flex: 1;
              min-width: 0;
              display: flex;
              gap: 0.75rem;
              overflow-x: auto;
              padding-bottom: 0.5rem;
              scrollbar-width: none;
              -ms-overflow-style: none;
              -webkit-overflow-scrolling: touch;
            }
            .category-scroll-container::-webkit-scrollbar {
              display: none;
            }
            
            .category-nav-container {
              display: none;
            }
            .mobile-category-nav {
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: calc(100% + 3rem);
              margin-left: -1.5rem;
              margin-right: -1.5rem;
              padding: 0 0.5rem;
              gap: 0.5rem;
            }
            .mobile-categories-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
              flex: 1;
              min-width: 0;
            }
            button.nav-arrow {
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 2.5rem;
              height: 2.5rem;
              border-radius: 9999px;
              background-color: var(--bg-surface);
              border: 1px solid var(--border-color);
              color: var(--text-primary);
              cursor: pointer;
              transition: all 0.2s ease-in-out;
            }
            button.nav-arrow:disabled {
              opacity: 0.2;
              cursor: not-allowed;
            }
            @media (min-width: 768px) {
              .mobile-category-nav {
                display: none;
              }
              .category-nav-container {
                display: flex;
                align-items: center;
                width: 100%;
                margin-left: 0;
                margin-right: 0;
                padding: 0;
                gap: 0.5rem;
              }
            }
            
            .machinery-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
              gap: 2rem;
            }
            .loading-container, .empty-container {
              text-align: center;
              padding: 4rem 0;
              color: var(--text-muted);
            }
            .loading-container {
              display: flex;
              justify-content: center;
            }
            .spinner {
              width: 24px;
              height: 24px;
              border: 2px solid var(--border-color);
              border-top-color: var(--accent-primary);
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin-right: 0.75rem;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>

        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            {t('machinery.loading')}
          </div>
        ) : machines.length === 0 ? (
          <div className="empty-container">
            <p style={{ fontSize: '1.125rem' }}>{t('machinery.empty')}</p>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="empty-container">
            <p className="mb-6" style={{ fontSize: '1.125rem' }}>
              {searchQuery ? t('machinery.noSearchResults') : t('machinery.emptyCategory')}
            </p>
            <button 
              onClick={() => updateParams({ category: 'all', q: '', showAll: false })} 
              className="btn btn-secondary"
            >
              {t('machinery.clearSearch')}
            </button>
          </div>
        ) : (
          <>
            <div className="machinery-grid">
              {displayedMachines.map(machine => (
                <MachineryCard key={machine.id} machine={machine} />
              ))}
            </div>

            {!showAll && filteredMachines.length > 6 && (
              <div className="text-center" style={{ marginTop: '4rem' }}>
                <button
                  onClick={() => updateParams({ showAll: true })}
                  className="btn btn-primary"
                  style={{ padding: '1rem 3rem', fontSize: '1.125rem' }}
                >
                  {t('machinery.showAll')} ({filteredMachines.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default MachinerySection;
