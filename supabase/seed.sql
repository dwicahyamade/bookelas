-- supabase/seed.sql — demo data mirroring the previous fixture content.
insert into studios (id, name, wa_number, bank_info) values
  ('11111111-1111-1111-1111-111111111111', 'Zenith Pilates Studio', '+62 812-3456-7890', 'Bank BCA 123-456-7890 a.n. Zenith Studio')
on conflict (id) do nothing;

insert into classes (id, studio_id, title, description, capacity, price) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Mat Pilates — Reformer Intro', 'Sesi perkenalan ramah pemula. Fokus pada inti, pernapasan, dan pergerakan terkontrol di atas reformer.', 10, 150000),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Power Yoga', 'Aliran dinamis yang membangun kekuatan dan fleksibilitas. Minimal 6 bulan praktik yoga sebelumnya.', 12, 120000)
on conflict (id) do nothing;

insert into class_sessions (id, class_id, start_time, end_time, magic_token, status) values
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '2026-08-15 09:00:00+08', '2026-08-15 10:00:00+08', '11111111-1111-1111-1111-222222222222', 'SCHEDULED'),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', '2026-08-16 16:00:00+08', '2026-08-16 17:00:00+08', '11111111-1111-1111-1111-333333333333', 'SCHEDULED')
on conflict (id) do nothing;

insert into bookings (id, session_id, customer_name, customer_wa, customer_email, payment_proof_url, status, created_at) values
  ('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-444444444444', 'Sarah Aruna', '+628123456789', 'sarah@example.com', 'seed/sarah.png', 'APPROVED', '2026-08-09 09:15:00+08'),
  ('66666666-6666-6666-6666-000000000002', '44444444-4444-4444-4444-444444444444', 'Dimas Putra',  '+628123456790', 'dimas@example.com', 'seed/dimas.png', 'APPROVED', '2026-08-09 10:15:00+08'),
  ('66666666-6666-6666-6666-000000000003', '44444444-4444-4444-4444-444444444444', 'Nadia Kusuma','+628123456791', 'nadia@example.com', 'seed/nadia.png', 'APPROVED', '2026-08-09 11:15:00+08'),
  ('66666666-6666-6666-6666-000000000004', '44444444-4444-4444-4444-444444444444', 'Bima Satria', '+628123456792', 'bima@example.com',  'seed/bima.png',  'APPROVED', '2026-08-09 12:15:00+08'),
  ('66666666-6666-6666-6666-000000000005', '44444444-4444-4444-4444-444444444444', 'Alya Nirmala','+628123456793', 'alya@example.com',  'seed/alya.png',  'APPROVED', '2026-08-09 13:15:00+08'),
  ('66666666-6666-6666-6666-000000000006', '44444444-4444-4444-4444-444444444444', 'Raka Hadi',   '+628123456794', 'raka@example.com',  'seed/raka.png',  'APPROVED', '2026-08-09 14:15:00+08'),
  ('66666666-6666-6666-6666-000000000007', '44444444-4444-4444-4444-444444444444', 'Maya Lestari','+628123456795', 'maya@example.com',  'seed/maya.png',  'APPROVED', '2026-08-09 15:15:00+08'),
  ('66666666-6666-6666-6666-000000000008', '55555555-5555-5555-5555-555555555555', 'Rani Dewi',   '+628123456796', 'rani@example.com',  'seed/rani.png',  'PENDING', '2026-08-10 10:15:00+08')
on conflict (id) do nothing;

-- Private bucket; uploads/reads go through the service role (server) only.
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;
