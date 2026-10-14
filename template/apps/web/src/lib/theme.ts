// An inline script in <head>, so it runs before the first paint; as a bundled module it would run after the body renders, and a dark-mode visitor would see a white flash. The server renders the stored theme into `data-theme` on <html>; this script turns it into the `dark` class that `styles.css` keys on, and keeps it in step with the OS and with later changes to the attribute.
export const THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  const os = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const theme = root.dataset.theme;
    root.classList.toggle("dark", theme === "dark" || (theme !== "light" && os.matches));
  };
  apply();
  os.addEventListener("change", apply);
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
})();`;
