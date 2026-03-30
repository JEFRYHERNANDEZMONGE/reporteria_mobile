"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import CollapsibleListSearch from "@/app/_components/collapsible-list-search";
import {
  getScrollableListClassName,
  getScrollableListObserverOptions,
} from "@/app/_components/scrollable-list-state.mjs";
import { sanitizeListSearchQuery } from "@/lib/list-search.mjs";
import type { RegistroListItem } from "./types";

type RegistrosResponse = {
  items: RegistroListItem[];
  hasMore: boolean;
};

type RegistrosListViewProps = {
  initialRecords: RegistroListItem[];
  initialHasMore: boolean;
  pageSize: number;
};

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RegistrosListView({
  initialRecords,
  initialHasMore,
  pageSize,
}: RegistrosListViewProps) {
  const [records, setRecords] = useState(initialRecords);
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
    setRecords(initialRecords);
    setHasMore(initialHasMore);
    setLoadError(null);
  }, [activeQuery, initialHasMore, initialRecords]);

  const fetchRecords = useCallback(
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

        const response = await fetch(`/api/registros?${params.toString()}`);
        if (!response.ok) {
          throw new Error("No se pudieron cargar mas registros.");
        }

        const payload = (await response.json()) as RegistrosResponse;
        if (reset) {
          setRecords(payload.items);
        } else {
          setRecords((current) => {
            const seen = new Set(current.map((item) => item.recordId));
            const next = payload.items.filter((item) => !seen.has(item.recordId));
            return current.concat(next);
          });
        }
        setHasMore(payload.hasMore);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Error cargando registros.");
      } finally {
        setIsLoadingMore(false);
      }
    },
    [pageSize],
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    await fetchRecords({
      offset: records.length,
      reset: false,
      query: activeQuery,
    });
  }, [activeQuery, fetchRecords, hasMore, isLoadingMore, records.length]);

  useEffect(() => {
    if (!hasMountedSearchRef.current) {
      hasMountedSearchRef.current = true;
      return;
    }

    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    void fetchRecords({
      offset: 0,
      reset: true,
      query: activeQuery,
    });
  }, [activeQuery, fetchRecords]);

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

  const emptyMessage = activeQuery
    ? `No se encontraron registros para "${activeQuery}".`
    : "No hay registros disponibles.";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <section ref={scrollRef} className={getScrollableListClassName({ topPadding: true })}>
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/registros/nuevo?source=registros"
            className="flex h-11 w-full items-center justify-center rounded-[12px] bg-[#0D3233] text-[14px] leading-none font-normal text-white"
          >
            Crear registro
          </Link>

          <CollapsibleListSearch
            isOpen={isSearchOpen}
            query={searchInput}
            onToggle={handleToggleSearch}
            onQueryChange={setSearchInput}
            placeholder="Buscar por establecimiento, producto o registro"
          />

          {records.length === 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[14px] text-[#405C62]">
              {emptyMessage}
            </div>
          ) : null}

          {records.map((record) => (
            <Link
              key={record.recordId}
              href={`/registros/${record.recordId}/editar?source=registros`}
              className="flex min-h-[84px] w-full flex-col justify-center gap-1 rounded-[12px] bg-[#5A7A84] px-3 py-3"
            >
              <p className="m-0 text-[14px] leading-none font-normal text-white">
                {formatDateLabel(record.createdAt)}
              </p>
              <p className="m-0 text-[12px] leading-none font-normal text-[#E9EDE9]">
                {record.establishmentName} | {record.productName}
              </p>
              <p className="m-0 text-[12px] leading-none font-normal text-[#E9EDE9]">
                {record.routeName ?? "Sin ruta"} | Evidencias: {record.evidenceNum ?? 0}
              </p>
            </Link>
          ))}

          <div ref={sentinelRef} className="h-6 w-full" aria-hidden="true" />

          {isLoadingMore ? (
            <p className="m-0 pb-2 text-center text-[12px] text-[#405C62]">
              Cargando registros...
            </p>
          ) : null}

          {loadError ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              className="h-10 w-full rounded-[10px] border border-[#B3B5B3] bg-white text-[13px] text-[#0D3233]"
            >
              {loadError} Reintentar
            </button>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-[#E9EDE9] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        <Link
          href="/home"
          className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[14px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}
