import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// Shared frame for the signed-in app routes (everything under `_app`, e.g.
// /home). Centered content via Tailwind's `container mx-auto px-4`; `TopNav`
// (__root) uses the same classes so nav and content line up. Landing/login
// render outside this layout, so they keep their own full-screen layouts.
function AppLayout() {
  return (
    <main className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4">
        <Outlet />
      </div>
    </main>
  );
}
