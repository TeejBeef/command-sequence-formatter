#!/usr/bin/env node
/**
 * format-survalent.js
 *
 * A standalone reformatter for Survalent Command Sequence language
 * (the DO WHILE / IF / DEFINE-style scripting language used in
 * Survalent SmartVU / SurvalentONE command sequences).
 *
 * Usage:
 *   node format-survalent.js input.seq            -> prints formatted result to stdout
 *   node format-survalent.js input.seq --write     -> reformats the file in place
 *   node format-survalent.js input.seq -o out.seq  -> writes result to a new file
 *
 * What it does:
 *   - Re-indents based on block-opening / block-closing keywords
 *       DO WHILE(...)         ... ENDDO
 *       IF (...)              ... ENDIF   (with optional ELSE / ELSEIF)
 *       FOR (...)             ... ENDFOR  (if used in your dialect)
 *   - Normalizes indent width (default 4 spaces, configurable with --indent N)
 *   - Uppercases known reserved keywords (DEFINE, DO, WHILE, ENDDO, IF, THEN,
 *     ELSE, ELSEIF, ENDIF, STOP, START, DELAY, FOR, ENDFOR) so mixed-case
 *     source is normalized consistently -- disable with --no-upper-keywords
 *   - Leaves comments (lines/trailing text starting with "!") untouched in
 *     content, just re-indented with the surrounding code
 *   - Collapses runs of blank lines to at most one
 *   - Trims trailing whitespace
 *
 * This is a line-based formatter, not a full parser -- it is intentionally
 * conservative: if it doesn't recognize a construct it leaves the line's
 * content alone and just applies the current indent level.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---- CLI args -------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    write: false,
    indent: 4,
    upperKeywords: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write' || a === '-w') {
      args.write = true;
    } else if (a === '-o' || a === '--output') {
      args.output = argv[++i];
    } else if (a === '--indent') {
      args.indent = parseInt(argv[++i], 10) || 4;
    } else if (a === '--no-upper-keywords') {
      args.upperKeywords = false;
    } else if (a === '-h' || a === '--help') {
      printHelpAndExit();
    } else if (!args.input) {
      args.input = a;
    }
  }

  if (!args.input) {
    printHelpAndExit(1);
  }

  return args;
}

function printHelpAndExit(code = 0) {
  console.log(`Usage: format-survalent.js <input.seq> [options]

Options:
  -o, --output <file>     Write formatted output to <file> instead of stdout
  -w, --write             Reformat the input file in place
      --indent <n>        Indent width in spaces (default: 4)
      --no-upper-keywords Do not force-uppercase reserved keywords
  -h, --help               Show this help
`);
  process.exit(code);
}

// ---- Keyword tables ---------------------------------------------------

// Keywords that are normalized to uppercase when found as whole words.
const KEYWORDS = [
  'DEFINE', 'FLOAT', 'INTEGER', 'STRING',
  'DO', 'WHILE', 'ENDDO',
  'IF', 'THEN', 'ELSE', 'ELSEIF', 'ENDIF',
  'FOR', 'ENDFOR', 'NEXT',
  'STOP', 'START', 'DELAY',
  'AND', 'OR', 'NOT', 'EQ', 'NE', 'LT', 'LE', 'GT', 'GE',
];

// Lines that OPEN a block: indent increases for everything after this line.
const OPENERS = [
  /^DO\s+WHILE\s*\(/i,
  /^DO\s*$/i,
  /^FOR\s*\(/i,
  /^IF\s*\(.*\)\s*THEN\s*$/i, // block-if (THEN with no single-line body)
];

// Lines that CLOSE a block: indent decreases for this line itself.
const CLOSERS = [
  /^ENDDO\b/i,
  /^ENDFOR\b/i,
  /^ENDIF\b/i,
];

// Lines that DEDENT-then-REINDENT (mid-block markers): this line sits one
// level shallower than the block body, but body continues after it.
const MID_MARKERS = [
  /^ELSE\b/i,
  /^ELSEIF\s*\(/i,
];

// ---- Formatting core ----------------------------------------------------

function upperKeywordsInLine(line, enabled) {
  if (!enabled) return line;

  // Don't touch anything after a "!" comment marker, and don't touch
  // contents of quoted strings.
  let result = '';
  let i = 0;
  let inString = false;
  let buf = '';

  const flushBuf = () => {
    if (buf) {
      result += buf.replace(/\b([A-Za-z]+)\b/g, (m) => {
        const upper = m.toUpperCase();
        return KEYWORDS.includes(upper) ? upper : m;
      });
      buf = '';
    }
  };

  while (i < line.length) {
    const ch = line[i];

    if (ch === '!' && !inString) {
      flushBuf();
      result += line.slice(i); // rest of line is a comment, keep verbatim
      return result;
    }

    if (ch === '"') {
      flushBuf();
      inString = !inString;
      result += ch;
      i++;
      continue;
    }

    if (inString) {
      result += ch;
      i++;
      continue;
    }

    buf += ch;
    i++;
  }
  flushBuf();
  return result;
}

function isOpener(trimmed) {
  return OPENERS.some((re) => re.test(trimmed));
}

function isCloser(trimmed) {
  return CLOSERS.some((re) => re.test(trimmed));
}

function isMidMarker(trimmed) {
  return MID_MARKERS.some((re) => re.test(trimmed));
}

function formatSource(source, opts) {
  const indentUnit = ' '.repeat(opts.indent);
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');

  let level = 0;
  const outLines = [];
  let blankRun = 0;

  for (let rawLine of rawLines) {
    let line = rawLine.replace(/[ \t]+$/g, ''); // trim trailing whitespace
    const trimmed = line.trim();

    if (trimmed === '') {
      blankRun++;
      if (blankRun <= 1) outLines.push('');
      continue;
    }
    blankRun = 0;

    const normalized = upperKeywordsInLine(trimmed, opts.upperKeywords);

    let thisLineLevel = level;

    if (isCloser(normalized)) {
      level = Math.max(0, level - 1);
      thisLineLevel = level;
    } else if (isMidMarker(normalized)) {
      thisLineLevel = Math.max(0, level - 1);
      // level stays the same: body after ELSE/ELSEIF is still indented
    }

    outLines.push(indentUnit.repeat(thisLineLevel) + normalized);

    if (isOpener(normalized)) {
      level++;
    }
  }

  // Trim trailing blank lines, ensure single trailing newline.
  while (outLines.length && outLines[outLines.length - 1] === '') {
    outLines.pop();
  }

  return outLines.join('\n') + '\n';
}

// ---- Entry point ----------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  const inputPath = path.resolve(args.input);
  const source = fs.readFileSync(inputPath, 'utf8');

  const formatted = formatSource(source, args);

  if (args.write) {
    fs.writeFileSync(inputPath, formatted, 'utf8');
    console.error(`Formatted in place: ${inputPath}`);
  } else if (args.output) {
    fs.writeFileSync(path.resolve(args.output), formatted, 'utf8');
    console.error(`Formatted output written to: ${args.output}`);
  } else {
    process.stdout.write(formatted);
  }
}

main();
