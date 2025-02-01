const DB_NAME = "DomainReputaion";
const STORE_NAME = "reputation";
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

function openDB(){
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)){
                db.createObjectStore(STORE_NAME, { keyPath: "domain" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get cached reputation data for a domain
async function getCachedReputation(domain) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(domain);
  
      request.onsuccess = () => {
        const result = request.result;
        if (result && Date.now() - result.timestamp < CACHE_EXPIRY) {
          resolve(result.data); 
        } else {
          resolve(null); 
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

// Cache reputation data for a domain
async function cacheReputation(domain, data) {
   
    await clearExpiredCache();
    
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ domain, data, timestamp: Date.now() });
  
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

async function clearExpiredCache() {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
  
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (Date.now() - cursor.value.timestamp > CACHE_EXPIRY) {
          cursor.delete(); 
        }
        cursor.continue();
      }
    };
  }

export{getCachedReputation, cacheReputation, clearExpiredCache};