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
  checkFn: (_obj: unknown) => T | null,
  store: LocalForage = localforage
): Promise<T | null> {
  const item = await store.getItem(id);
  return checkFn(item);
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

/* istanbul ignore next */
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
