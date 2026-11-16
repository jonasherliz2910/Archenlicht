// Browsing a closed live shop can use preview or released designs. Payment and
// fulfillment must always request the exact order mode (test or live).
export function approvalModeMatches(approvalMode, mode) {
  if (mode === 'preview') return approvalMode === 'test' || approvalMode === 'live';
  return (mode === 'test' || mode === 'live') && approvalMode === mode;
}
