import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import UserEditForm from "./UserEditForm";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: { id: string };
}) {
  const admin = createSupabaseAdminClient();
  const { data: userRes } = await admin.auth.admin.getUserById(params.id);
  const user = userRes?.user;
  if (!user) notFound();

  const { data: profile } = await admin
    .from("profiles")
    .select("role, customer_id")
    .eq("id", params.id)
    .maybeSingle();

  const customerId = (profile?.customer_id as string | null) ?? null;
  const { data: customer } = customerId
    ? await admin
        .from("customers")
        .select("id, full_name, full_name_kana, phone, status, avatar_url")
        .eq("id", customerId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ユーザー編集</h1>
        <Link href="/admin/users" className="text-brand underline">
          ← 戻る
        </Link>
      </div>
      <UserEditForm
        userId={user.id}
        initial={{
          email: user.email ?? "",
          full_name: (customer?.full_name as string) ?? "",
          full_name_kana: (customer?.full_name_kana as string) ?? "",
          phone: (customer?.phone as string) ?? "",
          status: (customer?.status as string) ?? "active",
          role: (profile?.role as string) ?? "member",
          avatar_url: (customer?.avatar_url as string) ?? null,
        }}
      />
    </div>
  );
}
