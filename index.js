// ============================================================
// 챗키피디아 (Chatpedia) - SillyTavern Extension v1.1.0
// RP 캐릭터 & 페르소나 백과사전
// https://github.com/your-username/chatpedia
// ============================================================

import { saveSettingsDebounced, characters, this_chid } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

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
    customFields: [],
    hideEmptyFields: false,
    defaultTab: 'character',
    showFloatBtn: true,
    charLinks: {},
    personaLinks: {},
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
    const s = extension_settings[EXT_NAME];
    if (!s.customFields)  s.customFields = [];
    if (!s.charLinks)     s.charLinks = {};
    if (!s.personaLinks)  s.personaLinks = {};
    if (s.hideEmptyFields === undefined) s.hideEmptyFields = false;
    if (s.defaultTab      === undefined) s.defaultTab = 'character';
    if (s.showFloatBtn    === undefined) s.showFloatBtn = true;
    return s;
}

function getEntries()     { return getSettings().entries || []; }
function saveEntries(e)   { getSettings().entries = e; saveSettingsDebounced(); }
function getCustomFields(){ return getSettings().customFields || []; }
function saveCustomFields(f){ getSettings().customFields = f; saveSettingsDebounced(); }
function getAllFields()    { return [...BASE_FIELDS, ...getCustomFields()]; }
function getOpt(key)      { return getSettings()[key]; }
function setOpt(key, val) { getSettings()[key] = val; saveSettingsDebounced(); }

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
        if (empty && getOpt('hideEmptyFields')) return '';
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
        <div class="cp-form-group cp-form-full" data-custom-key="${esc(f.key)}">
            <div class="cp-custom-field-header">
                <label class="cp-form-label">${esc(f.label)} <span class="cp-custom-badge">커스텀</span></label>
                <button class="cp-btn-remove-field" data-key="${esc(f.key)}" data-idx="${idx}" title="필드 삭제">✕ 삭제</button>
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
            const key = btn.dataset.key || state.editCustomFields[parseInt(btn.dataset.idx)]?.key;
            if (key) removeCustomFieldRow(panel, key);
        });
    });

    // 필드 추가 버튼
    panel.querySelector('#cp-btn-add-field')?.addEventListener('click', () => {
        // 전체 폼 재렌더 대신 해당 영역만 교체 → 기존 입력값 보존
        const btn = panel.querySelector('#cp-btn-add-field');
        if (!btn) return;
        btn.outerHTML = `
            <div class="cp-add-field-form cp-form-full" id="cp-add-field-inline">
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
            </div>`;
        state.showAddField = true;
        // 새로 삽입된 요소에 이벤트 바인딩
        const inlineForm = panel.querySelector('#cp-add-field-inline');
        bindAddFieldForm(panel, inlineForm);
        setTimeout(() => panel.querySelector('#cp-new-field-label')?.focus(), 30);
    });

    // 필드 추가 확인
    // confirm/cancel은 bindAddFieldForm()으로 이동됨 (인라인 삽입 방식)
    // 초기 showAddField=false 상태이므로 이미 버튼 형태로 렌더됨

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


