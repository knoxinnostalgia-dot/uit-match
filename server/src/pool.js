import { db } from './db.js';
import { GENDER_TO_PREFERENCE, SQL_AGE, calcAge } from './util.js';

export function gendersFor(preference) {
  if (preference === 'women') return ['woman'];
  if (preference === 'men') return ['man'];
  return ['woman', 'man', 'nonbinary'];
}

/**
 * Students the viewer is allowed to see: complete profiles, mutual attraction,
 * age windows, not already swiped, not blocked.
 */
export function listEligibleRows(userId, me) {
  const allowedGenders = gendersFor(me.interested_in);
  const genderPlaceholders = allowedGenders.map(() => '?').join(', ');
  const viewerAge = calcAge(me.birthdate);

  return db
    .prepare(
      `SELECT p.*,
              ${SQL_AGE} AS age
       FROM profiles p
       WHERE p.user_id != ?
         AND p.is_complete = 1
         AND p.gender IN (${genderPlaceholders})
         AND (p.interested_in = 'everyone' OR p.interested_in = ?)
         AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = ? AND s.target_id = p.user_id)
         AND NOT EXISTS (
               SELECT 1 FROM blocks b
               WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id)
                  OR (b.blocker_id = p.user_id AND b.blocked_id = ?)
             )
         AND ${SQL_AGE} BETWEEN ? AND ?
         AND ? BETWEEN p.min_age AND p.max_age
       ORDER BY RANDOM()
       LIMIT 60`,
    )
    .all(
      userId,
      ...allowedGenders,
      GENDER_TO_PREFERENCE[me.gender],
      userId,
      userId,
      userId,
      me.min_age,
      me.max_age,
      viewerAge,
    );
}

export function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}
