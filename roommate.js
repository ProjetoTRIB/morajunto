/* ===== AlugaJa — Roommate Matching (Dividir Apto) ===== */

let rmProfile = null;
let rmScales = { cleanliness: 3, noise: 3, social: 3 };
let rmSleepPrefs = { sleep: 'normal', wake: 'normal' };
let rmSwitches = { rmSmoking: false, rmPets: false, rmVisitors: false, rmGroceries: false };
let rmDiscoverProfiles = [];
let rmDiscoverIndex = 0;
let rmMatches = [];
let rmGroups = [];
let rmCurrentGroupId = null;

// ===== INITIALIZATION =====
async function initRoommate() {
    rmDiscoverIndex = 0;

    // Load profile from backend if authenticated
    if (currentToken) {
        try {
            var res = await fetch(API + '/roommate/profile', {
                headers: { 'Authorization': 'Bearer ' + currentToken }
            });
            if (res.ok) {
                var data = await res.json();
                var rp = data.roommateProfile || {};
                rmProfile = {
                    name: data.name || '',
                    age: rp.age || '',
                    occupation: rp.occupation || '',
                    budget: rp.budget || '',
                    salary: rp.salary || 0,
                    bio: rp.bio || '',
                    neighborhoods: rp.neighborhood || '',
                    course: rp.course || '',
                    genderPreference: rp.genderPreference || '',
                    ageMin: rp.ageMin || 18,
                    ageMax: rp.ageMax || 35,
                    scales: { cleanliness: rp.cleanliness || 3, noise: rp.noise || 3, social: rp.visitors || 3 },
                    sleepPrefs: { sleep: rp.sleep || 'normal', wake: 'normal' },
                    switches: {
                        rmSmoking: rp.smoking === 'sim' || rp.smoking === true,
                        rmPets: rp.pets === 'sim' || rp.pets === true,
                        rmVisitors: (rp.visitors || 3) >= 3,
                        rmGroceries: false
                    },
                    active: rp.active || false
                };
                if (rmProfile.scales) rmScales = { ...rmProfile.scales };
                if (rmProfile.sleepPrefs) rmSleepPrefs = { ...rmProfile.sleepPrefs };
                if (rmProfile.switches) rmSwitches = { ...rmProfile.switches };
            }
        } catch (e) { /* fallback: no profile loaded */ }
    }

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
    if (profile.salary && document.getElementById('rmSalary')) {
        document.getElementById('rmSalary').value = profile.salary;
        document.querySelectorAll('.rm-income-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.val === String(profile.salary));
        });
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

async function saveRoommateProfile(e) {
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

    var salary = parseInt(document.getElementById('rmSalary') ? document.getElementById('rmSalary').value : 0) || 0;

    // Save to backend
    var payload = {
        bio: bio,
        age: age,
        occupation: occupation,
        budget: budget,
        salary: salary,
        neighborhood: neighborhoods,
        course: course,
        genderPreference: genderPreference,
        ageMin: ageMin,
        ageMax: ageMax,
        cleanliness: rmScales.cleanliness,
        noise: rmScales.noise,
        visitors: rmScales.social,
        sleep: rmSleepPrefs.sleep,
        smoking: rmSwitches.rmSmoking ? 'sim' : 'nao',
        pets: rmSwitches.rmPets ? 'sim' : 'nao',
        active: true
    };

    try {
        var res = await fetch(API + '/roommate/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify(payload)
        });
        var data = await res.json();
        if (!res.ok) {
            showFormFeedback('rmSetupFeedback', data.error || 'Erro ao salvar perfil.', 'error');
            return;
        }

        rmProfile = {
            name, age, occupation, budget, bio, neighborhoods,
            course, genderPreference, ageMin, ageMax,
            scales: { ...rmScales },
            sleepPrefs: { ...rmSleepPrefs },
            switches: { ...rmSwitches },
            active: true
        };

        showFormFeedback('rmSetupFeedback', 'Perfil salvo com sucesso! Explore perfis compativeis.', 'success');
        setTimeout(() => { switchRoommateTab('discover'); }, 1200);
    } catch (err) {
        showFormFeedback('rmSetupFeedback', 'Erro de conexao. Tente novamente.', 'error');
    }
}

