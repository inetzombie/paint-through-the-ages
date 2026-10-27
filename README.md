# Paint Through the Ages

Microsoft Paint across four eras of Windows, recreated as a dependency-free static web app.

| Route | Version |
|---|---|
| `/` | Version picker |
| `/win1` | Windows 1.0 Paint (1985, monochrome) |
| `/win2` | Windows 2.x Paint (1987, monochrome, overlapping windows) |
| `/win31` | Windows 3.1 Paintbrush (1992, 28 colors) |
| `/win95` | Windows 95 Paint (1995) |

Shared code lives in `lib/`: `engine.js` (op-based raster engine), `editor.js` (tools, input, undo, autosave), `app.js` (window chrome, menus, dialogs), `profiles.js` (per-era tools/menus/palettes). No build step.

© 2026 der_zuhalter — MIT License. Fan recreation; not affiliated with Microsoft.
