const DATABASE = 'last-light-saves';
const SLOTS = 'slots';
let connection;

function openDatabase() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(SLOTS);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Save database is blocked'));
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          connection = null;
        };
        resolve(database);
      };
    }).catch(error => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

async function transact(storage, key, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SLOTS, 'readwrite');
    const slots = transaction.objectStore(SLOTS);
    const lookup = slots.get(key);
    let result, mirror, failure;
    lookup.onsuccess = () => {
      try {
        const present = lookup.result !== undefined;
        const previous = present ? lookup.result : storage.getItem(key);
        let raw = previous;
        result = operation({
          getItem: name => name === key ? raw : storage.getItem(name),
          setItem: (name, value) => {
            if (name === key) raw = value;
            else storage.setItem(name, value);
          }
        });
        if (!present || raw !== previous) slots.put(raw, key);
        if (raw !== previous) mirror = raw;
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.onabort = () => reject(failure ?? transaction.error);
    transaction.oncomplete = () => {
      if (mirror !== undefined) {
        try { storage.setItem(key, mirror); }
        catch { /* Older builds use the mirror; the committed save remains authoritative. */ }
      }
      resolve(result);
    };
  });
}

function usesBrowserSave(storage) {
  try { return Boolean(globalThis.indexedDB) && storage === globalThis.localStorage; }
  catch { return false; }
}

// A Web Lock serializes the compatibility mirror when available. IndexedDB's
// transaction is the authority because a new lock owner may still see cached
// localStorage bytes from before the last owner wrote its save.
export function withSaveSlot(key, operation, storage) {
  let entered = false;
  const run = () => {
    entered = true;
    return usesBrowserSave(storage) ? transact(storage, key, operation) : operation(storage);
  };
  try {
    const locks = globalThis.navigator?.locks;
    if (locks) return locks.request(key, run).catch(error => {
      if (entered) throw error;
      return run();
    });
  } catch {
    // Continue through the same save transaction without optional Web Locks.
  }
  return Promise.resolve().then(run);
}

export function backUpSave(storage, key, raw) {
  if (raw === null) return;
  const existing = storage.getItem(key);
  if (existing === raw) return;
  if (existing !== null) {
    const prefix = key + '-' + Date.now();
    key = prefix;
    for (let n = 1; storage.getItem(key) !== null; n++) key = prefix + '-' + n;
  }
  storage.setItem(key, raw);
}

export function newSaveGeneration() {
  return globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + Math.random().toString(36).slice(2);
}

export function includeSaveGeneration(bytes, saved) {
  if (typeof saved?.saveGeneration !== 'string') return bytes;
  return JSON.stringify({...JSON.parse(bytes), saveGeneration: saved.saveGeneration});
}
