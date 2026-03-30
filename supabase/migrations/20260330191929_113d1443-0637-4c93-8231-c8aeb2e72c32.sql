
ALTER TABLE public.profiles 
ADD COLUMN notif_interval_hours integer NOT NULL DEFAULT 9,
ADD COLUMN last_push_sent_at timestamptz;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
