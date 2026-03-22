// ============================================================
// 챗키피디아 (Chatpedia) - SillyTavern Extension v1.1.0
// RP 캐릭터 & 페르소나 백과사전
// https://github.com/your-username/chatpedia
// ============================================================

import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const EXT_NAME = 'chatpedia';

// ── 기본 필드 정의 (고정) ─────────────────────────────────
const BASE_FIELDS = [
    { key: 'name',        label: '이름',     type: 'input',    placeholder: '이름을 입력하세요',             required: true,  full: false },
    { key: 'age',         label: '나이',     type: 'input',    placeholder: '예: 17세',                      required: false, full: false },
    { key: 'gender',      label: '성별',     type: 'input',    placeholder: '예: 여성',                      required: false, full: false },
    { key: 'orientation', label: '성지향성', type: 'input',    placeholder: '예: 이성애자',                  required: false, full: false },
    { key: 'nationality', label: '국적',     type: 'input',    placeholder: '예: 한국',                      required: false, full: false },
    { key: 'job',         label: '직업',     type: 'input',    placeholder: '예: 고등학생, 마법사',          required: false, full: false },
    { key: 'family',      label: '가족관계', type: 'textarea', placeholder: '가족 관계를 설명해 주세요',     required: false, full: true,  rows: 2 },
    { key: 'appearance',  label: '외모',     type: 'textarea', placeholder: '외모를 묘사해 주세요',          required: false, full: true,  rows: 3 },
    { key: 'personality', label: '성격',     type: 'textarea', placeholder: '성격을 묘사해 주세요',          required: false, full: true,  rows: 3 },
    { key: 'speech',      label: '말투',     type: 'textarea', placeholder: '말투와 말버릇을 묘사해 주세요', required: false, full: true,  rows: 2 },
];

// ── 기본 설정 구조 ─────────────────────────────────────────
const DEFAULT_SETTINGS = {
    entries: [],
    customFields: []
};

// ── 상태 ──────────────────────────────────────────────────
let state = {
    activeTab: 'character',
    selectedId: null,
    mode: 'view',
    searchQuery: '',
    tagFilter: 'all',
    editTags: [],
    editCustomFields: [],
    showAddField: false,
};

// ── 설정 접근자 ───────────────────────────────────────────
function getSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    if (!extension_settings[EXT_NAME].customFields) {
        extension_settings[EXT_NAME].customFields = [];
    }
    return extension_settings[EXT_NAME];
}

function getEntries()              { return getSettings().entries || []; }
function saveEntries(e)            { getSettings().entries = e; saveSettingsDebounced(); }
function getCustomFields()         { return getSettings().customFields || []; }
function saveCustomFields(f)       { getSettings().customFields = f; saveSettingsDebounced(); }
function getAllFields()             { return [...BASE_FIELDS, ...getCustomFields()]; }

