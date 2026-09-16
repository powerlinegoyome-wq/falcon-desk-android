import tr from './tr.json';
import en from './en.json';
import ar from './ar.json';
import es from './es.json';
import { SupportedLanguage } from '../../types';
import { useChatStore } from '../store/useChatStore';

export const dictionaries: Record<SupportedLanguage, typeof tr> = {
  tr,
  en,
  ar,
  es,
};

export function getTranslation(lang: SupportedLanguage, path: string): string {
  const dict = dictionaries[lang] || dictionaries.tr;
  const keys = path.split('.');
  let current: any = dict;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      // Fallback to Turkish if key missing
      let fallback: any = dictionaries.tr;
      for (const fKey of keys) {
        if (fallback && typeof fallback === 'object' && fKey in fallback) {
          fallback = fallback[fKey];
        } else {
          return path;
        }
      }
      return typeof fallback === 'string' ? fallback : path;
    }
  }

  return typeof current === 'string' ? current : path;
}

/**
 * Custom React hook for reactive component translations
 */
export function useI18n() {
  const language = useChatStore((state) => state.settings.language || 'tr');
  const t = (path: string) => getTranslation(language, path);

  return {
    t,
    language,
    isRTL: language === 'ar',
  };
}
