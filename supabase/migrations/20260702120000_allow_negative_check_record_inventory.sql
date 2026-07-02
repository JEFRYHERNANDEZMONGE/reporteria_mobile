alter table public.check_record drop constraint if exists check_record_non_negative_inv;

alter table public.check_record
  add constraint check_record_non_negative_inv
  check ((evidence_num is null) or (evidence_num >= 0));
