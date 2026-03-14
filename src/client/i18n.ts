type Translations = Record<string, any>;

const LANG_STORAGE_KEY = "rpg_lang";
const DEFAULT_LANG = "en";

class I18nManager {
  private currentLang: string = localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
  private translations: Translations = {};
  private initialized = false;

  async init() {
    if (this.initialized) return;
    await this.loadTranslations(this.currentLang);
    this.initialized = true;
    this.applyToPage();
  }

  async loadTranslations(lang: string) {
    try {
      const resp = await fetch(`/src/client/locales/${lang}.json`);
      if (!resp.ok) throw new Error(`Failed to load ${lang}`);
      this.translations = await resp.ok ? await resp.json() : {};
      this.currentLang = lang;
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch (err) {
      console.error("i18n Load Error:", err);
      // Fallback to English if not already English
      if (lang !== DEFAULT_LANG) {
          await this.loadTranslations(DEFAULT_LANG);
      }
    }
  }

  t(key: string): string {
    const keys = key.split(".");
    let current: any = this.translations;
    
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        return key; // Return original key if missing
      }
    }
    
    return typeof current === "string" ? current : key;
  }

  applyToPage() {
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        if (el instanceof HTMLInputElement && (el.type === "text" || el.type === "password" || !el.type)) {
            el.placeholder = this.t(key);
        } else if (el instanceof HTMLElement) {
            el.innerText = this.t(key);
        }
      }
    });

    const placeholders = document.querySelectorAll("[data-i18n-placeholder]");
    placeholders.forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key && el instanceof HTMLInputElement) {
            el.placeholder = this.t(key);
        }
    });
  }

  async setLanguage(lang: string) {
    await this.loadTranslations(lang);
    this.applyToPage();
    // Dispatch event for other components to listen
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: lang }));
  }

  getLanguage() {
    return this.currentLang;
  }
}

export const i18n = new I18nManager();

// Auto-init on script load
if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => i18n.init());
}
