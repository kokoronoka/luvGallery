/* LuvGallery — Supabase auth + offline-first cloud sync for shared timelines.
   Local IndexedDB (js/db.js) stays the source of truth for instant UI;
   this module pushes changes to Supabase in the background and reconciles
   cloud state back into IndexedDB on load / realtime / reconnect.

   Data model: each "timeline" is a 1:1 shared space between exactly two
   accounts (see sql/schema.sql). The purely-local "local" pseudo-timeline
   (DB.LOCAL_TIMELINE_ID) never touches the cloud — it's the solo journal
   used when someone chooses to skip sign-in entirely. */
(() => {
  const BUCKET = window.LUV_STORAGE_BUCKET || 'luvgallery-photos';
  const configured = window.LUV_SUPABASE_URL && window.LUV_SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL'
    && window.LUV_SUPABASE_ANON_KEY && window.LUV_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_PUBLISHABLE_KEY';

  const supabase = configured && window.supabase
    ? window.supabase.createClient(window.LUV_SUPABASE_URL, window.LUV_SUPABASE_ANON_KEY)
    : null;

  let currentUser = null;
  let myProfileCache = null;
  let realtimeChannel = null;
  let authChangeCb = null;
  let onRemoteChangeCb = null;
  let onSyncStateCb = null;

  // ---------------- Pending queues (localStorage) ----------------
  function getQueue(key) {
    try { return JSON.parse(localStorage.getItem(`luv_pending_${key}`) || '[]'); } catch { return []; }
  }
  function setQueue(key, arr) { localStorage.setItem(`luv_pending_${key}`, JSON.stringify(arr)); }
  function addToQueue(key, id) {
    const q = getQueue(key);
    if (!q.includes(id)) { q.push(id); setQueue(key, q); }
  }
  function removeFromQueue(key, id) { setQueue(key, getQueue(key).filter((x) => x !== id)); }

  function isRLSViolation(error) {
    return error?.code === '42501' || (error?.message && error.message.includes('row-level security policy'));
  }
  function setSyncing(isSyncing) { if (onSyncStateCb) onSyncStateCb(isSyncing); }
  const nowIso = () => new Date().toISOString();

  // ---------------- Auth ----------------
  async function getValidUser() {
    if (!supabase) return null;
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { currentUser = null; return null; }
      currentUser = session.user;
      return session.user;
    } catch {
      currentUser = null;
      return null;
    }
  }

  async function getMyProfile() {
    const user = await getValidUser();
    if (!user) { myProfileCache = null; return null; }
    if (myProfileCache && myProfileCache.id === user.id) return myProfileCache;
    const { data } = await supabase.from('profiles').select('id,email,display_name,avatar').eq('id', user.id).maybeSingle();
    myProfileCache = data || { id: user.id, email: user.email, display_name: user.email?.split('@')[0], avatar: null };
    return myProfileCache;
  }

  async function updateMyAvatar(avatarId) {
    const user = await getValidUser();
    if (!user) return { error: { message: 'Sign in first.' } };
    const { data, error } = await supabase.from('profiles').update({ avatar: avatarId }).eq('id', user.id).select();
    if (!error) myProfileCache = null;
    return { error, data: data?.[0] };
  }

  async function signUp(email, password) {
    if (!supabase) return { error: { message: 'Cloud sync is not configured yet.' } };
    return supabase.auth.signUp({ email, password });
  }
  async function signIn(email, password) {
    if (!supabase) return { error: { message: 'Cloud sync is not configured yet.' } };
    return supabase.auth.signInWithPassword({ email, password });
  }
  async function signOut() {
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
    currentUser = null;
    myProfileCache = null;
    if (supabase) {
      await supabase.auth.signOut({ scope: 'global' });
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k));
      }
    }
  }

  // ---------------- Mapping ----------------
  function defaultTemplateForLabel(label) {
    return label === 'partner' ? 'love' : label === 'family' ? 'family' : 'friends';
  }
  function cloudToEntry(row) {
    return {
      id: row.id,
      timelineId: row.timeline_id,
      createdBy: row.created_by,
      dateTime: row.date_time,
      note: row.note || '',
      peopleIds: row.people_ids || [],
      images: (row.images || []).map((i) => ({ id: i.id, path: i.path })),
      createdAt: row.created_at,
    };
  }
  function entryToCloud(e, userId) {
    return {
      id: e.id,
      timeline_id: e.timelineId,
      created_by: e.createdBy || userId,
      date_time: e.dateTime,
      note: e.note || '',
      people_ids: e.peopleIds || [],
      images: (e.images || []).filter((i) => i.path).map((i) => ({ id: i.id, path: i.path })),
      updated_at: nowIso(),
    };
  }
  function mapInvitationRow(row, myId) {
    return {
      id: row.id,
      senderId: row.sender_id,
      recipientEmail: row.recipient_email,
      recipientId: row.recipient_id,
      label: row.label,
      status: row.status,
      timelineId: row.timeline_id,
      direction: row.sender_id === myId ? 'sent' : 'received',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async function profilesById(ids) {
    if (!ids.length) return {};
    const { data } = await supabase.from('profiles').select('id,email,display_name,avatar').in('id', ids);
    const map = {};
    (data || []).forEach((p) => { map[p.id] = p; });
    return map;
  }

  // ---------------- Image upload / download ----------------
  async function uploadEntryImages(entry, timelineId) {
    let allOk = true;
    for (const img of entry.images || []) {
      if (img.path) continue;
      if (!img.blob) { allOk = false; continue; }
      const ext = (img.blob.type && img.blob.type.split('/')[1]) || 'jpg';
      const path = `${timelineId}/${entry.id}/${img.id}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, img.blob, {
        upsert: true, contentType: img.blob.type || 'image/jpeg',
      });
      if (error) { allOk = false; continue; }
      img.path = path;
    }
    return allOk;
  }

  async function hydrateEntryImages(entry) {
    if (!supabase) return;
    let changed = false;
    for (const img of entry.images || []) {
      if (img.blob || !img.path) continue;
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(img.path);
        if (error || !data) continue;
        img.blob = data;
        changed = true;
      } catch { /* retry on next sync */ }
    }
    if (changed) {
      await DB.saveEntry(entry);
      document.dispatchEvent(new CustomEvent('luv:entry-hydrated', { detail: { id: entry.id } }));
    }
  }

  async function deleteEntryImagesFromStorage(imagePaths) {
    if (!supabase || !imagePaths || !imagePaths.length) return;
    try { await supabase.storage.from(BUCKET).remove(imagePaths); } catch { /* best-effort */ }
  }

  // ---------------- Flush: entries ----------------
  async function flushEntryUpsert(id) {
    const user = await getValidUser();
    if (!user) return false;
    const entry = await DB.getEntry(id);
    if (!entry) { removeFromQueue('entries_upsert', id); return true; }
    if (entry.timelineId === DB.LOCAL_TIMELINE_ID) { removeFromQueue('entries_upsert', id); return true; }

    const uploaded = await uploadEntryImages(entry, entry.timelineId);
    if (!uploaded) return false;
    await DB.saveEntry(entry);

    const { data, error } = await supabase.from('entries')
      .upsert(entryToCloud(entry, user.id), { onConflict: 'id' })
      .select();
    if (error) { if (isRLSViolation(error)) await supabase.auth.refreshSession(); return false; }
    if (!data || !data.length) return false;
    removeFromQueue('entries_upsert', id);
    return true;
  }
  async function flushEntryDelete(record) {
    const user = await getValidUser();
    if (!user) return true;
    await deleteEntryImagesFromStorage(record.imagePaths);
    const { error } = await supabase.from('entries').delete({ count: 'exact' }).eq('id', record.id);
    if (error) return false;
    removeFromQueue('entries_delete_ids', record.id);
    return true;
  }
  function queueEntryDeleteRecord(record) {
    const list = getQueue('entries_delete');
    if (!list.find((r) => r.id === record.id)) { list.push(record); setQueue('entries_delete', list); }
    addToQueue('entries_delete_ids', record.id);
  }

  // ---------------- Flush: timeline template ----------------
  async function flushTimelineTemplateUpdate(timelineId) {
    const user = await getValidUser();
    if (!user) return false;
    const t = await DB.getTimeline(timelineId);
    if (!t || t.isLocal) { removeFromQueue('timelines_template', timelineId); return true; }
    const { data, error } = await supabase.from('timelines')
      .update({ template: t.template, updated_at: nowIso() }).eq('id', timelineId).select();
    if (error) { if (isRLSViolation(error)) await supabase.auth.refreshSession(); return false; }
    if (!data || !data.length) return false;
    removeFromQueue('timelines_template', timelineId);
    return true;
  }

  async function flushPendingQueues() {
    if (!supabase) return;
    setSyncing(true);
    try {
      for (const rec of getQueue('entries_delete')) await flushEntryDelete(rec);
      for (const id of getQueue('entries_upsert')) await flushEntryUpsert(id);
      for (const id of getQueue('timelines_template')) await flushTimelineTemplateUpdate(id);
    } finally {
      setSyncing(false);
    }
  }

  // ---------------- Public queue-and-flush API ----------------
  function queueEntryUpsert(entry) {
    if (!supabase || !entry || entry.timelineId === DB.LOCAL_TIMELINE_ID) return;
    addToQueue('entries_upsert', entry.id);
    flushEntryUpsert(entry.id);
  }
  function queueEntryDelete(entry) {
    if (!supabase || !entry || entry.timelineId === DB.LOCAL_TIMELINE_ID) return;
    removeFromQueue('entries_upsert', entry.id);
    const imagePaths = (entry.images || []).map((i) => i.path).filter(Boolean);
    const record = { id: entry.id, imagePaths };
    queueEntryDeleteRecord(record);
    flushEntryDelete(record);
  }
  function queueTimelineTemplateUpdate(timelineId, template) {
    if (!supabase || timelineId === DB.LOCAL_TIMELINE_ID) return;
    addToQueue('timelines_template', timelineId);
    flushTimelineTemplateUpdate(timelineId);
  }

  // ---------------- Invitations ----------------
  async function sendInvitation(email, label) {
    const user = await getValidUser();
    if (!user) return { error: { message: 'You need to be signed in to add a friend.' } };
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return { error: { message: 'Enter a valid email address.' } };
    const profile = await getMyProfile();
    if (profile?.email?.toLowerCase() === normalized) return { error: { message: "That's your own email." } };

    const { data: dupes } = await supabase.from('invitations').select('id,status')
      .eq('sender_id', user.id).ilike('recipient_email', normalized).eq('status', 'pending');
    if (dupes && dupes.length) return { error: { message: 'You already have a pending invite to this email.' } };

    const { data, error } = await supabase.from('invitations').insert({
      id: DB.uid(), sender_id: user.id, recipient_email: normalized, label, status: 'pending',
    }).select();
    if (error) return { error };
    await listInvitationsLive();
    return { data: data?.[0] };
  }

  async function deleteTimelineRemote(id) {
    const user = await getValidUser();
    if (!user) return { error: { message: 'Sign in first.' } };
    const { error } = await supabase.from('timelines').delete().eq('id', id);
    return { error };
  }

  async function cancelInvitation(id) {
    const user = await getValidUser();
    if (!user) return { error: { message: 'Sign in first.' } };
    const { error } = await supabase.from('invitations').update({ status: 'cancelled', updated_at: nowIso() }).eq('id', id);
    if (!error) await listInvitationsLive();
    return { error };
  }

  async function respondToInvitation(invitationId, accept) {
    const user = await getValidUser();
    if (!user) return { error: { message: 'Sign in first.' } };
    const { data: rows, error: fetchErr } = await supabase.from('invitations').select('*').eq('id', invitationId).limit(1);
    if (fetchErr || !rows?.length) return { error: fetchErr || { message: 'Invitation not found.' } };
    const inv = rows[0];

    if (!accept) {
      const { error } = await supabase.from('invitations')
        .update({ status: 'rejected', recipient_id: user.id, updated_at: nowIso() }).eq('id', invitationId);
      if (!error) await listInvitationsLive();
      return { error };
    }

    const timelineId = DB.uid();
    const { data: tRows, error: tErr } = await supabase.from('timelines').insert({
      id: timelineId, user_a: inv.sender_id, user_b: user.id,
      label: inv.label, template: defaultTemplateForLabel(inv.label),
    }).select();

    let finalTimelineId = timelineId;
    if (tErr) {
      if (tErr.code === '23505') {
        const { data: existing } = await supabase.from('timelines').select('*')
          .or(`and(user_a.eq.${inv.sender_id},user_b.eq.${user.id}),and(user_a.eq.${user.id},user_b.eq.${inv.sender_id})`)
          .limit(1);
        if (!existing?.length) return { error: tErr };
        finalTimelineId = existing[0].id;
      } else {
        return { error: tErr };
      }
    }

    await supabase.from('invitations')
      .update({ status: 'accepted', recipient_id: user.id, timeline_id: finalTimelineId, updated_at: nowIso() })
      .eq('id', invitationId);
    await syncNow();
    return { data: { timelineId: finalTimelineId } };
  }

  async function listInvitationsLive() {
    const user = await getValidUser();
    if (!user) return { sent: [], received: [] };
    const profile = await getMyProfile();
    if (!profile?.email) return { sent: [], received: [] };

    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from('invitations').select('*').eq('sender_id', user.id).neq('status', 'cancelled').order('created_at', { ascending: false }),
      supabase.from('invitations').select('*').ilike('recipient_email', profile.email).order('created_at', { ascending: false }),
    ]);

    const recipientIds = Array.from(new Set((sent || []).map((r) => r.recipient_id).filter(Boolean)));
    const senderIds = Array.from(new Set((received || []).map((r) => r.sender_id)));
    const recipients = await profilesById(recipientIds);
    const senders = await profilesById(senderIds);

    const mappedSent = (sent || []).map((r) => {
      const inv = mapInvitationRow(r, user.id);
      const p = recipients[r.recipient_id];
      inv.recipientName = p?.display_name || p?.email?.split('@')[0] || r.recipient_email.split('@')[0];
      inv.recipientAvatar = p?.avatar || null;
      return inv;
    });
    const mappedReceived = (received || []).map((r) => {
      const inv = mapInvitationRow(r, user.id);
      const s = senders[r.sender_id];
      inv.senderName = s?.display_name || s?.email?.split('@')[0] || 'Someone';
      inv.senderEmail = s?.email || '';
      inv.senderAvatar = s?.avatar || null;
      return inv;
    });

    await DB.replaceInvitations([...mappedSent, ...mappedReceived]);
    return { sent: mappedSent, received: mappedReceived };
  }

  // ---------------- Reconcile: timelines ----------------
  async function ensureSoloTimeline() {
    const user = await getValidUser();
    if (!user) return;
    const { data: existing } = await supabase.from('timelines')
      .select('id').eq('user_a', user.id).is('user_b', null).limit(1);
    if (existing && existing.length) return;
    // A unique partial index on (user_a) where user_b is null guards against
    // duplicates if this races with another tab/device doing the same thing.
    await supabase.from('timelines').insert({
      id: DB.uid(), user_a: user.id, user_b: null, label: 'solo', template: 'love',
    });
  }

  async function reconcileTimelines() {
    const user = await getValidUser();
    if (!user) return [];
    const { data, error } = await supabase.from('timelines').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
    if (error || !data) return [];

    const myProfile = await getMyProfile();
    const otherIds = Array.from(new Set(
      data.map((t) => (t.user_a === user.id ? t.user_b : t.user_a)).filter(Boolean)
    ));
    const partners = await profilesById(otherIds);

    const mapped = data.map((t) => {
      const isSolo = !t.user_b;
      const partnerId = isSolo ? null : (t.user_a === user.id ? t.user_b : t.user_a);
      const p = isSolo ? myProfile : (partnerId ? partners[partnerId] : null);
      return {
        id: t.id,
        partnerId,
        partnerName: isSolo ? 'My Journal' : (p?.display_name || p?.email?.split('@')[0] || 'Someone'),
        partnerEmail: isSolo ? (myProfile?.email || '') : (p?.email || ''),
        partnerAvatar: p?.avatar || null,
        label: t.label,
        template: t.template,
        isSolo,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        isLocal: false,
      };
    });

    for (const t of mapped) await DB.saveTimeline(t);
    const localAll = await DB.listTimelines();
    const cloudIds = new Set(mapped.map((t) => t.id));
    for (const lt of localAll) {
      if (!lt.isLocal && !cloudIds.has(lt.id)) await DB.deleteTimeline(lt.id);
    }
    return mapped;
  }

  // ---------------- Reconcile: entries (across all my timelines) ----------------
  async function reconcileEntries() {
    const user = await getValidUser();
    if (!user) return;
    const { data, error } = await supabase.from('entries').select('*');
    if (error || !data) return;

    const cloudIds = new Set(data.map((r) => r.id));
    const deleteIds = new Set(getQueue('entries_delete_ids'));
    const upsertPending = new Set(getQueue('entries_upsert'));

    const allTimelines = await DB.listTimelines();
    let localAll = [];
    for (const t of allTimelines) {
      if (t.isLocal) continue;
      localAll = localAll.concat(await DB.listEntries(t.id));
    }

    const unconfirmedLocal = localAll.filter((e) => !cloudIds.has(e.id) && !deleteIds.has(e.id) && upsertPending.has(e.id));
    const fromCloud = data.map(cloudToEntry);
    const merged = [...unconfirmedLocal, ...fromCloud];

    for (const e of merged) {
      const existing = await DB.getEntry(e.id);
      if (existing) {
        e.images = (e.images || []).map((img) => {
          const match = (existing.images || []).find((x) => x.id === img.id);
          return match?.blob ? { ...img, blob: match.blob } : img;
        });
      }
      await DB.saveEntry(e);
    }
    const mergedIds = new Set(merged.map((e) => e.id));
    for (const e of localAll) {
      if (!mergedIds.has(e.id) && !upsertPending.has(e.id)) await DB.deleteEntry(e.id);
    }
    for (const e of merged) {
      if ((e.images || []).some((img) => !img.blob && img.path)) hydrateEntryImages(e);
    }
  }

  async function syncNow() {
    if (!supabase) return;
    setSyncing(true);
    try {
      await flushPendingQueues();
      await ensureSoloTimeline();
      await reconcileTimelines();
      await reconcileEntries();
      await listInvitationsLive();
    } finally {
      setSyncing(false);
      if (onRemoteChangeCb) onRemoteChangeCb();
    }
  }

  // ---------------- Realtime ----------------
  // No column filter: RLS's SELECT policies (membership-based) narrow what
  // each connected client actually receives, since these tables have RLS
  // enabled and replica identity full.
  function subscribeRealtime() {
    if (!supabase || realtimeChannel) return;
    realtimeChannel = supabase.channel('luvgallery-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timelines' }, () => onRemoteEvent())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => onRemoteEvent())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, () => onRemoteEvent())
      .subscribe((status) => { console.log('[LuvCloud] realtime status:', status); });
  }
  function unsubscribeRealtime() {
    if (realtimeChannel) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  }

  let syncDebounce = null;
  function onRemoteEvent() {
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(() => syncNow(), 250);
  }

  // ---------------- Init ----------------
  async function init({ onAuthChange, onRemoteChange, onSyncState }) {
    authChangeCb = onAuthChange;
    onRemoteChangeCb = onRemoteChange;
    onSyncStateCb = onSyncState;
    if (!supabase) { if (authChangeCb) authChangeCb(null); return; }

    const user = await getValidUser();
    if (authChangeCb) authChangeCb(user);
    if (user) {
      await syncNow();
      subscribeRealtime();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user ?? null;
      if (event === 'SIGNED_IN') {
        if (authChangeCb) authChangeCb(currentUser);
        await syncNow();
        subscribeRealtime();
      } else if (event === 'SIGNED_OUT') {
        unsubscribeRealtime();
        if (authChangeCb) authChangeCb(null);
      }
    });

    window.addEventListener('online', () => { if (currentUser) syncNow(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && currentUser) syncNow();
    });
  }

  window.LuvCloud = {
    isConfigured: () => !!supabase,
    init, signUp, signIn, signOut, getValidUser, getMyProfile, updateMyAvatar, syncNow,
    queueEntryUpsert, queueEntryDelete, queueTimelineTemplateUpdate, deleteTimelineRemote,
    sendInvitation, cancelInvitation, respondToInvitation, listInvitationsLive,
  };
})();
