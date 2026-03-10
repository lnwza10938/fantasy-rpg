/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// @ts-ignore - Vite handles import.meta.env at build time, bypassing strict IDE module checks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API = '/api';
const DEV_API = '/dev';
let G: any = {
    playerId: null, characterId: null, worldSeed: null, regions: [],
    selectedRegion: null, selectedRegionIndex: 0,
    user: null,
    gs: null,
    selectedLegend: null as any,
    allContent: { biomes: [], monsters: [], factions: [], maps: [] },
    customSelection: { biomes: [] as string[], monsters: [] as string[] }
};

// Vault and Forge state
let forgeState = { skillCode: '', skillData: null as any };

// --- AUTH ---
let authMode = 'login';
function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const titleEl = document.getElementById('auth-title');
    const btnEl = document.getElementById('btn-auth');
    const toggleEl = document.getElementById('auth-toggle');

    if (titleEl) titleEl.textContent = authMode === 'login' ? '🔐 Character Login' : '🛡️ Join the Realm';
    if (btnEl) btnEl.textContent = authMode === 'login' ? 'Enter Realm' : 'Claim Your Glory';
    if (toggleEl) toggleEl.textContent = authMode === 'login' ? 'Need an account? Sign Up' : 'Already have a hero? Login';
}

function showAuthError(msg: string) {
    const errEl = document.getElementById('auth-error');
    if (errEl) {
        errEl.textContent = '⚠️ ' + msg;
        errEl.style.display = 'block';
    }
}
function clearAuthError() {
    const errEl = document.getElementById('auth-error');
    if (errEl) errEl.style.display = 'none';
}

async function handleAuth(event?: Event) {
    if (event) event.preventDefault();
    clearAuthError();
    const emailEl = document.getElementById('auth-email') as HTMLInputElement;
    const passwordEl = document.getElementById('auth-password') as HTMLInputElement;
    const btnEl = document.getElementById('btn-auth') as HTMLButtonElement;
    const email = emailEl?.value.trim();
    const password = passwordEl?.value;
    if (!email || !password) return showAuthError('กรุณากรอก Email และ Password');

    btnEl.textContent = '⏳ กำลังเข้าสู่ระบบ...';
    btnEl.disabled = true;

    try {
        let res;
        if (authMode === 'login') {
            res = await supabase.auth.signInWithPassword({ email, password });
        } else {
            res = await supabase.auth.signUp({ email, password });
        }

        if (res.error) {
            // Translate common Supabase errors to user-friendly messages
            const errMsg = res.error.message;
            let friendlyMsg = errMsg;
            if (errMsg.includes('Invalid login credentials')) friendlyMsg = 'Email หรือ Password ไม่ถูกต้อง';
            else if (errMsg.includes('Email not confirmed')) friendlyMsg = 'กรุณายืนยัน Email ของคุณก่อน (ตรวจสอบ inbox)';
            else if (errMsg.includes('User already registered')) friendlyMsg = 'Email นี้มีบัญชีอยู่แล้ว กรุณา Login แทน';
            else if (errMsg.includes('Password should be')) friendlyMsg = 'Password ต้องมีอย่างน้อย 6 ตัวอักษร';
            throw new Error(friendlyMsg);
        }

        if (authMode === 'signup' && res.data.user && !res.data.session) {
            // Signup succeeded but needs email verification
            showAuthError('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบ Email เพื่อยืนยันบัญชีแล้วกลับมา Login ใหม่');
            const errEl = document.getElementById('auth-error');
            if (errEl) errEl.style.color = 'var(--green)';
            return;
        }

        if (res.data.user) {
            G.user = res.data.user;
            onLoginSuccess();
        }
    } catch (e: any) { showAuthError(e.message); }
    finally {
        btnEl.textContent = authMode === 'login' ? 'Enter Realm' : 'Claim Your Glory';
        btnEl.disabled = false;
    }
}

function onLoginSuccess() {
    const authScreen = document.getElementById('screen-auth');
    const gameContainer = document.getElementById('game-container');
    const userDisplay = document.getElementById('user-display');

    if (authScreen) authScreen.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'block';
    if (userDisplay && G.user) userDisplay.textContent = `Logged in as: ${G.user.email}`;
    showScreen('login');
    loadWorldContent(); // Load DB content for the world creation screen
    fetchSaveList();   // Fetch existing saves so user can see their data
    renderThemeBiomes('balanced'); // Initial biome preview
    renderThemeMonsters('balanced'); // Initial monster preview
}

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// Initialize state check
window.addEventListener('load', async () => {
    // TEMP: Skip login — go directly to world creation
    onLoginSuccess();

    // Normal auth check (re-enable when login is needed)
    // const { data } = await supabase.auth.getSession();
    // if (data.session) {
    //     G.user = data.session.user;
    //     onLoginSuccess();
    // }
});

// --- SCREEN ---
function showScreen(name: string) {
    // Ensure game-container is always visible when navigating app screens
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) gameContainer.style.display = 'block';

    const loginEl = document.getElementById('screen-login');
    const vaultEl = document.getElementById('screen-vault');
    const forgeEl = document.getElementById('screen-forge');
    const gameUi = document.getElementById('game-ui-screen');

    // Hide all major screens
    if (loginEl) loginEl.style.display = 'none';
    if (vaultEl) vaultEl.style.display = 'none';
    if (forgeEl) forgeEl.style.display = 'none';
    if (gameUi) gameUi.classList.remove('active');

    if (name === 'login') {
        if (loginEl) loginEl.style.display = 'block';
    } else if (name === 'vault') {
        if (vaultEl) vaultEl.style.display = 'block';
    } else if (name === 'forge') {
        if (forgeEl) forgeEl.style.display = 'block';
    } else {
        // For all gameplay screens (world, explore, combat, etc.), show the 4-panel game UI
        if (gameUi) gameUi.classList.add('active');

        // Map screen names to center tabs
        if (name === 'world') gpTab('map');
        else if (name === 'explore') gpTab('explore');
        else if (name === 'combat') gpTab('combat');

        // Refresh stats
        if (name === 'character') renderCharacter();
        if (name === 'inventory') renderInventory();
    }
}

// Switch center-top tabs: map | explore | combat
function gpTab(tab: string) {
    ['map', 'explore', 'combat'].forEach(t => {
        document.getElementById('sub-' + t)?.classList.toggle('active', t === tab);
        document.getElementById('tab-' + t)?.classList.toggle('active', t === tab);
    });
}


