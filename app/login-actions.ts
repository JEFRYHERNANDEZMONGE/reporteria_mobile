"use server";

import { redirect } from "next/navigation";
import { isAllowedAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLoginActionState } from "./login-form-state.mjs";

export type LoginActionState = {
  error: string | null;
  success: boolean;
  resetPassword: boolean;
  passwordResetNonce: number;
  email?: string;
};

export async function loginAction(
  prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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

  if (password.length < 8) {
    return buildLoginActionState({
      prevState,
      error: "La contrasena debe tener al menos 8 caracteres.",
      email,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return buildLoginActionState({
      prevState,
      error: "No fue posible iniciar sesion con esas credenciales.",
      email,
      resetPassword: true,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildLoginActionState({
      prevState,
      error: "No fue posible validar la sesion del usuario.",
      email,
    });
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!isAllowedAppRole(profile?.role)) {
    await supabase.auth.signOut();
    return buildLoginActionState({
      prevState,
      error: "Acceso denegado. Solo usuarios admin o rutero pueden ingresar.",
      email,
    });
  }

  redirect("/home");
}
