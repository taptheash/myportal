import { useEffect, useState, useCallback } from 'react';

// Decides whether the portal shows its phone layout or its desktop layout.
//
// Auto-detect: a touch screen that can't hover (a phone, in either
// orientation) or a very narrow window. Firefox, Chrome and Samsung Internet
// on Android all report these the same way, so no user-agent sniffing.
//
// The "Desktop view" / "Mobile view" switch overrides that per browser. It's
// stored in 'pw6-view-mode', which is deliberately NOT in cloudSync's
// SYNC_KEYS — choosing desktop view on the phone must not flip the laptop.

export type ViewOverride = 'auto' | 'mobile' | 'desktop';

const KEY = 'pw6-view-mode';
const PHONE_QUERY = '(pointer: coarse) and (hover: none) and (max-width: 932px), (max-width: 640px)';

function readOverride(): ViewOverride {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'mobile' || v === 'desktop' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function detectPhone(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches;
}

export function useViewMode() {
  const [override, setOverrideState] = useState<ViewOverride>(readOverride);
  const [autoIsPhone, setAutoIsPhone] = useState<boolean>(detectPhone);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => setAutoIsPhone(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const isMobile = override === 'auto' ? autoIsPhone : override === 'mobile';

  // Flip to the other layout. If that's what auto-detect would pick anyway,
  // go back to 'auto' so the device keeps following its own detection.
  const toggle = useCallback(() => {
    const wantMobile = !isMobile;
    const next: ViewOverride = wantMobile === autoIsPhone ? 'auto' : wantMobile ? 'mobile' : 'desktop';
    try {
      if (next === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch { /* storage blocked — still switches for this visit */ }
    setOverrideState(next);
    window.scrollTo(0, 0);
  }, [isMobile, autoIsPhone]);

  return { isMobile, autoIsPhone, override, toggle };
}
