import { Badge } from "@/components/ui/badge";
import { MessageCircle, AlertCircle } from "lucide-react";
import type { Conversation, Contact } from "@/types/api";

interface ConversationListProps {
  conversations: Array<Conversation & { contact?: Contact }>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  selectedForDeletion: Set<number>;
  onToggleSelection: (id: number) => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  selectedForDeletion,
  onToggleSelection,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Nenhuma conversa ativa</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {conversations.map(conv => (
        <div
          key={conv.id}
          className={`flex items-start gap-2 rounded-lg border p-3 transition-all ${
            selectedId === conv.id
              ? "bg-blue-50 border-blue-200 shadow-sm"
              : "bg-white border-gray-200 hover:bg-gray-50"
          }`}
        >
          <input
            type="checkbox"
            aria-label={`Selecionar conversa de ${conv.contact?.name || conv.contact?.phoneNumber || "Contato"}`}
            checked={selectedForDeletion.has(conv.id)}
            onChange={() => onToggleSelection(conv.id)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <button
            type="button"
            onClick={() => onSelect(conv.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {conv.contact?.name || conv.contact?.phoneNumber || "Contato"}
                </p>
                <p className="text-xs text-gray-500 truncate mt-1">
                  {conv.platform === "whatsapp"
                    ? "📱 WhatsApp"
                    : "📷 Instagram"}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <Badge className="bg-pink-100 text-pink-700 text-xs font-medium">
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
            {conv.subject && (
              <p className="text-xs text-gray-600 mt-2 truncate">
                {conv.subject}
              </p>
            )}
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              {conv.status === "pending" && (
                <>
                  <AlertCircle className="w-3 h-3" />
                  <span>Pendente</span>
                </>
              )}
              {conv.lastMessageAt && (
                <span>
                  {new Date(conv.lastMessageAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
