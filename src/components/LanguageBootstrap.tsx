// src/components/LanguageBootstrap.tsx
// Reads the saved language on mount and syncs it across the app.

'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/context/TranslationContext';

const LANGUAGE_KEYS = ['selectedLanguage', 'appLang'];

export default function LanguageBootstrap() {
  // If your TranslationContext exposes setters, we'll use them (best-effort).
  const ctx = (() => {
    try {
      return useTranslation();
    } catch {
      return null;
    }
  })() as null | {
    setTargetLanguage?: (code: string) => void;
    setLanguage?: (code: string) => void;
    targetLanguage?: string;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Find a saved language from localStorage (keep your existing keys)
    let saved = '';
    for (const k of LANGUAGE_KEYS) {
      const v = localStorage.getItem(k);
      if (v) { saved = v; break; }
    }
    if (!saved) return;

    // Fire a custom event so any listener (like your <T> logic) can react
    try {
      window.dispatchEvent(new CustomEvent('languageChange', { detail: saved }));
    } catch {}

    // Update provider immediately if it exposes a setter
    try {
      ctx?.setTargetLanguage?.(saved);
      ctx?.setLanguage?.(saved);
    } catch {
      // ignore—localStorage + event are enough as a fallback
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run only once on mount

  return null;
}
