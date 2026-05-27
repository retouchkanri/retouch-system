import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  customer_status: string | null;
  avatar_url: string | null;
  created_at: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string };
}) {
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const role = searchParams.role ?? "";

  const admin = createSupabaseAdminClient();
  const { data: authPage } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const authUsers = authPage?.users ?? [];

  const { data: profiles } = await admin.from("profiles").select("id, role, customer_id");
  const profileMap = new Map<string, { role: string; customer_id: string | null }>(
    (profiles ?? []).map((p: any) => [p.id, { role: p.role, customer_id: p.customer_id }]),
  );

  const customerIds = Array.from(profileMap.values())
    .map((p) => p.customer_id)
    .filter((id): id is string => !!id);
  const { data: customers } = customerIds.length
    ? await admin
        .from("customers")
        .select("id, full_name, email, status, avatar_url")
        .in("id", customerIds)
    : { data: [] as any[] };
  const customerMap = new Map<string, any>((customers ?? []).map((c: any) => [c.id, c]));

  const rows: Row[] = authUsers.map((u) => {
    const prof = profileMap.get(u.id);
    const cust = prof?.customer_id ? customerMap.get(prof.customer_id) : null;
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: cust?.full_name ?? (u.user_metadata?.full_name as string) ?? null,
      role: prof?.role ?? "member",
      customer_status: cust?.status ?? null,
      avatar_url: cust?.avatar_url ?? null,
      created_at: u.created_at,
    };
  });

  const filtered = rows.filter((r) => {
    if (role && r.role !== role) return false;
    if (!q) return true;
    return (
      r.email.toLowerCase().includes(q) ||
      (r.full_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <Link href="/admin/users/new" className="btn-primary !py-2 !px-4">
          新規ユーザー追加
        </Link>
      </div>

      <form method="get" className="card grid md:grid-cols-4 gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="メール / 氏名で検索"
          className="input md:col-span-2"
        />
        <select name="role" defaultValue={role} className="input">
          <option value="">権限：すべて</option>
          <option value="member">一般</option>
          <option value="staff">スタッフ</option>
          <option value="admin">管理者</option>
        </select>
        <div className="flex gap-2">
          <button className="btn-primary !py-2 !px-4">絞り込む</button>
          <Link href="/admin/users" className="btn-ghost !py-2 !px-4">リセット</Link>
        </div>
      </form>

      <div className="card p-0 overflow-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-12 text-right">No.</th>
              <th></th>
              <th>氏名</th>
              <th>メール</th>
              <th>権限</th>
              <th>状態</th>
              <th>登録日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} className="hover:bg-surface-soft">
                <td className="text-right text-ink-mute tabular-nums">{i + 1}</td>
                <td>
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-surface-line"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-surface-soft border border-surface-line" />
                  )}
                </td>
                <td className="font-semibold">{r.full_name ?? "—"}</td>
                <td>{r.email}</td>
                <td>
                  <span
                    className={
                      r.role === "admin"
                        ? "chip-ok"
                        : r.role === "staff"
                          ? "chip-warn"
                          : "chip-mute"
                    }
                  >
                    {r.role}
                  </span>
                </td>
                <td>{r.customer_status ?? "—"}</td>
                <td>{formatDate(r.created_at)}</td>
                <td className="text-right">
                  <Link href={`/admin/users/${r.id}`} className="text-brand underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-ink-mute py-6">
                  該当するユーザーがいません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
