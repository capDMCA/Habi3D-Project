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
// Real Supabase Auth (auth.users), not a hand-rolled table — the previous
// login system (a custom `users` table with a SHA-256 password column) was
// deleted along with AuthScreen/AdminScreen when the project first went
// anonymous-only. This rebuilds auth from scratch on Supabase's own auth
// system rather than reviving that table.

export interface AuthUser {
  userId: string;
  email: string;
}

function toAuthUser(user: { id: string; email?: string | null }): AuthUser {
  return { userId: user.id, email: user.email ?? '' };
}

/** Throws with a message safe to show directly under the form field. */
export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Could not create an account just now — try again.');
  return toAuthUser(data.user);
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Could not log you in just now — try again.');
  return toAuthUser(data.user);
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

