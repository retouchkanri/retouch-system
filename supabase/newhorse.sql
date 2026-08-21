-- =====================================================================
-- 緊急支援募集馬（57〜60番）管理用スクリプト
--
-- 対象:
--   57：緊急支援募集馬（現在の写真を追加）
--   58：緊急支援募集馬（牝馬）
--   59：緊急支援募集馬（仔馬）※新規追加
--   60：緊急支援募集馬（白いどさんこ）※新規追加
--
-- 画像は Supabase Storage の avatars バケット horses/ 配下にアップロード済み
-- （scripts/apply-emergency-horses-59-60.mjs で実行）。
-- このファイルは同じ内容を SQL として保持し、再実行しても安全（idempotent）。
-- =====================================================================

-- 57・58 は既存レコードなので画像・プロフィール・並び順のみ更新
update public.horses
set
  image_url = 'https://jdpsycypgdtewgdhlkkj.supabase.co/storage/v1/object/public/avatars/horses/57-emergency.jpg',
  profile = '大阪から千葉への移動を控えている57番目の子★支援募集開始★',
  is_emergency_recruitment = true,
  is_supportable = true,
  sort_order = -9
where name = '57：緊急支援募集馬';

update public.horses
set
  image_url = 'https://jdpsycypgdtewgdhlkkj.supabase.co/storage/v1/object/public/avatars/horses/58-emergency.jpg',
  profile = '大阪から千葉への移動を控えている58番目の子（牝馬）★支援募集開始★',
  is_emergency_recruitment = true,
  is_supportable = true,
  sort_order = -8
where name = '58：緊急支援募集馬';

-- 59・60 は新規追加（既に存在する場合は追加しない）
insert into public.horses (name, name_kana, profile, image_url, is_supportable, is_emergency_recruitment, sort_order)
select v.name, v.kana, v.profile, v.image_url, true, true, v.ord
from (values
  (
    '59：緊急支援募集馬',
    '59キンキュウシエンボシュウウマ',
    '大阪から千葉への移動を控えている59番目の子（仔馬）★支援募集開始★',
    'https://jdpsycypgdtewgdhlkkj.supabase.co/storage/v1/object/public/avatars/horses/59-emergency.jpg',
    -7
  ),
  (
    '60：緊急支援募集馬',
    '60キンキュウシエンボシュウウマ',
    '大阪から千葉への移動を控えている60番目の子（白いどさんこ）★支援募集開始★',
    'https://jdpsycypgdtewgdhlkkj.supabase.co/storage/v1/object/public/avatars/horses/60-emergency.jpg',
    -6
  )
) as v(name, kana, profile, image_url, ord)
where not exists (select 1 from public.horses h where h.name = v.name);
