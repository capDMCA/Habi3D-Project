import { createClient } from '@supabase/supabase-js';

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

// ─── User account functions ───────────────────────────────────────────────────
//
// Required Supabase table (run once in SQL Editor):
//
//   CREATE TABLE users (
//     id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//     username     TEXT UNIQUE NOT NULL,
//     password_hash TEXT NOT NULL,
//     unit_number  TEXT NOT NULL,
//     building     TEXT NOT NULL,
//     created_at   TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "users_all" ON users FOR ALL TO anon USING (true) WITH CHECK (true);

export interface UserRecord {
  id: string;
  username: string;
  unitNumber: string;
  building: string;
  createdAt: string;
}

/** SHA-256 hash via Web Crypto API (built-in, no dependencies) */
export async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Register a new user account. Throws if username is already taken. */
export async function registerUser(
  username: string,
  password: string,
  unitNumber: string,
  building: string,
): Promise<UserRecord> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash: passwordHash, unit_number: unitNumber, building })
    .select('id, username, unit_number, building, created_at')
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Username is already taken.');
    throw new Error(error.message);
  }

  return { id: data.id, username: data.username, unitNumber: data.unit_number, building: data.building, createdAt: data.created_at };
}

/** Verify credentials and return the user record, or null if not found / wrong password. */
export async function loginUser(
  username: string,
  password: string,
): Promise<UserRecord | null> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, unit_number, building, created_at')
    .eq('username', username)
    .eq('password_hash', passwordHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return { id: data.id, username: data.username, unitNumber: data.unit_number, building: data.building, createdAt: data.created_at };
}

/** Return all registered user accounts (admin use only). */
export async function getAllUsers(): Promise<UserRecord[]> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { data, error } = await supabase
    .from('users')
    .select('id, username, unit_number, building, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    unitNumber: row.unit_number,
    building: row.building,
    createdAt: row.created_at,
  }));
}

/** Permanently delete a user account by ID (admin use only). */
export async function deleteUser(userId: string): Promise<void> {
  if (!hasSupabaseConfig) throw new Error(supabaseConfigMessage);

  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw new Error(error.message);
}