function verifySocial(platform, evt) {
    var event = evt || window.event;
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }

    if (platform === 'facebook') {
        // Facebook: usuário cola URL do perfil
        var fbBtn = event ? event.target.closest('.rm-verify-item') : null;
        showCustomModal('Facebook', 'Cole a URL do seu perfil do Facebook:\nEx: https://facebook.com/seuperfil', true, true).then(function(url) {
            if (!url) return;
            url = url.trim();
            if (!url) return;

            var actionBtn = fbBtn ? fbBtn.querySelector('button') : null;
            if (actionBtn) { actionBtn.textContent = 'Verificando...'; actionBtn.disabled = true; }

            fetch(API + '/auth/verify-facebook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
                body: JSON.stringify({ url: url })
            }).then(function(res) { return res.json(); }).then(function(data) {
                if (data.success) {
                    if (actionBtn) actionBtn.outerHTML = '<span class="verified-check">' + data.handle + '</span>';
                    showToast('Facebook vinculado com sucesso!', 'success');
                } else {
                    if (actionBtn) { actionBtn.textContent = 'Conectar'; actionBtn.disabled = false; }
                    showCustomModal('Erro', data.error || 'URL inv��lida', false, false);
                }
            }).catch(function() {
                if (actionBtn) { actionBtn.textContent = 'Conectar'; actionBtn.disabled = false; }
            });
        });
        return;
    }

    if (platform === 'instagram') {
        // Instagram: verificação em 2 etapas
        var igBtn = event ? event.target.closest('.rm-verify-item') : null;
        showCustomModal('Instagram', 'Digite seu @ do Instagram (sem o @):', true, true).then(function(handle) {
            if (!handle) return;
            handle = handle.replace('@', '').trim();
            if (!handle) return;

            var actionBtn = igBtn ? igBtn.querySelector('button') : null;
            if (actionBtn) { actionBtn.textContent = 'Gerando código...'; actionBtn.disabled = true; }

            // Etapa 1: gerar código
            fetch(API + '/auth/verify-instagram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
                body: JSON.stringify({ handle: handle })
            }).then(function(res) { return res.json(); }).then(function(data) {
                if (!data.success) {
                    if (actionBtn) { actionBtn.textContent = 'Informar @'; actionBtn.disabled = false; }
                    showCustomModal('Erro', data.error || 'Erro', false, false);
                    return;
                }

                // Mostrar código e pedir para colocar na bio
                showCustomModal(
                    'Verificar Instagram',
                    'Coloque este código na sua bio do Instagram:\n\n' + data.verifyCode + '\n\nDepois clique OK. Você pode remover o código da bio após verificar.\n\n(Seu perfil precisa estar público)',
                    true, false
                ).then(function(confirmed) {
                    if (!confirmed && confirmed !== '') return;

                    if (actionBtn) actionBtn.textContent = 'Verificando...';

                    // Etapa 2: confirmar
                    fetch(API + '/auth/verify-instagram/confirm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken }
                    }).then(function(res) { return res.json(); }).then(function(result) {
                        if (result.verified) {
                            if (actionBtn) actionBtn.outerHTML = '<span class="verified-check">@' + handle + ' ✓</span>';
                            showToast('Instagram verificado!', 'success');
                        } else {
                            // Oferecer pular verificação
                            showCustomModal(
                                'Não verificado',
                                result.message + '\n\nDeseja salvar o handle mesmo sem verificação?',
                                true, false
                            ).then(function(skip) {
                                if (skip || skip === '') {
                                    fetch(API + '/auth/verify-instagram/skip', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken }
                                    }).then(function() {
                                        if (actionBtn) actionBtn.outerHTML = '<span class="verified-check" style="opacity:0.7">@' + handle + '</span>';
                                        showToast('Handle salvo (sem verificação)', 'info');
                                    });
                                } else {
                                    if (actionBtn) { actionBtn.textContent = 'Informar @'; actionBtn.disabled = false; }
                                }
                            });
                        }
                    }).catch(function() {
                        if (actionBtn) { actionBtn.textContent = 'Informar @'; actionBtn.disabled = false; }
                    });
                });
            }).catch(function() {
                if (actionBtn) { actionBtn.textContent = 'Informar @'; actionBtn.disabled = false; }
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
        dot.classList.remove('active', 'filled');
        if (i === value - 1) {
            dot.classList.add('active');
        } else if (i < value - 1) {
            dot.classList.add('filled');
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

function selectIncome(card) {
    document.querySelectorAll('.rm-income-card').forEach(function(c) { c.classList.remove('active'); });
    card.classList.add('active');
    document.getElementById('rmSalary').value = card.dataset.val;
}

// Hood chips click + search filter
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var chipsContainer = document.getElementById('rmHoodChips');
        if (chipsContainer) {
            chipsContainer.addEventListener('click', function(e) {
                var chip = e.target.closest('.rm-hood-chip');
                if (!chip || chip.classList.contains('disabled')) return;

                // Ripple effect
                chip.classList.remove('rm-hood-chip--ripple');
                void chip.offsetWidth;
                chip.classList.add('rm-hood-chip--ripple');

                chip.classList.toggle('selected');
                var allChips = chipsContainer.querySelectorAll('.rm-hood-chip');
                var selected = chipsContainer.querySelectorAll('.rm-hood-chip.selected');

                // Enable/disable based on max 3
                allChips.forEach(function(c) {
                    if (selected.length >= 3 && !c.classList.contains('selected')) {
                        c.classList.add('disabled');
                    } else {
                        c.classList.remove('disabled');
                    }
                });

                // Update hidden input
                var vals = [];
                selected.forEach(function(s) { vals.push(s.dataset.v); });
                document.getElementById('rmNeighborhoods').value = vals.join(',');
            });
        }

        var searchInput = document.getElementById('rmHoodSearch');
        if (!searchInput) return;
        searchInput.addEventListener('input', function() {
            var query = this.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            var groups = document.querySelectorAll('.rm-hood-group');
            groups.forEach(function(group) {
                var chips = group.querySelectorAll('.rm-hood-chip');
                var anyVisible = false;
                chips.forEach(function(chip) {
                    var text = (chip.dataset.v + ' ' + chip.textContent).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    var match = !query || text.indexOf(query) !== -1;
                    chip.style.display = match ? '' : 'none';
                    if (match) anyVisible = true;
                });
                group.style.display = anyVisible ? '' : 'none';
            });
        });
    });
})();

