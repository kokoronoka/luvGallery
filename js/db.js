/* LuvGallery — IndexedDB data layer */
const DB_NAME = 'luvgallery';
const DB_VERSION = 2;
const LOCAL_TIMELINE_ID = 'local';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      const tx = req.transaction;

      if (db.objectStoreNames.contains('people')) {
        db.deleteObjectStore('people');
      }

      let entriesStore;
      if (!db.objectStoreNames.contains('entries')) {
        entriesStore = db.createObjectStore('entries', { keyPath: 'id' });
        entriesStore.createIndex('byDateTime', 'dateTime');
      } else {
        entriesStore = tx.objectStore('entries');
      }
      if (!entriesStore.indexNames.contains('byTimeline')) {
        entriesStore.createIndex('byTimeline', 'timelineId');
      }
      if (e.oldVersion < 2) {
        // Migrate any pre-existing (v1, single-timeline) entries into the
        // local solo-journal pseudo-timeline so nothing is lost.
        entriesStore.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) return;
          const entry = cursor.value;
          if (!entry.timelineId) {
            entry.timelineId = LOCAL_TIMELINE_ID;
            cursor.update(entry);
          }
          cursor.continue();
        };
      }

      if (!db.objectStoreNames.contains('timelines')) {
        db.createObjectStore('timelines', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('invitations')) {
        db.createObjectStore('invitations', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const DB = {
  uid,
  LOCAL_TIMELINE_ID,

  // ---- Timelines ----
  async listTimelines() {
    const store = await tx('timelines', 'readonly');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  },
  async getTimeline(id) {
    const store = await tx('timelines', 'readonly');
    return reqToPromise(store.get(id));
  },
  async saveTimeline(timeline) {
    const store = await tx('timelines', 'readwrite');
    if (!timeline.id) timeline.id = uid();
    await reqToPromise(store.put(timeline));
    return timeline;
  },
  async deleteTimeline(id) {
    const store = await tx('timelines', 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async ensureLocalTimeline() {
    const existing = await this.getTimeline(LOCAL_TIMELINE_ID);
    if (existing) return existing;
    return this.saveTimeline({ id: LOCAL_TIMELINE_ID, isLocal: true, template: 'love', label: null, partnerName: null });
  },

  // ---- Entries ----
  async listEntries(timelineId) {
    const store = await tx('entries', 'readonly');
    const idx = store.index('byTimeline');
    const all = await reqToPromise(idx.getAll(IDBKeyRange.only(timelineId)));
    return all.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));
  },
  async getEntry(id) {
    const store = await tx('entries', 'readonly');
    return reqToPromise(store.get(id));
  },
  async saveEntry(entry) {
    const store = await tx('entries', 'readwrite');
    if (!entry.id) entry.id = uid();
    if (!entry.createdAt) entry.createdAt = new Date().toISOString();
    await reqToPromise(store.put(entry));
    return entry;
  },
  async deleteEntry(id) {
    const store = await tx('entries', 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async deleteEntriesForTimeline(timelineId) {
    const entries = await this.listEntries(timelineId);
    const store = await tx('entries', 'readwrite');
    await Promise.all(entries.map((e) => reqToPromise(store.delete(e.id))));
  },

  // ---- Invitations (local cache only — cloud is the source of truth) ----
  async listInvitations() {
    const store = await tx('invitations', 'readonly');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  },
  async saveInvitation(inv) {
    const store = await tx('invitations', 'readwrite');
    await reqToPromise(store.put(inv));
    return inv;
  },
  async deleteInvitation(id) {
    const store = await tx('invitations', 'readwrite');
    await reqToPromise(store.delete(id));
  },
  async replaceInvitations(list) {
    const store = await tx('invitations', 'readwrite');
    await reqToPromise(store.clear());
    await Promise.all(list.map((inv) => reqToPromise(store.put(inv))));
  },

  // ---- Settings ----
  async getSetting(key, fallback) {
    const store = await tx('settings', 'readonly');
    const rec = await reqToPromise(store.get(key));
    return rec ? rec.value : fallback;
  },
  async setSetting(key, value) {
    const store = await tx('settings', 'readwrite');
    await reqToPromise(store.put({ key, value }));
  },
};

window.DB = DB;
