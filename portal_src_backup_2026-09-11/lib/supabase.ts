import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Save dashboard configuration to Supabase
 */
export async function saveDashboardConfig(
  userId: string,
  widgets: any[],
  layout: any[],
  theme: string
) {
  const { data, error } = await supabase
    .from('dashboard_config')
    .upsert({
      user_id: userId,
      widgets,
      layout,
      theme,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
  return data;
}

/**
 * Load dashboard configuration from Supabase
 */
export async function loadDashboardConfig(userId: string) {
  const { data, error } = await supabase
    .from('dashboard_config')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Save note
 */
export async function saveNote(userId: string, content: string) {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      content,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
  return data;
}

/**
 * Get user's notes
 */
export async function getNotes(userId: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Save quick link
 */
export async function saveQuickLink(
  userId: string,
  label: string,
  url: string
) {
  const { data, error } = await supabase
    .from('quick_links')
    .insert({
      user_id: userId,
      label,
      url,
    });

  if (error) throw error;
  return data;
}

/**
 * Get user's quick links
 */
export async function getQuickLinks(userId: string) {
  const { data, error } = await supabase
    .from('quick_links')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

/**
 * Delete quick link
 */
export async function deleteQuickLink(userId: string, linkId: string) {
  const { error } = await supabase
    .from('quick_links')
    .delete()
    .eq('user_id', userId)
    .eq('id', linkId);

  if (error) throw error;
}
