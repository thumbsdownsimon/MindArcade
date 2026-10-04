import { useCallback, useEffect, useRef, useState } from 'react';

/** setTimeout that is automatically cleared when the component unmounts (e.g. the player quits mid-game). */
export function useTimeouts() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach((id) => clearTimeout(id)), []);
  return useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    ids.current.push(id);
    return id;
  }, []);
}

/** Calls the latest handler for keydown without re-binding listeners each render. */
export function useKeyDown(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
}

export function useHashRoute() {
  const read = () => window.location.hash.replace(/^#/, '') || '/';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const fn = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
}
