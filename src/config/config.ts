import AppStorage from "@/redux/storage";
import { createClient } from "@supabase/supabase-js";

// Set in .env.local (git-ignored); see .env.example.
const supabaseUrl = "https://ygqrmtiiwwdrudqmnepn.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncXJtdGlpd3dkcnVkcW1uZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjg5NzEsImV4cCI6MjEwNzc0NDk3MX0.K460xAQWxK9yPMagMte5e-c5fVjVIlvNGJsQ_XVEepM";

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AppStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
