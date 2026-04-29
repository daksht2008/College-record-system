// EduSync Offline-First Data Management
// IndexedDB Database for Local Storage

class EduSyncDB {
  constructor() {
    this.db = null;
    this.dbName = 'EduSyncOffline';
    this.version = 1;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Attendance Store
        if (!db.objectStoreNames.contains('attendance')) {
          const attStore = db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
          attStore.createIndex('status', 'status', { unique: false });
          attStore.createIndex('enrollment_no', 'enrollment_no', { unique: false });
          attStore.createIndex('date', 'date', { unique: false });
          attStore.createIndex('synced', 'synced', { unique: false });
        }

        // Marks Store
        if (!db.objectStoreNames.contains('marks')) {
          const marksStore = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
          marksStore.createIndex('enrollment_no', 'enrollment_no', { unique: false });
          marksStore.createIndex('subject', 'subject', { unique: false });
          marksStore.createIndex('synced', 'synced', { unique: false });
        }

        // Sync Queue (for failed syncs)
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  // Add Attendance Record Locally
  async addAttendance(enrollmentNo, date, status, division = 'A') {
    const record = {
      enrollment_no: enrollmentNo,
      date: date,
      status: status,
      division: division,
      synced: false,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['attendance'], 'readwrite');
      const store = transaction.objectStore('attendance');
      const request = store.add(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Get All Unsynced Attendance
  async getUnsyncedAttendance() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['attendance'], 'readonly');
      const store = transaction.objectStore('attendance');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Mark Attendance as Synced
  async markAttendanceSynced(ids) {
    return Promise.all(
      ids.map(id =>
        new Promise((resolve, reject) => {
          const transaction = this.db.transaction(['attendance'], 'readwrite');
          const store = transaction.objectStore('attendance');
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            const record = getRequest.result;
            record.synced = true;
            const updateRequest = store.put(record);
            updateRequest.onerror = () => reject(updateRequest.error);
            updateRequest.onsuccess = () => resolve();
          };
        })
      )
    );
  }

  // Add Marks Record Locally
  async addMarks(enrollmentNo, subject, marks) {
    const record = {
      enrollment_no: enrollmentNo,
      subject: subject,
      marks: marks,
      synced: false,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['marks'], 'readwrite');
      const store = transaction.objectStore('marks');
      const request = store.add(record);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Get All Unsynced Marks
  async getUnsyncedMarks() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['marks'], 'readonly');
      const store = transaction.objectStore('marks');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Mark Marks as Synced
  async markMarksSynced(ids) {
    return Promise.all(
      ids.map(id =>
        new Promise((resolve, reject) => {
          const transaction = this.db.transaction(['marks'], 'readwrite');
          const store = transaction.objectStore('marks');
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            const record = getRequest.result;
            record.synced = true;
            const updateRequest = store.put(record);
            updateRequest.onerror = () => reject(updateRequest.error);
            updateRequest.onsuccess = () => resolve();
          };
        })
      )
    );
  }

  // Clear Synced Records (cleanup)
  async clearSyncedRecords() {
    return Promise.all([
      this.clearSyncedFromStore('attendance'),
      this.clearSyncedFromStore('marks')
    ]);
  }

