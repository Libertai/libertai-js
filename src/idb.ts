import localforage from 'localforage';

/* TODO: Add LocalForage typings */

export function createStore(name: string): any {
  return localforage.createInstance({ name });
}

export async function put<T>(
  id: string,
  item: T,
  store: any = localforage
): Promise<T> {
  return store.setItem(id, item);
}

export async function get<T>(
  id: string,
  checkFn: (_obj: unknown) => T | null,
  store: any = localforage
): Promise<T | null> {
  const item = await store.getItem(id);
  return checkFn(item);
}

export async function exists(
  id: string,
  store: any = localforage
): Promise<boolean> {
  const key = await store.getItem(id);
  return key !== null;
}

export async function rm(id: string, store: any = localforage): Promise<void> {
  return store.removeItem(id);
}

export async function dropStore(store: any): Promise<void> {
  return store.dropInstance();
}

/* istanbul ignore next */
export async function clear(store?: any): Promise<void> {
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
