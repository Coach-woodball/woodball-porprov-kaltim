// Koneksi database online (Supabase). Kosongkan url untuk memakai aplikasi tanpa sinkron (hanya di perangkat).
// Kunci "anon" ini memang publik: akses data diatur oleh aturan keamanan (RLS) di database, bukan oleh kunci ini.
window.App = window.App || {};
App.CLOUD = {
  url: 'https://tehlgptjfefnjeemceoi.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaGxncHRqZmVmbmplZW1jZW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYxNjUsImV4cCI6MjEwOTI3MjE2NX0.FO42ZE2lqVhkRbrDo2mNLJIoiqBq0fJcNuhgeTiwG44',
};
