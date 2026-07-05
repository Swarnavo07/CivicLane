// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL: string      = 'https://liqpbvrcpgitvkvqjtrw.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXBidnJjcGdpdHZrdnFqdHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MTI1NTIsImV4cCI6MjA4ODA4ODU1Mn0.oOlEUWIseiJRZYSJWURu_cH36CTnpsiVmJ6xGkOPORU';

if (!SUPABASE_URL.startsWith('https://') || SUPABASE_URL.includes('YOUR_PROJECT')) {
  console.warn('[CivicLane] ⚠️  Supabase URL not configured. Edit lib/supabase.ts');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);