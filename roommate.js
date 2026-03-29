/* ===== AlugaJa — Roommate Matching (Dividir Apto) ===== */

let rmProfile;
try { rmProfile = JSON.parse(localStorage.getItem('alugaja_rm_profile') || 'null'); } catch(e) { rmProfile = null; }
let rmScales = { cleanliness: 3, noise: 3, social: 3 };
let rmSleepPrefs = { sleep: 'normal', wake: 'normal' };
let rmSwitches = { rmSmoking: false, rmPets: false, rmVisitors: false, rmGroceries: false };
let rmDiscoverProfiles = [];
let rmDiscoverIndex = 0;
let rmMatches;
try { rmMatches = JSON.parse(localStorage.getItem('alugaja_rm_matches') || '[]'); } catch(e) { rmMatches = []; }
let rmGroups;
try { rmGroups = JSON.parse(localStorage.getItem('alugaja_rm_groups') || '[]'); } catch(e) { rmGroups = []; }
let rmCurrentGroupId = null;

// Mock profiles for discover
const rmMockProfiles = [
    {
        id: 'rm1', name: 'Lucas Mendes', age: 24, occupation: 'Estudante de Engenharia - USP',
        bio: 'Gosto de estudar em casa, mas tambem curto sair nos fins de semana. Procuro alguem tranquilo para dividir um apto no centro.',
        budget: 1200, neighborhoods: ['Centro', 'Vila Tiberio'],
        cleanliness: 4, noise: 2, social: 3, sleep: 'normal', wake: 'cedo',
        smoking: false, pets: false, visitors: true, groceries: true, verified: ['linkedin'], compatibility: 87
    },
    {
        id: 'rm2', name: 'Ana Clara Silva', age: 22, occupation: 'Desenvolvedora Front-end',
        bio: 'Trabalho remoto, sou organizada e adoro cozinhar. Tenho uma gatinha chamada Luna. Busco alguem que aceite pets.',
        budget: 1500, neighborhoods: ['Nova Alianca', 'Jd California'],
        cleanliness: 5, noise: 2, social: 4, sleep: 'tarde', wake: 'normal',
        smoking: false, pets: true, visitors: true, groceries: true, verified: ['instagram', 'linkedin'], compatibility: 92
    },
    {
        id: 'rm3', name: 'Pedro Henrique', age: 26, occupation: 'Analista de Marketing',
        bio: 'Trabalho em horario comercial. Gosto de manter o apto limpo e organizado. Sou tranquilo durante a semana e social nos fds.',
        budget: 1800, neighborhoods: ['Ribeir\u00e2nia', 'Jd Sumare'],
        cleanliness: 4, noise: 3, social: 4, sleep: 'normal', wake: 'cedo',
        smoking: false, pets: false, visitors: true, groceries: false, verified: ['twitter'], compatibility: 78
    },
    {
        id: 'rm4', name: 'Mariana Costa', age: 23, occupation: 'Estudante de Medicina',
        bio: 'Estudo muito, entao preciso de silencio durante a semana. Sou super gente boa e adoro conversar. Procuro um apto perto do campus.',
        budget: 1300, neighborhoods: ['Centro', 'Nova Alianca'],
        cleanliness: 5, noise: 1, social: 3, sleep: 'cedo', wake: 'cedo',
        smoking: false, pets: false, visitors: false, groceries: true, verified: ['instagram'], compatibility: 81
    },
    {
        id: 'rm5', name: 'Rafael Oliveira', age: 28, occupation: 'Designer Grafico - Freelancer',
        bio: 'Trabalho em casa como freelancer. Gosto de um ambiente criativo e descontraido. Toco violao as vezes, mas com respeito ao horario.',
        budget: 1600, neighborhoods: ['Jd California', 'Centro'],
        cleanliness: 3, noise: 3, social: 5, sleep: 'tarde', wake: 'tarde',
        smoking: false, pets: true, visitors: true, groceries: true, verified: ['instagram', 'twitter', 'linkedin'], compatibility: 74
    },
    {
        id: 'rm6', name: 'Juliana Santos', age: 25, occupation: 'Enfermeira',
        bio: 'Trabalho em turnos no hospital, entao meus horarios variam. Sou super limpa e organizada. Procuro alguem compreensivo com horarios.',
        budget: 1400, neighborhoods: ['Vila Tiberio', 'Centro'],
        cleanliness: 5, noise: 1, social: 2, sleep: 'normal', wake: 'cedo',
        smoking: false, pets: false, visitors: false, groceries: true, verified: ['linkedin'], compatibility: 69
    },
    {
        id: 'rm7', name: 'Gabriel Ferreira', age: 21, occupation: 'Estudante de Direito',
        bio: 'Primeiro ano morando sozinho. Quero dividir para economizar e fazer amizade. Gosto de jogos e series a noite.',
        budget: 1000, neighborhoods: ['Centro', 'Vila Tiberio', 'Jd Sumare'],
        cleanliness: 3, noise: 3, social: 4, sleep: 'tarde', wake: 'normal',
        smoking: false, pets: true, visitors: true, groceries: true, verified: [], compatibility: 83
    }
];

