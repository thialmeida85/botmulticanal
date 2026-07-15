import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageCircle,
  Users,
  BarChart3,
  Send,
  LogOut,
  Smartphone,
  Menu,
  Kanban,
  Trash2,
  CheckSquare,
} from "lucide-react";
import ConversationList from "@/components/ConversationList";
import ConversationViewer from "@/components/ConversationViewer";
import { WhatsAppConfig } from "@/components/WhatsAppConfig";
import { BroadcastForm } from "@/components/BroadcastForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { normalizeCsvHeader, parseCsv } from "@/lib/csv";
import SalesFunnel from "@/components/SalesFunnel";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("metrics");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const dashboardStats = trpc.messages.getDashboardStats.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const conversations = trpc.messages.getConversations.useQuery(
    { status: "open" },
    { refetchInterval: 3000 }
  );

  const renderContent = () => {
    switch (activeTab) {
      case "chat":
        return <ChatView conversations={conversations.data} />;
      case "crm":
        return <CRMView />;
      case "funnel":
        return <SalesFunnel />;
      case "broadcast":
        return <BroadcastForm />;
      case "settings":
        return (
          <div className="max-w-4xl mx-auto">
            <WhatsAppConfig />
          </div>
        );
      case "metrics":
      default:
        return <MetricsView stats={dashboardStats.data} />;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Botão de Menu para Celular */}
      <button
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Barra Lateral (Sidebar) */}
      <aside
        className={`
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 
        fixed md:relative z-40 w-64 h-screen bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out shadow-xl
      `}
      >
        <div className="p-6 pb-2">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            Verticale
          </h1>
          <p className="text-sm text-slate-500 mt-3 bg-slate-800 p-2 rounded-lg inline-block w-full truncate">
            👤 {user?.name || "Administrador"}
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6 overflow-y-auto">
          <SidebarItem
            icon={<BarChart3 />}
            label="Dashboard"
            active={activeTab === "metrics"}
            onClick={() => {
              setActiveTab("metrics");
              setIsMobileMenuOpen(false);
            }}
          />
          <SidebarItem
            icon={<MessageCircle />}
            label="Atendimento"
            active={activeTab === "chat"}
            onClick={() => {
              setActiveTab("chat");
              setIsMobileMenuOpen(false);
            }}
          />
          <SidebarItem
            icon={<Users />}
            label="CRM Contatos"
            active={activeTab === "crm"}
            onClick={() => {
              setActiveTab("crm");
              setIsMobileMenuOpen(false);
            }}
          />
          <SidebarItem
            icon={<Kanban />}
            label="Funil de Vendas"
            active={activeTab === "funnel"}
            onClick={() => {
              setActiveTab("funnel");
              setIsMobileMenuOpen(false);
            }}
          />
          <SidebarItem
            icon={<Send />}
            label="Campanhas (Massa)"
            active={activeTab === "broadcast"}
            onClick={() => {
              setActiveTab("broadcast");
              setIsMobileMenuOpen(false);
            }}
          />

          <div className="pt-6 pb-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Integrações
            </p>
          </div>
          <SidebarItem
            icon={<Smartphone />}
            label="WhatsApp API"
            active={activeTab === "settings"}
            onClick={() => {
              setActiveTab("settings");
              setIsMobileMenuOpen(false);
            }}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8 w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 w-full text-left rounded-lg transition-all duration-200 ${
        active
          ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
          : "hover:bg-slate-800/50 hover:text-slate-100"
      }`}
    >
      <div className={`w-5 h-5 ${active ? "opacity-100" : "opacity-70"}`}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
    </button>
  );
}

// -------------------------------------------------------------
// TELAS (VÍDEOS/ABAS DO SISTEMA)
// -------------------------------------------------------------

function ChatView({ conversations }: { conversations: any }) {
  const [selectedConversation, setSelectedConversation] = useState<
    number | null
  >(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(
    new Set()
  );
  const utils = trpc.useUtils();
  const deleteConversations = trpc.messages.deleteConversations.useMutation({
    onSuccess: async () => {
      if (selectedConversation && selectedForDeletion.has(selectedConversation))
        setSelectedConversation(null);
      setSelectedForDeletion(new Set());
      await utils.messages.getConversations.invalidate();
      await utils.messages.getDashboardStats.invalidate();
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedConversation) {
        // Força a atualização em tempo real dos balões da conversa que está aberta
        utils.messages.invalidate();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedConversation, utils]);

  if (!conversations) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Carregando histórico de conversas ou sincronizando banco...
      </div>
    );
  }

  const selected = conversations.find(
    (conversation: any) => conversation.id === selectedConversation
  );
  const toggleConversation = (id: number) => {
    setSelectedForDeletion(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const deleteSelectedConversations = () => {
    const ids = Array.from(selectedForDeletion);
    if (!ids.length) return;
    if (
      !window.confirm(
        `Excluir permanentemente ${ids.length} conversa(s) e suas mensagens?`
      )
    )
      return;
    deleteConversations.mutate({ conversationIds: ids });
  };

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-bold text-slate-800 text-lg">
            Atendimento Ao Vivo
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sincronizado com WhatsApp e Instagram
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setSelectedForDeletion(
                  new Set(conversations.map((item: any) => item.id))
                )
              }
              disabled={!conversations.length}
            >
              <CheckSquare className="mr-1 h-4 w-4" /> Selecionar todas
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteSelectedConversations}
              disabled={
                !selectedForDeletion.size || deleteConversations.isPending
              }
            >
              <Trash2 className="mr-1 h-4 w-4" /> Excluir (
              {selectedForDeletion.size})
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <ConversationList
            conversations={conversations || []}
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
            selectedForDeletion={selectedForDeletion}
            onToggleSelection={toggleConversation}
          />
        </div>
      </div>
      <div className="lg:col-span-2 h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {selected ? (
          <ConversationViewer conversation={selected} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
            <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-600">
              Nenhum chat selecionado
            </p>
            <p className="text-sm">
              Selecione uma conversa ao lado para responder
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricsView({ stats }: { stats: any }) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
          Visão Geral
        </h2>
        <p className="text-slate-500 mt-1 text-lg">
          Acompanhe os resultados da sua agência hoje.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-md bg-white rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Conversas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-slate-800">
              {stats?.openConversations || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Aguardando Resposta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-red-500">
              {stats?.totalUnread || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Total de Contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-blue-600">
              {stats?.totalConversations || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Tempo Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black text-emerald-500">2m 14s</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CRMView() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const contactsQuery = trpc.messages.getContacts.useQuery(
    {},
    { refetchInterval: 5000 }
  );
  const importContactsMutation = trpc.messages.importContacts.useMutation();

  const contactTicketsQuery = trpc.messages.getContactTickets.useQuery(
    { contactId: selectedContact?.id || 0 },
    { enabled: !!selectedContact }
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus("Lendo arquivo e sincronizando com o banco de dados...");

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const rows = parseCsv(text);
        if (rows.length < 2)
          throw new Error("O arquivo parece estar vazio ou sem contatos.");

        const headers = rows[0].map(normalizeCsvHeader);
        const getValue = (columns: string[], ...aliases: string[]) => {
          const index = aliases
            .map(normalizeCsvHeader)
            .map(alias => headers.indexOf(alias))
            .find(item => item >= 0);
          return index === undefined ? "" : (columns[index] || "").trim();
        };
        if (!headers.includes("nome") || !headers.includes("telefone")) {
          throw new Error(
            'O CSV precisa ter, no mínimo, as colunas "Nome" e "Telefone".'
          );
        }

        const contactsToImport = [];
        let ignored = 0;
        for (const columns of rows.slice(1)) {
          const name =
            getValue(columns, "Nome", "Nome completo") || "Desconhecido";
          let phone = getValue(
            columns,
            "Telefone",
            "WhatsApp",
            "Celular"
          ).replace(/\D/g, "");
          if (
            !phone.startsWith("55") &&
            phone.length >= 10 &&
            phone.length <= 11
          )
            phone = `55${phone}`;
          if (phone.length < 12 || phone.length > 13) {
            ignored++;
            continue;
          }

          const scoreText = getValue(columns, "Score", "Pontuação").replace(
            ",",
            "."
          );
          const parsedScore = Number(scoreText);
          contactsToImport.push({
            name,
            phoneNumber: phone,
            platform: "whatsapp" as const,
            externalId: phone,
            company: getValue(columns, "Empresa", "Razão social") || undefined,
            cnpj: getValue(columns, "CNPJ").replace(/\D/g, "") || undefined,
            segment: getValue(columns, "Segmento") || undefined,
            city: getValue(columns, "Cidade") || undefined,
            state: getValue(columns, "Estado", "UF").toUpperCase() || undefined,
            email: getValue(columns, "E-mail", "Email") || undefined,
            leadStatus: getValue(columns, "Status") || undefined,
            leadScore: Number.isFinite(parsedScore)
              ? Math.max(0, Math.min(100, Math.round(parsedScore)))
              : undefined,
            source: getValue(columns, "Origem") || undefined,
            customMessage:
              getValue(columns, "Mensagem personalizada", "Mensagem") ||
              undefined,
          });
        }

        if (contactsToImport.length === 0) {
          throw new Error(
            'Nenhum número de WhatsApp válido foi encontrado na coluna "Telefone".'
          );
        }

        const result = await importContactsMutation.mutateAsync({
          contacts: contactsToImport,
        });

        setStatus(
          `✅ Sucesso! ${result.imported} leads foram importados e higienizados.${ignored ? ` ${ignored} linha(s) sem telefone válido foram ignoradas.` : ""}`
        );
        contactsQuery.refetch(); // Recarrega a tabela na hora
      } catch (err: any) {
        setStatus(`❌ Erro ao processar o arquivo: ${err.message}`);
      } finally {
        setLoading(false);
        if (e.target) e.target.value = ""; // Reseta o campo para poder subir outro depois
      }
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleViewTickets = (contact: any) => {
    setSelectedContact(contact);
    setIsTicketDialogOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">CRM de Contatos</h2>
          <p className="text-slate-500">
            Gerencie seus clientes e leads capturados
          </p>
        </div>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap">
          {loading ? "Importando..." : "Importar Contatos (CSV)"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>

      {status && (
        <div
          className={`mb-6 p-4 rounded-lg font-medium text-sm ${status.includes("Sucesso") ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}
        >
          {status}
        </div>
      )}

      <div className="flex-1 overflow-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="text-slate-500 text-sm border-b border-slate-200">
              <th className="p-4 font-semibold">Código</th>
              <th className="p-4 font-semibold">Nome</th>
              <th className="p-4 font-semibold">Telefone / ID</th>
              <th className="p-4 font-semibold">Empresa</th>
              <th className="p-4 font-semibold">Localidade</th>
              <th className="p-4 font-semibold">E-mail</th>
              <th className="p-4 font-semibold text-center">Score</th>
              <th className="p-4 font-semibold text-center">Interações</th>
              <th className="p-4 font-semibold text-center">Chamados</th>
              <th className="p-4 font-semibold">Data de Cadastro</th>
              <th className="p-4 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contactsQuery.isLoading && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">
                  Buscando contatos...
                </td>
              </tr>
            )}
            {contactsQuery.data?.map((contact: any) => (
              <tr
                key={contact.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="p-4 font-medium text-slate-500 text-sm">
                  {contact.customerCode}
                </td>
                <td className="p-4 font-medium text-slate-800">
                  {contact.name || "Desconhecido"}
                </td>
                <td className="p-4 text-slate-600">
                  {contact.phoneNumber || contact.externalId}
                </td>
                <td className="p-4 text-slate-600">
                  <div>{contact.company || "-"}</div>
                  <div className="text-xs text-slate-400">
                    {contact.segment || ""}
                  </div>
                </td>
                <td className="p-4 text-slate-600">
                  {[contact.city, contact.state].filter(Boolean).join("/") ||
                    "-"}
                </td>
                <td className="p-4 text-slate-600">{contact.email || "-"}</td>
                <td className="p-4 text-center">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    {contact.leadScore ?? "-"}
                  </span>
                </td>
                <td className="p-4 text-slate-600 text-center font-medium">
                  {contact.interactionsCount || 1}
                </td>
                <td className="p-4 text-center">
                  {contact.ticketCount > 0 ? (
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold">
                      {contact.ticketCount}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {new Date(contact.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleViewTickets(contact)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                  >
                    Ver Chamados
                  </button>
                </td>
              </tr>
            ))}
            {contactsQuery.data?.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">
                  Nenhum contato encontrado no banco de dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>
              Chamados de Suporte - {selectedContact?.name}
            </DialogTitle>
            <DialogDescription>
              Histórico de solicitações de suporte e problemas técnicos
              relatados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto mt-4 pr-2">
            {contactTicketsQuery.isLoading ? (
              <p className="text-slate-500 text-center py-4">
                Buscando chamados...
              </p>
            ) : contactTicketsQuery.data?.length === 0 ? (
              <p className="text-slate-500 text-center py-4">
                Nenhum chamado aberto para este cliente.
              </p>
            ) : (
              contactTicketsQuery.data?.map((ticket: any) => (
                <div
                  key={ticket.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-800">
                      {ticket.ticketCode}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded uppercase font-semibold ${ticket.status === "open" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-blue-700 mb-2">
                    {ticket.subject}
                  </h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap text-xs bg-white p-3 rounded border border-slate-100 h-24 overflow-y-auto">
                    {ticket.description}
                  </p>
                  <p className="text-xs text-slate-400 mt-3 font-medium">
                    Aberto em:{" "}
                    {new Date(ticket.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FunnelView() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center h-[80vh] flex flex-col items-center justify-center">
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
        <Kanban className="w-10 h-10" />
      </div>
      <h2 className="text-3xl font-bold text-slate-800 mb-3">
        Funil de Vendas KANBAN
      </h2>
      <p className="text-slate-500 max-w-lg mx-auto text-lg leading-relaxed">
        Aqui você poderá arrastar os clientes em colunas (Lead, Negociação,
        Fechado) sincronizadas automaticamente com as etiquetas do seu WhatsApp
        Business!
      </p>
    </div>
  );
}
