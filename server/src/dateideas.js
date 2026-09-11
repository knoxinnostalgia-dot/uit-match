import { BUDGET_ORDER, DAYS, SLOTS } from './config.js';

const DAY_LABEL = Object.fromEntries(DAYS.map((d) => [d.index, d.label]));
const SLOT_WHEN = Object.fromEntries(SLOTS.map((s) => [s.key, `${s.short} (${s.range})`]));

/**
 * Ideas are deliberately described by kind of place ("a café near the gate")
 * rather than a named address, so a suggestion never pins either student to an
 * exact location.
 */
const IDEAS = [
  // Coffee
  { activity: 'coffee', title: 'Canteen coffee break', description: 'Grab a coffee between lectures and see how the conversation goes. Low pressure, easy to leave, easy to stay.', venue: 'campus', budget: 'free', slots: ['l2', 'l3', 'lunch'], tags: ['Coffee'] },
  { activity: 'coffee', title: 'Milk tea run near the gate', description: 'Walk out to a tea shop near campus and split an order of snacks.', venue: 'nearby', budget: 'low', slots: ['lunch', 'l6'], tags: ['Coffee', 'Street food'] },
  { activity: 'coffee', title: 'Café with laptops open', description: 'Half study, half talking. Good if you both want company without a full date.', venue: 'nearby', budget: 'low', slots: ['l4', 'l5'], tags: ['Coffee', 'Coding', 'Reading'] },
  { activity: 'coffee', title: 'Coffee before the first lecture', description: 'An early start together, then you both head to class.', venue: 'campus', budget: 'low', slots: ['l1'], tags: ['Coffee'] },

  // Food
  { activity: 'food', title: 'Street food crawl near campus', description: 'Pick three stalls, share everything, rank them at the end.', venue: 'nearby', budget: 'low', slots: ['l6'], tags: ['Street food', 'Cooking'] },
  { activity: 'food', title: 'Lunch at the canteen', description: 'The most normal possible first meet. One of you pays, the other pays next time.', venue: 'campus', budget: 'free', slots: ['lunch'], tags: ['Street food'] },
  { activity: 'food', title: 'Cook something together', description: 'Split the shopping, cook one dish, argue about seasoning.', venue: 'nearby', budget: 'low', slots: ['l6'], tags: ['Cooking'] },
  { activity: 'food', title: 'Try a noodle shop neither of you has been to', description: 'Pick somewhere new to both of you so it is a shared first.', venue: 'nearby', budget: 'medium', slots: ['lunch', 'l6'], tags: ['Street food', 'Travelling'] },

  // Movie
  { activity: 'movie', title: 'Cinema trip', description: 'Catch whatever is showing and get food after so you have something to talk about.', venue: 'nearby', budget: 'medium', slots: ['l6'], tags: ['Movies'] },
  { activity: 'movie', title: 'Laptop movie on campus', description: 'One laptop, two pairs of headphones, a quiet corner of the common area after lectures.', venue: 'campus', budget: 'free', slots: ['l6'], tags: ['Movies', 'Anime'] },
  { activity: 'movie', title: 'Anime episode marathon', description: 'Pick a short series and get through the first season together.', venue: 'campus', budget: 'free', slots: ['l6'], tags: ['Anime', 'Movies'] },
  { activity: 'movie', title: 'Film club screening', description: 'Go to a student screening so there are other people around if it is your first meet.', venue: 'campus', budget: 'free', slots: ['l5', 'l6'], tags: ['Movies'] },

  // Campus walk
  { activity: 'walk', title: 'Loop around campus after class', description: 'A slow walk and a proper conversation. Costs nothing, ends whenever you want.', venue: 'campus', budget: 'free', slots: ['l6'], tags: ['Cycling', 'Gym'] },
  { activity: 'walk', title: 'Sunset walk near campus', description: 'Head out after Lecture 6 and take the long way back.', venue: 'nearby', budget: 'free', slots: ['l6'], tags: ['Photography', 'Travelling'] },
  { activity: 'walk', title: 'Photo walk', description: 'One roll, one phone, whoever takes the worst photo buys tea.', venue: 'campus', budget: 'free', slots: ['l4', 'l5'], tags: ['Photography'] },
  { activity: 'walk', title: 'Morning walk before lectures', description: 'Quiet campus, no crowds, and you are both on time for Lecture 1 after.', venue: 'campus', budget: 'free', slots: ['l1'], tags: ['Gym'] },

  // Study together
  { activity: 'study', title: 'Library study session', description: 'Sit together, work separately, take breaks at the same time.', venue: 'campus', budget: 'free', slots: ['l1', 'l2', 'l3', 'l4'], tags: ['Reading'] },
  { activity: 'study', title: 'Pair programming on a side project', description: 'Bring one small idea each and build whichever sounds worse.', venue: 'campus', budget: 'free', slots: ['l4', 'l5', 'l6'], tags: ['Coding', 'AI/ML', 'Startups'] },
  { activity: 'study', title: 'Exam revision swap', description: 'Teach each other the topic you are each best at.', venue: 'campus', budget: 'free', slots: ['lunch', 'l5', 'l6'], tags: ['Reading', 'Coding'] },
  { activity: 'study', title: 'Hackathon prep sprint', description: 'Sketch a project you could actually submit together.', venue: 'campus', budget: 'free', slots: ['l5', 'l6'], tags: ['Hackathons', 'Startups', 'Coding'] },

  // Gaming
  { activity: 'gaming', title: 'Co-op session in the common room', description: 'One screen, two controllers, no talking required until you want to.', venue: 'campus', budget: 'free', slots: ['l6'], tags: ['Gaming'] },
  { activity: 'gaming', title: 'Duo queue on mobile', description: 'Start remote, meet up after if it goes well.', venue: 'campus', budget: 'free', slots: ['lunch', 'l6'], tags: ['Gaming'] },
  { activity: 'gaming', title: 'Board games at the canteen', description: 'Chess or cards over lunch or a free afternoon lecture.', venue: 'campus', budget: 'free', slots: ['lunch', 'l4', 'l5'], tags: ['Chess', 'Gaming'] },
  { activity: 'gaming', title: 'Gaming café after lectures', description: 'Better machines, worse lighting, more fun.', venue: 'nearby', budget: 'low', slots: ['l6'], tags: ['Gaming'] },

  // University event
  { activity: 'event', title: 'Departmental tech talk', description: 'Go to a talk together and pick it apart afterwards over tea.', venue: 'campus', budget: 'free', slots: ['l4', 'l5'], tags: ['Coding', 'AI/ML', 'Startups'] },
  { activity: 'event', title: 'Student club showcase', description: 'Plenty to look at and easy to walk away from if it is awkward.', venue: 'campus', budget: 'free', slots: ['l4', 'lunch'], tags: ['Volunteering', 'Startups'] },
  { activity: 'event', title: 'Campus music night', description: 'Live student bands, no need to fill every silence.', venue: 'campus', budget: 'free', slots: ['l6'], tags: ['Music', 'Guitar', 'K-pop', 'Dancing'] },
  { activity: 'event', title: 'Art and photography exhibition', description: 'Walk it slowly and argue about which piece is overrated.', venue: 'campus', budget: 'free', slots: ['l4', 'l5'], tags: ['Painting', 'Photography'] },
];