function genId() {
    return `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 필터링 ────────────────────────────────────────────────
function getFilteredEntries() {
    let entries = getEntries().filter(e => e.type === state.activeTab);
    if (state.searchQuery.trim()) {
        const q = state.searchQuery.trim().toLowerCase();
        entries = entries.filter(e => {
            const vals = getAllFields().map(f => (e[f.key] || '').toLowerCase());
            const tags = (e.tags || []).map(t => t.toLowerCase());
            return [...vals, ...tags].some(v => v.includes(q));
        });
    }
    if (state.tagFilter !== 'all') {
        entries = entries.filter(e => (e.tags || []).includes(state.tagFilter));
    }
    return entries;
}

function getAllTags() {
    const s = new Set();
    getEntries().filter(e => e.type === state.activeTab)
        .forEach(e => (e.tags || []).forEach(t => s.add(t)));
    return [...s].sort();
}

function getTabCount(type) { return getEntries().filter(e => e.type === type).length; }

// ============================================================
// 렌더링
// ============================================================

function renderAll() { renderTabs(); renderList(); renderDetail(); renderTagFilter(); }

function renderTabs() {
    document.querySelectorAll('#chatpedia-modal .cp-tab').forEach(tab => {
        const t = tab.dataset.tab;
        tab.classList.toggle('active', t === state.activeTab);
        const c = tab.querySelector('.cp-tab-count');
        if (c) c.textContent = getTabCount(t);
    });
}

function renderTagFilter() {
    const sel = document.getElementById('cp-tag-filter');
    if (!sel) return;
    const cur = state.tagFilter;
    sel.innerHTML = `<option value="all">전체 태그</option>` +
        getAllTags().map(t => `<option value="${esc(t)}"${cur === t ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

function renderList() {
    const el = document.getElementById('cp-list');
    if (!el) return;
    const entries = getFilteredEntries();
    const typeLabel = state.activeTab === 'character' ? '캐릭터' : '페르소나';

    if (!entries.length) {
        el.innerHTML = `
            <div class="cp-list-empty">
                <div class="cp-list-empty-icon">${state.activeTab === 'character' ? '⚔️' : '🎭'}</div>
                등록된 ${typeLabel}가 없어요.<br>
                <small>+ 추가 버튼으로 만들어보세요!</small>
            </div>`;
        return;
    }

    el.innerHTML = entries.map(e => `
        <div class="cp-entry-item${state.selectedId === e.id ? ' selected' : ''}"
             data-id="${esc(e.id)}" data-type="${esc(e.type)}">
            <div class="cp-entry-name">${esc(e.name) || '(이름 없음)'}</div>
            ${(e.tags || []).length ? `<div class="cp-entry-tags">
                ${e.tags.slice(0, 3).map(t => `<span class="cp-entry-tag">${esc(t)}</span>`).join('')}
            </div>` : ''}
        </div>`).join('');

    el.querySelectorAll('.cp-entry-item').forEach(item => {
        item.addEventListener('click', () => {
            state.selectedId = item.dataset.id;
            state.mode = 'view';
            toggleMobileView('detail');
            renderList();
            renderDetail();
        });
    });
}

function renderDetail() {
    const panel = document.getElementById('cp-detail');
    if (!panel) return;

    if (state.mode === 'new' || state.mode === 'edit') { renderEditForm(panel); return; }

    if (!state.selectedId) {
        const typeLabel = state.activeTab === 'character' ? '캐릭터' : '페르소나';
        panel.innerHTML = `
            <div class="cp-detail-empty">
                <div class="cp-detail-empty-icon">📖</div>
                목록에서 ${typeLabel}를 선택하거나<br>새로 추가해 보세요.
            </div>`;
        return;
    }

    const entry = getEntries().find(e => e.id === state.selectedId);
    if (!entry) { state.selectedId = null; renderDetail(); return; }
    renderViewMode(panel, entry);
}

// ── 뷰 모드 ───────────────────────────────────────────────
function renderViewMode(panel, entry) {
    const typeLabel = entry.type === 'character' ? '캐릭터' : '페르소나';
    const baseKeys = new Set(BASE_FIELDS.map(f => f.key));

    const fieldBlocks = getAllFields().filter(f => f.key !== 'name').map(f => {
        const val = entry[f.key];
        const empty = !val || !String(val).trim();
        const isCustom = !baseKeys.has(f.key);
        return `
        <div class="cp-field-block${f.full ? ' cp-field-full' : ''}">
            <div class="cp-field-label">${esc(f.label)}${isCustom ? ' <span class="cp-custom-badge">커스텀</span>' : ''}</div>
            <div class="cp-field-value${empty ? ' empty' : ''}">${empty ? '(미입력)' : esc(val)}</div>
        </div>`;
    }).join('');

    const tagsHtml = (entry.tags || []).length
        ? `<div class="cp-tags-section">
            <span class="cp-tags-label">태그</span>
            ${entry.tags.map(t => `<span class="cp-tag-chip">${esc(t)}</span>`).join('')}
           </div>` : '';

    panel.innerHTML = `
        <div class="cp-view">
            <div class="cp-view-header">
                <div class="cp-view-header-left">
                    <button class="cp-btn-back" id="cp-btn-back">←</button>
                    <div>
                        <div class="cp-view-name">${esc(entry.name) || '(이름 없음)'}</div>
                        <span class="cp-view-type-badge ${entry.type}">${typeLabel}</span>
                    </div>
                </div>
                <div class="cp-view-actions">
                    <button class="cp-btn-edit" id="cp-btn-edit">✏️ 편집</button>
                    <button class="cp-btn-delete" id="cp-btn-delete">🗑 삭제</button>
                </div>
            </div>
            <div class="cp-fields-grid">${fieldBlocks}</div>
            ${tagsHtml}
        </div>`;

    panel.querySelector('#cp-btn-back').addEventListener('click', () => {
        state.selectedId = null; toggleMobileView('list'); renderList(); renderDetail();
    });
    panel.querySelector('#cp-btn-edit').addEventListener('click', () => {
        state.mode = 'edit';
        state.editTags = [...(entry.tags || [])];
        state.editCustomFields = structuredClone(getCustomFields());
        state.showAddField = false;
        renderDetail();
    });
    panel.querySelector('#cp-btn-delete').addEventListener('click', () => {
        showConfirm(`"${entry.name || '이 항목'}"을 삭제할까요?`, () => {
            saveEntries(getEntries().filter(e => e.id !== entry.id));
            state.selectedId = null; state.mode = 'view';
            toggleMobileView('list'); renderAll(); showToast('삭제되었어요');
        });
    });
}

// ── 편집/추가 폼 ──────────────────────────────────────────
function renderEditForm(panel) {
    const isNew = state.mode === 'new';
    const entry = isNew ? {} : (getEntries().find(e => e.id === state.selectedId) || {});
    const typeLabel = state.activeTab === 'character' ? '캐릭터' : '페르소나';

    const baseHtml = BASE_FIELDS.map(f => renderFormField(f, entry)).join('');

    const customHtml = state.editCustomFields.map((f, idx) => `
        <div class="cp-form-group cp-form-full">
            <div class="cp-custom-field-header">
                <label class="cp-form-label">${esc(f.label)} <span class="cp-custom-badge">커스텀</span></label>
                <button class="cp-btn-remove-field" data-idx="${idx}" title="필드 삭제">✕ 삭제</button>
            </div>
            ${f.type === 'textarea'
                ? `<textarea class="cp-form-textarea" name="custom_${esc(f.key)}" rows="${f.rows||2}" placeholder="${esc(f.placeholder)}">${esc(entry[f.key]||'')}</textarea>`
                : `<input class="cp-form-input" type="text" name="custom_${esc(f.key)}" value="${esc(entry[f.key]||'')}" placeholder="${esc(f.placeholder)}">`
            }
        </div>`).join('');

    const addFieldHtml = state.showAddField ? `
        <div class="cp-add-field-form cp-form-full">
            <div class="cp-add-field-title">➕ 새 필드 추가</div>
            <div class="cp-add-field-grid">
                <div class="cp-form-group">
                    <label class="cp-form-label">필드 이름 *</label>
                    <input class="cp-form-input" id="cp-new-field-label" type="text" placeholder="예: 특기, 좋아하는 것">
                </div>
                <div class="cp-form-group">
                    <label class="cp-form-label">입력 형태</label>
                    <select class="cp-form-select" id="cp-new-field-type">
                        <option value="input">한 줄 텍스트</option>
                        <option value="textarea">여러 줄 텍스트</option>
                    </select>
                </div>
            </div>
            <div class="cp-add-field-actions">
                <button class="cp-btn-cancel-small" id="cp-cancel-field">취소</button>
                <button class="cp-btn-confirm-field" id="cp-confirm-field">추가하기</button>
            </div>
        </div>` : `
        <button class="cp-btn-add-field" id="cp-btn-add-field">＋ 필드 추가</button>`;

    const tagsHtml = (state.editTags || []).map(t =>
        `<span class="cp-form-tag-chip">${esc(t)}<span class="cp-form-tag-remove" data-tag="${esc(t)}">✕</span></span>`
    ).join('');

    panel.innerHTML = `
        <div class="cp-edit">
            <div class="cp-edit-header">
                <div class="cp-edit-title">${isNew ? `새 ${typeLabel} 추가` : `${typeLabel} 편집`}</div>
                <div class="cp-edit-actions">
                    <button class="cp-btn-cancel" id="cp-btn-cancel">취소</button>
                    <button class="cp-btn-save" id="cp-btn-save">💾 저장</button>
                </div>
            </div>
            <div class="cp-form-grid">
                ${baseHtml}
                ${customHtml}
                <div class="cp-form-full">${addFieldHtml}</div>
                <div class="cp-form-group cp-form-full">
                    <label class="cp-form-label">태그</label>
                    <div class="cp-form-tags-input" id="cp-tags-container">
                        ${tagsHtml}
                        <input class="cp-tag-text-input" id="cp-tag-input" type="text" placeholder="태그 입력 후 Enter">
                    </div>
                </div>
            </div>
        </div>`;

    // 커스텀 필드 삭제
    panel.querySelectorAll('.cp-btn-remove-field').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const key = state.editCustomFields[idx]?.key;
            state.editCustomFields.splice(idx, 1);
            saveCustomFields(getCustomFields().filter(f => f.key !== key));
            renderDetail();
        });
    });

    // 필드 추가 버튼
    panel.querySelector('#cp-btn-add-field')?.addEventListener('click', () => {
        state.showAddField = true; renderDetail();
        setTimeout(() => document.getElementById('cp-new-field-label')?.focus(), 30);
    });

    // 필드 추가 확인
    panel.querySelector('#cp-confirm-field')?.addEventListener('click', () => {
        const labelEl = document.getElementById('cp-new-field-label');
        const typeEl  = document.getElementById('cp-new-field-type');
        const label   = labelEl?.value.trim();
        if (!label) { showToast('필드 이름을 입력해 주세요!'); labelEl?.focus(); return; }
        const key = 'custom_' + label.replace(/[^\w가-힣]/g, '_').toLowerCase() + '_' + Date.now().toString(36).slice(-4);
        const nf = { key, label, type: typeEl?.value || 'input', placeholder: `${label}을(를) 입력하세요`, full: true, rows: 2 };
        const g = getCustomFields(); g.push(nf); saveCustomFields(g);
        state.editCustomFields.push(nf);
        state.showAddField = false;
        renderDetail(); showToast(`"${label}" 필드가 추가됐어요!`);
    });

    // 필드 추가 취소
    panel.querySelector('#cp-cancel-field')?.addEventListener('click', () => {
        state.showAddField = false; renderDetail();
    });

    // 태그 입력
    setupTagInput(panel);

    // 저장
    panel.querySelector('#cp-btn-save').addEventListener('click', () => {
        const form = panel.querySelector('.cp-edit');
        const data = {};
        BASE_FIELDS.forEach(f => {
            const el = form.querySelector(`[name="${f.key}"]`);
            if (el) data[f.key] = el.value.trim();
        });
        state.editCustomFields.forEach(f => {
            const el = form.querySelector(`[name="custom_${f.key}"]`);
            if (el) data[f.key] = el.value.trim();
        });
        if (!data.name) { showToast('이름을 입력해 주세요!'); form.querySelector('[name="name"]')?.focus(); return; }
        data.tags = [...(state.editTags || [])];
        data.type = state.activeTab;
        const entries = getEntries();
        if (isNew) {
            data.id = genId(); data.createdAt = Date.now();
            entries.push(data); state.selectedId = data.id;
        } else {
            const idx = entries.findIndex(e => e.id === state.selectedId);
            if (idx !== -1) entries[idx] = { ...entries[idx], ...data };
        }
        saveEntries(entries); state.mode = 'view';
        renderAll(); showToast(isNew ? '새 항목이 추가됐어요!' : '저장되었어요!');
    });

    // 취소
    panel.querySelector('#cp-btn-cancel').addEventListener('click', () => {
        if (isNew) state.selectedId = null;
        state.mode = 'view'; state.showAddField = false;
        renderDetail();
    });
}

