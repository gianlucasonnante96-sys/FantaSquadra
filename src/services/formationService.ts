import { supabase } from './supabaseClient';
import { Player } from '../types';

/**
 * Salva la rosa dell'utente nel cloud.
 * Se esiste già, la sovrascrive (upsert).
 */
export async function salvaRosa(roster: Player[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Devi fare login per salvare la rosa');

  const { error } = await supabase
    .from('rose')
    .upsert(
      {
        user_id: userData.user.id,
        roster: roster,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}

/**
 * Carica la rosa dell'utente dal cloud.
 * Ritorna null se non c'è nessuna rosa salvata o nessun utente loggato.
 */
export async function caricaRosa(): Promise<Player[] | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('rose')
    .select('roster')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.roster) return null;

  return data.roster as Player[];
}
