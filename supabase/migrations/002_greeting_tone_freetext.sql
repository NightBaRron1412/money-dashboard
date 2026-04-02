-- Allow greeting_tone to be any text value (AI personality description)
-- instead of only 'minimal', 'coach', 'strict'
alter table money_settings drop constraint if exists money_settings_greeting_tone_check;

-- Persist dismissed detected-subscription merchants so they don't reappear
alter table money_settings
  add column if not exists dismissed_merchants jsonb not null default '[]'::jsonb;