function renderNav() {
    const html = `
        <button class="btn btn-action" id="nav-btn-world">🗺️ Map</button>
        <button class="btn btn-action" id="nav-btn-char">👤 Stats</button>
        <button class="btn btn-action" id="nav-btn-inv">🎒 Inventory</button>
        <button class="btn btn-action" id="nav-btn-explore">🧭 Explore</button>
        <button class="btn btn-gold" id="nav-btn-save">💾 Save</button>
    `;
    ['game-nav', 'nav-char', 'nav-explore', 'nav-inv'].forEach(id => {
        const el = document.getElementById(id); if (el) {
            el.innerHTML = html;
            // Re-attach listeners because we re-rendered HTML
            document.getElementById('nav-btn-world')?.addEventListener('click', () => showScreen('world'));
            document.getElementById('nav-btn-char')?.addEventListener('click', () => showScreen('character'));
            document.getElementById('nav-btn-inv')?.addEventListener('click', () => showScreen('inventory'));
            document.getElementById('nav-btn-explore')?.addEventListener('click', () => showScreen('explore'));
            document.getElementById('nav-btn-save')?.addEventListener('click', saveGame);
        }
    });
}

function updateAllStatusBars() {
    const s = G.gs;
    if (!s) return;
    const html = `
        <div class="stat">🗺️ Seed<span class="val-accent">${G.worldSeed}</span></div>
        <div class="stat">⭐ Lv.<span class="val-accent">${s.level}</span></div>
        <div class="stat">❤️ HP<span class="val-green">${s.hp}/${s.maxHP}</span></div>
        <div class="stat">🔷 MP<span class="val-accent">${s.mana}/${s.maxMana}</span></div>
        <div class="stat">💰<span class="val-gold">${s.gold}</span></div>
        <div class="stat">✨ EXP<span class="val-accent">${s.exp}/${s.level * 100}</span></div>
        ${G.selectedRegion ? `<div class="stat">📍<span class="val-accent">${G.selectedRegion.name}</span></div>` : ''}
    `;
    ['status-bar', 'status-bar-char', 'status-bar-explore', 'status-bar-inv'].forEach(id => {
        const el = document.getElementById(id); if (el) el.innerHTML = html;
    });
    // Update new HUD elements
    updateHUD();
    renderCharacter();
}

function showToast(msg: string, type = 'success') {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = msg;
        t.className = 'toast ' + type + ' show';
        setTimeout(() => t.classList.remove('show'), 2200);
    }
}

// --- WORLD CREATION FUNCTIONS ---

// Expose functions so inline onclick= HTML attributes work with Vite modules
(window as any).selectPreset = selectPreset;
(window as any).rollRandomSeed = rollRandomSeed;
(window as any).fetchSaveList = fetchSaveList;
(window as any).loadGame = loadGame;
(window as any).saveGame = saveGame;
(window as any).logout = logout;
(window as any).toggleAuthMode = toggleAuthMode;
(window as any).handleAuth = handleAuth;
(window as any).deleteSave = deleteSave;
(window as any).exploreRegion = exploreRegion;
(window as any).showScreen = showScreen;
(window as any).gpTab = gpTab;
(window as any).wizardGoStep = wizardGoStep;
(window as any).rollSkill = rollSkill;
(window as any).submitNewGame = submitNewGame;
(window as any).showVault = showVault;
(window as any).showForge = showForge;
(window as any).rollForgeSkill = rollForgeSkill;
(window as any).confirmForge = confirmForge;
(window as any).backFromForge = backFromForge;
(window as any).selectLegend = selectLegend;
(window as any).toggleCustomTag = toggleCustomTag;
(window as any).forgeGoStep = forgeGoStep;

// Wizard state
let wizardState = { worldName: 'The Balanced Realm', charSuggestion: 'Hero', seed: 500000000 as number | null, skillCode: '', skillData: null as any };

function selectPreset(el: HTMLElement, worldName: string, charName: string, seed: number | null) {
    document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    wizardState.worldName = worldName;
    wizardState.charSuggestion = charName;
    wizardState.seed = seed;

    // Show or hide seed row
    const seedRow = document.getElementById('seed-row');
    if (seedRow) seedRow.style.display = el.dataset.preset === 'custom' ? 'flex' : 'none';

    const svEl = document.getElementById('input-seed') as HTMLInputElement;
    if (seed !== null) { svEl.value = String(seed); } else { svEl.value = ''; }

    // Update Biome & Monster Previews based on Selection
    renderThemeBiomes(el.dataset.preset || 'balanced');
    renderThemeMonsters(el.dataset.preset || 'balanced');
}

function toggleCustomTag(type: 'biomes' | 'monsters', name: string) {
    const list = G.customSelection[type];
    const index = list.indexOf(name);
    if (index > -1) {
        list.splice(index, 1);
    } else {
        list.push(name);
    }
    const preset = document.querySelector('.preset-card.selected') as HTMLElement;
    if (preset?.dataset.preset === 'custom') {
        renderThemeBiomes('custom');
        renderThemeMonsters('custom');
    }
}

function renderThemeMonsters(preset: string) {
    const monEl = document.getElementById('monster-list');
    if (!monEl) return;
    const headerEl = monEl.parentElement?.querySelector('h3');

    if (preset === 'custom') {
        if (headerEl) headerEl.textContent = '👾 Select Monsters for Your World';
        if (G.allContent.monsters.length === 0) {
            monEl.innerHTML = '<div style="color:var(--muted); font-size:11px">Loading global database...</div>';
            return;
        }
        monEl.innerHTML = G.allContent.monsters.map((m: any) => {
            const isSelected = G.customSelection.monsters.includes(m.name);
            return `
                <div class="monster-badge selectable ${isSelected ? 'selected' : ''}" onclick="toggleCustomTag('monsters', '${m.name}')">
                    <span class="m-name">${m.name}</span>
                    <span class="m-lv">Lv.${m.level}</span>
                    <span class="m-type">${m.biome || m.type || 'Unknown'}</span>
                </div>
            `;
        }).join('');
        return;
    }

    if (headerEl) headerEl.textContent = '👾 Monsters in this World';

    let filterBiomes: string[] = [];
    if (preset === 'balanced') filterBiomes = ['forest', 'coast', 'mountain', 'desert', 'Mixed'];
    else if (preset === 'inferno') filterBiomes = ['volcanic', 'Volcanic'];
    else if (preset === 'cursed') filterBiomes = ['cursed_land', 'swamp', 'Dark'];
    else if (preset === 'ancient') filterBiomes = ['ruins', 'Lore'];

    let monsters = G.allContent.monsters.filter((m: any) => filterBiomes.includes(m.biome) || filterBiomes.includes(m.type) || !m.biome);

    if (!monsters || monsters.length === 0) {
        monEl.innerHTML = '<div style="color:var(--muted); font-size:11px">Fetching global database...</div>';
        return;
    }

    monsters = monsters.sort(() => Math.random() - 0.5).slice(0, 3);

    monEl.innerHTML = monsters.map((m: any) => `
        <div class="monster-badge fade-in" style="border: 1px solid rgba(255,255,255,0.05); background: var(--surface2)">
            <span class="m-name" style="font-weight:600">${m.name}</span>
            <span class="m-lv" style="color:var(--accent); margin-left:5px">Lv.${m.level || m.lv || 1}</span>
            <span class="m-type" style="font-size:9px; color:var(--muted); margin-left:8px; background:rgba(0,0,0,0.2); padding:1px 4px; border-radius:3px">${m.biome || m.type || 'Unknown'}</span>
        </div>
    `).join('');
}

