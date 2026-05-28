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
