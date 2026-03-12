declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    toggleTranslatePanel?: () => void;
    translateTo?: (lang: string) => void;
    toggleAutoTranslate?: (enabled: boolean) => void;
    toggleUIMode?: (enabled: boolean) => void;
  }
}

const PAGE_LANGUAGE = "en";
const LANG_STORAGE = "rpg_lang";
const AUTO_TRANSLATE_STORAGE = "rpg_auto_translate";
const MOBILE_UI_STORAGE = "rpg_ui_mobile";

let currentLang = localStorage.getItem(LANG_STORAGE) || "";
let autoTranslate = localStorage.getItem(AUTO_TRANSLATE_STORAGE) === "true";

function getTranslateButton() {
  return document.getElementById("translate-btn");
}

function getTranslatePanel() {
  return document.getElementById("translate-panel");
}

function updateLanguageButtons() {
  document.querySelectorAll<HTMLButtonElement>(".lang-btn[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === currentLang);
  });
}

function setTranslateCookie(lang: string) {
  const value = lang ? `/auto/${lang}` : "";
  const expires = lang ? "" : "expires=Thu, 01 Jan 1970 00:00:00 UTC; ";
  const domain = location.hostname;

  if (domain && domain !== "localhost") {
    document.cookie = `googtrans=${value}; ${expires}path=/; domain=${domain}`;
  }
  document.cookie = `googtrans=${value}; ${expires}path=/`;
}

function dispatchComboChange(select: HTMLSelectElement) {
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function withTranslateCombo(
  callback: (select: HTMLSelectElement) => void,
  attempts = 24,
) {
  const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (select) {
    callback(select);
    return;
  }
  if (attempts <= 0) return;
  window.setTimeout(() => withTranslateCombo(callback, attempts - 1), 250);
}

function clearTranslationArtifacts() {
  document.body.classList.remove("translated-ltr", "translated-rtl");
  document.documentElement.classList.remove("translated-ltr", "translated-rtl");
  document.body.style.top = "0px";
}

function resolveResetValue(select: HTMLSelectElement) {
  const values = Array.from(select.options).map((option) => option.value);
  if (values.includes("")) return "";
  if (values.includes(PAGE_LANGUAGE)) return PAGE_LANGUAGE;
  return values[0] || "";
}

function applyLanguageToPage(lang: string) {
  setTranslateCookie(lang);
  withTranslateCombo((select) => {
    if (select.value !== lang) {
      select.value = lang;
    }
    dispatchComboChange(select);
  });
}

function restoreOriginalLanguage() {
  setTranslateCookie("");
  clearTranslationArtifacts();

  withTranslateCombo((select) => {
    const resetValue = resolveResetValue(select);
    select.value = resetValue;
    dispatchComboChange(select);

    window.setTimeout(() => {
      clearTranslationArtifacts();
      updateLanguageButtons();
    }, 180);
  });
}

function applyStoredTranslation(force = false) {
  if (!currentLang) return;
  if (!force && !autoTranslate) return;
  applyLanguageToPage(currentLang);
}

function toggleTranslatePanel() {
  getTranslatePanel()?.classList.toggle("open");
}

function closeTranslatePanel() {
  getTranslatePanel()?.classList.remove("open");
}

function translateTo(lang: string) {
  currentLang = lang;

  if (lang) {
    localStorage.setItem(LANG_STORAGE, lang);
  } else {
    localStorage.removeItem(LANG_STORAGE);
  }

  updateLanguageButtons();
  closeTranslatePanel();

  if (!lang) {
    restoreOriginalLanguage();
    return;
  }

  applyLanguageToPage(lang);
}

function toggleAutoTranslate(enabled: boolean) {
  autoTranslate = enabled;
  localStorage.setItem(AUTO_TRANSLATE_STORAGE, enabled ? "true" : "false");
  if (enabled) {
    applyStoredTranslation(true);
  }
}

function toggleUIMode(isMobile: boolean) {
  document.body.classList.toggle("force-mobile", isMobile);
  localStorage.setItem(MOBILE_UI_STORAGE, isMobile ? "true" : "false");
}

function bindTranslatePanel() {
  const button = getTranslateButton();
  const panel = getTranslatePanel();
  if (!button || !panel) return;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTranslatePanel();
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!button.contains(target) && !panel.contains(target)) {
      closeTranslatePanel();
    }
  });
}

function bindLanguageButtons() {
  document.querySelectorAll<HTMLButtonElement>(".lang-btn[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      translateTo(button.dataset.lang || "");
    });
  });
}

function bindToggles() {
  const autoToggle = document.getElementById("auto-translate-toggle");
  if (autoToggle instanceof HTMLInputElement) {
    autoToggle.checked = autoTranslate;
    autoToggle.addEventListener("change", () => {
      toggleAutoTranslate(autoToggle.checked);
    });
  }

  const uiToggle = document.getElementById("ui-mode-toggle");
  const forceMobile = localStorage.getItem(MOBILE_UI_STORAGE) === "true";
  if (uiToggle instanceof HTMLInputElement) {
    uiToggle.checked = forceMobile;
    uiToggle.addEventListener("change", () => {
      toggleUIMode(uiToggle.checked);
    });
  }

  if (forceMobile) {
    document.body.classList.add("force-mobile");
  }
}

function loadGoogleTranslateScript() {
  if (document.querySelector('script[data-google-translate-script="true"]')) return;

  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  script.dataset.googleTranslateScript = "true";
  document.head.appendChild(script);
}

function initTranslateWidget() {
  if (!getTranslateButton() || !getTranslatePanel()) return;

  bindTranslatePanel();
  bindLanguageButtons();
  bindToggles();
  updateLanguageButtons();
  loadGoogleTranslateScript();
  window.setTimeout(() => applyStoredTranslation(), 400);
}

window.googleTranslateElementInit = () => {
  const TranslateElement = (window as any).google?.translate?.TranslateElement;
  if (!TranslateElement) return;

  new TranslateElement(
    {
      pageLanguage: PAGE_LANGUAGE,
      autoDisplay: false,
    },
    "google_translate_element",
  );

  window.setTimeout(() => applyStoredTranslation(), 120);
};

window.toggleTranslatePanel = toggleTranslatePanel;
window.translateTo = translateTo;
window.toggleAutoTranslate = toggleAutoTranslate;
window.toggleUIMode = toggleUIMode;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTranslateWidget, { once: true });
} else {
  initTranslateWidget();
}

export {};