function renderThemeBiomes(preset: string) {
    const biomeEl = document.getElementById('biome-list');
    if (!biomeEl) return;
    const headerEl = biomeEl.parentElement?.querySelector('h3');

    if (preset === 'custom') {
        if (headerEl) headerEl.textContent = '🌍 Select World Biomes (Tags)';
        if (G.allContent.biomes.length === 0) {
            biomeEl.innerHTML = '<div style="color:var(--muted); font-size:11px">Loading global database...</div>';
            return;
        }
        biomeEl.innerHTML = G.allContent.biomes.map((b: any) => {
            const isSelected = G.customSelection.biomes.includes(b.name);
            return `
                <div class="biome-card selectable ${isSelected ? 'selected' : ''}" onclick="toggleCustomTag('biomes', '${b.name}')">
                    <div class="b-name">${b.name}</div>
                    <div class="b-desc">${b.description}</div>
                </div>
            `;
        }).join('');
        const preview = document.getElementById('content-preview');
        if (preview) preview.style.display = 'block';
        return;
    }

    if (headerEl) headerEl.textContent = '🌍 World Biomes';

    let filterBiomes: string[] = [];
    if (preset === 'balanced') filterBiomes = ['forest', 'coast', 'mountain', 'desert'];
    else if (preset === 'inferno') filterBiomes = ['volcanic'];
    else if (preset === 'cursed') filterBiomes = ['cursed_land', 'swamp'];
    else if (preset === 'ancient') filterBiomes = ['ruins'];

    let biomes = G.allContent.biomes.filter((b: any) => filterBiomes.includes(b.id) || filterBiomes.includes(b.name));

    if (!biomes || biomes.length === 0) {
        biomeEl.innerHTML = '<div style="color:var(--muted); font-size:11px">Fetching global database...</div>';
        return;
    }

    biomes = biomes.sort(() => Math.random() - 0.5).slice(0, 3);

    biomeEl.innerHTML = biomes.map((b: any) => `
        <div class="biome-card fade-in" style="border-left: 3px solid var(--accent)">
            <div class="b-name" style="font-weight:700; color:var(--text)">${b.name}</div>
            <div class="b-desc" style="font-size:10px; color:var(--muted); margin-top:2px">${b.description}</div>
        </div>
    `).join('');

    const preview = document.getElementById('content-preview');
    if (preview) preview.style.display = 'block';
}



function wizardGoStep(step: number) {
    // Validate on forward to Step 4 (Confirm)
    if (step === 4) {
        if (!G.selectedLegend) {
            alert('Please select a legend for this adventure.');
            return;
        }

        // Populate summary
        const summaryEl = document.getElementById('confirm-summary');
        if (summaryEl) {
            let worldName = wizardState.worldName || 'Custom World';
            const selectedPreset = document.querySelector('.preset-card.selected') as HTMLElement;
            const isCustom = selectedPreset?.dataset.preset === 'custom';

            if (isCustom) {
                const customNameField = (document.getElementById('input-world-name') as HTMLInputElement)?.value.trim();
                if (customNameField) worldName = customNameField;
            }

            let tagSummary = '';
            if (isCustom) {
                const bTags = G.customSelection.biomes.length > 0 ? G.customSelection.biomes.join(', ') : 'Default';
                const mTags = G.customSelection.monsters.length > 0 ? G.customSelection.monsters.join(', ') : 'Default';
                tagSummary = `
                    <div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border); font-size:10px;">
                        <span style="color:var(--muted)">Biomes:</span> ${bTags}<br>
                        <span style="color:var(--muted)">Monsters:</span> ${mTags}
                    </div>
                `;
            }

            summaryEl.innerHTML = `
                <div style="text-align:left; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:15px; margin-bottom:10px">
                    <div style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:4px">Selected World</div>
                    <div style="font-size:16px; font-weight:700">${worldName}</div>
                    <div style="font-size:11px; color:var(--muted)">Seed: ${wizardState.seed || 'Random'}</div>
                    ${tagSummary}
                </div>
                <div style="text-align:left; background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:15px;">
                    <div style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:4px">Chosen Legend</div>
                    <div style="font-size:16px; font-weight:700">👤 ${G.selectedLegend.name}</div>
                    <div style="font-size:11px; color:var(--accent); font-weight:600; margin-top:4px">🌟 ${G.selectedLegend.skill_data?.name || 'Innate Power'}</div>
                </div>
            `;
        }
    }

    if (step === 2) {
        fetchVaultSelections();
    }

    // Show/hide steps
    [1, 2, 3, 4].forEach(s => {
        const stepEl = document.getElementById(`wizard-step-${s}`);
        const indEl = document.getElementById(`step-indicator-${s}`);
        if (stepEl) stepEl.style.display = s === step ? 'block' : 'none';
        if (indEl) {
            if (s === step) {
                indEl.style.background = 'linear-gradient(135deg,var(--accent),var(--accent2))';
                indEl.style.color = '#fff';
            } else if (s < step) {
                indEl.style.background = 'rgba(79,195,247,0.15)';
                indEl.style.color = 'var(--accent)';
            } else {
                indEl.style.background = 'var(--surface2)';
                indEl.style.color = 'var(--muted)';
            }
        }
    });

    const loginScreen = document.getElementById('screen-login');
    if (loginScreen) loginScreen.scrollTo(0, 0);
    window.scrollTo(0, 0);
}

// --- VAULT & FORGE LOGIC ---

