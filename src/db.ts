import type { Draft, SavedRun } from './types';

const DB_NAME = 'stock-label-run';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('app')) db.createObjectStore('app');
      if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(draft: Draft): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction('app', 'readwrite');
  transaction.objectStore('app').put(draft, 'draft');
  await complete(transaction);
}

export async function loadDraft(): Promise<Draft | null> {
  const db = await openDb();
  const request = db.transaction('app').objectStore('app').get('draft');
  return requestResult<Draft | null>(request, null);
}

export async function saveRun(run: SavedRun): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction('runs', 'readwrite');
  transaction.objectStore('runs').put(run);
  await complete(transaction);
}

export async function loadRuns(): Promise<SavedRun[]> {
  const db = await openDb();
  const request = db.transaction('runs').objectStore('runs').getAll();
  const runs = await requestResult<SavedRun[]>(request, []);
  return runs.sort((a, b) => b.printedAt.localeCompare(a.printedAt));
}

export async function deleteRun(id: string): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction('runs', 'readwrite');
  transaction.objectStore('runs').delete(id);
  await complete(transaction);
}

export async function importRuns(runs: SavedRun[]): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction('runs', 'readwrite');
  for (const run of runs) transaction.objectStore('runs').put(run);
  await complete(transaction);
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as T) ?? fallback);
    request.onerror = () => reject(request.error);
  });
}