export function formatWhen(cell) {
  if (!cell) return null;
  return `${DAY_LABEL[cell.day]} ${SLOT_WHEN[cell.slot] || cell.slotLabel || cell.slot}`;
}

/**
 * Ranks ideas for one activity against what the two students actually have in
 * common: shared interests, when they are both free, budget and venue.
 */
export function suggestDateIdeas({
  activity,
  sharedInterests = [],
  overlapSlots = [],
  budget = 'medium',
  venue = 'either',
  limit = 4,
}) {
  const budgetCeiling = BUDGET_ORDER[budget] ?? BUDGET_ORDER.medium;
  const sharedSet = new Set(sharedInterests.map((i) => i.toLowerCase()));
  const overlapSlotKeys = new Set(overlapSlots.map((c) => c.slot));

  const scored = IDEAS.filter((idea) => idea.activity === activity)
    .filter((idea) => (BUDGET_ORDER[idea.budget] ?? 0) <= budgetCeiling)
    .map((idea) => {
      const matchedTags = idea.tags.filter((t) => sharedSet.has(t.toLowerCase()));
      const slotFits = idea.slots.some((s) => overlapSlotKeys.has(s));
      const venueFits = venue === 'either' || idea.venue === venue;

      let score = 0;
      score += matchedTags.length * 2;
      if (slotFits) score += 1.5;
      if (venueFits) score += 1;
      if ((BUDGET_ORDER[idea.budget] ?? 0) <= budgetCeiling) score += 0.5;

      // Prefer a shared free period that suits this idea's time of day.
      const when =
        overlapSlots.find((c) => idea.slots.includes(c.slot)) || overlapSlots[0] || null;

      const why = [];
      if (matchedTags.length) why.push(`you both like ${matchedTags.join(' and ')}`);
      if (slotFits && when) why.push(`you are both free on ${formatWhen(when)}`);
      if (venueFits && venue !== 'either') why.push(venue === 'campus' ? 'stays on campus' : 'just off campus');

      return {
        ...idea,
        score,
        suggestedDay: when?.day ?? null,
        suggestedSlot: when?.slot ?? null,
        suggestedWhen: formatWhen(when),
        why: why.length ? `Because ${why.join(', and ')}.` : 'A safe, easy first meet.',
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ score, tags, ...rest }) => rest);
}