// ===== INITIALIZATION =====
function initRoommate() {
    rmDiscoverProfiles = [...rmMockProfiles];
    rmDiscoverIndex = 0;

    // Restore profile data to form if exists
    if (rmProfile) {
        fillProfileForm(rmProfile);
    }

    // Default to discover tab
    switchRoommateTab('discover');
    loadDiscoverProfiles();
    loadMatches();
    loadGroups();
}

// ===== URGENCY MODE =====
async function activateUrgency() {
    if (!currentToken) { showLoginModal(); return; }
    var ok = await showCustomModal('Modo urgencia', 'Ativar modo urgencia? Seu perfil sera destacado por 7 dias para todos os usuarios.', false, true);
    if (!ok) return;
    try {
        var res = await fetch(API + '/roommate/urgent', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        var data = await res.json();
        if (res.ok) {
            showCustomModal('Sucesso', data.message || 'Modo urgencia ativado!', false, false);
            var btn = document.getElementById('urgencyBtn');
            if (btn) {
                btn.textContent = 'Urgência ativa!';
                btn.disabled = true;
                btn.style.opacity = '0.6';
            }
        } else {
            showCustomModal('Erro', data.error || 'Erro ao ativar', false, false);
        }
    } catch(e) {
        showCustomModal('Erro', 'Erro de conexao', false, false);
    }
}

// Hook into showPage — ALL pages free to browse, login only for actions
(function() {
    const origShowPage = window.showPage;
    window.showPage = function(page, scrollTo) {
        // Agency/Admin dashboards require login
        if ((page === 'agency' || page === 'admin') && (!currentToken || !currentUser)) {
            showLoginModal();
            return;
        }
        // ALL other pages: FREE to browse
        origShowPage(page, scrollTo);
        if (page === 'roommate') {
            initRoommate();
        }
    };
})();

// ===== PROFILE SETUP =====
function showRoommateSetup() {
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }
    switchRoommateTab('setup');
}

