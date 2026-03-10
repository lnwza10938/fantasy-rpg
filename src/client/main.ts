/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// @ts-ignore - Vite handles import.meta.env at build time, bypassing strict IDE module checks
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
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
    loadWorldContent(); // Load DB content for the world creation screen
    fetchSaveList();   // Fetch existing saves so user can see their data
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

function selectPreset(el: HTMLElement, worldName: string, charName: string, seed: number | null) {
    document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    const pnEl = document.getElementById('input-player') as HTMLInputElement;
    const cnEl = document.getElementById('input-character') as HTMLInputElement;
    const svEl = document.getElementById('input-seed') as HTMLInputElement;
    if (worldName && !pnEl?.value) { pnEl.value = worldName; }
    if (charName && !cnEl?.value) { cnEl.value = charName; }
    if (seed !== null) { svEl.value = String(seed); } else { svEl.value = ''; }
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

        // Biomes
        const biomeEl = document.getElementById('biome-list');
        if (biomeEl && biomes) {
            biomeEl.innerHTML = biomes.map((b: any) => `
                <div class="biome-card">
                    <div class="b-name">${b.name}</div>
                    <div class="b-desc">${b.description}</div>
                </div>
            `).join('');
        }

        // Monsters
        const monEl = document.getElementById('monster-list');
        if (monEl && monsters && monsters.length > 0) {
            monEl.innerHTML = monsters.map((m: any) => `
                <div class="monster-badge">
                    <span class="m-name">${m.name}</span>
                    <span class="m-lv">Lv.${m.level}</span>
                    <span class="m-type">${m.biome || m.type || 'Unknown'}</span>
                </div>
            `).join('');
        } else if (monEl) {
            monEl.innerHTML = '<p style="font-size:11px;color:var(--muted)">No monsters in DB yet.</p>';
        }

        // Factions
        const facEl = document.getElementById('faction-list');
        if (facEl && factions && factions.length > 0) {
            facEl.innerHTML = factions.map((f: any) => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px">
                    <div style="font-weight:700">${f.name}</div>
                    <div style="color:var(--muted);font-size:10px;margin-top:2px">${f.ideology || f.type || ''}</div>
                </div>
            `).join('');
        } else if (facEl) {
            facEl.innerHTML = '<p style="font-size:11px;color:var(--muted)">No factions in DB yet.</p>';
        }

        // Maps
        const mapEl = document.getElementById('map-list');
        if (mapEl && maps && maps.length > 0) {
            mapEl.innerHTML = maps.map((m: any) => `
                <div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:11px;display:flex;justify-content:space-between">
                    <span style="font-weight:600">${m.name}</span>
                    <span style="color:var(--red);font-size:10px">⚠ Lv.${m.danger_level}</span>
                </div>
            `).join('');
        } else if (mapEl) {
            mapEl.innerHTML = '<p style="font-size:11px;color:var(--muted)">No custom maps yet.</p>';
        }

        const preview = document.getElementById('content-preview');
        if (preview) preview.style.display = 'block';
    } catch (e) { console.warn('Could not load world content', e); }
}

document.getElementById('form-start')?.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    const pnEl = document.getElementById('input-player') as HTMLInputElement;
    const cnEl = document.getElementById('input-character') as HTMLInputElement;
    const svEl = document.getElementById('input-seed') as HTMLInputElement;
    const btnEl = document.getElementById('btn-start') as HTMLButtonElement;
    const errEl = document.getElementById('start-error') as HTMLElement;
    const pn = pnEl?.value.trim();
    const cn = cnEl?.value.trim();
    const sv = svEl?.value.trim();

    if (!pn || !cn) {
        errEl.textContent = 'Please fill in both Player Name and Character Name.';
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';
    btnEl.textContent = '⏳ Creating world...';
    btnEl.disabled = true;

    console.log(`[World Creation] Sending request to ${API}/start`, { playerName: pn, characterName: cn, seed: sv });
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
            console.log('[World Creation] Success:', j.data);
            G.playerId = j.data.playerId;
            G.characterId = j.data.characterId;
            G.worldSeed = j.data.worldSeed;
            G.regions = j.data.regions;
            G.gs = j.data.state;

            // Re-render and transition
            renderRegions();
            updateAllStatusBars();
            showScreen('world');
            showToast('World Ready! ⚔️', 'success');
        } else {
            // If character exists, try to LOAD it instead of showing error
            if (j.error && (j.error.includes('already exists') || j.error.includes('duplicate'))) {
                console.log('[World Creation] Character already exists, attempting to load...');
                // We don't have the ID yet, so we'll fetch the save list to find the ID by name
                const listRes = await fetch(API + '/load/list/all');
                const listData = await listRes.json();
                if (listData.success) {
                    const existing = listData.data.find((s: any) => s.character_name.toLowerCase() === cn.toLowerCase());
                    if (existing) {
                        await loadGame(existing.character_id);
                        return;
                    }
                }
            }
            errEl.textContent = j.error || 'Failed to create world.';
            errEl.style.display = 'block';
        }
    } catch (err: any) {
        console.error('[World Creation] Fetch error:', err);
        // LAST RESORT: Try to find any save with this name and load it anyway
        try {
            const listRes = await fetch(API + '/load/list/all');
            const listData = await listRes.json();
            if (listData.success) {
                const existing = listData.data.find((s: any) => s.character_name.toLowerCase() === cn.toLowerCase());
                if (existing) {
                    console.log('[World Creation] Connection failed but character found in DB. Auto-loading...');
                    await loadGame(existing.character_id);
                    return;
                }
            }
        } catch (inner) { console.error('Silent fail on auto-load fallback', inner); }

        errEl.textContent = `Connection failed: ${err.message || 'Can\'t reach server'}. But if your character was created, you can try loading it from the list below.`;
        errEl.style.display = 'block';
        // Proactively fetch saves if connection failed so user can see their character
        fetchSaveList();
    } finally {
        btnEl.textContent = '⚔️ Enter the World';
        btnEl.disabled = false;
    }
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
