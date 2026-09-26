// extension.js
// Registers a DocumentFormattingEditProvider for the "survalent" language,
// using the same block-indentation logic as the standalone
// format-survalent.js CLI script.

const vscode = require('vscode');

const KEYWORDS = [
  'DEFINE', 'FLOAT', 'INTEGER', 'STRING',
  'DO', 'WHILE', 'ENDDO',
  'IF', 'THEN', 'ELSE', 'ELSEIF', 'ENDIF',
  'FOR', 'ENDFOR', 'NEXT',
  'STOP', 'START', 'DELAY',
  'AND', 'OR', 'NOT', 'EQ', 'NE', 'LT', 'LE', 'GT', 'GE',
];

const OPENERS = [
  /^DO\s+WHILE\s*\(/i,
  /^DO\s*$/i,
  /^FOR\s*\(/i,
  /^IF\s*\(.*\)\s*THEN\s*$/i,
];

const CLOSERS = [
  /^ENDDO\b/i,
  /^ENDFOR\b/i,
  /^ENDIF\b/i,
];

const MID_MARKERS = [
  /^ELSE\b/i,
  /^ELSEIF\s*\(/i,
];

function upperKeywordsInLine(line, enabled) {
  if (!enabled) return line;

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
      result += line.slice(i);
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

function isOpener(t) { return OPENERS.some((re) => re.test(t)); }
function isCloser(t) { return CLOSERS.some((re) => re.test(t)); }
function isMidMarker(t) { return MID_MARKERS.some((re) => re.test(t)); }

function formatSource(source, indentSize, upperCaseKeywords) {
  const indentUnit = ' '.repeat(indentSize);
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');

  let level = 0;
  const outLines = [];
  let blankRun = 0;

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/[ \t]+$/g, '');
    const trimmed = line.trim();

    if (trimmed === '') {
      blankRun++;
      if (blankRun <= 1) outLines.push('');
      continue;
    }
    blankRun = 0;

    const normalized = upperKeywordsInLine(trimmed, upperCaseKeywords);

    let thisLineLevel = level;

    if (isCloser(normalized)) {
      level = Math.max(0, level - 1);
      thisLineLevel = level;
    } else if (isMidMarker(normalized)) {
      thisLineLevel = Math.max(0, level - 1);
    }

    outLines.push(indentUnit.repeat(thisLineLevel) + normalized);

    if (isOpener(normalized)) {
      level++;
    }
  }

  while (outLines.length && outLines[outLines.length - 1] === '') {
    outLines.pop();
  }

  return outLines.join('\n') + '\n';
}

function activate(context) {
  const provider = vscode.languages.registerDocumentFormattingEditProvider(
    'survalent',
    {
      provideDocumentFormattingEdits(document) {
        const config = vscode.workspace.getConfiguration('survalent.format');
        const indentSize = config.get('indentSize', 4);
        const upperCaseKeywords = config.get('upperCaseKeywords', true);

        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );

        const formatted = formatSource(
          document.getText(),
          indentSize,
          upperCaseKeywords
        );

        return [vscode.TextEdit.replace(fullRange, formatted)];
      },
    }
  );

  context.subscriptions.push(provider);
}

function deactivate() {}

module.exports = { activate, deactivate };
