ALTER TABLE public.financial_profiles 
ADD COLUMN pin_reset_code TEXT,
ADD COLUMN pin_reset_expires TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.financial_profiles.pin_reset_code IS 'Temporary 6-digit code to reset profile PIN';
COMMENT ON COLUMN public.financial_profiles.pin_reset_expires IS 'Expiration time for the PIN reset code';