// ── 인라인 필드 추가 폼 이벤트 바인딩 (전체 재렌더 없이 동작) ──────
function bindAddFieldForm(panel, formEl) {
    if (!formEl) return;

    formEl.querySelector('#cp-confirm-field')?.addEventListener('click', () => {
        const labelEl = formEl.querySelector('#cp-new-field-label');
        const typeEl  = formEl.querySelector('#cp-new-field-type');
        const label   = labelEl?.value.trim();
        if (!label) { showToast('필드 이름을 입력해 주세요!'); labelEl?.focus(); return; }

        const key = 'custom_' + label.replace(/[^\w가-힣]/g, '_').toLowerCase()
                    + '_' + Date.now().toString(36).slice(-4);
        const nf = { key, label, type: typeEl?.value || 'input',
                     placeholder: `${label}을(를) 입력하세요`, full: true, rows: 2 };

        // 전역 저장
        const g = getCustomFields(); g.push(nf); saveCustomFields(g);
        state.editCustomFields.push(nf);
        state.showAddField = false;

        // 폼을 제거하고 → 새 커스텀 필드 행 + "필드 추가" 버튼 다시 삽입
        const fieldType = nf.type === 'textarea'
            ? `<textarea class="cp-form-textarea" name="custom_${esc(nf.key)}" rows="${nf.rows||2}" placeholder="${esc(nf.placeholder)}"></textarea>`
            : `<input class="cp-form-input" type="text" name="custom_${esc(nf.key)}" placeholder="${esc(nf.placeholder)}">`;

        const newRow = document.createElement('div');
        newRow.className = 'cp-form-group cp-form-full';
        newRow.dataset.customKey = nf.key;
        newRow.innerHTML = `
            <div class="cp-custom-field-header">
                <label class="cp-form-label">${esc(nf.label)} <span class="cp-custom-badge">커스텀</span></label>
                <button class="cp-btn-remove-field" data-key="${esc(nf.key)}">✕ 삭제</button>
            </div>
            ${fieldType}`;

        // 삭제 버튼 바인딩
        newRow.querySelector('.cp-btn-remove-field').addEventListener('click', () => {
            removeCustomFieldRow(panel, nf.key);
        });

        // 폼 자리에 새 행 삽입, 그 아래 "필드 추가" 버튼 복원
        formEl.replaceWith(newRow);
        insertAddFieldButton(panel);
        showToast(`"${label}" 필드가 추가됐어요!`);
    });

    formEl.querySelector('#cp-cancel-field')?.addEventListener('click', () => {
        state.showAddField = false;
        formEl.replaceWith(createAddFieldButton(panel));
    });
}

function createAddFieldButton(panel) {
    const btn = document.createElement('button');
    btn.className = 'cp-btn-add-field';
    btn.id = 'cp-btn-add-field';
    btn.textContent = '＋ 필드 추가';
    btn.addEventListener('click', () => {
        btn.outerHTML = `
            <div class="cp-add-field-form cp-form-full" id="cp-add-field-inline">
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
            </div>`;
        state.showAddField = true;
        const inlineForm = panel.querySelector('#cp-add-field-inline');
        bindAddFieldForm(panel, inlineForm);
        setTimeout(() => panel.querySelector('#cp-new-field-label')?.focus(), 30);
    });
    return btn;
}

function insertAddFieldButton(panel) {
    // 태그 입력 컨테이너 바로 앞의 cp-form-full 영역에 삽입
    const tagGroup = panel.querySelector('#cp-tags-container')?.closest('.cp-form-group');
    if (tagGroup) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cp-form-full';
        wrapper.appendChild(createAddFieldButton(panel));
        tagGroup.parentNode.insertBefore(wrapper, tagGroup);
    }
}

