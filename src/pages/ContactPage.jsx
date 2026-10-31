import { useEffect } from 'react';
import ContactSection from '../components/ContactSection';

const ContactPage = () => {
  useEffect(() => {
    document.title = 'Kontakt | Jannes Maskin & Smide';
    return () => { document.title = 'Jannes Maskin & Smide'; };
  }, []);

  return (
    <>
      <ContactSection />
    </>
  );
};

export default ContactPage;
