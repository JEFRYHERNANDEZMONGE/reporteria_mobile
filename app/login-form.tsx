"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getPasswordInputKey } from "./login-form-state.mjs";
import { loginAction, type LoginActionState } from "./login-actions";

const initialState: LoginActionState = {
  error: null,
  success: false,
  resetPassword: false,
  passwordResetNonce: 0,
  email: "",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      className="h-[44px] w-full cursor-pointer rounded-[12px] border-0 bg-[#0D3233] text-[16px] leading-none font-normal text-white transition-all duration-150 ease-out hover:-translate-y-px hover:bg-[#0B2B2C] active:translate-y-px active:bg-[#082122] disabled:cursor-not-allowed disabled:opacity-70"
      type="submit"
      disabled={isDisabled}
    >
      {pending ? "Ingresando..." : "Ingresar"}
    </button>
  );
}

function GoogleButton({
  disabled,
  isLoading,
  onClick,
}: {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      className="flex h-[44px] w-full cursor-pointer items-center justify-center gap-3 rounded-[12px] border border-[#B3B5B3] bg-white text-[14px] leading-none font-normal text-[#0D3233] transition-all duration-150 ease-out hover:-translate-y-px hover:border-[#9DA49E] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
      type="button"
      disabled={isDisabled}
      onClick={onClick}
    >
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
        <path
          fill="#EA4335"
          d="M9 7.364v3.49h4.85c-.213 1.122-.852 2.073-1.82 2.713l2.945 2.286c1.714-1.58 2.704-3.904 2.704-6.67 0-.639-.057-1.253-.164-1.84H9Z"
        />
        <path
          fill="#4285F4"
          d="M9 18c2.43 0 4.47-.805 5.96-2.147l-2.945-2.286c-.805.541-1.835.861-3.015.861-2.344 0-4.332-1.58-5.04-3.706H.917v2.36A8.998 8.998 0 0 0 9 18Z"
        />
        <path
          fill="#FBBC05"
          d="M3.96 10.722A5.413 5.413 0 0 1 3.679 9c0-.598.1-1.18.28-1.722V4.917H.917A8.999 8.999 0 0 0 0 9c0 1.45.348 2.82.917 4.083l3.043-2.361Z"
        />
        <path
          fill="#34A853"
          d="M9 3.572c1.321 0 2.507.455 3.443 1.342l2.582-2.581C13.465.889 11.425 0 9 0A8.998 8.998 0 0 0 .917 4.917l3.043 2.361C4.668 5.152 6.656 3.572 9 3.572Z"
        />
      </svg>
      {isLoading ? "Redirigiendo..." : "Continuar con Google"}
    </button>
  );
}

type LoginFormProps = {
  urlError?: string | null;
};

export default function LoginForm({ urlError = null }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [state, formAction] = useActionState(loginAction, initialState);
  const displayError = state.error ?? oauthError ?? urlError;

  const handleGoogleSignIn = async () => {
    setOauthError(null);
    setIsGooglePending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setOauthError("No fue posible completar el inicio de sesion con Google.");
        setIsGooglePending(false);
      }
    } catch {
      setOauthError("No fue posible completar el inicio de sesion con Google.");
      setIsGooglePending(false);
    }
  };

  return (
    <form
      className="flex w-full max-w-[360px] flex-col gap-4"
      action={(formData) => {
        setOauthError(null);
        return formAction(formData);
      }}
    >
      <div className="flex w-full items-center justify-center">
        <Image
          src="/logo-hm.webp"
          alt="Logo Reporteria"
          width={120}
          height={120}
          className="h-[120px] w-[120px] object-contain"
          priority
        />
      </div>

      <div className="flex w-full flex-col gap-[6px]">
        <label
          className="m-0 text-[12px] leading-none font-normal text-[#405C62]"
          htmlFor="email"
        >
          Correo
        </label>
        <input
          className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white px-3 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
          id="email"
          name="email"
          type="email"
          placeholder="usuario@empresa.com"
          autoComplete="email"
          defaultValue={state.email ?? ""}
          required
        />
      </div>

      <div className="flex w-full flex-col gap-[6px]">
        <label
          className="m-0 text-[14px] leading-none font-normal text-[#405C62]"
          htmlFor="password"
        >
          Contrasena
        </label>
        <div className="relative">
          <input
            key={getPasswordInputKey(state)}
            className="h-[44px] w-full rounded-[12px] border border-[#B3B5B3] bg-white pl-3 pr-10 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="********"
            autoComplete="current-password"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#8A9BA7]"
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {displayError ? (
        <p className="m-0 text-[12px] leading-[1.3] font-normal text-[#B42318]">
          {displayError}
        </p>
      ) : null}
      {state.success ? (
        <p className="m-0 text-[14px] leading-[1.3] font-normal text-[#0D3233]">
          Sesion iniciada correctamente.
        </p>
      ) : null}

      <SubmitButton disabled={isGooglePending} />
      <Link
        href="/login/olvide-contrasena"
        prefetch={false}
        className="text-center text-[12px] leading-none font-normal text-[#405C62] underline underline-offset-2"
      >
        Olvidaste tu contrasena?
      </Link>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#D5DDD8]" />
        <span className="text-[12px] leading-none font-normal text-[#8A9BA7]">o</span>
        <span className="h-px flex-1 bg-[#D5DDD8]" />
      </div>
      <GoogleButton
        disabled={isGooglePending}
        isLoading={isGooglePending}
        onClick={() => void handleGoogleSignIn()}
      />
    </form>
  );
}
