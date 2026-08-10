import { createClient } from '@supabase/supabase-js';
import type { FurnitureItem } from './types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage = hasSupabaseConfig
  ? ''
  : 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env.local and to Vercel Environment Variables.';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'missing-anon-key',
);

// ─── Account auth ────────────────────────────────────────────────────────────
//
// A plain `users` table (username, password_hash) — not Supabase Auth, and
// not the pre-Supabase-Auth hand-rolled table either (that one hashed with
// SHA-256; see CODEBASE_STATUS.md for the "does the old table still exist"
// caveat). Hashing/verification happens entirely inside Postgres via the
// `create_user`/`verify_login` RPC functions (pgcrypto's bcrypt) — the
// client never sees a password_hash, only a user id back. Doing the bcrypt
// compare here in the browser instead would require SELECTing password_hash
// down to the client to compare against, which hands every hash to anyone
// who opens devtools — that's why this isn't a client-side bcrypt call.

export interface AuthUser {
  userId: string;
  username: string;
}

/** Throws with a message safe to show directly under the form field. Never
 *  includes the password. */
export async function createAccount(username: string, password: string): Promise<AuthUser> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);
  const { data, error } = await supabase.rpc('create_user', {
    p_username: username,
    p_password: password,
  });
  if (error) {
    if (error.message.includes('username_taken')) throw new Error('That username is already taken.');
    if (error.message.includes('password_too_short')) throw new Error('Password must be at least 6 characters.');
    if (error.message.includes('username_required')) throw new Error('Enter a username.');
    throw new Error('Could not create an account just now — try again.');
  }
  if (!data) throw new Error('Could not create an account just now — try again.');
  return { userId: data as string, username };
}

/** Generic failure message on purpose — never reveals whether the username
 *  itself exists, only whether the username+password pair matched. */
export async function logIn(username: string, password: string): Promise<AuthUser> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);
  const { data, error } = await supabase.rpc('verify_login', {
    p_username: username,
    p_password: password,
  });
  if (error) throw new Error('Something went wrong — try again.');
  if (!data) throw new Error('Incorrect username or password.');
  return { userId: data as string, username };
}

// ─── Saved session (resume-later layout) ─────────────────────────────────────
//
// One row per user_id — upserted, not appended — so "resume" always means
// "my most recent layout," with no session-history table to manage. Requires
// a `saved_sessions` table (see CODEBASE_STATUS.md for the exact DDL + RLS
// policies to run in the Supabase SQL editor — this client has no way to
// create it).

export interface SavedSessionRow {
  sessionId: string;
  items: FurnitureItem[];
  updatedAt: string;
}

export async function fetchSavedSession(userId: string): Promise<SavedSessionRow | null> {
  if (!hasSupabaseConfig) return null;

  const { data, error } = await supabase
    .from('saved_sessions')
    .select('session_id, layout_data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    sessionId: data.session_id as string,
    items: (data.layout_data as FurnitureItem[]) ?? [],
    updatedAt: data.updated_at as string,
  };
}

export async function saveSessionLayout(
  userId: string,
  sessionId: string,
  items: FurnitureItem[],
): Promise<void> {
  if (!hasSupabaseConfig) return;

  const { error } = await supabase
    .from('saved_sessions')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        layout_data: items,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

  if (error) throw new Error(error.message);
}

/** Insert a new participant and return their UUID */
export async function insertParticipant(
  participantNumber: string,
  building: string,
  unitType: string,
  smartphoneType: string,
): Promise<string> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { data, error } = await supabase
    .from('participants')
    .insert({
      participant_number: participantNumber,
      building,
      unit_type: unitType,
      smartphone_type: smartphoneType,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

/** Insert SUS survey responses (q1–q10 + computed score) */
export async function insertSusSurvey(
  participantId: string,
  responses: Record<string, number>,
  susScore: number,
): Promise<void> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { error } = await supabase.from('sus_responses').insert({
    participant_id: participantId,
    ...responses,
    sus_score: susScore,
  });

  if (error) throw error;
}

/** Insert post-survey responses */
export async function insertPostSurvey(
  participantId: string,
  responses: Record<string, unknown>,
): Promise<void> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { error } = await supabase.from('post_survey_responses').insert({
    participant_id: participantId,
    ...responses,
  });

  if (error) throw error;
}

