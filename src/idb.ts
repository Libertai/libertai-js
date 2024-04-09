import localforage from 'localforage';

/* TODO: Add LocalForage typings */

export function createStore(name: string): LocalForage {
  return localforage.createInstance({ name });
}

export async function put<T>(
  id: string,
  item: T,
  store: LocalForage = localforage
): Promise<T> {
  return store.setItem(id, item);
}

export async function get<T>(
  id: string,
  store: LocalForage = localforage
): Promise<T | null> {
  const item = await store.getItem(id);
  // Check if item is null
  if (item === null) {
    return null;
  }
  // Otherwise, try to return item as T
  // Capture any errors and return null
  try {
    return item as T;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function exists(
  id: string,
  store: LocalForage = localforage
): Promise<boolean> {
  const key = await store.getItem(id);
  return key !== null;
}

export async function rm(
  id: string,
  store: LocalForage = localforage
): Promise<void> {
  return store.removeItem(id);
}

export async function dropStore(store: LocalForage): Promise<void> {
  return store.dropInstance();
}

export async function clear(store?: LocalForage): Promise<void> {
  if (store) {
    return dropStore(store);
  } else {
    return localforage.clear();
  }
}

export default {
  createStore,
  get,
  put,
  exists,
  rm,
  dropStore,
  clear,
};