function removeCustomFieldRow(panel, key) {
    // 전역 커스텀 필드에서 제거
    saveCustomFields(getCustomFields().filter(f => f.key !== key));
    state.editCustomFields = state.editCustomFields.filter(f => f.key !== key);
    // DOM에서 해당 행만 제거
    const row = panel.querySelector(`[data-custom-key="${key}"]`);
    row?.closest('.cp-form-group, .cp-form-full')?.remove() || row?.remove();
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

function openModal()  {
    const o = document.getElementById('chatpedia-overlay');
    if (o) {
        // 처음 열 때 기본 탭 적용
        if (!state._opened) {
            state.activeTab = getOpt('defaultTab') || 'character';
            state._opened = true;
        }
        o.classList.add('active');
        renderAll();
        // 현재 ST 캐릭터와 연결된 항목 하이라이트
        highlightLinkedEntry();
    }
}
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
    // 레퍼런스와 동일한 방식
    const $btn = $(`<div id="chatpedia-wand-btn" class="list-group-item flex-container flexGap5" title="챗키피디아 열기">
        <span>📚</span><span>챗키피디아</span>
    </div>`);
    $btn.on('click', openModal);
    $('#extensionsMenu').append($btn);
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

function syncFloatBtn() {
    const btn = document.getElementById('chatpedia-trigger');
    if (btn) btn.style.display = getOpt('showFloatBtn') ? 'flex' : 'none';
}


// ============================================================
// ST 연동 유틸
// ============================================================

/** ST 연결 프로필 목록 반환 */
function getConnectionProfiles() {
    // 레퍼런스(vocab-helper)와 동일한 방식: #connection_profiles option
    const profiles = [];
    $('#connection_profiles option').each(function() {
        const val  = $(this).val();
        const text = $(this).text().trim();
        // <None> 항목도 포함 (val이 빈 문자열이거나 'none')
        profiles.push({ id: val, name: text });
    });
    return profiles;
}

/** ST 캐릭터 목록 반환 */
function getSTCharacters() {
    try {
        if (Array.isArray(characters) && characters.length) {
            return characters.map((c, i) => ({ id: String(i), name: c.name || `캐릭터 ${i}` }));
        }
    } catch {}
    // fallback: DOM에서 수집
    const list = [];
    $('#rm_print_characters_block .character_select, .character_list .char-item').each(function() {
        const name = $(this).find('.ch_name, .name').first().text().trim()
            || $(this).attr('title') || $(this).data('name');
        const id   = $(this).attr('chid') || $(this).data('chid') || name;
        if (name) list.push({ id: String(id), name });
    });
    return list;
}

/** ST 페르소나 목록 반환 */
function getSTPers() {
    try {
        // 방법 1: getContext() via SillyTavern global
        const ctx = window.SillyTavern?.getContext();
        if (ctx?.personas && typeof ctx.personas === 'object') {
            return Object.entries(ctx.personas).map(([k, v]) => ({
                id: k, name: typeof v === 'string' ? v : (v?.name || k)
            }));
        }
    } catch {}
    // 방법 2: DOM fallback
    const list = [];
    $('#persona_selector option, #user_avatar_block .avatar-item').each(function() {
        const name = $(this).text().trim() || $(this).attr('title');
        const id   = $(this).val() || $(this).data('name') || name;
        if (name && name !== '없음') list.push({ id, name });
    });
    return list;
}

/** 현재 열린 ST 캐릭터와 연결된 챗키피디아 항목 하이라이트 */
function highlightLinkedEntry() {
    try {
        let charName = null;
        // this_chid로 현재 캐릭터 이름 확인
        if (typeof this_chid !== 'undefined' && this_chid != null && Array.isArray(characters)) {
            charName = characters[this_chid]?.name;
        }
        if (!charName) {
            charName = $('#char-name, .character_name_value, .ch_name').first().text().trim();
        }
        if (!charName) return;

        const links = getSettings().charLinks || {};
        const linkedId = links[charName];
        if (!linkedId) return;

        const entry = getEntries().find(e => e.id === linkedId);
        if (!entry) return;

        // 연결된 캐릭터가 있는 탭으로 이동 + 항목 선택
        if (entry.type !== state.activeTab) {
            state.activeTab = entry.type;
        }
        state.selectedId = linkedId;
        renderAll();
        // 시각적 알림
        showToast(`🔗 "${entry.name}" 항목과 연결됨`);
    } catch(e) { console.warn('[챗키피디아] highlightLinkedEntry:', e); }
}

// ============================================================
// 설정 패널 (Extensions 탭 토글 내부)
// ============================================================

function buildSettingsPanel() {
    if (document.getElementById('chatpedia-settings-panel')) return;

    // 레퍼런스와 동일한 방식: #extensions_settings에 직접 append
    const html = `
        <div id="chatpedia_ext_container">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>📚 챗키피디아</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div id="chatpedia-settings-panel">
                        ${buildSettingsPanelHTML()}
                    </div>
                </div>
            </div>
        </div>`;

    $('#extensions_settings').append(html);
    const panel = document.getElementById('chatpedia-settings-panel');
    if (panel) bindSettingsPanelEvents(panel);
}

function buildSettingsPanelHTML() {
    const s = getSettings();
    const chars   = getSTCharacters();
    const pers    = getSTPers();
    const entries = getEntries();
    const charEntries    = entries.filter(e => e.type === 'character');
    const personaEntries = entries.filter(e => e.type === 'persona');
    const profiles       = getConnectionProfiles();

    const charLinkRows = chars.length ? chars.map(c => {
        const linked = s.charLinks[c.name] || '';
        return `<div class="cp-set-link-row">
            <span class="cp-set-link-name" title="${esc(c.name)}">${esc(c.name)}</span>
            <select class="cp-set-select cp-char-link-sel" data-char="${esc(c.name)}">
                <option value="">— 연결 안 함 —</option>
                ${charEntries.map(e => `<option value="${esc(e.id)}"${linked===e.id?' selected':''}>${esc(e.name)}</option>`).join('')}
            </select>
        </div>`;
    }).join('') : `<p class="cp-set-hint">ST에서 캐릭터가 로드되지 않았어요.</p>`;

    const persLinkRows = pers.length ? pers.map(p => {
        const linked = s.personaLinks[p.id] || '';
        return `<div class="cp-set-link-row">
            <span class="cp-set-link-name" title="${esc(p.name)}">${esc(p.name)}</span>
            <select class="cp-set-select cp-pers-link-sel" data-pers="${esc(p.id)}">
                <option value="">— 연결 안 함 —</option>
                ${personaEntries.map(e => `<option value="${esc(e.id)}"${linked===e.id?' selected':''}>${esc(e.name)}</option>`).join('')}
            </select>
        </div>`;
    }).join('') : `<p class="cp-set-hint">ST에서 페르소나가 로드되지 않았어요.</p>`;

    // 프로필 select는 항상 표시 — bindSettingsPanelEvents에서 실시간으로 채움
    const profileRows = `
        <div class="cp-set-row">
            <label class="cp-set-label">연결 프로필 전환</label>
            <div class="cp-set-profile-wrap">
                <select class="cp-set-select" id="cp-profile-select">
                    <option value="">— 불러오는 중... —</option>
                </select>
                <button class="cp-set-btn-apply" id="cp-profile-apply">적용</button>
            </div>
            <p class="cp-set-hint">선택한 연결 프로필로 즉시 전환합니다.</p>
        </div>`;

    return `
    <div class="cp-settings">

        <!-- ── 표시 설정 ── -->
        <div class="cp-set-section">
            <div class="cp-set-section-title">🎨 표시 설정</div>

            <div class="cp-set-row cp-set-toggle-row">
                <label class="cp-set-label">빈 필드 숨기기</label>
                <label class="cp-toggle">
                    <input type="checkbox" id="cp-opt-hideEmpty" ${s.hideEmptyFields ? 'checked' : ''}>
                    <span class="cp-toggle-track"><span class="cp-toggle-thumb"></span></span>
                </label>
                <p class="cp-set-hint">뷰 모드에서 값이 없는 필드를 숨겨요.</p>
            </div>

            <div class="cp-set-row cp-set-toggle-row">
                <label class="cp-set-label">플로팅 버튼 표시</label>
                <label class="cp-toggle">
                    <input type="checkbox" id="cp-opt-showFloat" ${s.showFloatBtn ? 'checked' : ''}>
                    <span class="cp-toggle-track"><span class="cp-toggle-thumb"></span></span>
                </label>
                <p class="cp-set-hint">화면 우하단의 📚 버튼 표시 여부.</p>
            </div>

            <div class="cp-set-row">
                <label class="cp-set-label">기본 탭</label>
                <select class="cp-set-select" id="cp-opt-defaultTab">
                    <option value="character" ${s.defaultTab==='character'?'selected':''}>⚔️ 캐릭터</option>
                    <option value="persona"   ${s.defaultTab==='persona'  ?'selected':''}>🎭 페르소나</option>
                </select>
                <p class="cp-set-hint">챗키피디아를 열 때 기본으로 보여줄 탭.</p>
            </div>
        </div>

        <!-- ── 연결 프로필 ── -->
        <div class="cp-set-section">
            <div class="cp-set-section-title">🔌 연결 프로필</div>
            ${profileRows}
        </div>

        <!-- ── 캐릭터 카드 연결 ── -->
        <div class="cp-set-section">
            <div class="cp-set-section-title">⚔️ 캐릭터 카드 연결</div>
            <p class="cp-set-hint" style="margin-bottom:8px">ST 캐릭터와 챗키피디아 항목을 1:1 매핑합니다. 챗키피디아를 열면 연결된 항목이 자동으로 선택돼요.</p>
            <div class="cp-set-link-list" id="cp-char-link-list">${charLinkRows}</div>
        </div>

        <!-- ── 페르소나 연결 ── -->
        <div class="cp-set-section">
            <div class="cp-set-section-title">🎭 페르소나 연결</div>
            <p class="cp-set-hint" style="margin-bottom:8px">ST 페르소나와 챗키피디아 페르소나 항목을 연결합니다.</p>
            <div class="cp-set-link-list" id="cp-pers-link-list">${persLinkRows}</div>
        </div>

        <!-- ── 데이터 관리 ── -->
        <div class="cp-set-section">
            <div class="cp-set-section-title">📦 데이터 관리</div>

            <div class="cp-set-row">
                <label class="cp-set-label">내보내기 (Export)</label>
                <button class="cp-set-btn" id="cp-export-btn">⬇️ JSON 다운로드</button>
                <p class="cp-set-hint">모든 캐릭터/페르소나 데이터를 JSON 파일로 저장해요.</p>
            </div>

            <div class="cp-set-row">
                <label class="cp-set-label">가져오기 (Import)</label>
                <div class="cp-set-import-wrap">
                    <input type="file" id="cp-import-file" accept=".json" style="display:none">
                    <button class="cp-set-btn" id="cp-import-btn">⬆️ JSON 불러오기</button>
                </div>
                <p class="cp-set-hint">기존 데이터에 <b>병합</b>됩니다. 같은 ID는 덮어씌워져요.</p>
            </div>

            <div class="cp-set-row cp-set-danger-row">
                <label class="cp-set-label">초기화</label>
                <button class="cp-set-btn cp-set-btn-danger" id="cp-reset-btn">🗑️ 전체 데이터 삭제</button>
                <p class="cp-set-hint">⚠️ 모든 항목이 영구 삭제돼요. 되돌릴 수 없어요!</p>
            </div>
        </div>

    </div>`;
}

function bindSettingsPanelEvents(panel) {
    // ── 표시 옵션 ──────────────────────────────────────────
    panel.querySelector('#cp-opt-hideEmpty')?.addEventListener('change', e => {
        setOpt('hideEmptyFields', e.target.checked);
        showToast(e.target.checked ? '빈 필드를 숨겨요' : '빈 필드를 표시해요');
    });

    panel.querySelector('#cp-opt-showFloat')?.addEventListener('change', e => {
        setOpt('showFloatBtn', e.target.checked);
        syncFloatBtn();
        showToast(e.target.checked ? '플로팅 버튼을 표시해요' : '플로팅 버튼을 숨겼어요');
    });

    panel.querySelector('#cp-opt-defaultTab')?.addEventListener('change', e => {
        setOpt('defaultTab', e.target.value);
        showToast('기본 탭이 변경됐어요');
    });

    // ── 연결 프로필 select 실시간 채우기 ────────────────
    const profileSel = panel.querySelector('#cp-profile-select');
    if (profileSel) {
        const profiles = getConnectionProfiles();
        profileSel.innerHTML = profiles.length
            ? profiles.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')
            : '<option value="">등록된 프로필이 없어요</option>';
    }

    // ── 연결 프로필 적용 ─────────────────────────────────
    panel.querySelector('#cp-profile-apply')?.addEventListener('click', () => {
        const sel = panel.querySelector('#cp-profile-select');
        const val = sel?.value;
        if (!val) { showToast('프로필을 선택해 주세요'); return; }
        // ST 연결 프로필 전환 시도
        try {
            // 방법 1: ST 내부 함수 호출
            if (typeof window.selectConnectionProfile === 'function') {
                window.selectConnectionProfile(val);
            } else {
                // 방법 2: 드롭다운 직접 조작 (레퍼런스와 동일)
                $('#connection_profiles').val(val).trigger('change');
            }
            showToast(`✅ 프로필 "${sel.options[sel.selectedIndex]?.text}" 적용됨`);
        } catch(e) {
            showToast('프로필 전환에 실패했어요');
            console.warn('[챗키피디아] 프로필 전환 실패:', e);
        }
    });

    // ── 캐릭터 연결 ──────────────────────────────────────
    panel.querySelectorAll('.cp-char-link-sel').forEach(sel => {
        sel.addEventListener('change', () => {
            const charName = sel.dataset.char;
            const links = getSettings().charLinks;
            if (sel.value) links[charName] = sel.value;
            else delete links[charName];
            saveSettingsDebounced();
            showToast(`"${charName}" 연결 저장됨`);
        });
    });

    // ── 페르소나 연결 ────────────────────────────────────
    panel.querySelectorAll('.cp-pers-link-sel').forEach(sel => {
        sel.addEventListener('change', () => {
            const persId = sel.dataset.pers;
            const links  = getSettings().personaLinks;
            if (sel.value) links[persId] = sel.value;
            else delete links[persId];
            saveSettingsDebounced();
            showToast(`페르소나 연결 저장됨`);
        });
    });

    // ── 내보내기 ─────────────────────────────────────────
    panel.querySelector('#cp-export-btn')?.addEventListener('click', () => {
        const data = {
            version: '1.1.0',
            exportedAt: new Date().toISOString(),
            entries:      getEntries(),
            customFields: getCustomFields(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `chatpedia_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📥 내보내기 완료!');
    });

    // ── 가져오기 ─────────────────────────────────────────
    const importFile = panel.querySelector('#cp-import-file');
    panel.querySelector('#cp-import-btn')?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                const incoming = data.entries || data; // 구버전 호환
                if (!Array.isArray(incoming)) throw new Error('올바른 형식이 아니에요');

                const existing  = getEntries();
                const existMap  = Object.fromEntries(existing.map(e => [e.id, e]));
                incoming.forEach(e => { existMap[e.id] = e; });
                saveEntries(Object.values(existMap));

                if (Array.isArray(data.customFields)) {
                    const cf = getCustomFields();
                    const cfMap = Object.fromEntries(cf.map(f => [f.key, f]));
                    data.customFields.forEach(f => { cfMap[f.key] = f; });
                    saveCustomFields(Object.values(cfMap));
                }

                showToast(`✅ ${incoming.length}개 항목 가져오기 완료!`);
                // 설정 패널 새로고침
                const p = document.getElementById('chatpedia-settings-panel');
                if (p) { p.innerHTML = buildSettingsPanelHTML(); bindSettingsPanelEvents(p); }
            } catch(err) {
                showToast(`❌ 가져오기 실패: ${err.message}`);
            }
            importFile.value = '';
        };
        reader.readAsText(file);
    });

    // ── 초기화 ───────────────────────────────────────────
    panel.querySelector('#cp-reset-btn')?.addEventListener('click', () => {
        showConfirm('⚠️ 모든 데이터를 삭제할까요?\n되돌릴 수 없어요!', () => {
            getSettings().entries      = [];
            getSettings().customFields = [];
            getSettings().charLinks    = {};
            getSettings().personaLinks = {};
            saveSettingsDebounced();
            // 패널 새로고침
            const p = document.getElementById('chatpedia-settings-panel');
            if (p) { p.innerHTML = buildSettingsPanelHTML(); bindSettingsPanelEvents(p); }
            showToast('🗑️ 전체 데이터 삭제됨');
        });
    });
}

// ============================================================
// 진입점
// ============================================================

jQuery(async () => {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    // 기본 탭 상태 동기화
    state.activeTab = getOpt('defaultTab') || 'character';

    buildModal();
    buildTriggerButton();
    syncFloatBtn();
    registerWandButton();
    buildSettingsPanel();

    // ST 캐릭터 변경 이벤트 감지 → 연결된 항목 하이라이트
    $(document).on('characterSelected', () => {
        const overlay = document.getElementById('chatpedia-overlay');
        if (overlay?.classList.contains('active')) highlightLinkedEntry();
    });

    console.log('[챗키피디아] 로드 완료 ✅');
});