  async clearSyncedFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('synced');
      const request = index.openCursor(IDBKeyRange.only(true));
      let deleted = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Offline Sync Manager
class OfflineSyncManager {
  constructor(dbInstance, apiBase) {
    this.db = dbInstance;
    this.apiBase = apiBase;
    this.isSyncing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  // Detect Network Status
  isOnline() {
    return navigator.onLine;
  }

  // Initialize Network Status Listener
  initNetworkListener(onStatusChange) {
    window.addEventListener('online', () => {
      console.log('📡 Network Online - Starting sync...');
      onStatusChange(true);
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Network Offline - Using local data');
      onStatusChange(false);
    });
  }

  // Main Sync Function
  async syncAll() {
    if (this.isSyncing) {
      console.log('Sync already in progress...');
      return;
    }

    this.isSyncing = true;
    const syncResults = {
      attendance: { synced: 0, failed: 0 },
      marks: { synced: 0, failed: 0 }
    };

    try {
      // Sync Attendance
      const unsyncedAttendance = await this.db.getUnsyncedAttendance();
      if (unsyncedAttendance.length > 0) {
        const result = await this.syncAttendance(unsyncedAttendance);
        syncResults.attendance = result;
      }

      // Sync Marks
      const unsyncedMarks = await this.db.getUnsyncedMarks();
      if (unsyncedMarks.length > 0) {
        const result = await this.syncMarks(unsyncedMarks);
        syncResults.marks = result;
      }

      // Cleanup old synced records
      await this.db.clearSyncedRecords();

      this.retryCount = 0;
      console.log('✅ Sync Complete:', syncResults);
      return syncResults;
    } catch (error) {
      console.error('❌ Sync Error:', error);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying... (${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.syncAll(), 5000 * this.retryCount);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync Attendance Records
  async syncAttendance(records) {
    const result = { synced: 0, failed: 0 };
    const attendanceRecords = records.map(r => ({
      enrollment_no: r.enrollment_no,
      date: r.date,
      status: r.status,
      division: r.division
    }));

    try {
      const response = await fetch(`${this.apiBase}/admin/syncAttendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceRecords })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        const recordIds = records.map(r => r.id);
        await this.db.markAttendanceSynced(recordIds);
        result.synced = records.length;
        console.log(`✅ ${records.length} attendance records synced`);
      }
    } catch (error) {
      console.error('Attendance sync failed:', error);
      result.failed = records.length;
    }

    return result;
  }

  // Sync Marks Records
  async syncMarks(records) {
    const result = { synced: 0, failed: 0 };

    try {
      const updates = records.map(r => ({
        enrollment_no: r.enrollment_no,
        subject: r.subject,
        marks: r.marks
      }));

      const response = await fetch(`${this.apiBase}/admin/bulkUpdateMarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.success) {
        const recordIds = records.map(r => r.id);
        await this.db.markMarksSynced(recordIds);
        result.synced = records.length;
        console.log(`✅ ${records.length} marks records synced`);
      }
    } catch (error) {
      console.error('Marks sync failed:', error);
      result.failed = records.length;
    }

    return result;
  }
}

// Initialize on Page Load
let eduSyncDB = null;
let offlineSyncManager = null;

async function initializeOfflineSync() {
  try {
    // Check IndexedDB support
    if (!window.indexedDB) {
      console.warn('IndexedDB not supported - offline features disabled');
      return;
    }

    // Initialize database
    eduSyncDB = new EduSyncDB();
    await eduSyncDB.init();
    console.log('✅ IndexedDB initialized');

    // Initialize sync manager
    offlineSyncManager = new OfflineSyncManager(eduSyncDB, (typeof API_BASE !== 'undefined' ? API_BASE : window.location.origin + '/api'));
    
    // Setup network listener
    offlineSyncManager.initNetworkListener((isOnline) => {
      updateNetworkStatus(isOnline);
    });

    console.log('✅ Offline sync system ready');

    // Auto-sync every 30 seconds if online
    setInterval(() => {
      if (navigator.onLine && offlineSyncManager) {
        offlineSyncManager.syncAll();
      }
    }, 30000);

  } catch (error) {
    console.error('Failed to initialize offline sync:', error);
  }
}

// Update UI Network Status
function updateNetworkStatus(isOnline) {
  const indicator = document.getElementById('networkStatus');
  if (!indicator) {
    // Create if doesn't exist
    const div = document.createElement('div');
    div.id = 'networkStatus';
    div.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      z-index: 9999;
      display: none;
    `;
    document.body.appendChild(div);
  }

  const status = document.getElementById('networkStatus');
  if (isOnline) {
    status.style.display = 'none';
  } else {
    status.innerHTML = '📴 Offline Mode - Data saved locally';
    status.style.background = '#ef4444';
    status.style.color = 'white';
    status.style.display = 'block';
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOfflineSync);
} else {
  initializeOfflineSync();
}
