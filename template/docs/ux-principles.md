# UX principles

These principles hold by default. To deviate, ask the user first and give the reason; once the user agrees, write the reason in a comment at the place in the code.

## Actions that take an item away

- **Confirm first.** An action that takes an item away from where the user put it (delete, archive, a move to another list) asks first. The confirm dialog names the item and the result: "Delete 'Buy milk'?". The confirm button has focus, so the shortcut key followed by Enter completes the action. The reason: in a list the user ordered by hand, the item's position is data the action loses, and one key press is easy to hit by accident.
- **Shift skips the dialog**, on the shortcut key or on the click. Shift, not Cmd, Ctrl or Alt: it is the known skip-the-confirmation key (Shift+Delete), browsers never claim Shift plus a letter, and it works the same on every keyboard layout.
- **Show the Shift skip where it fits**: in the confirm dialog itself ("Hold Shift to skip this next time"), in the app's shortcuts list, or in a tooltip on the button. Each app picks the place, and an app may hide the skip only with a reason it writes down.
- **Focus moves to the next row** when a row leaves the list (the row before it when the row was the last), so repeated actions keep working from the keyboard. Two details: the confirm dialog's close returns focus to the button that opened it, which left with its row, so the code overrides that; and the code captures the next row before the row is removed, because the list redraws at once.
- **Same behaviour wherever the action appears**: a list row, a menu, an edit dialog, an edit page. The same confirm, Shift skip and Undo apply in every place; one function per action holds them, and every button and shortcut calls it.
- **Undo toast.** Every action that takes an item away shows a toast with an Undo button for a few seconds. Undo puts the item back exactly as it was, in its old list and at its old position. Delete therefore only marks the item as deleted, so Undo can bring it back; the final removal happens later, or never.
