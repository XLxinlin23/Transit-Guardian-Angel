ALTER TABLE public.commute_schedules
  DROP CONSTRAINT IF EXISTS commute_schedules_device_id_key;

ALTER TABLE public.commute_schedules
  ADD COLUMN IF NOT EXISTS alarm_id TEXT NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS from_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS from_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS to_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS to_lng DOUBLE PRECISION;

CREATE UNIQUE INDEX IF NOT EXISTS commute_schedules_device_alarm_key
  ON public.commute_schedules (device_id, alarm_id);