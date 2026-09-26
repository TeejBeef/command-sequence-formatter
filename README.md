# Survalent Command Sequence tools

Two pieces, for the `.seq` command-sequence language used in Survalent
SmartVU / SurvalentONE (DEFINE/DO WHILE/IF-THEN/ENDIF, `!` comments,
`.EQ.`/`.AND.`-style operators):

## 1. VS Code extension (`vscode-extension/`)

Gives you:
- Syntax highlighting for `.seq` / `.cmdseq` files (keywords, `!` comments,
  `"strings"`, `$variables`, `.AND.`/`.EQ.`-style operators, numbers, timespans
  like `5s`)
- A built-in formatter (Format Document / Format on Save) that re-indents
  based on `DO WHILE`/`ENDDO` and `IF...THEN`/`ELSE`/`ELSEIF`/`ENDIF` blocks

### Install (no publishing needed)
1. Copy the `vscode-extension` folder into your VS Code extensions directory:
   - macOS/Linux: `~/.vscode/extensions/survalent-command-sequence`
   - Windows: `%USERPROFILE%\.vscode\extensions\survalent-command-sequence`
2. Reload VS Code (Cmd/Ctrl+Shift+P → "Developer: Reload Window").
3. Open a `.seq` file — it should show "Survalent Command Sequence" in the
   bottom-right language picker. If it doesn't auto-detect, click the
   language picker and select it manually.
4. Right-click → "Format Document" to reindent, or enable
   `"editor.formatOnSave": true` in your settings (scoped to the
   `survalent` language if you want it only for these files):
   ```json
   "[survalent]": {
     "editor.formatOnSave": true
   }
   ```

Settings (Settings UI → search "survalent"):
- `survalent.format.indentSize` (default 4)
- `survalent.format.upperCaseKeywords` (default true — forces `DO WHILE`,
  `ENDIF`, etc. to uppercase on format)

Alternative to a manual copy: zip the `vscode-extension` folder's contents
and use "Install from VSIX" after packaging with `vsce package` if you'd
rather have a proper `.vsix` (requires `npm install -g @vscode/vsce`, then
`vsce package` inside `vscode-extension/`).

## 2. Standalone CLI formatter (`formatter/format-survalent.js`)

Same formatting logic, usable outside VS Code (CI, pre-commit hook, etc.),
with no dependencies beyond Node.js.

```bash
node format-survalent.js input.seq              # print formatted result
node format-survalent.js input.seq --write       # reformat in place
node format-survalent.js input.seq -o out.seq    # write to a new file
node format-survalent.js input.seq --indent 2    # 2-space indent
node format-survalent.js input.seq --no-upper-keywords
```

`sample.seq` in that folder is the "Restart DataExchange Server Only Once
per Event" example, useful for a quick sanity check.

## Notes / limitations

Both formatters are line-based, not a full parser. They recognize:
- Block openers: `DO WHILE(...)`, bare `DO`, `FOR(...)`, `IF (...) THEN`
- Block closers: `ENDDO`, `ENDFOR`, `ENDIF`
- Mid-block markers: `ELSE`, `ELSEIF(...)`

Anything else is left as-is and just re-indented to the current level. If
your dialect uses additional block constructs, add them to the `OPENERS` /
`CLOSERS` / `MID_MARKERS` arrays in `extension.js` and
`format-survalent.js` (same patterns, keep both files in sync).
