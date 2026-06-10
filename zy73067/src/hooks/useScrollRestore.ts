import { useEffect, useState, useRef } from "react";
import { useReviewStore } from "@/store/reviewStore";

export function useScrollRestore() {
  const { restorePageSnapshot, setFilters, selectRecord, expandedRowIds, toggleRowExpanded } =
    useReviewStore();
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [restored, setRestored] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (restored) return;
    const snap = restorePageSnapshot();
    if (!snap) {
      setRestored(true);
      return;
    }

    if (snap.filters && Object.keys(snap.filters).length > 0) {
      setFilters(snap.filters);
    }

    if (snap.selectedRecordId) {
      queueMicrotask(() => selectRecord(snap.selectedRecordId));
    }

    if (snap.expandedRowIds?.length > 0) {
      queueMicrotask(() => {
        snap.expandedRowIds.forEach((id) => {
          if (!expandedRowIds.includes(id)) toggleRowExpanded(id);
        });
      });
    }

    const pos = snap.scrollPosition ?? 0;
    const attemptRestore = () => {
      if (targetRef.current) {
        targetRef.current.scrollTop = pos;
        setRestored(true);
        if (pos > 50) setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3500);
      }
    };

    const timeoutId = window.setTimeout(attemptRestore, 300);
    const rafId = requestAnimationFrame(() => attemptRestore());

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
    };
  }, [restored]);

  return { targetRef, restored, showBanner, dismissBanner: () => setShowBanner(false) };
}
