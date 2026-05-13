import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * useSwipeBack — adds iOS-style edge-swipe-to-go-back gesture support.
 *
 * Why this exists: iOS Safari has native edge-swipe-back, but it does NOT
 * work in installed PWAs (Apple deliberately removed it). Android browsers
 * never had it. This hook simulates the gesture so users in standalone-mode
 * PWAs (which most of our team uses) still get the muscle-memory navigation.
 *
 * Behaviour:
 *   - Touch must start within 20px of the LEFT edge of the screen
 *   - Must swipe right at least 80px AND mostly horizontally (>60deg)
 *   - Must complete within 600ms (fast flick) to avoid false positives
 *     from regular scrolling/dragging
 *   - When triggered, navigates browser history back one step
 *
 * Falls back gracefully: if there's nothing in history (deep link, fresh
 * tab), navigates to /dashboard instead so users aren't stranded.
 */
export default function useSwipeBack({ excludePaths = [] } = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (excludePaths.some((p) => location.pathname.startsWith(p))) return;

    const EDGE_THRESHOLD = 20;
    const MIN_DISTANCE = 80;
    const MAX_DURATION = 600;
    const HORIZONTAL_RATIO = 1.5;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_THRESHOLD) {
        tracking = false;
        return;
      }
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      tracking = true;
    };

    const onTouchEnd = (e) => {
      if (!tracking) return;
      tracking = false;

      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;

      if (dt > MAX_DURATION) return;
      if (dx < MIN_DISTANCE) return;
      if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard');
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [navigate, location.pathname, excludePaths]);
}
