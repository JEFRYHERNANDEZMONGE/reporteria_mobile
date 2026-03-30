"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import CollapsibleListSearch from "@/app/_components/collapsible-list-search";
import {
  getScrollableListClassName,
  getScrollableListObserverOptions,
} from "@/app/_components/scrollable-list-state.mjs";
import { sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import type { ZonaListItem, ZonaSource } from "./zona-types";

type ZonaListResponse = {
  items: ZonaListItem[];
  hasMore: boolean;
};

type ZonaListViewProps = {
  routeId: number;
  source: ZonaSource;
  initialItems: ZonaListItem[];
  initialHasMore: boolean;
  pageSize: number;
  emptyMessage: string;
  backHref: string;
};

function buildDefaultHref(routeId: number, establishmentId: number, source: ZonaSource) {
  return `/mis-rutas/${routeId}/establecimientos/${establishmentId}?from=${source}`;
}

export default function ZonaListView({
  routeId,
  source,
  initialItems,
  initialHasMore,
  pageSize,
  emptyMessage,
  backHref,
}: ZonaListViewProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const hasMountedSearchRef = useRef(false);
  const deferredSearchInput = useDeferredValue(searchInput);
  const activeQuery = sanitizeListSearchQuery(deferredSearchInput);

  useEffect(() => {
    if (activeQuery) return;
    setItems(initialItems);
    setHasMore(initialHasMore);
    setLoadError(null);
  }, [activeQuery, initialHasMore, initialItems]);

  const fetchItems = useCallback(
    async ({
      offset,
      reset,
      query,
    }: {
      offset: number;
      reset: boolean;
      query: string;
    }) => {
      setIsLoadingMore(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(pageSize),
        });

        if (query) {
          params.set("query", query);
        }

        const response = await fetch(`/api/mis-rutas/${routeId}/${source}?${params.toString()}`);
        if (!response.ok) {
          throw new Error("No se pudieron cargar mas elementos.");
        }

        const payload = (await response.json()) as ZonaListResponse;
        if (reset) {
          setItems(payload.items);
        } else {
          setItems((current) => {
            const seen = new Set(current.map((item) => item.id));
            const next = payload.items.filter((item) => !seen.has(item.id));
            return current.concat(next);
          });
        }
        setHasMore(payload.hasMore);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Error cargando elementos.");
      } finally {
        setIsLoadingMore(false);
      }
    },
    [pageSize, routeId, source],
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    await fetchItems({
      offset: items.length,
      reset: false,
      query: activeQuery,
    });
  }, [activeQuery, fetchItems, hasMore, isLoadingMore, items.length]);

  useEffect(() => {
    if (!hasMountedSearchRef.current) {
      hasMountedSearchRef.current = true;
      return;
    }

    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    void fetchItems({
      offset: 0,
      reset: true,
      query: activeQuery,
    });
  }, [activeQuery, fetchItems]);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const node = sentinelRef.current;
    const container = scrollRef.current;
    if (!node || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      getScrollableListObserverOptions(container),
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  function handleToggleSearch() {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchInput("");
      return;
    }

    setIsSearchOpen(true);
  }

  const effectiveEmptyMessage = activeQuery
    ? `No se encontraron establecimientos para "${activeQuery}".`
    : emptyMessage;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <section ref={scrollRef} className={getScrollableListClassName({ topPadding: true })}>
        <div className="flex w-full flex-col gap-3">
          <CollapsibleListSearch
            isOpen={isSearchOpen}
            query={searchInput}
            onToggle={handleToggleSearch}
            onQueryChange={setSearchInput}
            placeholder="Buscar establecimiento"
          />

          {items.length === 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[16px] text-[#405C62]">
              {effectiveEmptyMessage}
            </div>
          ) : null}

          {items.map((item) => {
            const href = item.href ?? buildDefaultHref(routeId, item.id, source);
            return href ? (
              <Link
                key={item.id}
                href={href}
                className="flex h-[72px] w-full flex-col justify-center gap-1 rounded-[12px] bg-[#5A7A84] px-3"
              >
                <p className="m-0 text-[16px] leading-none font-normal text-white">{item.name}</p>
                {item.meta ? (
                  <p className="m-0 text-[12px] leading-none font-normal text-[#E9EDE9]">
                    {item.meta}
                  </p>
                ) : null}
              </Link>
            ) : (
              <article
                key={item.id}
                className="flex h-[72px] w-full flex-col justify-center gap-1 rounded-[12px] bg-[#5A7A84] px-3"
              >
                <p className="m-0 text-[16px] leading-none font-normal text-white">{item.name}</p>
                {item.meta ? (
                  <p className="m-0 text-[12px] leading-none font-normal text-[#E9EDE9]">
                    {item.meta}
                  </p>
                ) : null}
              </article>
            );
          })}

          <div ref={sentinelRef} className="h-6 w-full" aria-hidden="true" />

          {isLoadingMore ? (
            <p className="m-0 pb-2 text-center text-[14px] text-[#405C62]">Cargando...</p>
          ) : null}

          {loadError ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="h-10 w-full rounded-[10px] border border-[#B3B5B3] bg-white text-[15px] text-[#0D3233]"
            >
              {loadError} Reintentar
            </button>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-[#E9EDE9] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        <Link
          href={backHref}
          className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[16px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}
