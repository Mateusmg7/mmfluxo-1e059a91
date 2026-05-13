-- Add PIN column to financial_profiles
ALTER TABLE public.financial_profiles 
ADD COLUMN pin TEXT;

-- Update the comment to describe the column
COMMENT ON COLUMN public.financial_profiles.pin IS 'Optional 4-digit PIN to protect access to the profile';
