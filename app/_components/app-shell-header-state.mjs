export function getAppShellHeaderState(pathname) {
  const isHome = pathname === "/home";

  return {
    isHome,
    showBackButton: !isHome,
    showHomeButton: !isHome,
  };
}
