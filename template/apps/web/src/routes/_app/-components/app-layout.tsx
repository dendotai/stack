import { Outlet } from "@tanstack/react-router";

// `TopNav` (__root) uses the same `container mx-auto px-4`, so nav and content
// line up only while both match — change them together. Landing and login
// render outside `_app`, so they keep their own full-screen layouts.
export function AppLayout() {
  return (
    <main className="min-h-screen py-6 sm:py-8">
      <div className="container mx-auto px-4">
        <Outlet />
      </div>
    </main>
  );
}
