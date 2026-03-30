"use server";

import { redirect } from "next/navigation";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServerEnv } from "@/lib/supabase/env";
import { buildLoginActionState } from "./login-form-state.mjs";

export type LoginActionState = {
  error: string | null;
  success: boolean;
  resetPassword: boolean;
  passwordResetNonce: number;
  email?: string;
};

function formatSupabaseLoginDebug(error: {
  code?: string;
  message?: string;
  status?: number;
}) {
  const parts = [
    error.code ? `code=${error.code}` : null,
    typeof error.status === "number" ? `status=${error.status}` : null,
    error.message ? `message=${error.message}` : null,
  ].filter(Boolean);

  return parts.length ? ` [debug: ${parts.join(" | ")}]` : " [debug: unknown-auth-error]";
}

export async function loginAction(
  prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseServerEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[loginAction] Missing Supabase env vars", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    });

    return buildLoginActionState({
      prevState,
      error: "Error de configuracion de autenticacion. Revisa variables de entorno.",
      email,
    });
  }

  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return buildLoginActionState({
      prevState,
      error: "Debes ingresar correo y contrasena.",
      email,
    });
  }

  if (password.length < 6) {
    return buildLoginActionState({
      prevState,
      error: "La contrasena debe tener al menos 6 caracteres.",
      email,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("[loginAction] signInWithPassword failed", {
      email,
      message: error.message,
      code: error.code,
      status: error.status,
      name: error.name,
    });

    return buildLoginActionState({
      prevState,
      error: `No fue posible iniciar sesion con esas credenciales.${formatSupabaseLoginDebug(error)}`,
      email,
      resetPassword: true,
    });
  }

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    console.error("[loginAction] getUser failed after login", {
      email,
      message: getUserError.message,
      code: getUserError.code,
      status: getUserError.status,
      name: getUserError.name,
    });
  }

  if (!user) {
    console.error("[loginAction] user missing after successful signInWithPassword", {
      email,
    });

    return buildLoginActionState({
      prevState,
      error: "No fue posible validar la sesion del usuario.",
      email,
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[loginAction] user_profile query failed", {
      email,
      authUserId: user.id,
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
    });
  }

  if (!isAllowedAppRole(profile?.role)) {
    console.warn("[loginAction] denied by app role policy", {
      email,
      authUserId: user.id,
      role: profile?.role ?? null,
    });

    await supabase.auth.signOut();
    return buildLoginActionState({
      prevState,
      error: "Acceso denegado. Solo usuarios admin o rutero pueden ingresar.",
      email,
    });
  }

  redirect("/home");
}
