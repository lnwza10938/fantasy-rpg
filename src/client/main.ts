import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API = '/api';
let G: any = {
    playerId: null, characterId: null, worldSeed: null, regions: [],
    selectedRegion: null, selectedRegionIndex: 0,
    user: null, // Supabase user
    gs: null
};

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
}

async function logout() {
    await supabase.auth.signOut();
    location.reload();
}

// Initialize state check
window.addEventListener('load', async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        G.user = data.session.user;
        onLoginSuccess();
    }
});

// --- SCREEN ---
function showScreen(name: string) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + name)?.classList.add('active');
    if (name !== 'login' && name !== 'combat') renderNav();
    if (name === 'character') renderCharacter();
    if (name === 'inventory') renderInventory();
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
}

function showToast(msg: string, type = 'success') {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = msg;
        t.className = 'toast ' + type + ' show';
        setTimeout(() => t.classList.remove('show'), 2200);
    }
}

// --- START ---
document.getElementById('form-start')?.addEventListener('submit', async e => {
    e.preventDefault();
    const pnEl = document.getElementById('input-player') as HTMLInputElement;
    const cnEl = document.getElementById('input-character') as HTMLInputElement;
    const svEl = document.getElementById('input-seed') as HTMLInputElement;
    const pn = pnEl?.value;
    const cn = cnEl?.value;
    const sv = svEl?.value;
    try {
        const res = await fetch(API + '/start', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName: pn,
                characterName: cn,
                worldSeed: sv ? Number(sv) : undefined,
                userId: G.user?.id,
                email: G.user?.email
            })
        });
        const j = await res.json();
        if (j.success) {
            G.playerId = j.data.playerId; G.characterId = j.data.characterId;
            G.worldSeed = j.data.worldSeed; G.regions = j.data.regions;
            G.gs = j.data.state;
            renderRegions(); updateAllStatusBars(); showScreen('world');
        } else { showToast(j.error, 'error') }
    } catch { showToast('Connection failed', 'error') }
});

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
                card.style.cssText = 'text-align:left; padding:8px 12px';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between">
                        <span class="name">👤 ${s.character_name}</span>
                        <span class="danger">Lv.${s.level}</span>
                    </div>
                    <div class="enemies" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
                        ${s.last_action_log || 'No logs available'}
                    </div>
                    <div style="font-size:9px; color:var(--muted); margin-top:4px">${new Date(s.updated_at).toLocaleString()}</div>
                `;
                card.onclick = () => loadGame(s.character_id);
                listEl.appendChild(card);
            });
        }
    } catch { showToast('Could not fetch saves', 'error'); }
}

async function loadGame(cid: string) {
    try {
        const res = await fetch(API + '/load/' + cid);
        const j = await res.json();
        if (j.success) {
            G.characterId = cid; G.gs = j.data.gameState;
            G.worldSeed = j.data.gameState.worldSeed; G.regions = j.data.regions;
            renderRegions(); updateAllStatusBars(); showScreen('world');
            showToast('Game loaded!', 'info');
        } else { showToast(j.error, 'error') }
    } catch { showToast('Load failed', 'error') }
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

// --- CHARACTER ---
function renderCharacter() {
    const s = G.gs; if (!s) return;
    const hpPct = Math.round(s.hp / s.maxHP * 100);
    const mpPct = Math.round(s.mana / s.maxMana * 100);
    const expPct = Math.round(s.exp / (s.level * 100) * 100);

    const barsEl = document.getElementById('char-bars');
    const statsEl = document.getElementById('char-stats');

    if (barsEl) barsEl.innerHTML = `
        <div class="bar-container"><div class="bar-label"><span>❤️ HP</span><span>${s.hp} / ${s.maxHP}</span></div><div class="bar"><div class="bar-fill bar-hp" style="width:${hpPct}%"></div></div></div>
        <div class="bar-container"><div class="bar-label"><span>🔷 Mana</span><span>${s.mana} / ${s.maxMana}</span></div><div class="bar"><div class="bar-fill bar-mana" style="width:${mpPct}%"></div></div></div>
        <div class="bar-container"><div class="bar-label"><span>✨ EXP</span><span>${s.exp} / ${s.level * 100}</span></div><div class="bar"><div class="bar-fill bar-exp" style="width:${expPct}%"></div></div></div>
    `;
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
    const equipEl = document.getElementById('equip-display');
    const invEl = document.getElementById('inv-display');

    if (equipEl) equipEl.innerHTML = `
        <div class="equip-slot"><div class="slot-name">⚔️ Weapon</div><div class="slot-item">${eq.weapon || 'Empty'}</div></div>
        <div class="equip-slot"><div class="slot-name">🛡️ Armor</div><div class="slot-item">${eq.armor || 'Empty'}</div></div>
        <div class="equip-slot"><div class="slot-name">💎 Accessory</div><div class="slot-item">${eq.accessory || 'Empty'}</div></div>
    `;

    if (invEl) {
        if (s.inventory.length === 0) {
            invEl.innerHTML = '<p style="color:var(--muted);font-size:12px">No items yet.</p>';
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
