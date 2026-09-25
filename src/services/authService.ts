import { supabase } from './supabaseClient';

export async function registraUtente(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function loginUtente(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function logoutUtente() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback: (user: any) => void) {
  supabase.auth.getSession().then(({ data }) => {
    callback(data.session?.user ?? null);
  });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
