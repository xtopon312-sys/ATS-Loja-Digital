import { useSyncExternalStore } from 'react'
export function navigate(path: string, replace = false) {
  if (replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}
const subscribe = (callback: () => void) => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback) }
export function usePath() { return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/login') }
