ALTER TABLE public.profiles 
ALTER COLUMN notif_interval_hours TYPE numeric USING notif_interval_hours::numeric;

COMMENT ON COLUMN public.profiles.notif_interval_hours IS 'Intervalo em horas entre notificações automáticas (permite valores decimais)';