async function fetchVaultSelections() {
    const grid = document.getElementById('vault-selection-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--muted);">Loading vault...</div>';

    try {
        const res = await fetch(`${API}/characters?userId=${G.user?.id || ''}`);
        const j = await res.json();
        if (j.success && j.data.length > 0) {
            grid.innerHTML = j.data.map((c: any) => `
                <div class="legend-card ${G.selectedLegend?.id === c.id ? 'selected' : ''}" onclick="selectLegend('${c.id}', ${JSON.stringify(c).replace(/"/g, '&quot;')})">
                    <div class="name">${c.name}</div>
                    <div style="font-size:11px; color:var(--muted)">Lv.${c.level} Adventurer</div>
                    <div class="skill-badge">🌟 ${c.skill_data?.name || 'Innate'}</div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--muted);">Your vault is empty. Forge a legend first!</div>';
        }
    } catch (e) {
        grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--red);">Error loading vault.</div>';
    }
}

function selectLegend(id: string, legend: any) {
    G.selectedLegend = legend;
    document.querySelectorAll('#vault-selection-grid .legend-card').forEach(el => el.classList.remove('selected'));
    // Visual update will happen on re-render in fetchVaultSelections if we want, or manually here
    const nextBtn = document.getElementById('btn-vault-next') as HTMLButtonElement;
    if (nextBtn) nextBtn.disabled = false;

    // Add selected class to the clicked element (the one that triggered the event)
    const target = event?.currentTarget as HTMLElement;
    if (target) target.classList.add('selected');
}

function showVault() {
    showScreen('vault');
    renderFullVault();
}

async function renderFullVault() {
    const grid = document.getElementById('vault-full-list');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--muted);">Opening the archives...</div>';

    try {
        const res = await fetch(`${API}/characters?userId=${G.user?.id || ''}`);
        const j = await res.json();
        if (j.success && j.data.length > 0) {
            grid.innerHTML = j.data.map((c: any) => `
                <div class="legend-card">
                    <div class="name">${c.name}</div>
                    <div style="font-size:11px; color:var(--muted); margin-bottom:10px">Lv.${c.level} Adventurer</div>
                    <div style="background:rgba(255,255,255,0.03); border-radius:6px; padding:10px; font-size:11px">
                        <div style="color:var(--accent); font-weight:700; margin-bottom:4px">🌟 ${c.skill_data?.name || 'Unique Skill'}</div>
                        <div style="opacity:0.8; line-height:1.4">${c.skill_data?.description || 'No description available.'}</div>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--muted);">No legends have been recorded yet.</div>';
        }
    } catch (e) {
        grid.innerHTML = '<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: var(--red);">Vault connection failed.</div>';
    }
}

function forgeGoStep(step: number) {
    const s1 = document.getElementById('forge-step-1');
    const s2 = document.getElementById('forge-step-2');

    if (step === 2) {
        // Validate name before proceeding
        const nameVal = (document.getElementById('forge-name') as HTMLInputElement)?.value.trim();
        if (!nameVal) {
            alert('Please enter a name for your legend.');
            return;
        }
    }

    if (s1 && s2) {
        s1.style.display = step === 1 ? 'block' : 'none';
        s2.style.display = step === 2 ? 'block' : 'none';
    }
}

function showForge() {
    showScreen('forge');
    // Reset state
    forgeState = { skillCode: '', skillData: null };
    (document.getElementById('forge-name') as HTMLInputElement).value = '';

    // Reset appearance to default
    (document.getElementById('forge-gender') as HTMLSelectElement).value = 'male';
    (document.getElementById('forge-skin') as HTMLSelectElement).value = 'fair';
    (document.getElementById('forge-face') as HTMLSelectElement).value = 'round';
    (document.getElementById('forge-hair') as HTMLSelectElement).value = 'black';
    (document.getElementById('forge-eyes') as HTMLSelectElement).value = 'brown';

    document.getElementById('forge-skill-display')!.style.display = 'none';
    document.getElementById('forge-skill-placeholder')!.style.display = 'block';
    document.getElementById('forge-skill-box')!.style.display = 'none';
    (document.getElementById('btn-forge-confirm') as HTMLButtonElement).disabled = true;
    (document.getElementById('forge-error') as HTMLElement).style.display = 'none';

    forgeGoStep(1);
}

function backFromForge() {
    // Go back to wherever we were (Vault or Wizard Step 2)
    const vaultScreen = document.getElementById('screen-vault');
    if (vaultScreen && vaultScreen.style.display === 'block') {
        showScreen('vault'); // Refresh vault if needed
    } else {
        showScreen('login');
        wizardGoStep(2);
    }
}

async function rollForgeSkill() {
    const btn = document.getElementById('btn-roll-forge') as HTMLButtonElement;
    const confirmBtn = document.getElementById('btn-forge-confirm') as HTMLButtonElement;
    const display = document.getElementById('skill-code-forge') as HTMLElement;
    const resultBox = document.getElementById('forge-skill-box') as HTMLElement;
    const starArea = document.getElementById('forge-skill-display') as HTMLElement;
    const placeholder = document.getElementById('forge-skill-placeholder') as HTMLElement;
    const screen = document.getElementById('screen-forge');

    if (!btn || !confirmBtn || !display || !resultBox || !starArea || !placeholder || !screen) return;

    btn.disabled = true;
    confirmBtn.disabled = true;
    placeholder.style.display = 'none';
    starArea.style.display = 'block';
    resultBox.style.display = 'none';
    screen.classList.add('forging');

    let codeStr = '';
    let rolls = 0;
    const rollInterval = setInterval(() => {
        codeStr = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
        display.innerHTML = `<div style="font-family:monospace; font-size:18px; font-weight:900; letter-spacing:2px; color:var(--accent)">${codeStr.match(/.{1,3}/g)?.join('-')}</div>`;
        rolls++;
        if (rolls > 15) {
            clearInterval(rollInterval);
            fetchForgeInterpretation(codeStr);
        }
    }, 50);

    async function fetchForgeInterpretation(code: string) {
        display.innerHTML = `<div style="font-family:monospace; font-size:18px; font-weight:900; color:#fff">${code.match(/.{1,3}/g)?.join('-')}</div><div style="font-size:9px;color:var(--accent)">Interpreting...</div>`;

        try {
            const res = await fetch(`${DEV_API}/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'skill', context: code })
            });
            const j = await res.json();

            if (j.success && j.data) {
                forgeState.skillCode = code;
                forgeState.skillData = j.data;

                document.getElementById('forge-skill-name')!.textContent = j.data.name;
                document.getElementById('forge-skill-cost')!.textContent = j.data.mana_cost + ' MP';
                document.getElementById('forge-skill-desc')!.textContent = j.data.description;
                document.getElementById('forge-skill-cd')!.textContent = String(j.data.cooldown);
                document.getElementById('forge-skill-target')!.textContent = j.data.target_type;
                document.getElementById('forge-skill-scaling')!.textContent = j.data.scaling_stat;

                resultBox.style.display = 'block';
                display.innerHTML = `<div style="font-family:monospace; font-size:18px; font-weight:900; color:#fff">${code.match(/.{1,3}/g)?.join('-')}</div>`;
                confirmBtn.disabled = false;
            } else {
                display.innerHTML = `<div style="color:var(--red);font-size:10px">${j.error || 'Interpretation Failed'}</div>`;
            }
        } catch (e) {
            display.innerHTML = `<div style="color:var(--red);font-size:10px">Connection Error</div>`;
        } finally {
            if (screen) screen.classList.remove('forging');
            btn.disabled = false;
        }
    }
}

async function confirmForge() {
    const nameEl = document.getElementById('forge-name') as HTMLInputElement;
    const errEl = document.getElementById('forge-error') as HTMLElement;
    const btn = document.getElementById('btn-forge-confirm') as HTMLButtonElement;
    const name = nameEl.value.trim();

    if (!name) {
        errEl.textContent = 'Please enter a name for your legend.';
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Baking...';

    const appearance = {
        gender: (document.getElementById('forge-gender') as HTMLSelectElement)?.value || 'male',
        skinTone: (document.getElementById('forge-skin') as HTMLSelectElement)?.value || 'fair',
        faceShape: (document.getElementById('forge-face') as HTMLSelectElement)?.value || 'round',
        hairStyle: (document.getElementById('forge-hair') as HTMLSelectElement)?.value || 'black',
        eyeColor: (document.getElementById('forge-eyes') as HTMLSelectElement)?.value || 'brown'
    };

    try {
        const res = await fetch(API + '/character', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                characterName: name,
                playerName: G.user?.email?.split('@')[0] || 'Hero',
                userId: G.user?.id,
                email: G.user?.email,
                signatureSkill: { code: forgeState.skillCode, ...forgeState.skillData },
                appearance: appearance // Dev placeholder data for generating portraits later
            })
        });
        const j = await res.json();
        if (j.success) {
            showToast('Legend forged successfully! ✨', 'success');
            // Select this character if we're in the wizard flow
            G.selectedLegend = j.data;
            backFromForge();
        } else {
            errEl.textContent = j.error || 'Failed to forge legend.';
            errEl.style.display = 'block';
        }
    } catch (e) {
        errEl.textContent = 'Server connection failed.';
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Bake into Legend ⚔️';
    }
}

async function rollSkill() {
    const btn = document.getElementById('btn-roll-skill') as HTMLButtonElement;
    const nextBtn = document.getElementById('btn-step3-next') as HTMLButtonElement;
    const display = document.getElementById('skill-code-display') as HTMLElement;
    const resultBox = document.getElementById('skill-result-box') as HTMLElement;

    // Disable buttons
    btn.disabled = true;
    nextBtn.disabled = true;
    resultBox.style.display = 'none';

    // Animate rolling
    let codeStr = '';
    let rolls = 0;
    const rollInterval = setInterval(() => {
        codeStr = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
        const formatted = codeStr.match(/.{1,3}/g)?.join('-') || codeStr;
        display.innerHTML = `<div style="font-family:monospace; font-size:32px; font-weight:900; letter-spacing:4px; color:var(--accent); text-shadow:0 0 10px rgba(99,102,241,0.5)">${formatted}</div>`;
        rolls++;
        if (rolls > 15) {
            clearInterval(rollInterval);
            fetchAIinterpretation(codeStr);
        }
    }, 50);

    async function fetchAIinterpretation(code: string) {
        display.innerHTML = `<div style="font-family:monospace; font-size:32px; font-weight:900; letter-spacing:4px; color:var(--text); text-shadow:0 0 10px rgba(255,255,255,0.5)">${code.match(/.{1,3}/g)?.join('-')}</div><div style="font-size:10px;color:var(--accent);margin-top:8px">Interpreting with AI...</div>`;

        try {
            const res = await fetch(`${DEV_API}/ai/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'skill', context: code })
            });
            const j = await res.json();

            if (j.success && j.data) {
                wizardState.skillCode = code;
                wizardState.skillData = j.data;

                // Populate UI
                document.getElementById('skill-name-ui')!.textContent = j.data.name;
                document.getElementById('skill-cost-ui')!.textContent = j.data.mana_cost + ' MP';
                document.getElementById('skill-desc-ui')!.textContent = j.data.description;
                document.getElementById('skill-cd-ui')!.textContent = String(j.data.cooldown);
                document.getElementById('skill-target-ui')!.textContent = j.data.target_type;
                document.getElementById('skill-scaling-ui')!.textContent = j.data.scaling_stat + ' (' + j.data.power_multiplier + 'x)';

                resultBox.style.display = 'block';
                display.innerHTML = `<div style="font-family:monospace; font-size:24px; font-weight:900; letter-spacing:4px; color:#fff">${code.match(/.{1,3}/g)?.join('-')}</div>`;
                nextBtn.disabled = false;
            } else {
                display.innerHTML = `<div style="color:var(--red);font-size:12px">AI Interpretation Failed. Ensure API Key is set in Dev Panel.</div>`;
            }
        } catch (e) {
            console.error(e);
            display.innerHTML = `<div style="color:var(--red);font-size:12px">Network Error</div>`;
        }
        btn.disabled = false;
    }
}

