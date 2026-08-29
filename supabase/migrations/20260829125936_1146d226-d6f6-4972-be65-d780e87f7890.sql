CREATE TABLE public.password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX password_resets_mobile_idx ON public.password_resets (mobile, created_at DESC);
GRANT ALL ON public.password_resets TO service_role;
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;