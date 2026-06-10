import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useReviewStore } from "@/store/reviewStore";

const DEBOUNCE_MS = 800;

export function useAutoSave() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { filters, expandedRowIds, selectedRecordId, savePageSnapshot } = useReviewStore();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const triggerSave = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      savePageSnapshot({
        routePath: location.pathname + searchParams.toString(),
        scrollPosition: scrollContainerRef.current?.scrollTop ?? 0,
        filters,
        selectedRecordId: selectedRecordId ?? undefined,
        expandedRowIds,
      });
    }, DEBOUNCE_MS);
  };

  useEffect(() => {
    triggerSave();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [location.pathname, filters, expandedRowIds, selectedRecordId]);

  const attachScrollListener = (el: HTMLDivElement | null) => {
    scrollContainerRef.current = el;
    if (!el) return;
    el.onscroll = () => triggerSave();
  };

  return { attachScrollListener, scrollContainerRef };
}
