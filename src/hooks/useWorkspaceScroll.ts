import { useEffect, useState, type RefObject } from 'react';

interface UseWorkspaceScrollOptions {
  threshold?: number;
  containerRef?: RefObject<HTMLElement | null>;
}

export function useWorkspaceScroll({ threshold = 100, containerRef }: UseWorkspaceScrollOptions = {}) {
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      let currentY = window.scrollY;
      if (containerRef && containerRef.current) {
        currentY = Math.max(currentY, containerRef.current.scrollTop);
      }
      setScrollY(currentY);
      setIsScrolled(currentY >= threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const container = containerRef?.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [threshold, containerRef]);

  return { scrollY, isScrolled };
}
