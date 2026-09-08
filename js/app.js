/* LuvGallery — app logic */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const LABELS = {
    partner: { name: 'Partner / Lover' },
    family: { name: 'Family' },
    friend: { name: 'Friend' },
  };

  const TEMPLATES = [
    { id: 'love', name: 'Love', desc: 'Romantic rose tones, handwritten notes, a heart-linked thread.', colors: ['#BE185D', '#EC4899', '#DC2626'] },
    { id: 'family', name: 'Family Warm', desc: 'Cozy amber & cream, soft rounded type for family memories.', colors: ['#B45309', '#D97706', '#78716C'] },
    { id: 'friends', name: 'Friends Fun', desc: 'Playful orange & blue with bold rounded type.', colors: ['#F97316', '#FB923C', '#2563EB'] },
  ];

  const AVATARS = [
    { id: 'cat', bg: '#FDBA74', svg: '<path d="M20 38 L34 8 L44 34 Z" fill="#FB923C"/><path d="M80 38 L66 8 L56 34 Z" fill="#FB923C"/><ellipse cx="38" cy="55" rx="5" ry="7" fill="#3B0F26"/><ellipse cx="62" cy="55" rx="5" ry="7" fill="#3B0F26"/><path d="M46 66 L54 66 L50 72 Z" fill="#F472B6"/><path d="M50 72 Q42 80 34 74 M50 72 Q58 80 66 74" stroke="#3B0F26" stroke-width="3" fill="none" stroke-linecap="round"/>' },
    { id: 'fox', bg: '#F97316', svg: '<path d="M14 34 L30 6 L40 32 Z" fill="#7C2D12"/><path d="M86 34 L70 6 L60 32 Z" fill="#7C2D12"/><ellipse cx="50" cy="62" rx="26" ry="24" fill="#FFF7ED"/><ellipse cx="40" cy="58" rx="4.5" ry="6" fill="#3B0F26"/><ellipse cx="60" cy="58" rx="4.5" ry="6" fill="#3B0F26"/><path d="M50 66 L56 74 L44 74 Z" fill="#3B0F26"/>' },
    { id: 'bear', bg: '#A9744F', svg: '<circle cx="22" cy="24" r="14" fill="#7C5333"/><circle cx="78" cy="24" r="14" fill="#7C5333"/><ellipse cx="50" cy="66" rx="22" ry="18" fill="#D7B48C"/><ellipse cx="39" cy="55" rx="4.5" ry="6" fill="#3B0F26"/><ellipse cx="61" cy="55" rx="4.5" ry="6" fill="#3B0F26"/><ellipse cx="50" cy="68" rx="6" ry="4.5" fill="#3B0F26"/>' },
    { id: 'bunny', bg: '#FBCFE8', svg: '<ellipse cx="34" cy="18" rx="9" ry="24" fill="#F9A8D4"/><ellipse cx="66" cy="18" rx="9" ry="24" fill="#F9A8D4"/><ellipse cx="34" cy="18" rx="4" ry="17" fill="#FBCFE8"/><ellipse cx="66" cy="18" rx="4" ry="17" fill="#FBCFE8"/><ellipse cx="40" cy="58" rx="4.5" ry="6" fill="#3B0F26"/><ellipse cx="60" cy="58" rx="4.5" ry="6" fill="#3B0F26"/><path d="M50 64 L56 72 L44 72 Z" fill="#F472B6"/>' },
    { id: 'panda', bg: '#FFFFFF', svg: '<circle cx="22" cy="24" r="13" fill="#111827"/><circle cx="78" cy="24" r="13" fill="#111827"/><ellipse cx="38" cy="54" rx="10" ry="12" fill="#111827"/><ellipse cx="62" cy="54" rx="10" ry="12" fill="#111827"/><circle cx="38" cy="56" r="4" fill="#fff"/><circle cx="38" cy="57" r="2" fill="#111827"/><circle cx="62" cy="56" r="4" fill="#fff"/><circle cx="62" cy="57" r="2" fill="#111827"/>' },
    { id: 'koala', bg: '#CBD5E1', svg: '<circle cx="14" cy="46" r="16" fill="#94A3B8"/><circle cx="86" cy="46" r="16" fill="#94A3B8"/><ellipse cx="50" cy="60" rx="24" ry="22" fill="#E2E8F0"/><ellipse cx="50" cy="68" rx="10" ry="8" fill="#334155"/><ellipse cx="38" cy="52" rx="4" ry="5" fill="#111827"/><ellipse cx="62" cy="52" rx="4" ry="5" fill="#111827"/>' },
    { id: 'owl', bg: '#0D9488', svg: '<path d="M30 14 L38 30 L22 30 Z" fill="#0F766E"/><path d="M70 14 L78 30 L62 30 Z" fill="#0F766E"/><circle cx="36" cy="52" r="16" fill="#fff"/><circle cx="64" cy="52" r="16" fill="#fff"/><circle cx="36" cy="52" r="7" fill="#111827"/><circle cx="64" cy="52" r="7" fill="#111827"/><path d="M50 60 L58 72 L42 72 Z" fill="#F59E0B"/>' },
    { id: 'penguin', bg: '#1E293B', svg: '<ellipse cx="50" cy="56" rx="22" ry="28" fill="#fff"/><ellipse cx="40" cy="46" rx="4" ry="5" fill="#111827"/><ellipse cx="60" cy="46" rx="4" ry="5" fill="#111827"/><path d="M50 54 L58 62 L42 62 Z" fill="#F59E0B"/>' },
  ];

  const state = {
    route: 'timeline',
    currentUser: null,
    activeTimelineId: null,
    activeTimeline: null,
    entries: [],
    pendingFiles: [],
    selectedPeople: new Set(),
    editingEntryId: null,
    editingCreatedBy: null,
    lightboxUrls: [],
    lightboxIndex: 0,
    createdUrls: [],
    timelineViewMode: localStorage.getItem('luv_timeline_view') === 'coverflow' ? 'coverflow' : 'thread',
  };

  // ---------------- Utilities ----------------
  function revokeCreatedUrls() {
    state.createdUrls.forEach((u) => URL.revokeObjectURL(u));
    state.createdUrls = [];
  }
  function blobUrl(blob) {
    const url = URL.createObjectURL(blob);
    state.createdUrls.push(url);
    return url;
  }
  function showToast(msg) {
    const existing = $('.toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function initialsOf(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
  }
  function labelColor(label) {
    return `var(--tag-${label === 'partner' ? 'partner' : label === 'family' ? 'family' : 'friend'})`;
  }
  function avatarHtml(name, avatarId, fallbackColor) {
    const a = AVATARS.find((x) => x.id === avatarId);
    if (a) return `<div class="avatar" style="background:${a.bg}"><svg viewBox="0 0 100 100">${a.svg}</svg></div>`;
    return `<div class="avatar" style="background:${fallbackColor}">${initialsOf(name)}</div>`;
  }
  function monthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  function monthLabel(key) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  function formatWeekday(d) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
  function formatDay(d) { return d.toLocaleDateString(undefined, { day: 'numeric' }); }
  function formatTime(d) { return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function svgIcon(name) {
    const icons = {
      trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
      close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
      chevronRight: '<polyline points="9 18 15 12 9 6"/>',
      heart: '<path d="M12 21s-6.7-4.3-9.3-8.2C1 10 1.6 6.4 4.6 4.9c2.4-1.2 5-.4 6.4 1.6l1 1.4 1-1.4c1.4-2 4-2.8 6.4-1.6 3 1.5 3.6 5.1 1.9 7.9C18.7 16.7 12 21 12 21z"/>',
      list: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>',
      people: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
      palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 100 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c1.7 0 3.1-1.4 3.1-3.1C20.5 6.8 16.7 2 12 2z"/>',
      upload: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
  }

  // ---------------- Nav ----------------
  function renderNav() {
    const nav = $('#bottom-nav');
    const signedIn = !!state.currentUser;
    nav.innerHTML = signedIn ? `
      <button class="nav-btn" data-route="hub">${svgIcon('list')}Timelines</button>
      <button class="nav-btn" data-route="people">${svgIcon('people')}People</button>
      <button class="nav-fab" id="btn-add-fab" aria-label="Add">${svgIcon('plus')}</button>
      <button class="nav-btn" data-route="templates">${svgIcon('palette')}Themes</button>
      <button class="nav-btn" data-route="export">${svgIcon('upload')}Export</button>
    ` : `
      <button class="nav-btn" data-route="timeline">${svgIcon('list')}Timeline</button>
      <button class="nav-btn" data-route="templates">${svgIcon('palette')}Themes</button>
      <button class="nav-fab" id="btn-add-fab" aria-label="Add moment">${svgIcon('plus')}</button>
      <button class="nav-btn" data-route="export">${svgIcon('upload')}Export</button>
    `;
    $$('.nav-btn', nav).forEach((btn) => btn.addEventListener('click', () => handleNavClick(btn.dataset.route)));
    $('#btn-add-fab', nav).addEventListener('click', handleFabClick);
    updateNavActive();
  }
  function updateNavActive() {
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.route === state.route));
  }
  function handleNavClick(route) {
    if (route === 'hub') { state.activeTimelineId = null; state.activeTimeline = null; showRoute('hub'); return; }
    if (route === 'people') { showRoute('people'); return; }
    if (route === 'timeline') { showRoute('timeline'); return; }
    if (route === 'templates' || route === 'export') {
      if (!state.activeTimelineId) { showToast('Open a timeline first'); return; }
      showRoute(route);
    }
  }
  function handleFabClick() {
    if (state.currentUser && !state.activeTimelineId) {
      showRoute('people');
      setTimeout(() => $('#invite-email')?.focus(), 150);
      return;
    }
    state.editingEntryId = null;
    state.editingCreatedBy = null;
    resetAddForm();
    showRoute('add');
  }

  // ---------------- Routing ----------------
  function showRoute(route) {
    state.route = route;
    $$('.view').forEach((v) => { v.hidden = v.id !== `view-${route}`; });
    updateNavActive();
    updateSubHeader();
    if (['hub', 'people'].includes(route)) applyVisualTemplate('love');
    else if (state.activeTimeline) applyVisualTemplate(state.activeTimeline.template || 'love');

    if (route !== 'timeline') teardownCoverflow();
    if (route === 'hub') renderHub();
    if (route === 'people') renderPeopleTab();
    if (route === 'timeline') renderTimeline();
    if (route === 'templates') renderTemplates();
    if (route === 'export') renderExport();
    if (route === 'add' && !state.editingEntryId) resetAddForm();
    window.scrollTo({ top: 0 });
  }

  function updateSubHeader() {
    const bar = $('#timeline-subheader');
    const show = !!state.currentUser && !!state.activeTimeline && ['timeline', 'add', 'templates', 'export'].includes(state.route);
    bar.hidden = !show;
    if (show) {
      const tl = state.activeTimeline;
      $('#subheader-avatar').innerHTML = avatarHtml(tl.partnerName, tl.partnerAvatar, labelColor(tl.label));
      $('#subheader-name').textContent = tl.partnerName || 'Someone';
      const chip = $('#subheader-label');
      chip.textContent = LABELS[tl.label]?.name || tl.label;
      chip.dataset.label = tl.label;
    }
  }
  $('#subheader-back').addEventListener('click', () => {
    state.activeTimelineId = null;
    state.activeTimeline = null;
    showRoute('hub');
  });
  $('#btn-export-shortcut').addEventListener('click', () => handleNavClick('export'));

  function applyVisualTemplate(id) {
    document.documentElement.dataset.template = id;
    const meta = document.querySelector('meta[name="theme-color"]');
    const t = TEMPLATES.find((x) => x.id === id);
    if (meta && t) meta.setAttribute('content', t.colors[0]);
  }

  async function openTimeline(timeline) {
    state.activeTimelineId = timeline.id;
    state.activeTimeline = timeline;
    showRoute('timeline');
  }

  async function setActiveTimelineTemplate(id) {
    if (!state.activeTimelineId) return;
    const timeline = await DB.getTimeline(state.activeTimelineId);
    timeline.template = id;
    await DB.saveTimeline(timeline);
    state.activeTimeline = timeline;
    applyVisualTemplate(id);
    window.LuvCloud?.queueTimelineTemplateUpdate(timeline.id, id);
  }

  // ---------------- Hub ----------------
  async function renderHub() {
    const all = await DB.listTimelines();
    const real = all.filter((t) => !t.isLocal);
    const container = $('#hub-content');
    if (!real.length) {
      container.innerHTML = `
        <div class="empty-state">
          ${svgIcon('heart')}
          <h3>No timelines yet</h3>
          <p>Add a partner, friend, or family member's email in the People tab to start one.</p>
          <button class="btn btn-primary" id="btn-hub-add" style="margin-top:12px;">Add someone</button>
        </div>`;
      $('#btn-hub-add').addEventListener('click', () => showRoute('people'));
      return;
    }
    container.innerHTML = real.map((t) => `
      <div class="card timeline-card" data-id="${t.id}">
        <div class="timeline-card-main">
          ${avatarHtml(t.partnerName, t.partnerAvatar, labelColor(t.label))}
          <div class="timeline-card-info">
            <div class="timeline-card-name">${escapeHtml(t.partnerName || 'Someone')}</div>
            <div class="timeline-card-label">${LABELS[t.label]?.name || t.label}</div>
          </div>
        </div>
        <button class="icon-btn" data-action="delete-timeline" data-id="${t.id}" aria-label="Delete timeline">${svgIcon('trash')}</button>
      </div>`).join('');
    $$('.timeline-card', container).forEach((el) => {
      $('.timeline-card-main', el).addEventListener('click', () => {
        const t = real.find((x) => x.id === el.dataset.id);
        if (t) openTimeline(t);
      });
    });
    $$('[data-action="delete-timeline"]', container).forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = real.find((x) => x.id === el.dataset.id);
        if (t) deleteTimelineFlow(t);
      });
    });
  }

  async function deleteTimelineFlow(timeline) {
    openConfirmModal(
      'Delete this timeline?',
      `This removes every moment shared with ${escapeHtml(timeline.partnerName || 'them')} for both of you. This can't be undone.`,
      async () => {
        if (!navigator.onLine) { showToast('Go online to delete a shared timeline'); return; }
        const { error } = (await window.LuvCloud?.deleteTimelineRemote?.(timeline.id)) || {};
        if (error) { showToast('Could not delete — check your connection'); return; }
        await DB.deleteEntriesForTimeline(timeline.id);
        await DB.deleteTimeline(timeline.id);
        if (state.activeTimelineId === timeline.id) { state.activeTimelineId = null; state.activeTimeline = null; }
        closeModal();
        showRoute('hub');
        showToast('Timeline deleted');
      }
    );
  }

  // ---------------- People / connections ----------------
  async function renderPeopleTab() {
    const container = $('#people-content');
    if (!window.LuvCloud?.isConfigured()) {
      container.innerHTML = `
        <div class="empty-state">${svgIcon('heart')}<h3>Cloud sync required</h3>
        <p>Adding friends needs an account. Set up cloud sync (see README) to connect with a partner, friend, or family member.</p></div>`;
      return;
    }
    if (!state.currentUser) {
      container.innerHTML = `
        <div class="empty-state">${svgIcon('heart')}<h3>Sign in to add friends</h3>
        <p>Create an account to invite people and start shared timelines.</p>
        <button class="btn btn-primary" id="btn-people-signin" style="margin-top:12px;">Sign in</button></div>`;
      $('#btn-people-signin').addEventListener('click', () => {
        localStorage.removeItem('luv_skip_auth');
        showAuthScreen('signin');
      });
      return;
    }

    const { sent, received } = await window.LuvCloud.listInvitationsLive();
    const pendingReceived = received.filter((i) => i.status === 'pending');
    const visibleSent = sent.filter((i) => i.status === 'pending' || i.status === 'rejected');

    container.innerHTML = `
      <div class="card" style="padding:16px; margin-bottom:20px;">
        <h3 style="margin:0 0 12px; font-family:var(--font-display); font-size:22px; color:var(--color-primary);">Add someone</h3>
        <form id="form-invite">
          <div class="field">
            <label for="invite-email">Their email</label>
            <input type="text" id="invite-email" inputmode="email" placeholder="name@example.com" required />
          </div>
          <div class="field">
            <label for="invite-label">Relationship</label>
            <select id="invite-label">
              ${Object.entries(LABELS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Send invite</button>
        </form>
      </div>
      ${pendingReceived.length ? `
        <h3 class="section-title" style="font-size:22px;">Requests for you</h3>
        ${pendingReceived.map((inv) => `
          <div class="card person-row">
            ${avatarHtml(inv.senderName, inv.senderAvatar, labelColor(inv.label))}
            <div class="person-info">
              <div class="person-name">${escapeHtml(inv.senderName)}</div>
              <div class="person-label">wants to start a ${(LABELS[inv.label]?.name || inv.label).toLowerCase()} timeline</div>
            </div>
            <div class="person-actions">
              <button class="btn btn-secondary" data-action="reject-invite" data-id="${inv.id}" style="min-height:36px; padding:8px 12px;">Decline</button>
              <button class="btn btn-primary" data-action="accept-invite" data-id="${inv.id}" style="min-height:36px; padding:8px 12px;">Accept</button>
            </div>
          </div>`).join('')}
      ` : ''}
      ${visibleSent.length ? `
        <h3 class="section-title" style="font-size:22px; margin-top:24px;">Sent</h3>
        ${visibleSent.map((inv) => `
          <div class="card person-row">
            ${avatarHtml(inv.recipientName || inv.recipientEmail, inv.recipientAvatar, labelColor(inv.label))}
            <div class="person-info">
              <div class="person-name">${escapeHtml(inv.recipientEmail)}</div>
              <div class="person-label">${inv.status === 'rejected' ? 'Declined' : `Pending · ${LABELS[inv.label]?.name || inv.label}`}</div>
            </div>
            <div class="person-actions">
              <button class="icon-btn" data-action="cancel-invite" data-id="${inv.id}" aria-label="Remove invite">${svgIcon('trash')}</button>
            </div>
          </div>`).join('')}
      ` : ''}
      ${!pendingReceived.length && !visibleSent.length ? `
        <div class="empty-state">${svgIcon('heart')}<h3>No pending requests</h3><p>Invite someone above, or check back later.</p></div>` : ''}
    `;

    $('#form-invite').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#invite-email').value;
      const label = $('#invite-label').value;
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      const { error } = await window.LuvCloud.sendInvitation(email, label);
      btn.disabled = false;
      if (error) { showToast(error.message || 'Could not send invite'); return; }
      showToast('Invite sent');
      renderPeopleTab();
    });
    $$('[data-action="accept-invite"]', container).forEach((el) => el.addEventListener('click', async () => {
      el.disabled = true;
      const { error } = await window.LuvCloud.respondToInvitation(el.dataset.id, true);
      if (error) { showToast(error.message || 'Could not accept'); el.disabled = false; return; }
      showToast("You're connected! Check Timelines.");
      renderPeopleTab();
    }));
    $$('[data-action="reject-invite"]', container).forEach((el) => el.addEventListener('click', async () => {
      el.disabled = true;
      const { error } = await window.LuvCloud.respondToInvitation(el.dataset.id, false);
      if (error) { showToast(error.message || 'Could not decline'); el.disabled = false; return; }
      renderPeopleTab();
    }));
    $$('[data-action="cancel-invite"]', container).forEach((el) => el.addEventListener('click', async () => {
      const { error } = await window.LuvCloud.cancelInvitation(el.dataset.id);
      if (error) { showToast('Could not remove'); return; }
      renderPeopleTab();
    }));
  }

  // ---------------- Timeline (moments feed) ----------------
  let coverflowInstance = null;
  function teardownCoverflow() {
    if (coverflowInstance) { coverflowInstance.destroy(); coverflowInstance = null; }
  }

  $$('.view-toggle-btn').forEach((btn) => btn.addEventListener('click', () => setTimelineViewMode(btn.dataset.mode)));

  function setTimelineViewMode(mode) {
    state.timelineViewMode = mode;
    localStorage.setItem('luv_timeline_view', mode);
    $$('.view-toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('#timeline-content').hidden = mode !== 'thread';
    $('#timeline-coverflow').hidden = mode !== 'coverflow';
    if (mode === 'coverflow') renderCoverflowView(state.entries);
    else teardownCoverflow();
  }

  async function renderTimeline() {
    if (!state.activeTimelineId) { showRoute('hub'); return; }
    revokeCreatedUrls();
    teardownCoverflow();
    state.entries = await DB.listEntries(state.activeTimelineId);
    const threadContainer = $('#timeline-content');
    const coverflowContainer = $('#timeline-coverflow');
    $$('.view-toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.timelineViewMode));
    threadContainer.hidden = state.timelineViewMode !== 'thread';
    coverflowContainer.hidden = state.timelineViewMode !== 'coverflow';

    if (!state.entries.length) {
      const who = state.activeTimeline?.isLocal ? 'your journal' : `you and ${escapeHtml(state.activeTimeline?.partnerName || 'them')}`;
      const emptyHtml = `
        <div class="empty-state">
          ${svgIcon('heart')}
          <h3>No memories yet</h3>
          <p>Tap the + button below to add the first moment in ${who}.</p>
        </div>`;
      threadContainer.innerHTML = emptyHtml;
      renderCoverflowView([]);
      return;
    }

    renderThreadView(state.entries);
    if (state.timelineViewMode === 'coverflow') renderCoverflowView(state.entries);
  }

  function renderThreadView(entries) {
    const container = $('#timeline-content');
    const byMonth = new Map();
    entries.forEach((e) => {
      const key = monthKey(new Date(e.dateTime));
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(e);
    });

    let html = '';
    for (const [key, items] of byMonth) {
      html += `<div class="month-heading"><h2>${monthLabel(key)}</h2><span class="line"></span><span class="month-count">${items.length}</span></div>`;
      html += '<div class="thread">';
      items.forEach((entry) => { html += renderMoment(entry); });
      html += '</div>';
    }
    container.innerHTML = html;

    $$('.photo-item:not(.photo-pending)', container).forEach((el) => {
      el.addEventListener('click', () => openLightbox(el.dataset.entryId, Number(el.dataset.idx)));
    });
    $$('[data-action="edit-entry"]', container).forEach((el) => el.addEventListener('click', () => editEntry(el.dataset.id)));
    $$('[data-action="delete-entry"]', container).forEach((el) => el.addEventListener('click', () => confirmDeleteEntry(el.dataset.id)));
  }

  function renderCoverflowView(entries) {
    teardownCoverflow();
    const stage = $('#coverflow-stage');
    if (!entries || !entries.length) { stage.innerHTML = ''; renderCoverflowCaption(null); return; }

    const slides = entries.map((entry) => {
      const firstPhoto = (entry.images || []).find((img) => img.blob);
      return { entryId: entry.id, photoUrl: firstPhoto ? blobUrl(firstPhoto.blob) : null, placeholderIcon: svgIcon('heart') };
    });

    coverflowInstance = LuvCoverflow.create(stage, slides, {
      onSelect: (i) => renderCoverflowCaption(entries[i]),
      onActivate: (i) => {
        const entry = entries[i];
        if ((entry.images || []).some((img) => img.blob)) openLightbox(entry.id, 0);
      },
    });
  }

  function renderCoverflowCaption(entry) {
    const box = $('#coverflow-caption');
    if (!entry) { box.innerHTML = ''; return; }
    const d = new Date(entry.dateTime);
    const tl = state.activeTimeline;
    const people = (entry.peopleIds || []).map((pid) => {
      if (!tl || tl.isLocal) return null;
      if (pid === state.currentUser?.id) return { name: 'You' };
      if (pid === tl.partnerId) return { name: tl.partnerName };
      return null;
    }).filter(Boolean);
    const peopleHtml = people.length ? `<div class="moment-people" style="justify-content:center;">${people.map((p) => `
        <span class="chip" data-label="${tl.label}"><span class="dot" style="background:${labelColor(tl.label)}"></span>${escapeHtml(p.name)}</span>`).join('')}</div>` : '';

    box.innerHTML = `
      <div class="coverflow-time">${formatTime(d)}<span class="weekday">${formatWeekday(d)} · ${formatDay(d)}</span></div>
      <p class="coverflow-note">${escapeHtml(entry.note || '')}</p>
      ${peopleHtml}
      <div class="moment-footer" style="justify-content:center;">
        <button class="icon-btn" data-action="edit-entry" data-id="${entry.id}" aria-label="Edit moment">${svgIcon('edit')}</button>
        <button class="icon-btn" data-action="delete-entry" data-id="${entry.id}" aria-label="Delete moment">${svgIcon('trash')}</button>
      </div>`;
    $$('[data-action="edit-entry"]', box).forEach((el) => el.addEventListener('click', () => editEntry(el.dataset.id)));
    $$('[data-action="delete-entry"]', box).forEach((el) => el.addEventListener('click', () => confirmDeleteEntry(el.dataset.id)));
  }

  function renderMoment(entry) {
    const d = new Date(entry.dateTime);
    const photos = entry.images || [];
    const gridClass = photos.length === 1 ? 'count-1' : photos.length === 2 ? 'count-2' : '';
    let readyIdx = 0;
    const photosHtml = photos.length ? `<div class="photo-grid ${gridClass}">${photos.map((img) => {
      if (!img.blob) return `<div class="photo-item photo-pending" aria-label="Photo syncing"></div>`;
      const idx = readyIdx++;
      return `<div class="photo-item" data-entry-id="${entry.id}" data-idx="${idx}">
          <img src="${blobUrl(img.blob)}" alt="Memory photo" loading="lazy" />
        </div>`;
    }).join('')}</div>` : '';

    const tl = state.activeTimeline;
    const people = (entry.peopleIds || []).map((pid) => {
      if (!tl || tl.isLocal) return null;
      if (pid === state.currentUser?.id) return { name: 'You' };
      if (pid === tl.partnerId) return { name: tl.partnerName };
      return null;
    }).filter(Boolean);
    const peopleHtml = people.length ? `<div class="moment-people">${people.map((p) => `
        <span class="chip" data-label="${tl.label}"><span class="dot" style="background:${labelColor(tl.label)}"></span>${escapeHtml(p.name)}</span>`).join('')}</div>` : '';

    let addedByHtml = '';
    if (state.currentUser && tl && !tl.isLocal && entry.createdBy && entry.createdBy !== state.currentUser.id) {
      addedByHtml = `<div class="moment-added-by">Added by ${escapeHtml(tl.partnerName || 'them')}</div>`;
    }

    return `
      <article class="moment">
        <div class="moment-time">${formatTime(d)} <span class="weekday">${formatWeekday(d)} · ${formatDay(d)}</span></div>
        <div class="card moment-card">
          ${photosHtml}
          <div class="moment-note">${escapeHtml(entry.note || '')}</div>
          ${peopleHtml}
          ${addedByHtml}
          <div class="moment-footer">
            <button class="icon-btn" data-action="edit-entry" data-id="${entry.id}" aria-label="Edit moment">${svgIcon('edit')}</button>
            <button class="icon-btn" data-action="delete-entry" data-id="${entry.id}" aria-label="Delete moment">${svgIcon('trash')}</button>
          </div>
        </div>
      </article>`;
  }

  // ---------------- Lightbox ----------------
  function openLightbox(entryId, idx) {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    state.lightboxUrls = (entry.images || []).filter((img) => img.blob).map((img) => blobUrl(img.blob));
    state.lightboxIndex = idx;
    renderLightbox();
  }
  function renderLightbox() {
    const urls = state.lightboxUrls;
    const i = state.lightboxIndex;
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="lightbox" id="lightbox">
        <button class="icon-btn lightbox-close" id="lb-close" aria-label="Close">${svgIcon('close')}</button>
        ${urls.length > 1 ? `<button class="icon-btn lightbox-nav prev" id="lb-prev" aria-label="Previous photo">${svgIcon('chevronLeft')}</button>` : ''}
        <img src="${urls[i]}" alt="Memory photo" />
        ${urls.length > 1 ? `<button class="icon-btn lightbox-nav next" id="lb-next" aria-label="Next photo">${svgIcon('chevronRight')}</button>` : ''}
      </div>`;
    $('#lb-close').addEventListener('click', closeLightbox);
    $('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLightbox(); });
    if (urls.length > 1) {
      $('#lb-prev').addEventListener('click', () => { state.lightboxIndex = (i - 1 + urls.length) % urls.length; renderLightbox(); });
      $('#lb-next').addEventListener('click', () => { state.lightboxIndex = (i + 1) % urls.length; renderLightbox(); });
    }
  }
  function closeLightbox() { $('#modal-root').innerHTML = ''; }

  // ---------------- Add / Edit moment ----------------
  const uploader = $('#uploader');
  const fileInput = $('#file-input');
  uploader.addEventListener('click', () => fileInput.click());
  uploader.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
  uploader.addEventListener('dragover', (e) => { e.preventDefault(); uploader.classList.add('dragover'); });
  uploader.addEventListener('dragleave', () => uploader.classList.remove('dragover'));
  uploader.addEventListener('drop', (e) => { e.preventDefault(); uploader.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; });

  function handleFiles(fileList) {
    Array.from(fileList).filter((f) => f.type.startsWith('image/')).forEach((file) => {
      const url = URL.createObjectURL(file);
      state.pendingFiles.push({ file, url });
    });
    renderUploadPreviews();
  }
  function renderUploadPreviews() {
    const box = $('#upload-previews');
    box.innerHTML = state.pendingFiles.map((pf, i) => `
      <div class="upload-thumb">
        <img src="${pf.url}" alt="" />
        <button type="button" class="remove" data-idx="${i}" aria-label="Remove photo">${svgIcon('close')}</button>
      </div>`).join('');
    $$('.remove', box).forEach((btn) => btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      URL.revokeObjectURL(state.pendingFiles[idx].url);
      state.pendingFiles.splice(idx, 1);
      renderUploadPreviews();
    }));
  }

  function resetAddForm() {
    state.pendingFiles.forEach((pf) => pf.url && URL.revokeObjectURL(pf.url));
    state.pendingFiles = [];
    const tl = state.activeTimeline;
    state.selectedPeople = (tl && !tl.isLocal && state.currentUser)
      ? new Set([state.currentUser.id, tl.partnerId])
      : new Set();
    renderUploadPreviews();
    const now = new Date();
    $('#input-date').value = now.toISOString().slice(0, 10);
    $('#input-time').value = now.toTimeString().slice(0, 5);
    $('#input-note').value = '';
    renderPeoplePicker();
  }

  function renderPeoplePicker() {
    const wrapper = $('#people-picker-field');
    const box = $('#people-picker');
    const tl = state.activeTimeline;
    if (!tl || tl.isLocal || !state.currentUser) { wrapper.hidden = true; return; }
    wrapper.hidden = false;
    const options = [
      { id: state.currentUser.id, name: 'Me' },
      { id: tl.partnerId, name: tl.partnerName || 'Them' },
    ];
    box.innerHTML = options.map((p) => `
      <span class="chip selectable ${state.selectedPeople.has(p.id) ? 'selected' : ''}" data-label="${tl.label}" data-id="${p.id}">
        <span class="dot" style="background:${labelColor(tl.label)}"></span>${escapeHtml(p.name)}
      </span>`).join('');
    $$('.chip', box).forEach((chip) => chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (state.selectedPeople.has(id)) state.selectedPeople.delete(id); else state.selectedPeople.add(id);
      renderPeoplePicker();
    }));
  }

  async function editEntry(id) {
    const entry = await DB.getEntry(id);
    if (!entry) return;
    state.editingEntryId = id;
    state.editingCreatedBy = entry.createdBy || null;
    state.pendingFiles.forEach((pf) => pf.url && URL.revokeObjectURL(pf.url));
    state.pendingFiles = (entry.images || []).map((img) => ({ blob: img.blob, path: img.path, url: img.blob ? blobUrl(img.blob) : '', existing: true }));
    state.selectedPeople = new Set(entry.peopleIds || []);
    renderUploadPreviews();
    const d = new Date(entry.dateTime);
    $('#input-date').value = d.toISOString().slice(0, 10);
    $('#input-time').value = d.toTimeString().slice(0, 5);
    $('#input-note').value = entry.note || '';
    renderPeoplePicker();
    showRoute('add');
  }

  $('#form-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.activeTimelineId) { showToast('Open a timeline first'); return; }
    const date = $('#input-date').value;
    const time = $('#input-time').value || '00:00';
    if (!date) { showToast('Please choose a date'); return; }
    const dt = new Date(`${date}T${time}`);

    const images = state.pendingFiles.map((pf) => (pf.existing ? { id: DB.uid(), blob: pf.blob, path: pf.path } : { id: DB.uid(), blob: pf.file }));

    const entry = {
      id: state.editingEntryId || undefined,
      timelineId: state.activeTimelineId,
      createdBy: state.editingCreatedBy || state.currentUser?.id || null,
      dateTime: dt.toISOString(),
      note: $('#input-note').value.trim(),
      images,
      peopleIds: Array.from(state.selectedPeople),
    };
    const saved = await DB.saveEntry(entry);
    window.LuvCloud?.queueEntryUpsert(saved);
    state.editingEntryId = null;
    state.editingCreatedBy = null;
    showToast('Moment saved');
    showRoute('timeline');
  });

  async function confirmDeleteEntry(id) {
    openConfirmModal('Delete this moment?', 'This photo and note will be removed for good.', async () => {
      const entry = await DB.getEntry(id);
      await DB.deleteEntry(id);
      if (entry) window.LuvCloud?.queueEntryDelete(entry);
      closeModal();
      renderTimeline();
      showToast('Moment deleted');
    });
  }

  // ---------------- Modals ----------------
  function openConfirmModal(title, body, onConfirm) {
    const root = $('#modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" id="confirm-backdrop">
        <div class="modal-sheet">
          <div class="modal-head"><h3>${title}</h3></div>
          <p style="color:var(--color-muted-fg); margin-top:-8px;">${body}</p>
          <div style="display:flex; gap:12px; margin-top:20px;">
            <button class="btn btn-ghost" id="confirm-cancel" style="flex:1;">Cancel</button>
            <button class="btn btn-danger" id="confirm-ok" style="flex:1;">Delete</button>
          </div>
        </div>
      </div>`;
    $('#confirm-cancel').addEventListener('click', closeModal);
    $('#confirm-backdrop').addEventListener('click', (e) => { if (e.target.id === 'confirm-backdrop') closeModal(); });
    $('#confirm-ok').addEventListener('click', onConfirm);
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  // ---------------- Templates ----------------
  async function renderTemplates() {
    if (!state.activeTimeline) { showRoute('hub'); return; }
    const active = state.activeTimeline.template || 'love';
    const grid = $('#template-grid');
    grid.innerHTML = TEMPLATES.map((t) => `
      <div class="card template-card ${t.id === active ? 'active' : ''}" data-id="${t.id}">
        ${t.id === active ? '<span class="template-badge">Active</span>' : ''}
        <div class="template-preview" style="background:linear-gradient(135deg, ${t.colors[0]}22, ${t.colors[1]}22);">
          ${t.colors.map((c) => `<span class="swatch" style="background:${c}"></span>`).join('')}
        </div>
        <h3 class="template-name" style="color:${t.colors[0]}">${t.name}</h3>
        <p class="template-desc">${t.desc}</p>
        <button class="btn ${t.id === active ? 'btn-secondary' : 'btn-primary'} btn-block" data-action="apply-template" data-id="${t.id}" ${t.id === active ? 'disabled' : ''}>
          ${t.id === active ? 'Currently active' : 'Use this template'}
        </button>
      </div>`).join('');
    $$('[data-action="apply-template"]', grid).forEach((btn) => btn.addEventListener('click', async () => {
      await setActiveTimelineTemplate(btn.dataset.id);
      renderTemplates();
      showToast('Template applied');
    }));
  }

  // ---------------- Export ----------------
  async function renderExport() {
    if (!state.activeTimelineId) { showRoute('hub'); return; }
    state.entries = await DB.listEntries(state.activeTimelineId);
    const select = $('#export-month');
    const keys = Array.from(new Set(state.entries.map((e) => monthKey(new Date(e.dateTime)))));
    if (!keys.length) {
      select.innerHTML = '<option value="">No memories yet</option>';
      $('#export-summary').textContent = 'Add some moments first, then come back to export them.';
      $('#btn-export-png').disabled = true;
      $('#btn-export-pdf').disabled = true;
      return;
    }
    select.innerHTML = keys.map((k) => `<option value="${k}">${monthLabel(k)}</option>`).join('');
    $('#btn-export-png').disabled = false;
    $('#btn-export-pdf').disabled = false;
    updateExportSummary();
    select.onchange = updateExportSummary;
  }
  function updateExportSummary() {
    const key = $('#export-month').value;
    const items = state.entries.filter((e) => monthKey(new Date(e.dateTime)) === key);
    const photoCount = items.reduce((n, e) => n + (e.images?.length || 0), 0);
    $('#export-summary').textContent = `${items.length} moment${items.length === 1 ? '' : 's'} · ${photoCount} photo${photoCount === 1 ? '' : 's'} in ${monthLabel(key)}`;
  }
  $('#btn-export-png').addEventListener('click', async () => {
    const key = $('#export-month').value;
    if (!key) return;
    await window.LuvExport.exportMonth(key, 'png');
  });
  $('#btn-export-pdf').addEventListener('click', async () => {
    const key = $('#export-month').value;
    if (!key) return;
    await window.LuvExport.exportMonth(key, 'pdf');
  });

  // ---------------- Auth screen ----------------
  let authMode = 'signin';
  function updateAuthScreenMode() {
    $('#btn-auth-submit').textContent = authMode === 'signin' ? 'Sign in' : 'Create account';
    $('#btn-auth-toggle').textContent = authMode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in';
    $('#auth-password').autocomplete = authMode === 'signin' ? 'current-password' : 'new-password';
    $('#auth-error').hidden = true;
  }
  function showAuthScreen(mode) {
    authMode = mode || 'signin';
    updateAuthScreenMode();
    $('#auth-screen').hidden = false;
  }
  function hideAuthScreen() { $('#auth-screen').hidden = true; }

  $('#btn-auth-toggle').addEventListener('click', () => {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    updateAuthScreenMode();
  });
  $('#btn-auth-skip').addEventListener('click', () => {
    localStorage.setItem('luv_skip_auth', '1');
    enterLocalMode();
  });
  $('#btn-toggle-password').addEventListener('click', () => {
    const input = $('#auth-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('#form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#auth-email').value.trim();
    const password = $('#auth-password').value;
    const submitBtn = $('#btn-auth-submit');
    const errorEl = $('#auth-error');
    submitBtn.disabled = true;
    errorEl.hidden = true;
    errorEl.style.color = '';
    try {
      const { error, data } = authMode === 'signin'
        ? await window.LuvCloud.signIn(email, password)
        : await window.LuvCloud.signUp(email, password);
      if (error) {
        errorEl.hidden = false;
        errorEl.textContent = error.message || 'Something went wrong. Please try again.';
        return;
      }
      localStorage.removeItem('luv_skip_auth');
      if (authMode === 'signup' && data?.user && !data.session) {
        errorEl.hidden = false;
        errorEl.style.color = 'var(--color-primary)';
        errorEl.textContent = 'Check your email to confirm your account, then sign in.';
      }
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ---------------- Account modal ----------------
  $('#btn-account').addEventListener('click', () => openAccountModal());
  async function openAccountModal() {
    const root = $('#modal-root');
    const user = state.currentUser;
    const configured = window.LuvCloud?.isConfigured();
    const profile = user ? await window.LuvCloud.getMyProfile() : null;
    root.innerHTML = `
      <div class="modal-backdrop" id="account-backdrop">
        <div class="modal-sheet">
          <div class="modal-head"><h3>Account</h3><button class="icon-btn" id="account-close">${svgIcon('close')}</button></div>
          ${user ? `
            <p style="color:var(--color-muted-fg);">Signed in as<br><strong style="color:var(--color-fg);">${escapeHtml(user.email)}</strong></p>
            <div class="field">
              <label>Your avatar</label>
              <div class="avatar-picker" id="avatar-picker"></div>
            </div>
            <button class="btn btn-secondary btn-block" id="btn-sync-now" style="margin-top:16px;">Sync now</button>
            <button class="btn btn-danger btn-block" id="btn-sign-out" style="margin-top:10px;">Sign out</button>
          ` : `
            <p style="color:var(--color-muted-fg);">${configured ? "You're using LuvGallery locally on this device. Sign in to add friends and sync across devices." : "Cloud sync isn't set up for this app yet — everything is stored locally on this device."}</p>
            ${configured ? '<button class="btn btn-primary btn-block" id="btn-go-signin" style="margin-top:16px;">Sign in / Sign up</button>' : ''}
          `}
        </div>
      </div>`;
    $('#account-close').addEventListener('click', closeModal);
    $('#account-backdrop').addEventListener('click', (e) => { if (e.target.id === 'account-backdrop') closeModal(); });
    if (user) {
      const picker = $('#avatar-picker');
      picker.innerHTML = AVATARS.map((a) => `
        <button type="button" class="avatar-option ${profile?.avatar === a.id ? 'selected' : ''}" data-id="${a.id}" style="background:${a.bg}" aria-label="Choose ${a.id} avatar">
          <svg viewBox="0 0 100 100">${a.svg}</svg>
        </button>`).join('');
      $$('.avatar-option', picker).forEach((btn) => btn.addEventListener('click', async () => {
        const { error } = await window.LuvCloud.updateMyAvatar(btn.dataset.id);
        if (error) { showToast('Could not update avatar'); return; }
        await window.LuvCloud.syncNow();
        openAccountModal();
        showToast('Avatar updated');
      }));
      $('#btn-sync-now').addEventListener('click', async () => {
        showToast('Syncing…');
        await window.LuvCloud.syncNow();
        closeModal();
        showRoute(state.route);
        showToast('Synced');
      });
      $('#btn-sign-out').addEventListener('click', async () => {
        await window.LuvCloud.signOut();
        closeModal();
        showToast('Signed out');
      });
    } else {
      $('#btn-go-signin')?.addEventListener('click', () => {
        closeModal();
        localStorage.removeItem('luv_skip_auth');
        showAuthScreen('signin');
      });
    }
  }

  // ---------------- Cloud sync callbacks ----------------
  async function enterLocalMode() {
    hideAuthScreen();
    const local = await DB.ensureLocalTimeline();
    state.activeTimelineId = local.id;
    state.activeTimeline = local;
    applyVisualTemplate(local.template || 'love');
    showRoute('timeline');
  }

  async function handleAuthChange(user) {
    state.currentUser = user;
    renderNav();
    if (user) {
      hideAuthScreen();
      state.activeTimelineId = null;
      state.activeTimeline = null;
      applyVisualTemplate('love');
      showRoute('hub');
    } else if (window.LuvCloud?.isConfigured() && localStorage.getItem('luv_skip_auth') !== '1') {
      showAuthScreen('signin');
    } else {
      await enterLocalMode();
    }
  }

  async function handleRemoteChange() {
    if (state.activeTimelineId && state.activeTimelineId !== DB.LOCAL_TIMELINE_ID) {
      const t = await DB.getTimeline(state.activeTimelineId);
      if (t) {
        state.activeTimeline = t;
        updateSubHeader();
        if (['timeline', 'add', 'templates', 'export'].includes(state.route)) applyVisualTemplate(t.template || 'love');
      }
    }
    if (state.route === 'hub') renderHub();
    if (state.route === 'people') renderPeopleTab();
    if (state.route === 'timeline') renderTimeline();
    if (state.route === 'templates') renderTemplates();
    if (state.route === 'export') renderExport();
    if (state.route === 'add') renderPeoplePicker();
  }

  function handleSyncState(isSyncing) { $('#sync-indicator').hidden = !isSyncing; }
  document.addEventListener('luv:entry-hydrated', () => { if (state.route === 'timeline') renderTimeline(); });

  // ---------------- Init ----------------
  async function init() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    renderNav();
    if (window.LuvCloud) {
      await window.LuvCloud.init({
        onAuthChange: handleAuthChange,
        onRemoteChange: handleRemoteChange,
        onSyncState: handleSyncState,
      });
    } else {
      await handleAuthChange(null);
    }
  }

  window.LuvApp = {
    state, monthKey, monthLabel, formatTime, formatWeekday, formatDay,
    escapeHtml, svgIcon, LABELS,
  };

  document.addEventListener('DOMContentLoaded', init);
})();
