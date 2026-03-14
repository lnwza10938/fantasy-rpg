/**
 * Google Translate Integration (Stable + Zero Reload)
 * This handles Google Translate widget without breaking the UI.
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
    this.pollForElement();
  }

  private injectStyles() {
    if (document.getElementById('google-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'google-bridge-style';
    style.innerHTML = `
      iframe.goog-te-banner-frame { display: none !important; }
      body { top: 0 !important; }
      #google_translate_element, .goog-te-gadget { display: none !important; }
      .goog-te-spinner-pos { display: none !important; }

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
      }
      .google-btn.active {
        background: rgba(212, 188, 132, 0.2);
        color: #f4ead2;
        box-shadow: inset 0 0 10px rgba(212, 188, 132, 0.1);
      }
      .google-btn:hover:not(.active) {
        color: #fff;
        background: rgba(255,255,255,0.05);
      }
    `;
    document.head.appendChild(style);
  }

  private injectGoogleScripts() {
    if (document.getElementById('google_translate_element')) return;
    
    const gElem = document.createElement('div');
    gElem.id = 'google_translate_element';
    document.body.appendChild(gElem);

    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,th',
        layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
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
    switcher.className = 'google-switcher';
    switcher.innerHTML = `
      <button class="google-btn ${this.currentLang === 'en' ? 'active' : ''}" data-lang-set="en">EN</button>
      <button class="google-btn ${this.currentLang === 'th' ? 'active' : ''}" data-lang-set="th">TH</button>
    `;

    document.body.appendChild(switcher);
  }

  private setupGlobalListeners() {
    // Listen for ANY element with data-lang-set or similar
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-lang-set]');
      if (btn) {
        const lang = (btn as HTMLElement).dataset.langSet;
        if (lang) this.setLanguage(lang);
      }
      
      // Also listen for your specific toggle switch if it exists
      const toggle = target.closest('#translate-toggle') as HTMLInputElement;
      if (toggle) {
        this.setLanguage(toggle.checked ? 'th' : 'en');
      }
    });
  }

  public setLanguage(lang: string) {
    this.currentLang = lang;
    localStorage.setItem('app_lang', lang);

    // Sync all UI buttons/toggles
    document.querySelectorAll('[data-lang-set]').forEach(el => {
      el.classList.toggle('active', (el as HTMLElement).dataset.langSet === lang);
    });
    
    const toggle = document.querySelector('#translate-toggle') as HTMLInputElement;
    if (toggle) toggle.checked = (lang === 'th');

    if (lang === 'en') {
      this.restoreOriginal();
    } else {
      this.triggerGoogle(lang);
    }
  }

  private restoreOriginal() {
    // 1. Try to find the 'Show Original' button in Google's hidden iframe
    const iframe = document.querySelector('.goog-te-banner-frame') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      const restoreBtn = iframe.contentWindow.document.querySelector('.goog-te-button button') as HTMLElement;
      if (restoreBtn) {
        restoreBtn.click();
        return;
      }
    }

    // 2. Fallback: Force the combo to empty and trigger change
    const googleCombo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (googleCombo) {
      googleCombo.value = '';
      googleCombo.dispatchEvent(new Event('change'));
    }
  }

  private triggerGoogle(lang: string) {
    const googleCombo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (googleCombo) {
      googleCombo.value = lang;
      googleCombo.dispatchEvent(new Event('change'));
    } else {
      setTimeout(() => this.triggerGoogle(lang), 500);
    }
  }

  private pollForElement() {
    const check = () => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        if (this.currentLang === 'th') this.triggerGoogle('th');
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  }
}

export const translator = new GoogleTranslator();
