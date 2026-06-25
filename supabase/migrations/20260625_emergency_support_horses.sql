-- 緊急支援募集馬（54・55番）の追加
alter table public.horses
  add column if not exists is_emergency_recruitment boolean not null default false;

insert into public.horses (name, name_kana, profile, is_supportable, is_emergency_recruitment, sort_order)
select v.name, v.kana, v.profile, true, true, v.ord
from (values
  (
    '54：緊急支援募集馬',
    '54キンキュウシエンボシュウウマ',
    '肥育場からの54番目の子（千葉予定）★支援募集開始★',
    1
  ),
  (
    '55：緊急支援募集馬',
    '55キンキュウシエンボシュウウマ',
    '肥育場からの55番目の子（千葉予定）★支援募集開始★',
    2
  )
) as v(name, kana, profile, ord)
where not exists (select 1 from public.horses h where h.name = v.name);
