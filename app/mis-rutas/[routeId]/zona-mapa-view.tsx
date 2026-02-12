"use client";

import Link from "next/link";
import Script from "next/script";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MapMarker, RouteLapsoSummary } from "../types";
import { startRouteAction } from "./actions";

type ZonaMapaViewProps = {
  routeId: number;
  routeName: string;
  markers: MapMarker[];
  lapso: RouteLapsoSummary | null;
  canStartRoute: boolean;
};

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => {
          fitBounds: (bounds: unknown) => void;
          setCenter: (center: { lat: number; lng: number }) => void;
          setZoom: (zoom: number) => void;
        };
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown) => void;
        };
        LatLngBounds: new () => {
          extend: (point: { lat: number; lng: number }) => void;
        };
      };
    };
  }
}

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };
const INITIAL_START_ROUTE_STATE = { error: null, success: false };

export default function ZonaMapaView({
  routeId,
  routeName,
  markers,
  lapso,
  canStartRoute,
}: ZonaMapaViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const router = useRouter();
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{
    fitBounds: (bounds: unknown) => void;
    setCenter: (center: { lat: number; lng: number }) => void;
    setZoom: (zoom: number) => void;
  } | null>(null);
  const markerRefs = useRef<Array<{ setMap: (map: unknown) => void }>>([]);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [hasScriptError, setHasScriptError] = useState(false);
  const [startState, startAction, startPending] = useActionState(
    startRouteAction,
    INITIAL_START_ROUTE_STATE,
  );
  const hasActiveLapso = !!lapso;

  const effectiveCenter = useMemo(() => markers[0] ?? DEFAULT_CENTER, [markers]);

  useEffect(() => {
    if (!apiKey || !isScriptLoaded || hasScriptError) return;
    const googleMaps = window.google?.maps;
    if (!mapNodeRef.current || !googleMaps) return;

    if (!mapRef.current) {
      mapRef.current = new googleMaps.Map(mapNodeRef.current, {
        center: effectiveCenter,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];

    if (markers.length === 0) {
      mapRef.current.setCenter(effectiveCenter);
      mapRef.current.setZoom(12);
      return;
    }

    const bounds = new googleMaps.LatLngBounds();
    markers.forEach((marker) => {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
      const mapMarker = new googleMaps.Marker({
        map: mapRef.current,
        position: { lat: marker.lat, lng: marker.lng },
        title: marker.label,
      });
      markerRefs.current.push(mapMarker);
    });

    mapRef.current.fitBounds(bounds);
  }, [apiKey, effectiveCenter, hasScriptError, isScriptLoaded, markers]);

  useEffect(() => {
    if (!startState.success) return;
    router.refresh();
  }, [router, startState.success]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto pt-1">
      <div className="rounded-[12px] border border-[#B3B5B3] bg-white px-3 py-2">
        <p className="m-0 text-[14px] leading-none font-normal text-[#0D3233]">{routeName}</p>
        {lapso ? (
          <p className="m-0 mt-1 text-[12px] leading-none font-normal text-[#405C62]">
            Lapso activo {lapso.dayLabel} ({lapso.progressPercent}%)
          </p>
        ) : (
          <p className="m-0 mt-1 text-[12px] leading-none font-normal text-[#405C62]">
            No hay lapso activo para esta ruta.
          </p>
        )}
      </div>

      {apiKey ? (
        <Script
          id="google-maps-api-script"
          src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}`}
          strategy="afterInteractive"
          onLoad={() => setIsScriptLoaded(true)}
          onError={() => setHasScriptError(true)}
        />
      ) : null}

      <div className="flex h-[clamp(180px,42dvh,420px)] w-full items-center justify-center overflow-hidden rounded-[12px] border border-[#B3B5B3] bg-white">
        {!apiKey ? (
          <p className="px-4 text-center text-[13px] text-[#405C62]">
            Agrega NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en tu .env.local para activar Google Maps.
          </p>
        ) : hasScriptError ? (
          <p className="px-4 text-center text-[13px] text-[#A43E2A]">
            No fue posible cargar Google Maps. Revisa la API key y restricciones.
          </p>
        ) : (
          <div ref={mapNodeRef} className="h-full w-full" aria-label={`Mapa de ${routeName}`} />
        )}
      </div>

      <div className="flex w-full flex-col gap-4 pt-2 pb-2">
        {!hasActiveLapso && canStartRoute ? (
          <form action={startAction} className="flex w-full flex-col gap-2">
            <input type="hidden" name="routeId" value={routeId} />
            <button
              type="submit"
              disabled={startPending}
              className="h-[60px] w-full rounded-[12px] border-0 bg-[#7C8745] text-[20px] leading-none font-normal text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {startPending ? "Iniciando..." : "Iniciar ruta"}
            </button>
            {startState.error ? (
              <p className="m-0 text-center text-[12px] text-[#A43E2A]">{startState.error}</p>
            ) : null}
          </form>
        ) : null}

        <Link
          href={`/mis-rutas/${routeId}/pendientes`}
          className="flex h-[60px] w-full items-center justify-center rounded-[12px] border-0 bg-[#0D3233] text-[20px] leading-none font-normal text-white"
        >
          Ver pendientes
        </Link>
        <Link
          href={`/mis-rutas/${routeId}/completadas`}
          className="flex h-[60px] w-full items-center justify-center rounded-[12px] border-0 bg-[#0D3233] text-[20px] leading-none font-normal text-white"
        >
          Ver completadas
        </Link>
        <Link
          href="/mis-rutas"
          className="flex h-[60px] w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[20px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
      </div>
    </div>
  );
}
