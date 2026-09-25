import { supabase } from './supabaseClient';
import { Formation } from '../types';

export async function salvaFormazione(
  giornata: number,
  formation: Formation,
  lockedIds: string[],
  nome: string = 'La mia formazione'
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Devi fare login per salvare la formazione');

  const { error } = await supabase.from('formazioni').upsert({
    user_id: userData.user.id,
    giornata,
    nome,
    modulo: formation.modulo,
    slots: formation.slots,
    bench: formation.bench,
    total_score: formation.totalScore,
    locked_ids: lockedIds,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,giornata' });

  if (error) throw error;
}

export async function caricaFormazione(giornata: number) {
  const { data, error } = await supabase
    .from('formazioni')
    .select('*')
    .eq('giornata', giornata)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function caricaTutteFormazioni() {
  const { data, error } = await supabase
    .from('formazioni')
    .select('*')
    .order('giornata', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
