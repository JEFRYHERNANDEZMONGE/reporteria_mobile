"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getScrollableListClassName, getScrollableListObserverOptions } from "@/app/_components/scrollable-list-state.mjs";
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setRecords(initialRecords);
    setHasMore(initialHasMore);
    setLoadError(null);
  }, [initialHasMore, initialRecords]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        offset: String(records.length),
        limit: String(pageSize),
      });
      const response = await fetch(`/api/registros?${params.toString()}`);
      if (!response.ok) {
        throw new Error("No se pudieron cargar mas registros.");
      }

      const payload = (await response.json()) as RegistrosResponse;
      setRecords((current) => {
        const seen = new Set(current.map((item) => item.recordId));
        const next = payload.items.filter((item) => !seen.has(item.recordId));
        return current.concat(next);
      });
      setHasMore(payload.hasMore);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Error cargando registros.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, pageSize, records.length]);

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

          {records.length === 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[14px] text-[#405C62]">
              No hay registros disponibles.
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


