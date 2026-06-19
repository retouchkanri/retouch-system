import { requireCapability } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getChatSettings } from "@/lib/chatbot";
import ChatbotSettingsForm from "./ChatbotSettingsForm";

export const dynamic = "force-dynamic";

export default async function ChatbotAdminPage() {
  await requireCapability("chatbot.manage");
  const admin = createSupabaseAdminClient();
  const settings = await getChatSettings(admin);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">AIチャットボット</h1>
      <ChatbotSettingsForm initialPrompt={settings.systemPrompt ?? ""} />
    </div>
  );
}
