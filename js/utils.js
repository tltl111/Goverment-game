// ============================================================
// UTILS — shared formatting helpers
// ============================================================

function fmt(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs < 1 && abs > 0) return sign + '$' + abs.toFixed(2) + 'M';
  return sign + '$' + Math.round(abs).toLocaleString() + 'M';
}

// Format a population value (stored as millions) as a readable string.
function fmtPop(millions) {
  if (millions >= 1000) return (millions / 1000).toFixed(1) + 'B';
  if (millions >= 100)  return Math.round(millions) + 'M';
  return millions.toFixed(1) + 'M';
}
