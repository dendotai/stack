- **Chrome may be unselectable, content may not**
  ([apps/web/CLAUDE.md](apps/web/CLAUDE.md)): buttons, grips, chips and other
  affordances can take `select-none`; anything the user might copy (titles,
  descriptions, ids, error messages, URLs) must stay selectable, and any
  pattern that suppresses selection as a side effect gets an explicit check.
  Touch suppressions are scoped with `pointer-coarse:`. Records the
  `@atlaskit/pragmatic-drag-and-drop` gotcha: `draggable()` sets
  `draggable="true"` on the registered element, which blocks text selection in
  the whole subtree even with `dragHandle`; set `draggable={false}` on the
  inner content container, or register the handle element itself with a custom
  drag preview. To apply: copy the "Selection" section into
  `apps/web/CLAUDE.md`.
