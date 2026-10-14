# 0010. User settings: one store, one read, one write

**Status:** Accepted

## Context

Every app needs a home for its first per-user preference, and the homes that look natural each cost more later (see Rejected). Two projects built from this template each built the same store on their own, so the template carries it.

## Decision

- **Storage:** one `userSettings` row per user (`by_userId`), every setting an optional field. A user who never changed a setting has no row.
- **Read:** every front reads through one query, `settings.getForCaller`, which fills in the defaults from the `DEFAULTS` object in `convex/settings.ts`. No row, a row without the field, and the default read the same, so a client never null-checks, and a default changes with no migration.
- **Write:** every front writes through one mutation, `settings.set({ setting: { key, value } })`. Its argument is a union with one member per key, so each key is tied to its value type at compile time and at run time, and one call changes one setting. A setting that needs a side effect gets a `switch (setting.key)` case in the handler, not a mutation of its own.
- **Web:** a control writes through `useSetSetting` (`apps/web/src/lib/use-set-setting.ts`), which holds the one optimistic update of `getForCaller`.
- **Other fronts:** a mobile app, an MCP server, or an extension reads and writes through the same query and mutation, never through a copy of its own.
- **Scope:** the store holds preferences that follow the user across devices. A value that belongs to one device (a window size, a local volume) stays on that device.

Adding a setting: an optional field in `convex/schema.ts`, its default in `DEFAULTS`, a line in `getForCaller`, a member of the union in `set`, and a control.

**Where a control sits is the project's choice.** The default is the place where the setting takes effect, and a `/settings` page that lists every setting is worth it once there are more than a handful. The template's first setting, `theme` (`"system"`, `"light"` or `"dark"`), takes effect on every page, so its control sits in `TopNav`; a project moves it to a menu or a page without touching this ADR.

## Consequences

- **Positive:** a new setting is four small edits and a control, and its schema change for a new setting only adds, so it reaches prod in one release (ADR 0008).
- **Positive:** the theme is part of the server render: the root loader fetches `getForCaller` for a signed-in user, `<html data-theme>` carries it, and the inline script in `apps/web/src/lib/theme.ts` turns it into the `dark` class before the first paint and follows the OS for `"system"`.
- **Accepted trade-off:** a signed-out visitor has no row and no control, and always follows the OS theme.
- **Accepted trade-off:** the root loader renders `"system"` when the theme fetch fails, so a cosmetic setting never breaks a page; a page that loads data still fails in its own loader.

## Rejected

- **`localStorage`:** it holds a value per device, the backend never sees it, and a server render cannot read it, so the page flashes.
- **A field on a domain table (`users`, say):** every setting gets its own read path, and removing one later takes three releases (widen, migrate, narrow).
- **A mutation per setting (`setTheme`, `setLanguage`, …):** boilerplate grows with each setting, while almost every setting is a plain value write.
