import { supabase } from './supabase';

/** Uploads a course file (image, audio, PDF, slides…) to the public course-media bucket; returns its public URL. */
export async function uploadMedia(file: File, folder: string): Promise<{ url?: string; error?: string }> {
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabase.storage.from('course-media').upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) return { error: error.message };
  return { url: supabase.storage.from('course-media').getPublicUrl(path).data.publicUrl };
}
