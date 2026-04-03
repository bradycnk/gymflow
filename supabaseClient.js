import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhoawtgvtehewwexatej.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2F3dGd2dGVoZXd3ZXhhdGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDAwMzksImV4cCI6MjA5MDYxNjAzOX0.PegFZhL2wzfBaGsNkkIHVRcQSH5jjztFPeNSFIiN7VA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