function fillProfileForm(profile) {
    if (profile.name) document.getElementById('rmName').value = profile.name;
    if (profile.age) document.getElementById('rmAge').value = profile.age;
    if (profile.occupation) document.getElementById('rmOccupation').value = profile.occupation;
    if (profile.budget) document.getElementById('rmBudget').value = profile.budget;
    if (profile.bio) document.getElementById('rmBio').value = profile.bio;
    if (profile.neighborhoods) {
        document.getElementById('rmNeighborhoods').value = profile.neighborhoods;
        var vals = profile.neighborhoods.split(',').map(function(s){ return s.trim(); });
        document.querySelectorAll('.rm-hood-chip').forEach(function(c) {
            c.classList.toggle('selected', vals.includes(c.dataset.v));
        });
        // Apply limit styling
        var selected = document.querySelectorAll('.rm-hood-chip.selected');
        if (selected.length >= 3) {
            document.querySelectorAll('.rm-hood-chip').forEach(function(c) {
                if (!c.classList.contains('selected')) c.classList.add('disabled');
            });
        }
    }
    if (profile.course && document.getElementById('rmCourse')) document.getElementById('rmCourse').value = profile.course;
    if (profile.genderPreference && document.getElementById('rmGenderPref')) document.getElementById('rmGenderPref').value = profile.genderPreference;
    if (profile.ageMin && document.getElementById('rmAgeMin')) document.getElementById('rmAgeMin').value = profile.ageMin;
    if (profile.ageMax && document.getElementById('rmAgeMax')) document.getElementById('rmAgeMax').value = profile.ageMax;

    if (profile.scales) {
        rmScales = { ...profile.scales };
        Object.keys(rmScales).forEach(field => setScaleValue(field, rmScales[field]));
    }
    if (profile.sleepPrefs) {
        rmSleepPrefs = { ...profile.sleepPrefs };
        Object.keys(rmSleepPrefs).forEach(field => setSleepPref(field, rmSleepPrefs[field]));
    }
    if (profile.switches) {
        rmSwitches = { ...profile.switches };
        Object.keys(rmSwitches).forEach(id => {
            const el = document.getElementById(id);
            if (el && rmSwitches[id]) el.classList.add('active');
        });
    }
}

function saveRoommateProfile(e) {
    e.preventDefault();
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }

    const name = document.getElementById('rmName').value.trim();
    const age = parseInt(document.getElementById('rmAge').value);
    const occupation = document.getElementById('rmOccupation').value.trim();
    const budget = parseInt(document.getElementById('rmBudget').value);
    const bio = document.getElementById('rmBio').value.trim();
    const neighborhoods = document.getElementById('rmNeighborhoods').value.trim();

    if (!name || !age || !budget) {
        showFormFeedback('rmSetupFeedback', 'Preencha todos os campos obrigatorios.', 'error');
        return;
    }

    const course = document.getElementById('rmCourse') ? document.getElementById('rmCourse').value.trim() : '';
    const genderPreference = document.getElementById('rmGenderPref') ? document.getElementById('rmGenderPref').value : '';
    const ageMin = parseInt(document.getElementById('rmAgeMin') ? document.getElementById('rmAgeMin').value : 18) || 18;
    const ageMax = parseInt(document.getElementById('rmAgeMax') ? document.getElementById('rmAgeMax').value : 35) || 35;

    rmProfile = {
        name, age, occupation, budget, bio, neighborhoods,
        course,
        genderPreference,
        ageMin,
        ageMax,
        scales: { ...rmScales },
        sleepPrefs: { ...rmSleepPrefs },
        switches: { ...rmSwitches },
        verified: [],
        createdAt: new Date().toISOString()
    };

    localStorage.setItem('alugaja_rm_profile', JSON.stringify(rmProfile));
    showFormFeedback('rmSetupFeedback', 'Perfil salvo com sucesso! Explore perfis compativeis.', 'success');

    setTimeout(() => {
        switchRoommateTab('discover');
    }, 1200);
}