function renderFormField(f, entry) {
    const val = esc(entry[f.key] || '');
    const cls = f.full ? ' cp-form-full' : '';
    if (f.type === 'textarea') {
        return `
        <div class="cp-form-group${cls}">
            <label class="cp-form-label">${esc(f.label)}${f.required ? ' *' : ''}</label>
            <textarea class="cp-form-textarea" name="${f.key}" rows="${f.rows||2}" placeholder="${esc(f.placeholder)}">${val}</textarea>
        </div>`;
    }
    return `
    <div class="cp-form-group${cls}">
        <label class="cp-form-label">${esc(f.label)}${f.required ? ' *' : ''}</label>
        <input class="cp-form-input" type="text" name="${f.key}" value="${val}" placeholder="${esc(f.placeholder)}">
    </div>`;
}

function setupTagInput(panel) {
    const render = () => {
        const c = panel.querySelector('#cp-tags-container');
        if (!c) return;
        c.innerHTML = (state.editTags||[]).map(t =>
            `<span class="cp-form-tag-chip">${esc(t)}<span class="cp-form-tag-remove" data-tag="${esc(t)}">✕</span></span>`
        ).join('') + `<input class="cp-tag-text-input" id="cp-tag-input" type="text" placeholder="태그 입력 후 Enter">`;
        const inp = c.querySelector('#cp-tag-input');
        inp?.addEventListener('keydown', (e) => {
            if ((e.key==='Enter'||e.key===',') && inp.value.trim()) {
                e.preventDefault();
                const t = inp.value.trim().replace(/,/g,'');
                if (t && !state.editTags.includes(t)) state.editTags.push(t);
                inp.value=''; render(); c.querySelector('#cp-tag-input')?.focus();
            }
            if (e.key==='Backspace' && !inp.value && state.editTags.length) {
                state.editTags.pop(); render(); c.querySelector('#cp-tag-input')?.focus();
            }
        });
        c.querySelectorAll('.cp-form-tag-remove').forEach(b => {
            b.addEventListener('click', () => {
                state.editTags = state.editTags.filter(t => t !== b.dataset.tag); render();
            });
        });
    };
    render();
}

