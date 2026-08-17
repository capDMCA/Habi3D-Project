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
// Plain Supabase Auth (`supabase.auth.signUp`/`signInWithPassword`) — not the
// custom `users` table + pgcrypto RPC pair this app used previously (see
// CODEBASE_STATUS.md Round 6 for that design; reversed here on explicit
// instruction back to standard Supabase behaviour). The app's UI only ever
// asks for a username, so a synthetic email (`${username}@habi3d.local`) is
// what's actually handed to Supabase Auth underneath — the real identity the
// rest of the app cares about is the returned `user.id` (`auth.uid()`), which
// flows into sessionStore exactly like the old custom-table id did.
//
// Requires "Confirm email" turned OFF in the Supabase project (Dashboard →
// Authentication → Sign In / Providers → Email). The synthetic domain can
// never receive a real confirmation link — with confirmation left on,
// signUp() would create the auth.users row but never establish a session,
// and every later RLS check against auth.uid() would silently fail.

export interface AuthUser {
  userId: string;
  username: string;
}

const SYNTHETIC_EMAIL_DOMAIN = 'habi3d.local';

/** Throws before ever constructing an email if the username itself contains
 *  "@" — otherwise `${username}@habi3d.local` could end up with two "@"
 *  signs and silently target a different (invalid) address. */
function buildSyntheticEmail(username: string): string {
  if (username.includes('@')) {
    throw new Error('Username cannot contain "@".');
  }
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** Throws with a message safe to show directly under the form field. Never
 *  includes the password. */
export async function createAccount(username: string, password: string): Promise<AuthUser> {
  const email = buildSyntheticEmail(username);
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists')) {
      throw new Error('That username is already taken.');
    }
    if (msg.includes('password')) throw new Error('Password must be at least 6 characters.');
    throw new Error('Could not create an account just now — try again.');
  }
  if (!data.user) throw new Error('Could not create an account just now — try again.');
  return { userId: data.user.id, username };
}

/** Generic failure message on purpose — Supabase Auth itself never reveals
 *  whether the underlying email/username exists, only whether the
 *  credentials matched. */
export async function logIn(username: string, password: string): Promise<AuthUser> {
  const email = buildSyntheticEmail(username);
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Incorrect username or password.');
  if (!data.user) throw new Error('Incorrect username or password.');
  return { userId: data.user.id, username };
}

// ─── Saved session (resume-later layout) ─────────────────────────────────────
//
// One row per user_id — upserted, not appended — so "resume" always means
// "my most recent layout," with no session-history table to manage. user_id
// now references auth.users(id) directly (real Supabase Auth), not the old
// custom `users` table. Requires a `saved_sessions` table with RLS keyed on
// auth.uid() = user_id — this client has no way to create it; run the SQL
// in the Supabase SQL editor manually.

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

