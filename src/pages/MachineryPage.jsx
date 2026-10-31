import React, { useState, useEffect } from 'react';
import MachinerySection from '../components/MachinerySection';
import BuySellSection from '../components/BuySellSection';
import TransportSection from '../components/TransportSection';
import ContactModal from '../components/ContactModal';

const MachineryPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('sell');

  const handleOpenModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  useEffect(() => {
    document.title = 'Begagnade maskiner | Jannes Maskin & Smide';
    return () => { document.title = 'Jannes Maskin & Smide'; };
  }, []);

  return (
    <>
      <MachinerySection />
      <BuySellSection onOpenModal={() => handleOpenModal('sell')} />
      <TransportSection onOpenModal={() => handleOpenModal('transport')} />
      <ContactModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        subject={modalType} 
      />
    </>
  );
};

export default MachineryPage;