function rollRandomSeed() {
    const svEl = document.getElementById('input-seed') as HTMLInputElement;
    svEl.value = String(Math.floor(Math.random() * 999999999));
}

async function loadWorldContent() {
    try {
        const res = await fetch(API + '/content');
        const j = await res.json();
        if (!j.success) return;
        const { biomes, monsters, factions, maps } = j.data;

        G.allContent.biomes = biomes || [];
        G.allContent.monsters = monsters || [];
        G.allContent.factions = factions || [];
        G.allContent.maps = maps || [];

        // Factions and Maps can still be rendered directly if they aren't theme-dependent
        const facEl = document.getElementById('faction-list');
        if (facEl && factions && factions.length > 0) {
            facEl.innerHTML = factions.map((f: any) => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px">
                    <div style="font-weight:700">${f.name}</div>
                    <div style="color:var(--muted);font-size:10px;margin-top:2px">${f.ideology || f.type || ''}</div>
                </div>
            `).join('');
        }

        const mapEl = document.getElementById('map-list');
        if (mapEl && maps && maps.length > 0) {
            mapEl.innerHTML = maps.map((m: any) => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px;display:flex;justify-content:space-between">
                    <span style="font-weight:600">${m.name}</span>
                    <span style="color:var(--red);font-size:10px">⚠ Lv.${m.danger_level}</span>
                </div>
            `).join('');
        }

        const preview = document.getElementById('content-preview');
        if (preview) preview.style.display = 'block';
    } catch (e) { console.warn('Could not load world content', e); }
}

