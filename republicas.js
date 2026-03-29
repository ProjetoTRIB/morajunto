/* MoraJunto — Repúblicas */

var currentRepublicas = [];

function initRepublicas() {
    loadRepublicas();
}

async function loadRepublicas() {
    var grid = document.getElementById('republicasGrid');
    grid.innerHTML = '<div class="rm-empty">Carregando...</div>';

    var params = new URLSearchParams();
    var gender = document.getElementById('repFilterGender');
    var uni = document.getElementById('repFilterUni');
    if (gender && gender.value) params.append('genderPolicy', gender.value);
    if (uni && uni.value) params.append('university', uni.value);

    try {
        var res = await fetch(API + '/republicas?' + params.toString());
        var data = await res.json();
        currentRepublicas = data.republicas || data || [];
        renderRepublicas(currentRepublicas);
    } catch(e) {
        // Demo data
        renderRepublicas(getDemoRepublicas());
    }
}

function renderRepublicas(reps) {
    var grid = document.getElementById('republicasGrid');
    if (!reps.length) {
        grid.innerHTML = '<div class="rm-empty"><h3>Nenhuma república encontrada</h3><p>Seja o primeiro a cadastrar!</p></div>';
        return;
    }
    grid.innerHTML = reps.map(function(r) {
        var photo = (r.photos && r.photos[0]) ? r.photos[0] : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop';
        var genderLabel = r.genderPolicy === 'feminina' ? 'Feminina' : r.genderPolicy === 'masculina' ? 'Masculina' : 'Mista';
        var spotsClass = r.availableSpots > 0 ? 'available' : 'full';
        var spotsText = r.availableSpots > 0 ? r.availableSpots + ' vaga' + (r.availableSpots > 1 ? 's' : '') : 'Lotada';
        var features = (r.features || []).slice(0, 3);
        var split = r.maxMembers ? Math.round(r.price / r.maxMembers) : r.price;

        var safeId = escapeHtml(r._id || r.id || '');
        return '<div class="rep-card" onclick="showRepublicaDetail(\'' + safeId + '\')">' +
            '<div class="rep-card-img" style="background-image:url(\'' + photo + '\')">' +
                '<div class="rep-card-badges">' +
                    '<span class="rep-badge rep-badge-gender">' + genderLabel + '</span>' +
                    (r.university ? '<span class="rep-badge rep-badge-uni">' + escapeHtml(r.university) + '</span>' : '') +
                '</div>' +
                '<div class="rep-card-price">R$ ' + split + '/pessoa <span>· R$ ' + r.price + ' total</span></div>' +
            '</div>' +
            '<div class="rep-card-body">' +
                '<h3>' + escapeHtml(r.name) + '</h3>' +
                '<div class="rep-card-address"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + escapeHtml(r.neighborhood || '') + ', Ribeirão Preto</div>' +
                '<div class="rep-card-meta"><span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ' + (r.members ? r.members.length : 0) + '/' + r.maxMembers + '</span></div>' +
                '<div class="rep-card-spots"><span class="rep-card-spots-text ' + spotsClass + '">' + spotsText + '</span></div>' +
                (features.length ? '<div class="rep-card-features">' + features.map(function(f){ return '<span>' + escapeHtml(f) + '</span>'; }).join('') + '</div>' : '') +
            '</div>' +
        '</div>';
    }).join('');
}

function showCreateRepublica() {
    if (!currentToken) { showLoginModal(); return; }
    var form = document.getElementById('createRepForm');
    form.classList.remove('hidden'); form.style.display = 'block';
    document.getElementById('republicasGrid').style.display = 'none';
}

function hideCreateRepublica() {
    var form = document.getElementById('createRepForm');
    form.classList.add('hidden'); form.style.display = 'none';
    document.getElementById('republicasGrid').style.display = 'grid';
}

async function saveRepublica(e) {
    e.preventDefault();
    var feedback = document.getElementById('repFeedback');
    var editId = document.getElementById('editRepId').value;

    var payload = {
        name: document.getElementById('repName').value,
        description: document.getElementById('repDesc').value,
        university: document.getElementById('repUni').value,
        price: parseInt(document.getElementById('repPrice').value) || 0,
        availableSpots: parseInt(document.getElementById('repSpots').value) || 1,
        maxMembers: parseInt(document.getElementById('repMaxMembers').value) || 4,
        genderPolicy: document.getElementById('repGender').value,
        neighborhood: document.getElementById('repNeighborhood').value,
        address: document.getElementById('repAddress').value,
        photos: document.getElementById('repPhotos').value.split('\n').filter(Boolean),
        features: document.getElementById('repFeatures').value.split(',').map(function(s){return s.trim()}).filter(Boolean)
    };

    try {
        var url = editId ? API + '/republicas/' + editId : API + '/republicas';
        var method = editId ? 'PUT' : 'POST';
        var res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            var data = await res.json();
            showFormFeedback('repFeedback', data.error || 'Erro ao salvar', 'error');
            return;
        }
        showFormFeedback('repFeedback', 'República cadastrada!', 'success');
        setTimeout(function() { hideCreateRepublica(); loadRepublicas(); }, 1000);
    } catch(e) {
        showFormFeedback('repFeedback', 'Erro de conexão', 'error');
    }
}

