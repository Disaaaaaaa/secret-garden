/*
  Project settings.
  ------------------------------------------------------------
  The game works without any server: progress and research data
  are saved in the browser (localStorage).

  For a real class study (many devices), fill in Supabase keys below.
  Then every anonymous result is also saved in the Supabase database
  and the /research dashboard reads all participants from there.
  See README.md → "Supabase" for the table setup.
*/
window.SG_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcd1234.supabase.co'
  supabaseAnonKey: '',  // the public "anon" key (never the service key)
  supabaseTable: 'participants'
};