async function submitNewGame() {
    if (!G.selectedLegend) return;

    const svEl = document.getElementById('input-seed') as HTMLInputElement;
    const errEl = document.getElementById('start-error') as HTMLElement;
    const sv = svEl?.value.trim();

    if (errEl) errEl.style.display = 'none';

    // --- STEP 1: Enter game screen IMMEDIATELY ---
    const seed = sv ? Number(sv) : Math.floor(Math.random() * 999999999);
    const selectedPreset = document.querySelector('.preset-card.selected') as HTMLElement;
    const presetName = selectedPreset?.querySelector('.preset-name')?.textContent || 'Unknown World';
    const isCustom = selectedPreset?.dataset.preset === 'custom';

    let finalWorldName = presetName;
    if (isCustom) {
        const customName = (document.getElementById('input-world-name') as HTMLInputElement)?.value.trim();
        if (customName) finalWorldName = customName;
    }

    G.worldSeed = seed;
    G.regions = [];
    G.gs = {
        characterName: G.selectedLegend.name,
        playerName: G.user?.email?.split('@')[0] || 'Hero',
        level: G.selectedLegend.level || 1,
        exp: 0, gold: 0,
        hp: G.selectedLegend.hp, maxHP: G.selectedLegend.max_hp,
        mana: G.selectedLegend.mana, maxMana: G.selectedLegend.max_mana,
        equipment: { weapon: null, armor: null, accessory: null },
        inventory: [],
        effectiveStats: {
            attack: G.selectedLegend.attack,
            defense: G.selectedLegend.defense,
            speed: G.selectedLegend.speed
        },
        worldSeed: seed,
        worldName: finalWorldName,
        signatureSkill: G.selectedLegend.skill_data
    };

    updateAllStatusBars();
    showScreen('world');
    showToast(`Welcome back, ${G.selectedLegend.name}! ⚔️`, 'success');

    // --- STEP 2: Sync with server in background (non-blocking) ---
    (async () => {
        try {
            let autoCustomSelection: { biomes: string[], monsters: string[] } | null = null;
            if (isCustom) {
                autoCustomSelection = G.customSelection;
            } else {
                autoCustomSelection = { biomes: [], monsters: [] };
                const presetId = selectedPreset?.dataset.preset || 'balanced';
                if (presetId === 'balanced') autoCustomSelection.biomes = ['forest', 'coast', 'mountain', 'desert'];
                else if (presetId === 'inferno') autoCustomSelection.biomes = ['volcanic'];
                else if (presetId === 'cursed') autoCustomSelection.biomes = ['cursed_land', 'swamp'];
                else if (presetId === 'ancient') autoCustomSelection.biomes = ['ruins'];
            }

            const res = await fetch(API + '/start', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    worldSeed: seed,
                    characterId: G.selectedLegend.id,
                    userId: G.user?.id, email: G.user?.email,
                    customSelection: autoCustomSelection
                })
            });
            const j = await res.json();
            if (j.success) {
                G.characterId = j.data.characterId;
                G.worldSeed = j.data.worldSeed;
                G.gs = j.data.gameState;
                G.regions = j.data.regions;
                renderRegions();
                updateAllStatusBars();
                showToast('Adventure synced! 🌍', 'success');
            } else {
                showToast('Sync issue: ' + (j.error || 'Server busy'), 'error');
            }
        } catch (err) {
            console.warn('[World] Server sync failed, using local state:', err);
            // Default regions if offline
            if (!G.regions || G.regions.length === 0) {
                G.regions = [
                    { name: 'Starting Plains', dangerLevel: 1, enemyTypes: ['Slime', 'Goblin'] },
                    { name: 'Dark Forest', dangerLevel: 3, enemyTypes: ['Wolf', 'Bandit'] },
                    { name: 'Ancient Ruins', dangerLevel: 5, enemyTypes: ['Skeleton', 'Ghost'] },
                ];
                renderRegions();
            }
        }
    })();
}

