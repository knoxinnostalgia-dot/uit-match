function givenName(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || 'them';
}

/**
 * A short campus story built from real overlap and shared interests — no model,
 * no invention of facts the student cannot already see on the card.
 */
export function chemistryStory({
  displayName,
  overlapCount,
  hint,
  todayCount,
  sameMajor,
  sharedInterests = [],
  score,
}) {
  const who = givenName(displayName);
  const lines = [];

  if (todayCount > 0) {
    lines.push(
      `You're both free today — ${todayCount} lecture gap${todayCount === 1 ? '' : 's'} already line up.`,
    );
  } else if (overlapCount > 0) {
    lines.push(
      `${overlapCount} free period${overlapCount === 1 ? '' : 's'} overlap this week${
        hint ? ` (${String(hint).toLowerCase()})` : ''
      }.`,
    );
  }

  if (sameMajor) lines.push('Same major. Same buildings. Maybe not the same lecture hall.');
  if (sharedInterests.length) {
    lines.push(`You both ticked ${sharedInterests.slice(0, 2).join(' and ')}.`);
  }
  if (!lines.length) {
    lines.push(`Campus is small. Today the deck still thought of ${who}.`);
  }

  lines.push(`${score}% compatible. That's a timetable with a crush, not a coincidence.`);
  return lines.join(' ');
}
