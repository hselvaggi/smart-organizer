import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `@tauri-apps/api/core::invoke` can't run in jsdom/happy-dom. Stub it so
// any code path that reaches the IPC boundary errors loudly with a clear
// message — individual tests should `vi.mock("@/lib/tauri")` instead and
// never hit this fallback.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    throw new Error(
      `@tauri-apps/api invoke("${cmd}") called from a test; mock @/lib/tauri instead.`,
    );
  }),
}));