// --- LOAD ---
async function fetchSaveList() {
    try {
        const res = await fetch(API + '/load/list/all');
        const j = await res.json();
        if (j.success) {
            const listEl = document.getElementById('save-list');
            if (!listEl) return;
            if (j.data.length === 0) {
                listEl.innerHTML = '<p style="font-size:11px; color:var(--muted)">No saves found.</p>';
                return;
            }
            listEl.innerHTML = '';
            j.data.forEach((s: any) => {
                const card = document.createElement('div');
                card.className = 'region-card';
                card.style.cssText = 'text-align:left; padding:8px 12px; position:relative;';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items: center; margin-right: 24px;">
                        <span class="name" style="cursor:pointer" onclick="loadGame('${s.character_id}')">👤 ${s.character_name}</span>
                        <span class="danger">Lv.${s.level}</span>
                    </div>
                    <div class="enemies" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer" onclick="loadGame('${s.character_id}')">
                        ${s.last_action_log || 'No logs available'}
                    </div>
                    <div style="font-size:9px; color:var(--muted); margin-top:4px">${new Date(s.updated_at).toLocaleString()}</div>
                    <button class="btn-delete" title="Delete Save" onclick="event.stopPropagation(); deleteSave('${s.character_id}', '${s.character_name}')" 
                        style="position:absolute; top:8px; right:8px; background:none; border:none; color:var(--red); cursor:pointer; font-size:16px; padding:4px;">
                        🗑️
                    </button>
                `;
                listEl.appendChild(card);
            });
        }
    } catch { showToast('Could not fetch saves', 'error'); }
}

async function deleteSave(cid: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete the legend of ${name}?`)) return;

    try {
        const res = await fetch(API + '/load/' + cid, { method: 'DELETE' });
        const j = await res.json();
        if (j.success) {
            showToast(`Legend of ${name} has been erased.`, 'info');
            fetchSaveList(); // Refresh list
        } else {
            showToast(j.error || 'Delete failed', 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Connection error during deletion', 'error');
    }
}

async function loadGame(cid: string, charName?: string) {
    // --- Enter game screen IMMEDIATELY ---
    G.characterId = cid;
    G.gs = G.gs || {
        characterName: charName || 'Hero',
        level: 1, exp: 0, gold: 0,
        hp: 100, maxHP: 100, mana: 50, maxMana: 50,
        equipment: { weapon: null, armor: null, accessory: null },
        inventory: [],
        effectiveStats: { attack: 10, defense: 5, speed: 8 },
        worldSeed: 0,
    };

    const regionListEl = document.getElementById('region-list');
    if (regionListEl) regionListEl.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted)">
            <div style="font-size:36px;margin-bottom:12px">📂</div>
            <div style="font-size:14px;font-weight:700;margin-bottom:6px">Loading save...</div>
        </div>
    `;

    updateAllStatusBars();
    showScreen('world');
    showToast('Loading save...', 'info');

    // --- Sync in background ---
    try {
        const res = await fetch(API + '/load/' + cid);
        const j = await res.json();
        if (j.success) {
            G.gs = j.data.gameState;
            G.worldSeed = j.data.gameState.worldSeed;
            G.regions = j.data.regions;
            renderRegions();
            updateAllStatusBars();
            showToast('Game loaded! ✅', 'success');
        } else {
            // Server error — show offline regions so the UI isn't stuck
            G.regions = [
                { name: 'Starting Plains', dangerLevel: 1, enemyTypes: ['Slime', 'Goblin'] },
                { name: 'Dark Forest', dangerLevel: 3, enemyTypes: ['Wolf', 'Bandit'] },
                { name: 'Ancient Ruins', dangerLevel: 5, enemyTypes: ['Skeleton', 'Ghost'] },
            ];
            renderRegions();
            showToast(j.error || 'Offline mode', 'info');
        }
    } catch {
        G.regions = [
            { name: 'Starting Plains', dangerLevel: 1, enemyTypes: ['Slime', 'Goblin'] },
            { name: 'Dark Forest', dangerLevel: 3, enemyTypes: ['Wolf', 'Bandit'] },
            { name: 'Ancient Ruins', dangerLevel: 5, enemyTypes: ['Skeleton', 'Ghost'] },
        ];
        renderRegions();
        showToast('Offline mode – syncing failed', 'info');
    }
}

// --- SAVE ---
async function saveGame() {
    try {
        const res = await fetch(API + '/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: G.characterId })
        });
        const j = await res.json();
        if (j.success) showToast('💾 Game Saved!', 'success');
        else showToast(j.error, 'error');
    } catch { showToast('Save failed', 'error') }
}

// --- REGIONS ---
function renderRegions() {
    const listEl = document.getElementById('region-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    G.regions.forEach((r: any, i: number) => {
        const card = document.createElement('div');
        card.className = 'region-card';
        card.innerHTML = `
            <div class="name">${r.name}</div>
            <div class="danger">⚠️ Danger: ${r.dangerLevel}</div>
            <div class="enemies">${r.enemyTypes.join(', ')}</div>
        `;
        card.onclick = () => selectRegion(i);
        listEl.appendChild(card);
    });
}

function selectRegion(i: number) {
    G.selectedRegion = G.regions[i]; G.selectedRegionIndex = i;
    updateAllStatusBars();
    const titleEl = document.getElementById('explore-title');
    if (titleEl) titleEl.textContent = '🧭 Exploring: ' + G.selectedRegion.name;
    const logEl = document.getElementById('event-log');
    if (logEl) logEl.innerHTML = '<div class="log-info">Click "Explore Again" to begin...</div>';
    showScreen('explore');
}

// --- HUD ---
function updateHUD() {
    const s = G.gs; if (!s) return;
    const name = s.characterName || 'Hero';
    const f = (id: string, v: any) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    const setBar = (id: string, pct: number) => { const el = document.getElementById(id) as HTMLElement; if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%'; };

    // ── Old HUD compat ──
    f('hud-char', `⚔️ ${name} (Lv.${s.level})`); f('hud-char-exp', `⚔️ ${name}`);
    f('hud-hp', s.hp); f('hud-maxhp', s.maxHP); f('hud-mp', s.mana); f('hud-maxmp', s.maxMana);
    f('hud-lv', s.level); f('hud-gold', s.gold);
    f('exp-hp', s.hp); f('exp-maxhp', s.maxHP); f('exp-mp', s.mana); f('exp-maxmp', s.maxMana);
    f('exp-gold', s.gold);

    // ── New 4-panel LEFT sidebar ──
    f('gp-char-name', name);
    f('gp-char-class', `Level ${s.level} Adventurer`);
    const hpPct = Math.round(s.hp / s.maxHP * 100);
    const mpPct = Math.round(s.mana / s.maxMana * 100);
    const expPct = Math.round(s.exp / (s.level * 100) * 100);
    f('gp-hp-txt', `${s.hp}/${s.maxHP}`);
    f('gp-mp-txt', `${s.mana}/${s.maxMana}`);
    f('gp-exp-txt', `${s.exp}/${s.level * 100}`);
    setBar('gp-hp-bar', hpPct); setBar('gp-mp-bar', mpPct); setBar('gp-exp-bar', expPct);
    f('gp-atk', s.effectiveStats?.attack ?? 10);
    f('gp-def', s.effectiveStats?.defense ?? 5);
    f('gp-spd', s.effectiveStats?.speed ?? 8);
    f('gp-gold', s.gold);

    // ── EXP bar (old compat) ──
    const expPctOld = Math.round(s.exp / (s.level * 100) * 100);
    f('exp-display', `${s.exp} / ${s.level * 100}`);
    setBar('exp-bar', expPctOld);
}

// --- CHARACTER ---
function renderCharacter() {
    const s = G.gs; if (!s) return;
    const hpPct = Math.round(s.hp / s.maxHP * 100);
    const mpPct = Math.round(s.mana / s.maxMana * 100);
    const expPct = Math.round(s.exp / (s.level * 100) * 100);

    // New bar elements
    const f = (id: string, v: any) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    f('char-hp-text', `${s.hp}/${s.maxHP}`); f('char-mp-text', `${s.mana}/${s.maxMana}`);
    f('char-exp-text', `${s.exp}/${s.level * 100}`);
    const setBar = (id: string, pct: number) => { const el = document.getElementById(id); if (el) el.style.width = pct + '%'; };
    setBar('char-hp-bar', hpPct); setBar('char-mp-bar', mpPct); setBar('char-exp-bar', expPct);
    // Explore bars too
    f('explore-hp-text', `${s.hp}/${s.maxHP}`); f('explore-mp-text', `${s.mana}/${s.maxMana}`);
    setBar('explore-hp-bar', hpPct); setBar('explore-mp-bar', mpPct);

    const statsEl = document.getElementById('char-stats');
    // Legacy char-bars support
    const barsEl = document.getElementById('char-bars');
    if (barsEl) barsEl.innerHTML = '';

    if (statsEl) statsEl.innerHTML = `
        <div class="char-stat"><div class="label">Level</div><div class="value" style="color:var(--accent)">${s.level}</div></div>
        <div class="char-stat"><div class="label">Gold</div><div class="value" style="color:var(--gold)">${s.gold}</div></div>
        <div class="char-stat"><div class="label">Attack</div><div class="value" style="color:var(--red)">${s.effectiveStats.attack}</div></div>
        <div class="char-stat"><div class="label">Defense</div><div class="value" style="color:var(--green)">${s.effectiveStats.defense}</div></div>
        <div class="char-stat"><div class="label">Speed</div><div class="value" style="color:var(--accent)">${s.effectiveStats.speed}</div></div>
        <div class="char-stat"><div class="label">World Seed</div><div class="value" style="color:var(--muted);font-size:14px">${G.worldSeed}</div></div>
    `;
}


// --- INVENTORY ---
function renderInventory() {
    const s = G.gs; if (!s) return;
    const eq = s.equipment;
    const weaponText = eq.weapon || '— None —';
    const armorText = eq.armor || '— None —';
    const accessText = eq.accessory || '— None —';

    // Update all equipment slot elements (both inventory and character screens)
    ['inv-weapon', 'eq-weapon'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = weaponText; });
    ['inv-armor', 'eq-armor'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = armorText; });
    ['inv-access', 'eq-access'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = accessText; });

    // Legacy equip-display
    const equipEl = document.getElementById('equip-display');
    if (equipEl && equipEl.children.length === 0) {
        equipEl.innerHTML = `
            <div class="equip-slot"><div class="slot-name">⚔️ Weapon</div><div class="slot-item">${weaponText}</div></div>
            <div class="equip-slot"><div class="slot-name">🛡️ Armor</div><div class="slot-item">${armorText}</div></div>
            <div class="equip-slot"><div class="slot-name">💎 Accessory</div><div class="slot-item">${accessText}</div></div>
        `;
    }

    const invEl = document.getElementById('inv-display');
    if (invEl) {
        if (s.inventory.length === 0) {
            invEl.innerHTML = '<p style="color:var(--muted);font-size:12px">No items yet. Explore to find loot!</p>';
        } else {
            invEl.innerHTML = s.inventory.map((i: any) =>
                `<div class="inv-item"><span class="name">${i.itemId}</span><span class="qty">x${i.qty}</span></div>`
            ).join('');
        }
    }
}


// --- EXPLORE ---
async function exploreRegion() {
    if (!G.selectedRegion) return;
    const logBox = document.getElementById('event-log');
    if (!logBox) return;
    logBox.innerHTML += '<div class="log-info">───────────────────</div>';
    try {
        const res = await fetch(API + '/event', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: G.characterId, regionIndex: G.selectedRegionIndex })
        });
        const j = await res.json();
        if (!j.success) { logBox.innerHTML += `<div class="log-combat">Error: ${j.error}</div>`; return }

        const ev = j.data;
        if (ev.gameState) { G.gs = ev.gameState; updateAllStatusBars(); }

        if (ev.type === 'enemy_encounter' && ev.combatLogs) {
            showCombat(ev);
        } else if (ev.type === 'treasure_found') {
            logBox.innerHTML += `<div class="log-treasure">💰 ${ev.description}</div>`;
            if (ev.treasureGold) logBox.innerHTML += `<div class="log-exp">+${ev.treasureGold} Gold!</div>`;
        } else if (ev.type === 'rare_event') {
            logBox.innerHTML += `<div class="log-rare">✨ ${ev.description}</div>`;
        } else if (ev.type === 'npc_encounter') {
            logBox.innerHTML += `<div class="log-dialogue">💬 ${ev.description}</div>`;
        } else if (ev.type === 'lore_event') {
            logBox.innerHTML += `
                <div class="log-info" style="margin: 8px 0; padding: 10px; background:rgba(79, 195, 247, 0.1); border-left: 3px solid var(--accent); border-radius: 4px">
                    <strong style="color:var(--accent)">📖 ${ev.loreTitle || 'Ancient Scroll'}</strong><br/>
                    <p style="margin-top:4px; font-style:italic">${ev.loreContent || ev.description}</p>
                </div>
            `;
        } else if (ev.type === 'ambient_event') {
            logBox.innerHTML += `<div class="log-info" style="font-style:italic; color:var(--muted)">☁️ ${ev.description}</div>`;
        } else if (ev.type === 'rest_event') {
            logBox.innerHTML += `<div class="log-victory">🧘 ${ev.description}</div>`;
            if (ev.restLog) logBox.innerHTML += `<div class="log-exp">${ev.restLog}</div>`;
        } else {
            logBox.innerHTML += `<div class="log-info">${ev.description}</div>`;
        }
        logBox.scrollTop = logBox.scrollHeight;
    } catch { logBox.innerHTML += '<div class="log-combat">Network error</div>' }
}

// --- COMBAT ---
function showCombat(ev: any) {
    const logBox = document.getElementById('combat-log');
    const resultBox = document.getElementById('combat-result');
    const titleEl = document.getElementById('combat-title');
    if (titleEl) titleEl.textContent = `⚔️ Combat — ${ev.enemy?.name || 'Enemy'}`;

    if (logBox) logBox.innerHTML = '';
    if (resultBox) resultBox.innerHTML = '';

    if (ev.combatLogs && logBox && resultBox) {
        let i = 0;
        const interval = setInterval(() => {
            if (i >= ev.combatLogs.length) {
                clearInterval(interval);
                resultBox.innerHTML = `
                    <div style="text-align:center;margin-top:12px">
                        <button class="btn btn-action" id="btn-post-combat-explore">← Continue Exploring</button>
                        <button class="btn btn-action" id="btn-post-combat-stats">👤 View Stats</button>
                    </div>`;
                document.getElementById('btn-post-combat-explore')?.addEventListener('click', () => showScreen('explore'));
                document.getElementById('btn-post-combat-stats')?.addEventListener('click', () => showScreen('character'));
                return;
            }
            const line = ev.combatLogs[i];
            const cls = line.includes('wins') ? 'log-victory' : line.includes('takes') ? 'log-combat' : 'log-info';
            logBox.innerHTML += `<div class="${cls}">${line}</div>`;
            logBox.scrollTop = logBox.scrollHeight;
            i++;
        }, 120);
    }
    showScreen('combat');
}

// Expose to window for onclicks if needed, or better, attach all in TS
// Let's attach them to window for now to keep HTML roughly same
(window as any).toggleAuthMode = toggleAuthMode;
(window as any).handleAuth = handleAuth;
(window as any).logout = logout;
(window as any).showScreen = showScreen;
(window as any).exploreRegion = exploreRegion;
(window as any).saveGame = saveGame;
(window as any).fetchSaveList = fetchSaveList;
(window as any).loadGame = loadGame;
(window as any).selectRegion = selectRegion;
