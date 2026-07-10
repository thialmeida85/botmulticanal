import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Lightbulb, Plus, Tags, Kanban } from "lucide-react";
import type { ConversationWithContact } from "@/types/api";

interface ConversationViewerProps {
  conversation: ConversationWithContact;
}

export default function ConversationViewer({ conversation }: ConversationViewerProps) {
  const conversationId = conversation.id;
  const [messageContent, setMessageContent] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showDealForm, setShowDealForm] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const utils = trpc.useUtils();

  const messages = trpc.messages.getMessages.useQuery({ conversationId });
  const sendMessage = trpc.messages.sendMessage.useMutation();
  const allTags = trpc.sales.listTags.useQuery();
  const contactTags = trpc.sales.getContactTags.useQuery({ contactId: conversation.contactId });
  const pipelines = trpc.sales.listPipelines.useQuery();
  const createTag = trpc.sales.createTag.useMutation({ onSuccess: () => { setNewTagName(""); utils.sales.listTags.invalidate(); } });
  const toggleTag = trpc.sales.toggleContactTag.useMutation({ onSuccess: () => utils.sales.getContactTags.invalidate() });
  const createDeal = trpc.sales.createDeal.useMutation({ onSuccess: () => { setShowDealForm(false); setDealTitle(""); utils.sales.getBoard.invalidate(); } });
  const getSuggestion = trpc.messages.getSuggestion.useQuery(
    {
      conversationId,
      messageContent: messages.data?.[messages.data.length - 1]?.content || "",
    },
    { enabled: showSuggestion }
  );

  const handleSendMessage = async () => {
    if (!messageContent.trim()) return;

    try {
      await sendMessage.mutateAsync({
        conversationId,
        contactId: conversation.contactId,
        content: messageContent,
        platform: conversation.platform,
      });

      setMessageContent("");
      messages.refetch();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    }
  };

  if (messages.isLoading) {
    return (
      <Card className="border-0 shadow-sm h-full flex items-center justify-center">
        <CardContent className="text-center py-16">
          <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
          <p className="text-gray-500">Carregando conversa...</p>
        </CardContent>
      </Card>
    );
  }

  const messageList = messages.data || [];

  return (
    <Card className="border-0 shadow-sm h-full flex flex-col">
      <CardHeader className="border-b space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <CardTitle className="text-lg">{conversation.contact?.name || conversation.contact?.phoneNumber || "Conversa"}</CardTitle>
            <p className="text-xs text-slate-500">{conversation.platform === "whatsapp" ? "WhatsApp" : "Instagram"}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setShowDealForm(!showDealForm); setDealTitle(conversation.contact?.name || "Nova oportunidade"); }}><Kanban className="mr-1 h-4 w-4" /> Criar card</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tags className="h-4 w-4 text-slate-400" />
          {allTags.data?.map((tag: any) => {
            const selected = contactTags.data?.some((item: any) => item.id === tag.id) || false;
            return <button key={tag.id} onClick={() => toggleTag.mutate({ contactId: conversation.contactId, tagId: tag.id, selected: !selected })} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${selected ? "text-white" : "bg-white text-slate-600"}`} style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color }}>{tag.name}</button>;
          })}
          <Input className="h-8 w-32" placeholder="Nova tag" value={newTagName} onChange={(event) => setNewTagName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && newTagName.trim()) createTag.mutate({ name: newTagName, color: "#2563eb" }); }} />
          <Button size="sm" variant="ghost" disabled={!newTagName.trim()} onClick={() => createTag.mutate({ name: newTagName, color: "#2563eb" })}><Plus className="h-4 w-4" /></Button>
        </div>
        {showDealForm && (
          <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-3">
            <select className="h-9 rounded-md border bg-white px-2 text-sm" value={pipelineId} onChange={(event) => { setPipelineId(event.target.value); setStageId(""); }}><option value="">Escolha o funil</option>{pipelines.data?.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select>
            <select className="h-9 rounded-md border bg-white px-2 text-sm" value={stageId} onChange={(event) => setStageId(event.target.value)} disabled={!pipelineId}><option value="">Escolha a etapa</option>{pipelines.data?.find((pipeline) => pipeline.id === Number(pipelineId))?.stages.map((stage: any) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select>
            <Input className="h-9" placeholder="Título do card" value={dealTitle} onChange={(event) => setDealTitle(event.target.value)} />
            <div className="sm:col-span-3 flex gap-2"><Button size="sm" disabled={!pipelineId || !stageId || !dealTitle.trim()} onClick={() => createDeal.mutate({ pipelineId: Number(pipelineId), stageId: Number(stageId), contactId: conversation.contactId, conversationId, title: dealTitle, value: 0 })}>Adicionar ao funil</Button><Button size="sm" variant="ghost" onClick={() => setShowDealForm(false)}>Cancelar</Button></div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messageList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhuma mensagem nesta conversa</p>
          </div>
        ) : (
          messageList.map((msg: any) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.direction === "outbound"
                    ? "bg-blue-100 text-blue-900 rounded-br-none"
                    : "bg-gray-100 text-gray-900 rounded-bl-none"
                }`}
              >
                <p className="text-sm break-words">{msg.content}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs opacity-70">
                    {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {msg.automatedResponse && (
                    <Badge className="text-xs bg-green-100 text-green-700">Auto</Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {/* LLM Suggestion */}
      {showSuggestion && getSuggestion.data?.suggestion && (
        <div className="border-t bg-blue-50 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900 mb-2">Sugestão de resposta:</p>
              <p className="text-sm text-blue-800">{getSuggestion.data.suggestion}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => setMessageContent(getSuggestion.data?.suggestion || "")}
              >
                Usar sugestão
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t p-4 space-y-3">
        <div className="flex gap-2">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            className="resize-none h-20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageContent.trim() || sendMessage.isPending}
            size="sm"
            className="self-end"
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSuggestion(!showSuggestion)}
            className="text-xs"
          >
            <Lightbulb className="w-3 h-3 mr-1" />
            {showSuggestion ? "Ocultar" : "Sugestão"} IA
          </Button>
        </div>
      </div>
    </Card>
  );
}
