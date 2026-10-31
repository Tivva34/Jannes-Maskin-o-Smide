import { useState, useEffect } from 'react';
import Hero from '../components/Hero';
import TrustSection from '../components/TrustSection';
import ContactModal from '../components/ContactModal';

const HomePage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Jannes Maskin & Smide | Lantbruksmaskiner, verkstad & smide';
  }, []);

  return (
    <>
      <Hero onOpenContact={() => setModalOpen(true)} />
      <TrustSection />
      
      <ContactModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        subject="other" 
      />
    </>
  );
};

export default HomePage;
