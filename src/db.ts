import type { Draft, SavedRun } from './types';

export type StorageScope = 'real' | 'demo';

const DB_NAME = 'stock-label-run';
const DB_VERSION = 1;

export function databaseName(scope: StorageScope): string {
  return scope === 'demo' ? `demo:${DB_NAME}` : DB_NAME;
}

function openDb(scope: StorageScope): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName(scope), DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('app')) db.createObjectStore('app');
      if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(draft: Draft, scope: StorageScope): Promise<void> {
  const db = await openDb(scope);
  try {
    const transaction = db.transaction('app', 'readwrite');
    transaction.objectStore('app').put(draft, 'draft');
    await complete(transaction);
  } finally { db.close(); }
}

export async function loadDraft(scope: StorageScope): Promise<Draft | null> {
  const db = await openDb(scope);
  try {
    const request = db.transaction('app').objectStore('app').get('draft');
    return await requestResult<Draft | null>(request, null);
  } finally { db.close(); }
}

export async function saveRun(run: SavedRun, scope: StorageScope): Promise<void> {
  const db = await openDb(scope);
  try {
    const transaction = db.transaction('runs', 'readwrite');
    transaction.objectStore('runs').put(run);
    await complete(transaction);
  } finally { db.close(); }
}

export async function loadRuns(scope: StorageScope): Promise<SavedRun[]> {
  const db = await openDb(scope);
  try {
    const request = db.transaction('runs').objectStore('runs').getAll();
    const runs = await requestResult<SavedRun[]>(request, []);
    return runs.sort((a, b) => b.printedAt.localeCompare(a.printedAt));
  } finally { db.close(); }
}

export async function deleteRun(id: string, scope: StorageScope): Promise<void> {
  const db = await openDb(scope);
  try {
    const transaction = db.transaction('runs', 'readwrite');
    transaction.objectStore('runs').delete(id);
    await complete(transaction);
  } finally { db.close(); }
}

export async function importRuns(runs: SavedRun[], scope: StorageScope): Promise<void> {
  const db = await openDb(scope);
  try {
    const transaction = db.transaction('runs', 'readwrite');
    for (const run of runs) transaction.objectStore('runs').put(run);
    await complete(transaction);
  } finally { db.close(); }
}

export function clearScope(scope: StorageScope): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName(scope));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other demo tabs before resetting the demo.'));
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function requestResult<T>(request: IDBRequest, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as T) ?? fallback);
    request.onerror = () => reject(request.error);
  });
}