function verifySocial(platform, evt) {
    var event = evt || window.event;
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }

    if (platform === 'facebook') {
        // Real Facebook OAuth — redirect to Facebook login
        window.location.href = API + '/auth/facebook?token=' + encodeURIComponent(currentToken);
        return;
    }

    if (platform === 'instagram') {
        // Instagram: user provides handle via custom modal
        var evtBtn = event ? event.target.closest('.rm-verify-item') : null;
        showCustomModal('Instagram', 'Digite seu @ do Instagram (sem o @):', true, true).then(function(handle) {
            if (!handle) return;
            handle = handle.replace('@', '').trim();
            if (!handle) return;

            var actionBtn = evtBtn ? evtBtn.querySelector('button') : null;
            if (actionBtn) { actionBtn.textContent = 'Salvando...'; actionBtn.disabled = true; }

            fetch(API + '/auth/verify-instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
                body: JSON.stringify({ handle: handle })
            }).then(function(res) { return res.json(); }).then(function(data) {
                if (data.success) {
                    if (actionBtn) actionBtn.outerHTML = '<span class="verified-check">@' + handle + '</span>';
                } else {
                    if (actionBtn) { actionBtn.textContent = 'Verificar'; actionBtn.disabled = false; }
                    showCustomModal('Erro', data.error || 'Erro', false, false);
            }
            }).catch(function() {
                if (actionBtn) { actionBtn.textContent = 'Verificar'; actionBtn.disabled = false; }
            });
        });
        return;
    }
}