function toggleRmSwitch(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active');
    rmSwitches[id] = el.classList.contains('active');
}

// ===== DISCOVER =====
async function loadDiscoverProfiles() {
    if (!currentToken) {
        rmDiscoverProfiles = [];
        rmDiscoverIndex = 0;
        renderCurrentDiscoverCard();
        return;
    }

    try {
        var res = await fetch(API + '/roommate/discover', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        var data = await res.json();
        if (res.ok && data.profiles) {
            rmDiscoverProfiles = data.profiles.map(function(p) {
                var rp = p.roommateProfile || {};
                return {
                    id: p._id,
                    name: p.name || 'Sem nome',
                    age: rp.age || '?',
                    occupation: rp.occupation || '',
                    bio: rp.bio || '',
                    budget: rp.budget || 0,
                    neighborhoods: rp.neighborhood ? [rp.neighborhood] : [],
                    cleanliness: rp.cleanliness || 3,
                    noise: rp.noise || 3,
                    social: rp.visitors || 3,
                    sleep: rp.sleep || 'normal',
                    smoking: rp.smoking === 'sim' || rp.smoking === true,
                    pets: rp.pets === 'sim' || rp.pets === true,
                    visitors: (rp.visitors || 3) >= 3,
                    groceries: false,
                    verified: p.socialVerified ? ['social'] : [],
                    socialVerified: p.socialVerified,
                    identityVerification: p.identityVerification,
                    urgentUntil: rp.urgentUntil,
                    compatibility: p.compatibility || 0
                };
            });
        } else {
            rmDiscoverProfiles = [];
        }
    } catch (e) {
        rmDiscoverProfiles = [];
    }

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

async function likeProfile() {
    if (rmDiscoverIndex >= rmDiscoverProfiles.length) return;
    if (!currentToken) { showLoginModal(); return; }

    const card = document.getElementById('rmCurrentCard');
    if (!card) return;

    const profile = rmDiscoverProfiles[rmDiscoverIndex];
    card.classList.add('swipe-right');

    try {
        var res = await fetch(API + '/roommate/like/' + profile.id, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        var data = await res.json();
        if (res.ok && data.match) {
            // Mutual match!
            showToast('Match com ' + profile.name + '!', 'success');
            loadMatches();
        }
    } catch (e) { /* continue silently */ }

    setTimeout(() => {
        rmDiscoverIndex++;
        renderCurrentDiscoverCard();
    }, 500);
}

async function skipProfile() {
    if (rmDiscoverIndex >= rmDiscoverProfiles.length) return;

    const card = document.getElementById('rmCurrentCard');
    if (!card) return;

    const profile = rmDiscoverProfiles[rmDiscoverIndex];
    card.classList.add('swipe-left');

    if (currentToken) {
        try {
            await fetch(API + '/roommate/dislike/' + profile.id, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + currentToken }
            });
        } catch (e) { /* continue silently */ }
    }

    setTimeout(() => {
        rmDiscoverIndex++;
        renderCurrentDiscoverCard();
    }, 500);
}

// ===== MATCHES =====
async function loadMatches() {
    if (!currentToken) {
        rmMatches = [];
        renderMatches();
        return;
    }

    try {
        var res = await fetch(API + '/roommate/matches', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        var data = await res.json();
        if (res.ok && data.matches) {
            rmMatches = data.matches.map(function(m) {
                var rp = m.roommateProfile || {};
                return {
                    id: m._id,
                    name: m.name || 'Sem nome',
                    age: rp.age || '?',
                    occupation: rp.occupation || '',
                    budget: rp.budget || 0,
                    compatibility: 0
                };
            });
        } else {
            rmMatches = [];
        }
    } catch (e) {
        rmMatches = [];
    }
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

    var safeMatchId = escapeHtml(matchId);
    var html = '<div class="custom-modal-body"><p>Adicionar <strong>' + escapeHtml(match.name) + '</strong> a qual grupo?</p>';
    html += rmGroups.map(function(g, i) {
        return '<button class="btn btn-outline w100 custom-modal-group-btn" onclick="addMatchToGroup(' + i + ',\'' + safeMatchId + '\')">' + escapeHtml(g.name) + '</button>';
    }).join('');
    html += '<button class="btn btn-accent w100" onclick="closeCustomModal();showCustomModal(\'Novo grupo\',\'Nome do grupo:\',true,true).then(function(n){if(n)createGroupWithMember(n,\'' + safeMatchId + '\')})">+ Criar novo grupo</button></div>';

    showCustomModalHTML('Adicionar ao grupo', html);
}

async function addMatchToGroup(idx, matchId) {
    closeCustomModal();
    var match = rmMatches.find(function(m) { return m.id === matchId; });
    if (!match || !rmGroups[idx]) return;

    // For backend groups, we would need an add-member endpoint
    // For now, show the success since backend groups are created with members
    showCustomModalHTML('Info', '<div class="custom-modal-success"><p>Para adicionar membros, crie um novo grupo com esse match.</p></div><div class="custom-modal-actions"><button class="btn btn-accent" onclick="closeCustomModal()">OK</button></div>');
}

async function startChat(matchId) {
    if (!currentToken) { showLoginModal(); return; }

    // Check if there's already a group with this match
    var existingGroup = rmGroups.find(function(g) {
        return g.members && g.members.some(function(m) { return (m.id || m._id || '').toString() === matchId; });
    });

    if (existingGroup) {
        showGroupDetail(existingGroup.id);
        return;
    }

    // Create group via backend
    try {
        var res = await fetch(API + '/roommate/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify({ matchUserId: matchId })
        });
        var data = await res.json();
        if (res.ok && data.group) {
            await loadGroups();
            showGroupDetail(data.group._id);
        } else {
            showToast(data.error || 'Erro ao criar grupo', 'error');
        }
    } catch (e) {
        showToast('Erro de conexao', 'error');
    }
}

// ===== GROUPS =====
function createGroup() {
    if (!currentToken || !currentUser) {
        showLoginModal();
        return;
    }

    // Backend requires a matchUserId to create a group
    if (rmMatches.length === 0) {
        showCustomModal('Sem matches', 'Voce precisa ter pelo menos um match para criar um grupo.', false, false);
        return;
    }

    // Show list of matches to select from
    var html = '<div class="custom-modal-body"><p>Selecione um match para criar o grupo:</p>';
    html += rmMatches.map(function(m) {
        return '<button class="btn btn-outline w100 custom-modal-group-btn" onclick="createGroupWithMember(\'\',\'' + escapeHtml(m.id) + '\')">' + escapeHtml(m.name) + '</button>';
    }).join('');
    html += '</div>';
    showCustomModalHTML('Criar grupo', html);
}

async function createGroupWithMember(name, matchId) {
    closeCustomModal();
    if (!currentToken) { showLoginModal(); return; }

    try {
        var res = await fetch(API + '/roommate/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify({ matchUserId: matchId })
        });
        var data = await res.json();
        if (res.ok && data.group) {
            showToast('Grupo criado!', 'success');
            await loadGroups();
        } else {
            showToast(data.error || 'Erro ao criar grupo', 'error');
        }
    } catch (e) {
        showToast('Erro de conexao', 'error');
    }
}

