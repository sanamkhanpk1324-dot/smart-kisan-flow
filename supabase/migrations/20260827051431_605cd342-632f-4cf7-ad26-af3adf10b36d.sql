
-- ROLES
CREATE TYPE public.app_role AS ENUM ('farmer','admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  farmer_id text NOT NULL DEFAULT '',
  village text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  crop text NOT NULL DEFAULT '',
  land_size numeric NOT NULL DEFAULT 0,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_farmer_id_key ON public.profiles (lower(farmer_id)) WHERE farmer_id <> '';
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CENTRES
CREATE TABLE public.centres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  capacity_per_slot int NOT NULL DEFAULT 10,
  avg_minutes_per_farmer int NOT NULL DEFAULT 6,
  now_serving text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.centres TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.centres TO authenticated;
GRANT ALL ON public.centres TO service_role;
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "centres readable" ON public.centres FOR SELECT TO authenticated USING (true);
CREATE POLICY "centres admin write" ON public.centres FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SLOTS
CREATE TABLE public.slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity int NOT NULL DEFAULT 10,
  booked_count int NOT NULL DEFAULT 0,
  is_open boolean NOT NULL DEFAULT true,
  UNIQUE (centre_id, slot_date, start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slots TO authenticated;
GRANT ALL ON public.slots TO service_role;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots readable" ON public.slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "slots admin write" ON public.slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- BOOKINGS
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_id uuid NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
  crop text NOT NULL,
  expected_quantity numeric NOT NULL DEFAULT 0,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  token_code text NOT NULL,
  queue_number int NOT NULL,
  stage text NOT NULL DEFAULT 'booked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings select" ON public.bookings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bookings insert own" ON public.bookings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings update" ON public.bookings FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROCUREMENT RECORDS
CREATE TABLE public.procurement_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actual_quantity numeric NOT NULL DEFAULT 0,
  quality_grade text NOT NULL DEFAULT '',
  moisture numeric,
  rate_per_quintal numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_records TO authenticated;
GRANT ALL ON public.procurement_records TO service_role;
ALTER TABLE public.procurement_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records select" ON public.procurement_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "records admin write" ON public.procurement_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER records_updated BEFORE UPDATE ON public.procurement_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  reference text NOT NULL DEFAULT '',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments select" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "payments admin write" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications select own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- REALTIME
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.centres REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.centres;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- SEED CENTRES
INSERT INTO public.centres (name, code, address, district, capacity_per_slot, avg_minutes_per_farmer, now_serving) VALUES
  ('Mandi Procurement Centre, Karnal','A','Sector 12, Grain Market Road','Karnal',12,6,'A118'),
  ('Kisan Kendra, Ludhiana','B','NH-44, Near Cold Storage','Ludhiana',10,7,'B104'),
  ('APMC Yard, Nashik','C','Panchavati Market Complex','Nashik',8,8,'C061');

-- SEED SLOTS: next 7 days, 5 slots/day
INSERT INTO public.slots (centre_id, slot_date, start_time, end_time, capacity, booked_count)
SELECT c.id,
       (CURRENT_DATE + d)::date,
       (t.h || ':00')::time,
       ((t.h + 2) || ':00')::time,
       c.capacity_per_slot,
       LEAST(c.capacity_per_slot, (abs(hashtext(c.code || d::text || t.h::text)) % (c.capacity_per_slot + 1)))
FROM public.centres c
CROSS JOIN generate_series(0,6) AS d
CROSS JOIN (VALUES (8),(10),(12),(14),(16)) AS t(h);
