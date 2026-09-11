export type Gender = 'woman' | 'man' | 'nonbinary';
export type Preference = 'women' | 'men' | 'everyone';
export type BudgetKey = 'free' | 'low' | 'medium';
export type VenueKey = 'campus' | 'nearby' | 'either';
export type SlotKey = 'l1' | 'l2' | 'l3' | 'lunch' | 'l4' | 'l5' | 'l6';

export interface Profile {
  userId: number;
  displayName: string;
  age: number;
  gender: Gender;
  major: string | null;
  studyYear: number | null;
  studySemester: number | null;
  bio: string;
  interests: string[];
  photos: string[];
}

export interface OwnProfile extends Profile {
  email: string;
  birthdate: string;
  interestedIn: Preference;
  minAge: number;
  maxAge: number;
  isComplete: boolean;
  freeTimeEnabled: boolean;
  budget: BudgetKey;
  venuePreference: VenueKey;
}

export interface OverlapSlot {
  day: number;
  slot: SlotKey;
  dayLabel: string;
  dayShort: string;
  slotLabel: string;
  slotRange?: string;
}

/**
 * `slots` is only populated once the two students have matched. Before that the
 * server sends the count and a coarse hint and nothing else.
 */
export interface FreeTimeInfo {
  available: boolean;
  overlapCount: number;
  hint: string | null;
  slots: OverlapSlot[];
}

export interface Compatibility {
  score: number;
  chips: string[];
  sharedInterests: string[];
  breakdown: {
    interests: number;
    academic: number;
    age: number;
    freeTime: number | null;
  };
}

export interface DeckCard extends Profile {
  likesMe: boolean;
  freeTime: FreeTimeInfo;
  compatibility: Compatibility;
  todayOverlap?: number;
  story?: string;
}

export interface Spark {
  fromMe: boolean;
  note: string;
  photoIndex: number | null;
}

export interface Admirer {
  userId: number;
  photo: string | null;
  teaser: string;
  overlapCount: number;
  hint: string | null;
}

export interface SerendipityMoment {
  matchId: number;
  name: string;
  slotLabel: string;
  slotRange?: string;
  endsInMinutes: number;
}

export interface RightNow {
  slotLabel: string;
  slotRange?: string;
  endsInMinutes: number;
}

export interface MatchSummary {
  id: number;
  createdAt: string;
  profile: Profile;
  freeTime: FreeTimeInfo;
  lastMessage: { body: string; mine: boolean; createdAt: string } | null;
  unread: number;
}

export interface DatePlan {
  id: number;
  activity: string;
  title: string;
  description: string;
  day: number | null;
  slot: SlotKey | null;
  budget: BudgetKey;
  venue: VenueKey;
  status: 'proposed' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
  proposedByMe: boolean;
}

export interface MatchDetail {
  id: number;
  createdAt: string;
  profile: Profile;
  freeTime: FreeTimeInfo;
  compatibility: Compatibility;
  sparks?: Spark[];
  rightNow?: RightNow | null;
  plans: DatePlan[];
}

export interface Message {
  id: number;
  body: string;
  mine: boolean;
  createdAt: string;
}

export interface DateIdea {
  activity: string;
  title: string;
  description: string;
  venue: VenueKey;
  budget: BudgetKey;
  slots: SlotKey[];
  suggestedDay: number | null;
  suggestedSlot: SlotKey | null;
  suggestedWhen: string | null;
  why: string;
}

export interface AvailabilityState {
  cells: { day: number; slot: SlotKey }[];
  enabled: boolean;
  budget: BudgetKey;
  venuePreference: VenueKey;
}

export interface Meta {
  majors: string[];
  studyYears: number[];
  studySemesters: number[];
  interests: string[];
  interestEmoji: Record<string, string>;
  days: { index: number; key: string; short: string; label: string }[];
  slots: { key: SlotKey; label: string; range: string; short: string; band?: string }[];
  activities: { key: string; emoji: string; label: string }[];
  budgets: { key: BudgetKey; label: string; note: string }[];
  venues: { key: VenueKey; label: string }[];
  allowedEmailDomains: string[];
  maxPhotos: number;
}
