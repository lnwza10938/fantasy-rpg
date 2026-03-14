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
    this.pollForElement();
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      /* Hide Google Branding & Widgets */
      iframe.goog-te-banner-frame { display: none !important; }
      body { top: 0 !important; }
      #google_translate_element, .goog-te-gadget { display: none !important; }
      .goog-te-spinner-pos { display: none !important; }
      
      /* Switcher UI */
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
        text-transform: uppercase;
      }
      .google-btn.active {
        background: rgba(212, 188, 132, 0.25);
        color: #f4ead2;
      }
      .google-btn:hover:not(.active) {
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  private injectGoogleScripts() {
    // 1. Create target element
    const gElem = document.createElement('div');
    gElem.id = 'google_translate_element';
    document.body.appendChild(gElem);

    // 2. Initializer function
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,th',
        layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
      
      // Auto-trigger if saved
      if (this.currentLang === 'th') {
        setTimeout(() => this.setLanguage('th'), 1000);
      }
    };

    // 3. Load Script
    const script = document.createElement('script');
    script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    document.head.appendChild(script);
  }

  private injectSwitcher() {
    const switcher = document.createElement('div');
    switcher.className = 'google-switcher';
    switcher.innerHTML = `
      <button class="google-btn ${this.currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
      <button class="google-btn ${this.currentLang === 'th' ? 'active' : ''}" data-lang="th">TH</button>
    `;

    switcher.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn) {
        const lang = btn.dataset.lang!;
        this.setLanguage(lang);
      }
    });

    document.body.appendChild(switcher);
  }

  public setLanguage(lang: string) {
    this.currentLang = lang;
    localStorage.setItem('app_lang', lang);

    // UI Update
    document.querySelectorAll('.google-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.lang === lang);
    });

    const googleCombo = document.querySelector('.goog-te-combo') as HTMLSelectElement;
    if (googleCombo) {
      googleCombo.value = lang === 'en' ? '' : lang;
      googleCombo.dispatchEvent(new Event('change'));
    }
  }

  private pollForElement() {
    const check = () => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo && this.currentLang === 'th') {
        this.setLanguage('th');
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  }
}

export const translator = new GoogleTranslator();
