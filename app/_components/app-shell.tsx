"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type AppShellProps = {
  title: string;
  displayName: string;
  profilePhotoUrl?: string | null;
  onLogout: () => Promise<void>;
  children: ReactNode;
  contentClassName?: string;
};

const AVATAR_COLORS = [
  "#7C8745",
  "#0D3233",
  "#405C62",
  "#5A7984",
  "#8A9BA7",
];

function getInitial(displayName: string) {
  const clean = displayName.trim();
  if (!clean) return "U";
  return clean.charAt(0).toUpperCase();
}

function getAvatarColor(displayName: string) {
  const clean = displayName.trim();
  if (!clean) return AVATAR_COLORS[0];
  const total = clean
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

export default function AppShell({
  title,
  displayName,
  profilePhotoUrl,
  onLogout,
  children,
  contentClassName,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHome = pathname === "/home";

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[#E9EDE9]">
      <section className="relative flex min-h-dvh w-full flex-col bg-[#E9EDE9] p-4">
        <header className="flex h-[56px] w-full items-center justify-between rounded-[12px] bg-[#DDE2DD] px-3 py-2">
          <div className="flex items-center gap-2">
            {isHome ? (
              <Image
                src="/logo.png"
                alt="Reporteria"
                width={24}
                height={24}
                className="h-10 w-10 object-contain"
                priority
              />
            ) : (
              <button
                type="button"
                aria-label="Volver"
                onClick={() => router.back()}
                className="flex h-10 w-10 items-center justify-center border-0 bg-transparent p-0 text-[#0D3233]"
              >
                <ArrowLeft size={26} strokeWidth={3.5} />
              </button>
            )}
            <p className="m-0 text-[20px] leading-none font-normal text-[#0D3233]">
              {title}
            </p>
          </div>
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-[#0D3233]"
          >
            <span className="relative block h-[14px] w-[16px]">
              <span className="absolute top-0 block h-[2px] w-full bg-current" />
              <span className="absolute top-[6px] block h-[2px] w-full bg-current" />
              <span className="absolute top-[12px] block h-[2px] w-full bg-current" />
            </span>
          </button>
        </header>

        <div className={contentClassName ?? "flex min-h-0 flex-1 w-full flex-col gap-4 pt-4"}>
          {children}
        </div>

        {menuOpen ? (
          <div className="absolute inset-0 z-20 bg-[#00000033]">
            <button
              type="button"
              aria-label="Cerrar menu"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 border-0 bg-transparent p-0"
            />

            <div className="absolute top-0 right-0 z-30 flex w-[231px] flex-col gap-4 rounded-[12px] border border-[#B3B5B3] bg-[#E9EDE9] p-4">
              <div className="flex w-[199px] flex-col items-center gap-2">
                {profilePhotoUrl ? (
                  <div className="relative h-[72px] w-[72px] overflow-hidden rounded-full border border-[#B3B5B3] bg-white">
                    <Image
                      src={profilePhotoUrl}
                      alt="Foto de perfil"
                      fill
                      sizes="72px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#B3B5B3] text-[28px] leading-none font-semibold text-white"
                    style={{ backgroundColor: getAvatarColor(displayName) }}
                  >
                    {getInitial(displayName)}
                  </div>
                )}
                <p className="m-0 text-[16px] leading-none font-normal text-[#0D3233]">
                  {displayName}
                </p>
              </div>

              <div className="flex w-[199px] flex-col gap-3">
                <Link
                  href="/mi-perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full flex-col justify-center gap-1 rounded-[12px] bg-[#0D3233] p-3"
                >
                  <span className="text-[14px] leading-none font-normal text-white">
                    Mi perfil
                  </span>
                </Link>

                <form action={onLogout}>
                  <button
                    type="submit"
                    className="flex w-full cursor-pointer flex-col justify-center gap-1 rounded-[12px] border border-[#B3B5B3] bg-white p-3 text-left"
                  >
                    <span className="text-[14px] leading-none font-normal text-[#0D3233]">
                      Cerrar sesion
                    </span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
