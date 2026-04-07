import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import AppShell from "@/app/_components/app-shell";
import { logoutAction } from "@/app/home/actions";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RegistroForm from "../../registro-form";
import type {
  EvidenceGeoInfo,
  EvidenceItem,
  RegistroSource,
} from "../../types";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const EVIDENCE_BUCKET = "check-evidences";

function getDisplayName(user: User | null, profileName?: string | null) {
  if (profileName?.trim()) return profileName.trim();
  if (!user) return "Juan Perez";

  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name ?? metadata.name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return user.email ?? "Usuario";
}

function parseOptionalNumber(value: string | undefined) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSource(value: string | undefined): RegistroSource {
  if (value === "home") return "home";
  if (value === "pendientes") return "pendientes";
  if (value === "completadas") return "completadas";
  return "registros";
}

function buildBackHref(source: RegistroSource, routeId: number) {
  if (source === "home") return "/home";
  if (source === "pendientes") return `/mis-rutas/${routeId}/pendientes`;
  if (source === "completadas") return `/mis-rutas/${routeId}/completadas`;
  return "/registros";
}

function parseGeoInfo(rawValue: string | null): EvidenceGeoInfo | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    const lat = Number((parsed as { lat?: unknown }).lat);
    const lng = Number((parsed as { lng?: unknown }).lng);
    const accuracyRaw = (parsed as { accuracy?: unknown }).accuracy;
    const capturedAt = String((parsed as { capturedAt?: unknown }).capturedAt ?? "");

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !capturedAt.trim()) {
      return null;
    }

    return {
      lat,
      lng,
      accuracy:
        typeof accuracyRaw === "number" && Number.isFinite(accuracyRaw)
          ? accuracyRaw
          : null,
      capturedAt,
    };
  } catch {
    return null;
  }
}

export default async function RegistroEditarPage({
  params,
  searchParams,
}: {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const [{ recordId }, { source }] = await Promise.all([params, searchParams]);
  const recordIdNumber = parseOptionalNumber(recordId);
  const sourceValue = parseSource(source);

  if (recordIdNumber === null) {
    redirect("/registros");
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
    .select("user_id, role, photo_path, name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.user_id || !isAllowedAppRole(profile.role)) {
    redirect("/home");
  }

  let profilePhotoUrl: string | null = null;
  if (profile.photo_path) {
    const { data } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(profile.photo_path, 3600);
    profilePhotoUrl = data?.signedUrl ?? null;
  }

  const { data: record } = await supabase
    .from("check_record")
    .select(
      "record_id, user_id, product_id, establishment_id, system_inventory, real_inventory, comments",
    )
    .eq("record_id", recordIdNumber)
    .maybeSingle();

  if (!record) {
    redirect("/registros");
  }

  if (record.user_id !== profile.user_id) {
    redirect("/registros");
  }

  const { data: establishment } = await supabase
    .from("establishment")
    .select("establishment_id, route_id, name, is_active")
    .eq("establishment_id", record.establishment_id)
    .maybeSingle();

  if (!establishment || !establishment.is_active || !Number.isFinite(establishment.route_id)) {
    redirect("/registros");
  }

  if (profile.role === "rutero") {
    const { data: route } = await supabase
      .from("route")
      .select("assigned_user")
      .eq("route_id", establishment.route_id)
      .maybeSingle();

    if (!route || route.assigned_user !== profile.user_id) {
      redirect("/registros");
    }
  }

  const { data: route } = await supabase
    .from("route")
    .select("route_id, nombre")
    .eq("route_id", establishment.route_id)
    .maybeSingle();

  const { data: product } = await supabase
    .from("product")
    .select("product_id, name, sku")
    .eq("product_id", record.product_id)
    .maybeSingle();

  if (!product) {
    redirect("/registros");
  }

  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("evidence_id, url, geo_info")
    .eq("record_id", record.record_id)
    .order("evidence_id", { ascending: true });

  const existingEvidences: EvidenceItem[] = [];
  for (const evidence of evidenceRows ?? []) {
    let imageUrl = evidence.url;
    if (!evidence.url.startsWith("http://") && !evidence.url.startsWith("https://")) {
      const { data } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(evidence.url, 3600);
      imageUrl = data?.signedUrl ?? "";
    }

    if (!imageUrl) continue;

    existingEvidences.push({
      evidenceId: evidence.evidence_id,
      rawPath: evidence.url,
      imageUrl,
      geoInfo: parseGeoInfo(evidence.geo_info ?? null),
    });
  }
  const displayName = getDisplayName(user, profile.name);

  return (
    <AppShell
      title="Editar registro"
      displayName={displayName}
      profilePhotoUrl={profilePhotoUrl}
      onLogout={logoutAction}
      contentClassName="relative flex min-h-0 flex-1 h-full w-full pt-4 overflow-hidden"
    >
      <RegistroForm
        mode="edit"
        source={sourceValue}
        backHref={buildBackHref(sourceValue, establishment.route_id)}
        routeOptions={[
          {
            id: route?.route_id ?? establishment.route_id,
            name: route?.nombre ?? `Ruta #${establishment.route_id}`,
          },
        ]}
        establishmentOptions={[
          {
            id: establishment.establishment_id,
            routeId: establishment.route_id,
            name: establishment.name,
          },
        ]}
        productOptions={[
          {
            id: product.product_id,
            name: product.name,
            sku: product.sku,
          },
        ]}
        productRelations={[
          {
            establishmentId: establishment.establishment_id,
            productId: product.product_id,
          },
        ]}
        activeRegistroRelations={[]}
        initialRouteId={establishment.route_id}
        initialEstablishmentId={establishment.establishment_id}
        initialProductId={product.product_id}
        initialSystemInventory={record.system_inventory ?? null}
        initialRealInventory={record.real_inventory ?? null}
        initialComments={record.comments ?? null}
        existingEvidences={existingEvidences}
        recordId={record.record_id}
        submitLabel="Actualizar registro"
        currentUserName={displayName}
      />
    </AppShell>
  );
}
