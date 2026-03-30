import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AppShell from "@/app/_components/app-shell";
import { logoutAction } from "@/app/home/actions";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteScrollableContentClassName } from "@/app/mis-rutas/route-scroll-layout.mjs";
import { getEstablishmentProductsPage } from "../detail-products-data";
import SupermercadoDetalleView, { type DetailSource } from "./supermercado-detalle-view";

const PROFILE_PHOTO_BUCKET = "profile-photos";

function getDisplayName(user: User | null) {
  if (!user) return "Juan Perez";

  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return user.email ?? "Usuario";
}

function toDetailSource(value: string | undefined): DetailSource {
  return value === "completadas" ? "completadas" : "pendientes";
}

export default async function SupermercadoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ routeId: string; establishmentId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { routeId, establishmentId } = await params;
  const { from } = await searchParams;

  const routeIdNumber = Number(routeId);
  const establishmentIdNumber = Number(establishmentId);
  const source = toDetailSource(from);

  if (!Number.isFinite(routeIdNumber) || !Number.isFinite(establishmentIdNumber)) {
    redirect("/mis-rutas");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("user_id, role, photo_path")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.user_id || !isAllowedAppRole(profile.role)) {
    redirect("/mis-rutas");
  }

  let profilePhotoUrl: string | null = null;
  if (profile.photo_path) {
    const { data } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(profile.photo_path, 3600);
    profilePhotoUrl = data?.signedUrl ?? null;
  }

  const { data: routeRow } = await supabase
    .from("route")
    .select("route_id, assigned_user")
    .eq("route_id", routeIdNumber)
    .maybeSingle();

  if (
    !routeRow ||
    (profile.role === "rutero" && routeRow.assigned_user !== profile.user_id)
  ) {
    redirect("/mis-rutas");
  }

  const lapsoUserId = routeRow.assigned_user ?? profile.user_id;

  const page = await getEstablishmentProductsPage({
    supabase,
    routeId: routeIdNumber,
    establishmentId: establishmentIdNumber,
    lapsoUserId,
    source,
    offset: 0,
    limit: DEFAULT_PAGE_SIZE,
  });

  if (!page) {
    redirect(`/mis-rutas/${routeIdNumber}/${source}`);
  }

  const backHref = source === "completadas"
    ? `/mis-rutas/${routeIdNumber}/completadas`
    : `/mis-rutas/${routeIdNumber}/pendientes`;

  return (
    <AppShell
      title="Establecimiento detalle"
      displayName={getDisplayName(user)}
      profilePhotoUrl={profilePhotoUrl}
      onLogout={logoutAction}
      contentClassName={getRouteScrollableContentClassName()}
    >
      <SupermercadoDetalleView
        routeId={routeIdNumber}
        establishmentId={establishmentIdNumber}
        establishmentName={page.establishmentName}
        source={source}
        hasActiveLapso={page.hasActiveLapso}
        initialItems={page.items}
        initialHasMore={page.hasMore}
        pageSize={DEFAULT_PAGE_SIZE}
        backHref={backHref}
      />
    </AppShell>
  );
}