// ===== SCALE, SLEEP, TOGGLE =====
function setScaleValue(field, value) {
    rmScales[field] = value;
    const container = document.querySelector(`.rm-scale[data-field="${field}"]`);
    if (!container) return;
    const dots = container.querySelectorAll('.rm-dot');
    dots.forEach((dot, i) => {
        if (i < value) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function setSleepPref(field, value) {
    rmSleepPrefs[field] = value;
    // Find the correct pref item
    const prefItems = document.querySelectorAll('.rm-pref-item');
    prefItems.forEach(item => {
        const label = item.querySelector('label');
        if (!label) return;
        const isTarget = (field === 'sleep' && label.textContent.includes('dormir')) ||
                         (field === 'wake' && label.textContent.includes('acordar'));
        if (isTarget) {
            item.querySelectorAll('.rm-sleep-btn').forEach(btn => {
                const btnValue = btn.onclick.toString().match(/'(\w+)'\)$/);
                if (btn.textContent.includes(getSleepLabel(field, value))) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    });
}

function getSleepLabel(field, value) {
    const labels = {
        sleep: { cedo: 'Antes das 22h', normal: '22h - 00h', tarde: 'Após meia-noite' },
        wake: { cedo: 'Antes das 7h', normal: '7h - 9h', tarde: 'Após 9h' }
    };
    return labels[field] ? labels[field][value] || '' : '';
}

function toggleRmSwitch(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active');
    rmSwitches[id] = el.classList.contains('active');
}

// ===== DISCOVER =====
function loadDiscoverProfiles() {
    rmDiscoverProfiles = rmMockProfiles.filter(p => {
        // Skip already matched
        return !rmMatches.some(m => m.id === p.id);
    });
    rmDiscoverIndex = 0;
    renderCurrentDiscoverCard();
}

function renderCurrentDiscoverCard() {
    const wrap = document.getElementById('rmDiscoverWrap');
    if (!wrap) return;

    if (rmDiscoverIndex >= rmDiscoverProfiles.length) {
        wrap.innerHTML = `
            <div class="rm-discover-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
                <p>Voce viu todos os perfis disponiveis!</p>
                <button class="btn btn-outline btn-sm" onclick="loadDiscoverProfiles()">Recarregar</button>
            </div>`;
        return;
    }

    const p = rmDiscoverProfiles[rmDiscoverIndex];
    const initial = p.name.charAt(0).toUpperCase();

    // Badge logic: identity verified (gold) > social verified (blue)
    const identityApproved = p.identityVerification && p.identityVerification.status === 'approved';
    const socialVerified = p.verified && p.verified.length > 0 || p.socialVerified;
    var verifiedHtml = '';
    if (identityApproved) {
        verifiedHtml = '<div class="rm-verified-badge rm-verified-gold"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Identidade Verificada</div>';
    } else if (socialVerified) {
        verifiedHtml = '<div class="rm-verified-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Verificado</div>';
    }

    // Urgency badge
    const isUrgent = p.urgentUntil && new Date(p.urgentUntil) > new Date();
    const urgentDays = isUrgent ? Math.ceil((new Date(p.urgentUntil) - Date.now()) / (24 * 60 * 60 * 1000)) : 0;
    const urgentHtml = isUrgent ? '<div class="rm-urgent-badge">URGENTE — ' + urgentDays + ' dia' + (urgentDays > 1 ? 's' : '') + '</div>' : '';

    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (p.compatibility / 100) * circumference;

    const tagsHtml = [];
    if (p.smoking) tagsHtml.push('Fumante');
    if (p.pets) tagsHtml.push('Tem pet');
    if (p.visitors) tagsHtml.push('Aceita visitas');
    if (p.groceries) tagsHtml.push('Divide mercado');
    const sleepLabels = { cedo: 'Dorme cedo', normal: 'Dorme 22h-00h', tarde: 'Dorme tarde' };
    if (p.sleep) tagsHtml.push(sleepLabels[p.sleep] || '');
    if (p.neighborhoods) tagsHtml.push(...p.neighborhoods.slice(0, 2));

    wrap.innerHTML = `
        <div class="rm-discover-card" id="rmCurrentCard" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;max-width:380px;margin:0 auto;box-shadow:0 4px 16px rgba(0,0,0,.08)">
            <div style="height:160px;background:linear-gradient(135deg,var(--accent-light),#E0E7FF);display:flex;align-items:center;justify-content:center;position:relative">
                <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#4338CA,#6366F1);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:800;box-shadow:0 4px 12px rgba(67,56,202,.3)">${escapeHtml(initial)}</div>
                ${identityApproved ? '<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#F59E0B,#D97706);padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:600;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.15);display:flex;align-items:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Identidade Verificada</div>' : socialVerified ? '<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:#fff;padding:3px 10px;border-radius:20px;font-size:.7rem;font-weight:600;color:#4338CA;box-shadow:0 2px 6px rgba(0,0,0,.1);display:flex;align-items:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Verificado</div>' : ''}
                ${urgentHtml ? '<div style="position:absolute;top:8px;right:8px">' + urgentHtml + '</div>' : ''}
            </div>
            <div style="padding:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:1.1rem;font-weight:700;color:var(--text)">${escapeHtml(p.name)}, ${p.age}</span>
                    <span style="background:var(--accent-light);color:var(--accent);padding:4px 10px;border-radius:8px;font-size:.78rem;font-weight:700">${p.compatibility}%</span>
                </div>
                <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px">${escapeHtml(p.occupation)}</div>
                <div style="font-size:.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:14px;max-height:48px;overflow:hidden">${escapeHtml(p.bio)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
                    ${tagsHtml.map(t => `<span style="padding:3px 10px;border-radius:6px;background:var(--bg-alt);font-size:.72rem;color:var(--text-secondary)">${escapeHtml(t)}</span>`).join('')}
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--text);padding-top:12px;border-top:1px solid var(--border)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                    R$ ${p.budget.toLocaleString('pt-BR')}/mês
                </div>
            </div>
        </div>`;
}

function likeProfile() {
    if (rmDiscoverIndex >= rmDiscoverProfiles.length) return;

    const card = document.getElementById('rmCurrentCard');
    if (!card) return;

    const profile = rmDiscoverProfiles[rmDiscoverIndex];
    card.classList.add('swipe-right');

    // Add to matches
    if (!rmMatches.some(m => m.id === profile.id)) {
        rmMatches.push({
            id: profile.id,
            name: profile.name,
            age: profile.age,
            occupation: profile.occupation,
            budget: profile.budget,
            compatibility: profile.compatibility,
            matchedAt: new Date().toISOString()
        });
        localStorage.setItem('alugaja_rm_matches', JSON.stringify(rmMatches));
    }

    setTimeout(() => {
        rmDiscoverIndex++;
        renderCurrentDiscoverCard();
    }, 500);
}

function skipProfile() {
    if (rmDiscoverIndex >= rmDiscoverProfiles.length) return;

    const card = document.getElementById('rmCurrentCard');
    if (!card) return;

    card.classList.add('swipe-left');

    setTimeout(() => {
        rmDiscoverIndex++;
        renderCurrentDiscoverCard();
    }, 500);
}

// ===== MATCHES =====
function loadMatches() {
    rmMatches = JSON.parse(localStorage.getItem('alugaja_rm_matches') || '[]');
    renderMatches();
}

function renderMatches() {
    const grid = document.getElementById('rmMatchesGrid');
    if (!grid) return;

    if (rmMatches.length === 0) {
        grid.innerHTML = `
            <div class="rm-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" stroke-width="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                </svg>
                <p>Nenhuma conexão ainda. Continue explorando perfis!</p>
            </div>`;
        return;
    }

    grid.innerHTML = rmMatches.map(m => {
        const initial = m.name.charAt(0).toUpperCase();
        return `
        <div class="rm-match-card">
            <div class="rm-match-top">
                <div class="rm-match-avatar">${escapeHtml(initial)}</div>
                <div class="rm-match-info">
                    <h4>${escapeHtml(m.name)}, ${m.age}</h4>
                    <span>${escapeHtml(m.occupation)}</span>
                </div>
            </div>
            <div class="rm-match-compat">
                <span>${m.compatibility}% compativel</span>
                <div class="compat-bar"><div class="compat-fill" style="width:${m.compatibility}%"></div></div>
            </div>
            <div class="rm-match-actions">
                <button class="btn btn-outline btn-sm" onclick="addToGroupPrompt('${m.id}')">Adicionar a grupo</button>
                <button class="btn btn-accent btn-sm" onclick="startChat('${m.id}')">Conversar</button>
            </div>
        </div>`;
    }).join('');
}

function addToGroupPrompt(matchId) {
    var match = rmMatches.find(function(m) { return m.id === matchId; });
    if (!match) return;

    if (rmGroups.length === 0) {
        showCustomModal('Criar grupo', 'Nenhum grupo criado. Digite o nome do novo grupo:', true, true).then(function(name) {
            if (name) createGroupWithMember(name, matchId);
        });
        return;
    }

    function escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/[&'"<>]/g, function(c) {
            return {'&':'&amp;', "'": '&#39;', '"':'&quot;', '<':'&lt;', '>':'&gt;'}[c];
        });
    }
    var safeMatchId = escapeAttr(matchId);
    var html = '<div class="custom-modal-body"><p>Adicionar <strong>' + escapeHtml(match.name) + '</strong> a qual grupo?</p>';
    html += rmGroups.map(function(g, i) {
        return '<button class="btn btn-outline w100 custom-modal-group-btn" onclick="addMatchToGroup(' + i + ',\'' + safeMatchId + '\')">' + escapeHtml(g.name) + '</button>';
    }).join('');
    html += '<button class="btn btn-accent w100" onclick="closeCustomModal();showCustomModal(\'Novo grupo\',\'Nome do grupo:\',true,true).then(function(n){if(n)createGroupWithMember(n,\'' + safeMatchId + '\')})">+ Criar novo grupo</button></div>';

    showCustomModalHTML('Adicionar ao grupo', html);
}

function addMatchToGroup(idx, matchId) {
    closeCustomModal();
    var match = rmMatches.find(function(m) { return m.id === matchId; });
    if (match && rmGroups[idx] && !rmGroups[idx].members.some(function(mb) { return mb.id === matchId; })) {
        rmGroups[idx].members.push({ id: match.id, name: match.name });
        localStorage.setItem('alugaja_rm_groups', JSON.stringify(rmGroups));
        renderGroups();
        showCustomModalHTML('Adicionado!', '<div class="custom-modal-success"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p><strong>' + escapeHtml(match.name) + '</strong> foi adicionado ao grupo<br><strong>' + escapeHtml(rmGroups[idx].name) + '</strong></p></div><div class="custom-modal-actions"><button class="btn btn-accent" onclick="closeCustomModal()">OK</button></div>');
    }
}

function startChat(matchId) {
    // Check if there's a group with this match, or create a DM-style group
    let group = rmGroups.find(g => g.members.length === 1 && g.members[0].id === matchId && g.isDM);
    if (!group) {
        const match = rmMatches.find(m => m.id === matchId);
        if (!match) return;
        group = {
            id: 'grp_dm_' + Date.now(),
            name: `Conversa com ${match.name}`,
            members: [{ id: match.id, name: match.name }],
            messages: [],
            isDM: true,
            budget: 0,
            createdAt: new Date().toISOString()
        };
        rmGroups.push(group);
        localStorage.setItem('alugaja_rm_groups', JSON.stringify(rmGroups));
    }
    showGroupDetail(group.id);
}

// ===== GROUPS =====
function createGroup() {
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }

    showCustomModal('Criar grupo', 'Nome do grupo (ex: "República Centro 3 quartos"):', true, true).then(function(name) {
        if (!name || !name.trim()) return;
        _finishCreateGroup(name.trim());
    });
    return;
}

function _finishCreateGroup(name) {
    var budget = 0;

    const group = {
        id: 'grp_' + Date.now(),
        name: name.trim(),
        members: [{ id: 'me', name: (currentUser && currentUser.name) || 'Voce' }],
        messages: [],
        budget: budget,
        createdAt: new Date().toISOString()
    };

    rmGroups.push(group);
    localStorage.setItem('alugaja_rm_groups', JSON.stringify(rmGroups));
    renderGroups();
}

function createGroupWithMember(name, matchId) {
    const match = rmMatches.find(m => m.id === matchId);
    if (!match) return;

    const group = {
        id: 'grp_' + Date.now(),
        name: name.trim(),
        members: [
            { id: 'me', name: (currentUser && currentUser.name) || 'Voce' },
            { id: match.id, name: match.name }
        ],
        messages: [],
        budget: 0,
        createdAt: new Date().toISOString()
    };

    rmGroups.push(group);
    localStorage.setItem('alugaja_rm_groups', JSON.stringify(rmGroups));
    renderGroups();
    alert(`Grupo "${name}" criado com ${match.name}!`);
}

function loadGroups() {
    rmGroups = JSON.parse(localStorage.getItem('alugaja_rm_groups') || '[]');
    renderGroups();
}

function renderGroups() {
    const grid = document.getElementById('rmGroupsGrid');
    if (!grid) return;

    // Filter out DM groups
    const visibleGroups = rmGroups.filter(g => !g.isDM);

    if (visibleGroups.length === 0) {
        grid.innerHTML = `
            <div class="rm-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" stroke-width="1.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <p>Nenhum grupo ainda. Crie um para comecar a organizar sua republica!</p>
            </div>`;
        return;
    }

    grid.innerHTML = visibleGroups.map(g => {
        const avatarsHtml = g.members.slice(0, 4).map(m => {
            const initial = m.name.charAt(0).toUpperCase();
            return `<div class="rm-group-member-avatar">${escapeHtml(initial)}</div>`;
        }).join('');
        const extra = g.members.length > 4 ? `<div class="rm-group-member-avatar">+${g.members.length - 4}</div>` : '';
        const statusClass = g.members.length >= 4 ? 'full' : 'active';
        const statusText = g.members.length >= 4 ? 'Completo' : 'Buscando membros';

        return `
        <div class="rm-group-card" onclick="showGroupDetail('${g.id}')">
            <div class="rm-group-header">
                <span class="rm-group-name">${escapeHtml(g.name)}</span>
                <span class="rm-group-count">${g.members.length} membro${g.members.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="rm-group-members">${avatarsHtml}${extra}</div>
            ${g.budget ? `<div class="rm-group-budget">Orcamento: <strong>R$ ${g.budget.toLocaleString('pt-BR')}/mes</strong></div>` : ''}
            <span class="rm-group-status ${statusClass}">${statusText}</span>
        </div>`;
    }).join('');
}

function showGroupDetail(groupId) {
    const group = rmGroups.find(g => g.id === groupId);
    if (!group) return;

    rmCurrentGroupId = groupId;

    document.getElementById('rmChatGroupName').textContent = group.name;
    document.getElementById('rmChatMembers').textContent = group.members.length + ' membro' + (group.members.length !== 1 ? 's' : '');

    renderGroupMessages(group);

    document.getElementById('groupChatModal').classList.add('open');
    document.getElementById('rmChatInput').focus();
}

function renderGroupMessages(group) {
    const container = document.getElementById('rmChatMessages');
    if (!group.messages || group.messages.length === 0) {
        container.innerHTML = '<div class="rm-chat-empty">Nenhuma mensagem ainda. Diga oi!</div>';
        return;
    }

    container.innerHTML = group.messages.map(msg => {
        const isSent = msg.senderId === 'me';
        const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `
        <div class="rm-chat-msg ${isSent ? 'sent' : 'received'}">
            ${!isSent ? `<div class="rm-chat-msg-name">${escapeHtml(msg.senderName)}</div>` : ''}
            ${escapeHtml(msg.text)}
            <div class="rm-chat-msg-time">${time}</div>
        </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

function sendGroupMessage() {
    if (!rmCurrentGroupId) return;

    const input = document.getElementById('rmChatInput');
    const text = input.value.trim();
    if (!text) return;

    const group = rmGroups.find(g => g.id === rmCurrentGroupId);
    if (!group) return;

    if (!group.messages) group.messages = [];

    group.messages.push({
        id: 'msg_' + Date.now(),
        senderId: 'me',
        senderName: (currentUser && currentUser.name) || 'Voce',
        text: text,
        timestamp: new Date().toISOString()
    });

    localStorage.setItem('alugaja_rm_groups', JSON.stringify(rmGroups));
    input.value = '';
    renderGroupMessages(group);

    // Simulate a reply after a short delay
    if (group.members.length > 1) {
        const otherMember = group.members.find(m => m.id !== 'me');
        if (otherMember) {
            setTimeout(() => {
                const replies = [
                    'Oi! Tudo bem? Que legal que voce mandou mensagem!',
                    'Show! Vamos combinar os detalhes do apartamento?',
                    'Perfeito, estou disponivel para visitar imoveis neste fim de semana.',
                    'Que bom! Qual bairro voce prefere?',
                    'Vamos marcar para conversar por video essa semana?',
                    'Legal! Meu orcamento maximo e R$ 1.500/mes, e o seu?'
                ];
                const reply = replies[Math.floor(Math.random() * replies.length)];
                group.messages.push({
                    id: 'msg_' + Date.now(),
                    senderId: otherMember.id,
                    senderName: otherMember.name,
                    text: reply,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('alugaja_rm_groups', JSON.stringify(rmGroups));
                if (rmCurrentGroupId === group.id) {
                    renderGroupMessages(group);
                }
            }, 1500 + Math.random() * 2000);
        }
    }
}

// ===== TAB SWITCHING =====
function switchRoommateTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.rm-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.rm-tab').forEach(t => {
        const tabName = t.onclick.toString().match(/'(\w+)'/);
        if (tabName && tabName[1] === tab) t.classList.add('active');
    });

    // Update tab content
    document.querySelectorAll('.rm-tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById('rmTab-' + tab);
    if (target) target.classList.add('active');

    // Load data for tab
    if (tab === 'discover') {
        loadDiscoverProfiles();
    } else if (tab === 'matches') {
        loadMatches();
    } else if (tab === 'groups') {
        loadGroups();
    }
}

// ===== CUSTOM MODAL (replaces prompt/alert) =====
var _customModalCallback = null;

// Custom modal functions are defined in the inline script of index.html (Promise-based)
// showCustomModal(title, msg, hasInput, hasCancel) returns a Promise
