import React, { useState, useEffect } from 'react';
import WorkshopSection from '../components/WorkshopSection';
import ManufacturingSection from '../components/ManufacturingSection';
import TransportSection from '../components/TransportSection';
import ContactModal from '../components/ContactModal';

const WorkshopPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('workshop');

  const handleOpenModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  useEffect(() => {
    document.title = 'Verkstad & Smide | Jannes Maskin & Smide';
    return () => { document.title = 'Jannes Maskin & Smide'; };
  }, []);

  return (
    <>
      <WorkshopSection onOpenModal={() => handleOpenModal('')} />
      <ManufacturingSection onOpenModal={() => handleOpenModal('manufacturing')} />

      <TransportSection onOpenModal={() => handleOpenModal('transport')} />
      
      <ContactModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        subject={modalType}
      />
    </>
  );
};

export default WorkshopPage;
