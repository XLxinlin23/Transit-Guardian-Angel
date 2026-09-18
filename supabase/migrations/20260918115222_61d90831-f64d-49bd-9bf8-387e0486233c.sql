CREATE TABLE public.commute_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  travel_days TEXT[] NOT NULL DEFAULT '{}',
  repeat_option TEXT NOT NULL DEFAULT 'weekdays',
  arrive_by TEXT NOT NULL DEFAULT '08:45',
  max_delay INTEGER NOT NULL DEFAULT 15,
  preferences TEXT[] NOT NULL DEFAULT '{speed}',
  active BOOLEAN NOT NULL DEFAULT true,
  notify_lead_minutes INTEGER NOT NULL DEFAULT 20,
  notify_weather BOOLEAN NOT NULL DEFAULT true,
  notify_crowd BOOLEAN NOT NULL DEFAULT true,
  notify_bus BOOLEAN NOT NULL DEFAULT false,
  bus_stop_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.commute_schedules TO service_role;

ALTER TABLE public.commute_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to commute schedules"
ON public.commute_schedules FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_commute_schedules_updated_at
BEFORE UPDATE ON public.commute_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();