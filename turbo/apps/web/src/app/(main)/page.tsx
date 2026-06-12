import { ChatPanel } from "@/components/chat/chat-panel";
import { getDictionary } from "@/i18n/locale";

export default async function ChatPage() {
  const dictionary = await getDictionary();
  return <ChatPanel dictionary={dictionary} />;
}
