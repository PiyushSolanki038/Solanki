-- Populate missing quote numbers for existing quotes
-- This generates quote numbers in the format: QT-YYYYMMDD-XXXX

UPDATE public.quotes
SET quote_number = 'QT-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
WHERE quote_number IS NULL;

-- Create index on quote_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON public.quotes(quote_number);