async function loadGroups() {
    if (!currentToken) {
        rmGroups = [];
        renderGroups();
        return;
    }

    try {
        var res = await fetch(API + '/roommate/groups', {
            headers: { 'Authorization': 'Bearer ' + currentToken }
        });
        var data = await res.json();
        if (res.ok && data.groups) {
            rmGroups = data.groups.map(function(g) {
                return {
                    id: g._id,
                    name: g.neighborhood ? ('Grupo - ' + g.neighborhood) : ('Grupo #' + g._id.substring(0, 6)),
                    members: (g.members || []).map(function(m) {
                        return { id: m._id, name: m.name || 'Membro' };
                    }),
                    messages: (g.chat || []).map(function(c) {
                        return {
                            id: c._id,
                            senderId: c.user,
                            senderName: c.userName || 'Membro',
                            text: c.message,
                            timestamp: c.createdAt || new Date().toISOString()
                        };
                    }),
                    budget: g.totalBudget || 0,
                    createdAt: g.createdAt
                };
            });
        } else {
            rmGroups = [];
        }
    } catch (e) {
        rmGroups = [];
    }
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
        const myId = currentUser ? (currentUser._id || currentUser.id) : 'me';
        const isSent = msg.senderId === myId || msg.senderId === 'me';
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

async function sendGroupMessage() {
    if (!rmCurrentGroupId || !currentToken) return;

    const input = document.getElementById('rmChatInput');
    const text = input.value.trim();
    if (!text) return;

    const group = rmGroups.find(g => g.id === rmCurrentGroupId);
    if (!group) return;

    // Optimistic: show message immediately
    if (!group.messages) group.messages = [];
    group.messages.push({
        id: 'msg_' + Date.now(),
        senderId: currentUser ? currentUser._id : 'me',
        senderName: (currentUser && currentUser.name) || 'Voce',
        text: text,
        timestamp: new Date().toISOString()
    });
    input.value = '';
    renderGroupMessages(group);

    // Send to backend
    try {
        await fetch(API + '/roommate/groups/' + rmCurrentGroupId + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify({ message: text })
        });
    } catch (e) { /* message already shown optimistically */ }
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

// Custom modal functions are defined in the inline script of index.html (Promise-based)
// showCustomModal(title, msg, hasInput, hasCancel) returns a Promise
