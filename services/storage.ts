
import { Appointment } from '../types';

const DB_NAME = 'TechArjaDB';
const STORE_NAME = 'appointments';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveAppointmentsToStorage = async (appointments: Appointment[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear the store before adding the current state to ensure synchronization
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      if (appointments.length === 0) {
          resolve();
          return;
      }
      
      let processed = 0;
      appointments.forEach(appt => {
        const request = store.put(appt);
        request.onsuccess = () => {
          processed++;
          if (processed === appointments.length) resolve();
        };
        request.onerror = (e) => reject((e.target as IDBRequest).error);
      });
    };

    clearRequest.onerror = (e) => reject((e.target as IDBRequest).error);
  });
};

export const loadAppointmentsFromStorage = async (): Promise<Appointment[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = request.result as Appointment[];
      // Hydrate Date objects from stored strings/objects
      const hydrated = result.map(a => ({
        ...a,
        start: new Date(a.start),
        end: new Date(a.end)
      }));
      resolve(hydrated);
    };

    request.onerror = (e) => reject((e.target as IDBRequest).error);
  });
};
