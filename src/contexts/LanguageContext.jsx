import { createContext, useContext, useState, useCallback } from 'react';
import translations from '../i18n/translations';

/* ─────────────────────────────────────────────────────────────
   LanguageContext – lättviktig språkhantering (i18n) för den publika sajten.
   Adminpanelen är medvetet INTE omsluten.

   Exponerar:
     lang      – aktuell språkkod ('sv' | 'en')
     setLang   – byt språk och spara i localStorage
     t(key)    – slå upp en punktseparerad nyckel, t.ex. t('hero.title1')
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'hms_lang';
const SUPPORTED = ['sv', 'en'];

function resolveKey(dict, key) {
  return key.split('.').reduce((obj, part) => obj?.[part], dict) ?? key;
}

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : 'sv';
  });

  const setLang = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return;
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
  }, []);

  const t = useCallback(
    (key) => resolveKey(translations[lang], key),
    [lang]
  );

  const tDb = useCallback(
    (value, dictKey = 'machinery.types') => {
      if (!value) return '';
      const standardKey = `${dictKey}.${value}`;
      const resolved = resolveKey(translations[lang], standardKey);
      if (resolved !== standardKey) return resolved;
      
      const dbValKey = `dbValues.${value}`;
      const dbResolved = resolveKey(translations[lang], dbValKey);
      if (dbResolved !== dbValKey) return dbResolved;

      return value;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tDb }}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * useLang – konsumera LanguageContext.
 * Måste användas inuti <LanguageProvider>.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
};
