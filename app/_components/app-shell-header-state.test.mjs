import test from "node:test";
import assert from "node:assert/strict";

import { getAppShellHeaderState } from "./app-shell-header-state.mjs";

test("hides back and home shortcuts on the home route", () => {
  assert.deepEqual(getAppShellHeaderState("/home"), {
    isHome: true,
    showBackButton: false,
    showHomeButton: false,
  });
});

test("shows back and home shortcuts on non-home routes", () => {
  assert.deepEqual(getAppShellHeaderState("/mis-rutas/12/pendientes"), {
    isHome: false,
    showBackButton: true,
    showHomeButton: true,
  });
});
