// ============================================================
// UTILS — shared formatting helpers
// ============================================================

function fmt(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs < 1 && abs > 0) return sign + '$' + abs.toFixed(2) + 'M';
  return sign + '$' + Math.round(abs).toLocaleString() + 'M';
}