async function showRepublicaDetail(id) {
    try {
        var res = await fetch(API + '/republicas/' + encodeURIComponent(id));
        var data = await res.json();
        var r = data.republica || data;
        if (!r || !r.name) {
            alert('República não encontrada');
            return;
        }

        var photo = (r.photos && r.photos[0]) ? r.photos[0] : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop';
        var genderLabel = r.genderPolicy === 'feminina' ? 'Feminina' : r.genderPolicy === 'masculina' ? 'Masculina' : 'Mista';
        var membersHtml = (r.members || []).map(function(m) {
            return '<div class="rep-detail-member"><strong>' + escapeHtml(m.name || 'Membro') + '</strong></div>';
        }).join('');
        var featuresHtml = (r.features || []).map(function(f) {
            return '<span class="rep-badge">' + escapeHtml(f) + '</span>';
        }).join(' ');
        var split = r.members && r.members.length > 0 ? Math.round(r.price / r.members.length) : r.price;

        var html = '<div class="custom-modal-body">' +
            '<div class="rep-card-img" style="background-image:url(\'' + escapeHtml(photo) + '\');height:200px;border-radius:12px;margin-bottom:16px"></div>' +
            '<h2>' + escapeHtml(r.name) + '</h2>' +
            '<p>' + escapeHtml(r.description || '') + '</p>' +
            '<div style="margin:12px 0"><strong>' + genderLabel + '</strong>' +
            (r.university ? ' · ' + escapeHtml(r.university) : '') + '</div>' +
            '<div style="margin:8px 0"><strong>R$ ' + split + '/pessoa</strong> (R$ ' + r.price + ' total)</div>' +
            '<div style="margin:8px 0">' + escapeHtml(r.neighborhood || '') + ', ' + escapeHtml(r.city || 'Ribeirão Preto') + '</div>' +
            '<div style="margin:8px 0">Vagas: ' + (r.availableSpots || 0) + ' de ' + (r.maxMembers || '?') + '</div>' +
            (featuresHtml ? '<div style="margin:12px 0">' + featuresHtml + '</div>' : '') +
            '<h4 style="margin-top:16px">Moradores</h4>' +
            (membersHtml || '<p>Nenhum membro ainda</p>') +
            (r.availableSpots > 0 && currentToken ?
                '<button class="btn btn-accent w100" style="margin-top:16px" onclick="applyToRepublica(\'' + escapeHtml(r._id || id) + '\')">Candidatar-se</button>' : '') +
        '</div>';

        showCustomModalHTML(escapeHtml(r.name), html);
    } catch(e) {
        alert('Erro ao carregar república');
    }
}

async function applyToRepublica(id) {
    closeCustomModal();
    showCustomModal('Candidatura', 'Mensagem para o dono (opcional):', true, true).then(async function(msg) {
        if (msg === null) return;
        try {
            var res = await fetch(API + '/republicas/' + encodeURIComponent(id) + '/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken },
                body: JSON.stringify({ message: msg || '' })
            });
            var data = await res.json();
            if (res.ok) {
                showCustomModal('Sucesso', data.message || 'Candidatura enviada!');
            } else {
                showCustomModal('Erro', data.error || 'Erro ao se candidatar');
            }
        } catch(e) {
            showCustomModal('Erro', 'Erro de conexão');
        }
    });
}

function getDemoRepublicas() {
    return [
        { id:'rep1', name:'Rep Medicina USP', description:'República de estudantes de medicina', genderPolicy:'mista', university:'USP', price:3200, maxMembers:4, members:[{},{},{}], availableSpots:1, neighborhood:'Vila Tibério', photos:['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop'], features:['Wi-Fi','Ar condicionado','Lavanderia','Churrasqueira'] },
        { id:'rep2', name:'Rep Feminina Califórnia', description:'República feminina perto da UNAERP', genderPolicy:'feminina', university:'UNAERP', price:2400, maxMembers:3, members:[{}], availableSpots:2, neighborhood:'Jd. Califórnia', photos:['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop'], features:['Piscina','Garagem','Portaria 24h'] },
        { id:'rep3', name:'Rep Engenharia', description:'República de estudantes de engenharia', genderPolicy:'masculina', university:'USP', price:2800, maxMembers:4, members:[{},{},{},{}], availableSpots:0, neighborhood:'Centro', photos:['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop'], features:['Wi-Fi','Sala de estudos','Pet friendly'] },
        { id:'rep4', name:'Rep Nova Aliança', description:'República mista no Nova Aliança', genderPolicy:'mista', university:'', price:3600, maxMembers:3, members:[{}], availableSpots:2, neighborhood:'Nova Aliança', photos:['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop'], features:['Piscina','Academia','Churrasqueira','Garagem'] }
    ];
}

// Hook into showPage
(function(){
    var _orig = window.showPage;
    if (_orig) {
        window.showPage = function(page, scrollTo) {
            _orig(page, scrollTo);
            if (page === 'republicas') initRepublicas();
        };
    }
})();
