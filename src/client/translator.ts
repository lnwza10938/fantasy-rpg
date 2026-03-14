/**
 * Simple Dual-Language Translator (EN/TH)
 * Focuses on speed, no reloads, and "view original" capability.
 */

const UI_DICTIONARY: Record<string, string> = {
  // Navigation
  "Home": "หน้าแรก",
  "Journey": "การผจญภัย",
  "World Map": "แผนที่โลก",
  "Create Hero": "สร้างฮีโร่",
  "Hero Archive": "คลังฮีโร่",
  "Logout": "ออกจากระบบ",
  
  // Auth
  "Enter the Realm": "เข้าสู่ดินแดน",
  "Sign in with email, continue as a guest, or use an invite code to reopen the same profile from another device.": 
    "เข้าสู่ระบบด้วยอีเมล เล่นต่อแบบเกสต์ หรือใช้อินไวท์โค้ดเพื่อเข้าใช้งานโปรไฟล์เดิมจากอุปกรณ์อื่น",
  "Email Address": "ที่อยู่อีเมล",
  "Password": "รหัสผ่าน",
  "Invite Code": "อินไวท์โค้ด",
  "Enter Realm": "เข้าสู่ดินแดน",
  "Continue as Guest": "เข้าเล่นแบบเกสต์",
  "Enter with Invite Code": "เข้าใช้งานด้วยโค้ด",
  "Use the same invite code to reopen the same profile from any device.": "ใช้โค้ดเดิมเพื่อเข้าใช้โปรไฟล์เดิมจากเครื่องใดก็ได้",
  "Need an account? Sign Up": "ยังไม่มีบัญชี? สมัครสมาชิก",
  "Have an account? Sign In": "มีบัญชีแล้ว? เข้าสู่ระบบ",
  "Guest mode stays on this device. Invite mode keeps a protected shared identity. Full accounts keep ownership of your legends and vault.":
    "โหมดเกสต์บันทึกเฉพาะเครื่องนี้ อินไวท์โค้ดแชร์ตัวตนได้ ส่วนบัญชีทางการจะบันทึกข้อมูลถาวร",

  // Hub / Wizard
  "Welcome to the Realm": "ยินดีต้อนรับสู่ดินแดน",
  "Use the hub to choose your next step: begin a new run, reopen a saved journey, or check the world map before heading back out.":
    "ใช้ศูนย์กลางเพื่อเลือกขั้นตอนต่อไป: เริ่มการผจญภัยใหม่ เปิดการเดินทางเดิม หรือตรวจสอบแผนที่โลก",
  "Realm Archive": "คลังดินแดน",
  "Saved Journeys": "การเดินทางที่บันทึกไว้",
  "Access Mode": "โหมดการเข้าถึง",
  "Begin New Journey": "เริ่มการผจญภัยใหม่",
  "Open World Map": "เปิดแผนที่โลก",
  "Open Hero Archive": "เปิดคลังฮีโร่",
  "Current Journey": "การผจญภัยปัจจุบัน",
  "Pick Up The Journey": "เดินทางต่อไป",
  "Recent Journeys": "การผจญภัยล่าสุด",
  "Refresh": "รีเฟรช",
  "Step 1: Build a World": "ขั้นตอนที่ 1: สร้างโลก",
  "Shape the realm before your legend enters it": "กำหนดภาพลักษณ์ของดินแดนก่อนเริ่มต้นตำนาน",
  "Next: Choose a Legend": "ถัดไป: เลือกตำนาน",
  "Next: Manifest Destiny": "ถัดไป: กำหนดชะตาชีวิต",
  "Begin Your Journey": "เริ่มต้นการเดินทาง",

  // Game UI
  "Hero": "ฮีโร่",
  "Level": "เลเวล",
  "Signature Skill": "สกิลประจำตัว",
  "Gear": "อุปกรณ์",
  "Weapon": "อาวุธ",
  "Armor": "ชุดเกราะ",
  "Relic": "เรลิค",
  "Items": "ไอเทม",
  "Action Log": "บันทึกการกระทำ",
  "Save Game": "บันทึกเกม",
  "Uncharted Realm": "ดินแดนที่ยังไม่สำรวจ",
  "Current Location": "ตำแหน่งปัจจุบัน",
  "Current Encounter": "สิ่งที่พบเจอ",
  "Battle": "การต่อสู้",
  "Outcome": "ผลลัพธ์",
  "Victory": "ชัยชนะ",
  "Defeat": "พ่ายแพ้",

  // Map Editor / Dev
  "Map Editor": "ตัวแก้ไขแผนที่",
  "World & Tools": "โลกและเครื่องมือ",
  "Tool Mode": "โหมดเครื่องมือ",
  "Layers": "เลเยอร์",
  "Quick Actions": "ทางลัด",
  "Inspector": "ตัวตรวจสอบ",
  "Selection": "สิ่งที่เลือก",
  "Global Layout": "เลย์เอาต์รวม",
  "Node": "โหนด",
  "Story": "เนื้อเรื่อง",
  "Fights": "การต่อสู้",
  "Draft": "แบบร่าง",
  "Preview": "ตัวอย่าง",
  "Undo": "เลิกทำ",
  "Redo": "ทำซ้ำ",
  "Validate": "ตรวจสอบ",
  "Save": "บันทึก",
  "Reset": "รีเซ็ต",
  "Paths": "เส้นทาง",
  "Nodes": "โหนด",
  "Labels": "ฉลาก",
  "Regions": "ภูมิภาค",
  "Terrain": "ภูมิประเทศ",

  // Forge Options
  "Identity": "ตัวตน",
  "Skill": "สกิล",
  "Combat Archetype": "รูปแบบการต่อสู้",
  "Skin Tone": "โทนสีผิว",
  "Face Shape": "รูปหน้า",
  "Hair Style & Color": "ทรงผมและสีผม",
  "Eye Color": "สีตา",
  "Warrior": "นักรบ",
  "Mage": "จอมเวท",
  "Rogue": "โจร",
  "Cleric": "นักบวช",
  "Roll New Skill": "สุ่มสกิลใหม่",
  "Manifest Destiny": "กำหนดโชคชะตา"
};

