/** IndexedDB kv 封装：图标 / 壁纸 / 备份快照的本地存储。连接复用（会话只 open 一次） */
/** IndexedDB 连接复用：整个会话只 open 一次（此前每次读写都重新 open，首载约 45 图标即 45 次连接） */
let idbPromise = null;
export function idb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const rq = indexedDB.open('nav-page', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  return idbPromise;
}

export function idbPut(key, value) {
  return idb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

export function idbGet(key) {
  return idb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}