// ── 모바일 뷰 전환 ────────────────────────────────────────
function toggleMobileView(show) {
    document.getElementById('cp-body')?.classList.toggle('show-detail', show === 'detail');
}

// ============================================================
// 유틸 UI
// ============================================================

function showConfirm(msg, onYes) {
    const o = document.createElement('div');
    o.className = 'cp-confirm-overlay';
    o.innerHTML = `<div class="cp-confirm-box"><p>${esc(msg)}</p>
        <div class="cp-confirm-btns">
            <button class="cp-confirm-no">취소</button>
            <button class="cp-confirm-yes">삭제</button>
        </div></div>`;
    document.body.appendChild(o);
    o.querySelector('.cp-confirm-yes').addEventListener('click', () => { o.remove(); onYes(); });
    o.querySelector('.cp-confirm-no').addEventListener('click', () => o.remove());
}

let _toastTimer = null;
function showToast(msg) {
    let t = document.getElementById('cp-toast');
    if (!t) { t = document.createElement('div'); t.className='cp-toast'; t.id='cp-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ============================================================
// 모달
// ============================================================

function openModal()  { const o = document.getElementById('chatpedia-overlay'); if(o) { o.classList.add('active'); renderAll(); } }
function closeModal() { document.getElementById('chatpedia-overlay')?.classList.remove('active'); }

function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'chatpedia-overlay';
    overlay.innerHTML = `
        <div id="chatpedia-modal">
            <div class="cp-header">
                <div class="cp-title-block">
                    <span class="cp-title">📚 챗키피디아</span>
                    <span class="cp-title-sub">Chatpedia</span>
                </div>
                <button class="cp-btn-close" id="cp-close-btn" title="닫기">✕</button>
            </div>
            <div class="cp-tabs">
                <div class="cp-tab active" data-tab="character">⚔️ 캐릭터 <span class="cp-tab-count">0</span></div>
                <div class="cp-tab" data-tab="persona">🎭 페르소나 <span class="cp-tab-count">0</span></div>
            </div>
            <div class="cp-toolbar">
                <div class="cp-search-wrap">
                    <span class="cp-search-icon">🔍</span>
                    <input class="cp-search" id="cp-search" type="text" placeholder="이름, 설정, 태그 검색...">
                </div>
                <select class="cp-tag-filter" id="cp-tag-filter"><option value="all">전체 태그</option></select>
                <button class="cp-btn-add" id="cp-add-btn">＋ 추가</button>
            </div>
            <div class="cp-body" id="cp-body">
                <div class="cp-list-panel" id="cp-list"></div>
                <div class="cp-detail-panel" id="cp-detail"></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.querySelector('#cp-close-btn').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key==='Escape' && overlay.classList.contains('active')) closeModal(); });

    overlay.querySelectorAll('.cp-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.activeTab = tab.dataset.tab;
            state.selectedId = null; state.mode = 'view';
            state.searchQuery = ''; state.tagFilter = 'all';
            const s = document.getElementById('cp-search'); if(s) s.value='';
            toggleMobileView('list'); renderAll();
        });
    });

    overlay.querySelector('#cp-search').addEventListener('input', e => {
        state.searchQuery = e.target.value; renderList();
    });
    overlay.querySelector('#cp-tag-filter').addEventListener('change', e => {
        state.tagFilter = e.target.value; renderList();
    });
    overlay.querySelector('#cp-add-btn').addEventListener('click', () => {
        state.mode = 'new'; state.selectedId = null;
        state.editTags = []; state.editCustomFields = structuredClone(getCustomFields());
        state.showAddField = false;
        toggleMobileView('detail'); renderList(); renderDetail();
    });
}

// ── 마법봉(wand) 메뉴 등록 ───────────────────────────────
function registerWandButton() {
    const WAND_ID = 'chatpedia-wand-btn';

    const inject = () => {
        if (document.getElementById(WAND_ID)) return true;

        // SillyTavern의 extensions 메뉴 컨테이너 탐색
        const menu = document.getElementById('extensionsMenu')
            || document.querySelector('.extensions-menu ul')
            || document.querySelector('#extensionsMenuList');
        if (!menu) return false;

        const item = document.createElement('div');
        item.id = WAND_ID;
        item.className = 'list-group-item flex-container flexGap5 interactable';
        item.setAttribute('tabindex', '0');
        item.innerHTML = `<i class="fa-solid fa-book-open"></i><span>챗키피디아 열기</span>`;
        item.addEventListener('click', () => {
            // 메뉴 팝업 닫기 시도
            document.querySelector('#extensionsMenu')?.closest('.popup')?.remove();
            document.querySelector('.extensions-menu')?.classList.remove('open');
            openModal();
        });
        menu.appendChild(item);
        return true;
    };

    if (!inject()) {
        const obs = new MutationObserver(() => { if (inject()) obs.disconnect(); });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // 마법봉 버튼 클릭 후 메뉴가 열릴 때 재시도
    document.addEventListener('click', e => {
        if (e.target.closest('#extensionsMenuButton, [data-i18n="Extensions"], .extensions-btn')) {
            setTimeout(inject, 150);
        }
    });
}

// ── 플로팅 버튼 (모바일 보조) ─────────────────────────────
function buildTriggerButton() {
    if (document.getElementById('chatpedia-trigger')) return;
    const btn = document.createElement('button');
    btn.id = 'chatpedia-trigger';
    btn.title = '챗키피디아 열기';
    btn.innerHTML = `📚`;
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
}

// ============================================================
// 진입점
// ============================================================

jQuery(async () => {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    buildModal();
    buildTriggerButton();
    registerWandButton();
    console.log('[챗키피디아] 로드 완료 ✅');
});