class DualTranslator {
  private currentLang: 'en' | 'th' = 'en';
  private observer: MutationObserver | null = null;

  constructor() {
    this.currentLang = (localStorage.getItem('app_lang') as 'en' | 'th') || 'en';
    this.init();
  }

  private init() {
    // Inject Toggle Button
    this.injectSwitcher();
    
    // Apply initial language
    if (this.currentLang === 'th') {
      setTimeout(() => this.applyThai(), 100);
    }

    // Observe changes to translate dynamic content
    this.observer = new MutationObserver(() => {
      if (this.currentLang === 'th') {
        this.applyThai();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  private injectSwitcher() {
    if (document.getElementById('dual-lang-switcher')) return;

    const style = document.createElement('style');
    style.innerHTML = `
      .dual-switcher {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        display: flex;
        background: rgba(14, 16, 21, 0.9);
        border: 1px solid rgba(212, 188, 132, 0.3);
        border-radius: 99px;
        padding: 4px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      .dual-btn {
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
      }
      .dual-btn.active {
        background: rgba(212, 188, 132, 0.2);
        color: #f4ead2;
      }
      .dual-btn:hover:not(.active) {
        color: #fff;
      }
    `;
    document.head.appendChild(style);

    const switcher = document.createElement('div');
    switcher.id = 'dual-lang-switcher';
    switcher.className = 'dual-switcher';
    switcher.innerHTML = `
      <button class="dual-btn ${this.currentLang === 'en' ? 'active' : ''}" data-lang="en">ENGLISH</button>
      <button class="dual-btn ${this.currentLang === 'th' ? 'active' : ''}" data-lang="th">ภาษาไทย</button>
    `;

    switcher.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn) {
        const lang = btn.dataset.lang as 'en' | 'th';
        this.setLanguage(lang);
      }
    });

    document.body.appendChild(switcher);
  }

  public setLanguage(lang: 'en' | 'th') {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    localStorage.setItem('app_lang', lang);

    // Update buttons
    document.querySelectorAll('.dual-btn').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.lang === lang);
    });

    if (lang === 'th') {
      this.applyThai();
    } else {
      this.restoreEnglish();
    }
  }

  private applyThai() {
    this.walk(document.body, (node) => {
      const text = node.nodeValue?.trim();
      if (!text) return;

      // 1. Static Dictionary Match
      const translated = UI_DICTIONARY[text];
      if (translated) {
        if (!node.parentElement?.hasAttribute('data-orig')) {
          node.parentElement?.setAttribute('data-orig', text);
        }
        node.nodeValue = node.nodeValue!.replace(text, translated);
        return;
      }

      // 2. Placeholder Check (Extra step)
      if (node.parentElement instanceof HTMLInputElement) {
        const ph = node.parentElement.placeholder;
        if (UI_DICTIONARY[ph]) {
          if (!node.parentElement.hasAttribute('data-orig-ph')) {
            node.parentElement.setAttribute('data-orig-ph', ph);
          }
          node.parentElement.placeholder = UI_DICTIONARY[ph];
        }
      }
    });
  }

  private restoreEnglish() {
    const elements = document.querySelectorAll('[data-orig]');
    elements.forEach(el => {
      const orig = el.getAttribute('data-orig');
      if (orig) {
        // Find text node and restore
        this.walk(el, (node) => {
          if (node.nodeValue && UI_DICTIONARY[orig] === node.nodeValue.trim()) {
            node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), orig);
          }
        });
      }
    });

    const placeholders = document.querySelectorAll('[data-orig-ph]');
    placeholders.forEach(el => {
      const orig = el.getAttribute('data-orig-ph');
      if (orig && el instanceof HTMLInputElement) {
        el.placeholder = orig;
      }
    });
  }

  private walk(node: Node, callback: (node: Text) => void) {
    if (node.nodeType === Node.TEXT_NODE) {
      callback(node as Text);
    } else {
      node.childNodes.forEach(child => this.walk(child, callback));
    }
  }
}

// Auto-init
export const translator = new DualTranslator();
