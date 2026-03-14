/**
 * Google Translate Bridge v5 (Final Polish)
 * - Uses 'notranslate' on UI.
 * - Handles both Cookie and Combo-box triggers.
 * - Robust restoration with multiple detection layers.
 */

class GoogleTranslator {
  private currentLang: string = 'en';

  constructor() {
    this.currentLang = localStorage.getItem('app_lang') || 'en';
    this.init();
  }

  private init() {
    this.injectStyles();
    this.injectGoogleScripts();
    this.injectSwitcher();
    this.setupGlobalListeners();
    this.syncInitialState();
  }

  private injectStyles() {
    if (document.getElementById('google-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'google-bridge-style';
    style.innerHTML = `
      iframe.goog-te-banner-frame { display: none !important; }
      body { top: 0 !important; }
      #google_translate_element, .goog-te-gadget { 
        position: absolute;
        top: -1000px;
        opacity: 0;
        pointer-events: none;
      }
      .goog-te-spinner-pos { display: none !important; }
      
      /* Reset Google Font Overrides */
      font { background-color: transparent !important; box-shadow: none !important; }
      .goog-text-highlight { background-color: transparent !important; box-shadow: none !important; }

      /* Premium Switcher UI */
      .google-switcher {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 100000;
        display: flex;
        background: rgba(14, 16, 21, 0.9);
        border: 1px solid rgba(212, 188, 132, 0.3);
        border-radius: 99px;
        padding: 4px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      .google-btn {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.4);
        font-size: 11px;
        font-weight: 800;
        padding: 6px 16px;
        border-radius: 99px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: 'Inter', sans-serif;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .google-btn.active {
        background: rgba(212, 188, 132, 0.2);
        color: #f4ead2;
      }
      .google-btn:hover:not(.active) {
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  private injectGoogleScripts() {
    if (document.getElementById('google_translate_element')) return;
    
    const gElem = document.createElement('div');
    gElem.id = 'google_translate_element';
    gElem.className = 'notranslate';
    document.body.appendChild(gElem);

    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'th',
        autoDisplay: false
      }, 'google_translate_element');
    };

    const script = document.createElement('script');
    script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.head.appendChild(script);
  }

  private injectSwitcher() {
    if (document.querySelector('.google-switcher')) return;
    const switcher = document.createElement('div');
    switcher.className = 'google-switcher notranslate';
    switcher.innerHTML = `
      <button class="google-btn ${this.currentLang === 'en' ? 'active' : ''}" data-lang-set="en">EN</button>
      <button class="google-btn ${this.currentLang === 'th' ? 'active' : ''}" data-lang-set="th">TH</button>
    `;
    document.body.appendChild(switcher);
  }

  private setupGlobalListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-lang-set]');
      if (btn) {
        const lang = (btn as HTMLElement).dataset.langSet;
        if (lang) this.setLanguage(lang);
      }
    });
  }

  public setLanguage(lang: string) {
    if (this.currentLang === lang && document.documentElement.lang === lang) return;
    
    this.currentLang = lang;
    localStorage.setItem('app_lang', lang);

    document.querySelectorAll('[data-lang-set]').forEach(el => {
      el.classList.toggle('active', (el as HTMLElement).dataset.langSet === lang);
    });

    if (lang === 'th') {
      this.applyThai();
    } else {
      this.restoreEnglish();
    }
  }

  private applyThai() {
    this.setGoogleCookie('/en/th');
    this.triggerCombo('th');
  }

  private restoreEnglish() {
    this.setGoogleCookie(''); // Clear cookie

    // 1. Try to trigger "Show Original" in the hidden banner frame
    const banner = document.querySelector('.goog-te-banner-frame') as HTMLIFrameElement;
    if (banner && banner.contentWindow) {
      try {
        const resetBtn = banner.contentWindow.document.querySelector('.goog-te-button button') as HTMLElement;
        if (resetBtn) {
          resetBtn.click();
          return;
        }
      } catch (e) {}
    }

    // 2. Try to trigger via combo box
    this.triggerCombo('');

    // 3. Last resort fallback: If still translated, we might need a refresh,
    // but we'll try to just wait and re-trigger.
    setTimeout(() => {
        if (document.querySelector('font')) {
            this.triggerCombo('en'); // Sometimes value 'en' works better than empty
        }
    }, 500);
  }

  private setGoogleCookie(val: string) {
    const expires = val ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    const domain = window.location.hostname;
    document.cookie = "googtrans=" + val + "; path=/; " + expires;
    document.cookie = "googtrans=" + val + "; path=/; domain=" + domain + expires;
    if (domain.includes('.')) {
        const partDomain = "." + domain.split('.').slice(-2).join('.');
        document.cookie = "googtrans=" + val + "; path=/; domain=" + partDomain + expires;
    }
  }

  private triggerCombo(lang: string) {
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (combo) {
      combo.value = lang;
      combo.dispatchEvent(new Event('change'));
    } else {
      // Find ANY select with TH option
      const selects = document.querySelectorAll('select');
      for (const s of Array.from(selects)) {
          if (Array.from(s.options).some(o => o.value === 'th')) {
              s.value = lang;
              s.dispatchEvent(new Event('change'));
              return;
          }
      }
      setTimeout(() => this.triggerCombo(lang), 500);
    }
  }

  private syncInitialState() {
    const check = () => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        if (this.currentLang === 'th') this.applyThai();
      } else {
        setTimeout(check, 1000);
      }
    };
    if (this.currentLang === 'th') check();
  }
}

export const translator = new GoogleTranslator();
