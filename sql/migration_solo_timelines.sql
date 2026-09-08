-- LuvGallery — additive migration: allow a "solo" personal timeline (user_b = null)
-- on top of an existing v2 schema, WITHOUT dropping any existing data.
-- Run this once in SQL Editor. Safe to re-run.

alter table timelines alter column user_b drop not null;

alter table timelines drop constraint if exists timelines_distinct_members;
alter table timelines add constraint timelines_distinct_members
  check (user_b is null or user_a <> user_b);

drop index if exists timelines_unique_pair;
create unique index if not exists timelines_unique_pair
  on timelines (least(user_a, user_b), greatest(user_a, user_b)) where user_b is not null;
create unique index if not exists timelines_unique_solo
  on timelines (user_a) where user_b is null;
