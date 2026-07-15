import { useEffect, useState } from "react";
import axios from "axios";
import {
  Bot,
  Brain,
  CheckCircle2,
  FileUp,
  Image,
  Loader2,
  Mic,
  Power,
  PowerOff,
  QrCode,
  RefreshCw,
  Save,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type ConnectionStatus = "checking" | "connected" | "disconnected";
type DeliveryHealth = {
  checked: number;
  errors: number;
  delivered: number;
  pending: number;
  latestStatus: string;
  latestActivityAt: string | null;
  historicalChecked: number;
  historicalErrors: number;
  windowHours: number;
  healthy: boolean;
};

const defaultSettings = {
  isEnabled: true,
  behaviorGeneral: "",
  knowledgeGeneral: "",
  knowledgeSpecific: "",
  pricingKnowledge: "",
  fallbackMessage: "",
  humanHandoffRules: "",
  prohibitedTopics: "",
  businessHours: "",
  audioUnderstandingEnabled: false,
  imageUnderstandingEnabled: false,
  mediaStorageEnabled: false,
  responseDelayMs: 1500,
  maxResponseLength: 600,
};

export function WhatsAppConfig() {
  const utils = trpc.useUtils();
  const settingsQuery = trpc.settings.getBotSettings.useQuery();
  const resources = trpc.settings.listBotResources.useQuery();
  const [settings, setSettings] = useState(defaultSettings);
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryHealth | null>(null);
  const [resourceName, setResourceName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceKeywords, setResourceKeywords] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);

  useEffect(() => {
    if (settingsQuery.data)
      setSettings({ ...defaultSettings, ...settingsQuery.data });
  }, [settingsQuery.data]);
  useEffect(() => {
    checkConnection();
  }, []);
  useEffect(() => {
    if (!qrCode) return;
    const interval = window.setInterval(async () => {
      const connected = await checkConnection();
      if (connected) {
        setQrCode(null);
        setNotice("WhatsApp conectado com sucesso.");
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [qrCode]);

  const saveSettings = trpc.settings.saveBotSettings.useMutation({
    onSuccess: () => {
      setNotice("Configurações e treinamento salvos.");
      utils.settings.getBotSettings.invalidate();
    },
  });
  const uploadResource = trpc.settings.uploadBotResource.useMutation({
    onSuccess: () => {
      setResourceName("");
      setResourceDescription("");
      setResourceKeywords("");
      setResourceUrl("");
      setResourceFile(null);
      resources.refetch();
      setNotice("Recurso adicionado à biblioteca.");
    },
  });
  const deleteResource = trpc.settings.deleteBotResource.useMutation({
    onSuccess: () => resources.refetch(),
  });

  async function checkConnection() {
    try {
      const [state, health] = await Promise.all([
        whatsappApi.get("/api/whatsapp/status"),
        whatsappApi
          .get("/api/whatsapp/delivery-health")
          .catch(() => ({ data: null })),
      ]);
      const connected = state.data.state === "open";
      setStatus(connected ? "connected" : "disconnected");
      setDelivery(health.data);
      return connected;
    } catch (error: any) {
      setStatus("disconnected");
      setNotice(
        error.response?.data?.reason ||
          error.response?.data?.error ||
          "Não foi possível consultar a conexão do WhatsApp."
      );
      return false;
    }
  }

  async function connect() {
    setConnectionBusy(true);
    setNotice(null);
    try {
      const response = await whatsappApi.get("/api/whatsapp/qrcode");
      if (response.data.alreadyConnected || response.data.state === "open") {
        setQrCode(null);
        setStatus("connected");
        setNotice("A instância já está conectada.");
      } else if (response.data.qrCode) {
        setQrCode(response.data.qrCode);
        setStatus("disconnected");
        setNotice(
          "Escaneie o QR Code. O status será atualizado automaticamente."
        );
      } else {
        setNotice("A Evolution não retornou um QR Code válido.");
      }
    } catch (error: any) {
      setNotice(
        error.response?.data?.error || "Não foi possível gerar o QR Code."
      );
    } finally {
      setConnectionBusy(false);
    }
  }

  async function disconnect() {
    setConnectionBusy(true);
    setNotice(null);
    try {
      await whatsappApi.post("/api/whatsapp/disconnect");
      setStatus("disconnected");
      setQrCode(null);
      setNotice("WhatsApp desconectado. Gere um novo QR Code para reconectar.");
    } catch (error: any) {
      setNotice(error.response?.data?.error || "Falha ao desconectar.");
    } finally {
      setConnectionBusy(false);
    }
  }

  async function syncContacts() {
    setConnectionBusy(true);
    try {
      const response = await whatsappApi.post("/api/whatsapp/sync-contacts");
      setNotice(`${response.data.imported} contatos sincronizados.`);
    } catch (error: any) {
      setNotice(
        error.response?.data?.error || "Falha ao sincronizar contatos."
      );
    } finally {
      setConnectionBusy(false);
    }
  }

  async function addResource() {
    if (!resourceName.trim() || (!resourceFile && !resourceUrl.trim())) return;
    let base64: string | undefined;
    if (resourceFile)
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(resourceFile);
      });
    const mime = resourceFile?.type;
    const type = mime?.startsWith("image/")
      ? "image"
      : mime?.startsWith("video/")
        ? "video"
        : mime?.startsWith("audio/")
          ? "audio"
          : resourceFile
            ? "document"
            : "link";
    uploadResource.mutate({
      name: resourceName,
      resourceType: type,
      mimeType: mime || undefined,
      base64,
      externalUrl: resourceUrl || undefined,
      description: resourceDescription || undefined,
      triggerKeywords: resourceKeywords || undefined,
    });
  }

  const update = (field: keyof typeof defaultSettings, value: any) =>
    setSettings(current => ({ ...current, [field]: value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Integração e Treinamento do Bot
        </h1>
        <p className="text-sm text-slate-500">
          Conexão, comportamento, conhecimento, mídia e recursos em um só lugar.
        </p>
      </div>
      {notice && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {notice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5 text-green-600" /> Conexão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-slate-50 p-4">
            {connectionBusy || status === "checking" ? (
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            ) : qrCode ? (
              <img
                src={qrCode}
                alt="QR Code para conectar o WhatsApp"
                className="h-56 w-56"
              />
            ) : status === "connected" ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
                <p className="mt-2 font-semibold">Instância conectada</p>
              </div>
            ) : (
              <div className="text-center">
                <QrCode className="mx-auto h-14 w-14 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">
                  Gere o QR Code para conectar
                </p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={connect} disabled={connectionBusy}>
                <QrCode className="mr-2 h-4 w-4" /> Gerar QR / Reconectar
              </Button>
              <Button
                variant="destructive"
                onClick={disconnect}
                disabled={connectionBusy}
              >
                <PowerOff className="mr-2 h-4 w-4" /> Desconectar / Limpar
                sessão
              </Button>
              <Button
                variant="outline"
                onClick={syncContacts}
                disabled={status !== "connected" || connectionBusy}
              >
                <Users className="mr-2 h-4 w-4" /> Sincronizar contatos
              </Button>
              <Button
                variant="outline"
                onClick={checkConnection}
                disabled={connectionBusy}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar diagnóstico
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="font-semibold">Bot automático</p>
                <p className="text-xs text-slate-500">
                  Desative para atendimento exclusivamente humano.
                </p>
              </div>
              <Switch
                aria-label="Ativar ou desativar bot automático"
                checked={settings.isEnabled}
                onCheckedChange={value => update("isEnabled", value)}
              />
            </div>
            {delivery && (
              <div
                className={`rounded-xl border p-4 ${status !== "connected" ? "border-red-200 bg-red-50" : delivery.errors > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}
              >
                <p className="font-semibold">
                  Diagnóstico de entrega:{" "}
                  {status !== "connected"
                    ? "DESCONECTADO"
                    : delivery.checked === 0
                      ? "SEM ENVIOS RECENTES"
                      : delivery.errors > 0
                        ? "FALHA RECENTE"
                        : "SAUDÁVEL"}
                </p>
                <p className="mt-1 text-sm">
                  Últimas {delivery.windowHours}h: {delivery.checked} analisadas
                  | {delivery.errors} falhas | {delivery.delivered} entregues |{" "}
                  {delivery.pending} pendentes
                </p>
                {delivery.latestActivityAt && (
                  <p className="mt-1 text-xs text-slate-600">
                    Última atividade:{" "}
                    {new Date(delivery.latestActivityAt).toLocaleString(
                      "pt-BR"
                    )}
                  </p>
                )}
                {delivery.historicalErrors > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Histórico informativo: {delivery.historicalErrors} falhas
                    entre as últimas {delivery.historicalChecked} mensagens.
                    Falhas antigas não alteram o estado atual.
                  </p>
                )}
                {status !== "connected" && (
                  <p className="mt-2 text-sm text-red-700">
                    A sessão está desconectada. Limpe a sessão e reconecte pelo
                    QR Code.
                  </p>
                )}
                {status === "connected" && delivery.errors > 0 && (
                  <p className="mt-2 text-sm text-amber-700">
                    Há falha dentro das últimas {delivery.windowHours} horas.
                    Tente novamente e confira o número do destinatário.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <TrainingCard
          icon={<Bot />}
          title="Comportamento geral"
          description="Persona, tom, objetivos, limites e como conduzir o atendimento."
          value={settings.behaviorGeneral}
          onChange={value => update("behaviorGeneral", value)}
        />
        <TrainingCard
          icon={<Brain />}
          title="Conhecimento geral"
          description="História, serviços, diferenciais, processos e perguntas frequentes."
          value={settings.knowledgeGeneral}
          onChange={value => update("knowledgeGeneral", value)}
        />
        <TrainingCard
          icon={<Brain />}
          title="Conhecimentos específicos"
          description="Políticas, termos técnicos, segmentos e instruções detalhadas."
          value={settings.knowledgeSpecific}
          onChange={value => update("knowledgeSpecific", value)}
        />
        <TrainingCard
          icon={<Save />}
          title="Precificação e condições"
          description="Planos, valores, descontos, parcelamento e regras comerciais."
          value={settings.pricingKnowledge}
          onChange={value => update("pricingKnowledge", value)}
        />
        <TrainingCard
          icon={<Users />}
          title="Transferência para humano"
          description="Quando parar a automação, abrir chamado ou encaminhar ao atendente."
          value={settings.humanHandoffRules}
          onChange={value => update("humanHandoffRules", value)}
        />
        <TrainingCard
          icon={<PowerOff />}
          title="Restrições e fallback"
          description="Assuntos proibidos e resposta quando o bot não souber."
          value={`${settings.prohibitedTopics}\n--- FALLBACK ---\n${settings.fallbackMessage}`}
          onChange={value => {
            const [blocked, fallback = ""] = value.split("--- FALLBACK ---");
            update("prohibitedTopics", blocked.trim());
            update("fallbackMessage", fallback.trim());
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Capacidades e limites</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Capability
            icon={<Mic />}
            title="Compreensão de áudio"
            checked={settings.audioUnderstandingEnabled}
            onChange={value => update("audioUnderstandingEnabled", value)}
          />
          <Capability
            icon={<Image />}
            title="Compreensão de imagem"
            checked={settings.imageUnderstandingEnabled}
            onChange={value => update("imageUnderstandingEnabled", value)}
          />
          <Capability
            icon={<Video />}
            title="Armazenar mídias recebidas"
            checked={settings.mediaStorageEnabled}
            onChange={value => update("mediaStorageEnabled", value)}
          />
          <label className="text-sm">
            Atraso antes da resposta (ms)
            <Input
              type="number"
              min="0"
              max="15000"
              value={settings.responseDelayMs}
              onChange={event =>
                update("responseDelayMs", Number(event.target.value))
              }
            />
          </label>
          <label className="text-sm">
            Limite da resposta (caracteres)
            <Input
              type="number"
              min="100"
              max="4000"
              value={settings.maxResponseLength}
              onChange={event =>
                update("maxResponseLength", Number(event.target.value))
              }
            />
          </label>
          <label className="text-sm">
            Horário de atendimento
            <Input
              value={settings.businessHours}
              onChange={event => update("businessHours", event.target.value)}
              placeholder="Seg-Sex, 8h às 18h"
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" /> Biblioteca de arquivos e links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Nome do recurso"
              value={resourceName}
              onChange={event => setResourceName(event.target.value)}
            />
            <Input
              placeholder="URL externa (opcional)"
              value={resourceUrl}
              onChange={event => setResourceUrl(event.target.value)}
            />
            <Input
              placeholder="Quando usar / palavras-chave"
              value={resourceKeywords}
              onChange={event => setResourceKeywords(event.target.value)}
            />
            <Input
              placeholder="Descrição para o bot"
              value={resourceDescription}
              onChange={event => setResourceDescription(event.target.value)}
            />
            <label className="text-sm text-slate-600">
              Arquivo
              <Input
                className="mt-1"
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={event =>
                  setResourceFile(event.target.files?.[0] || null)
                }
              />
            </label>
            <Button
              onClick={addResource}
              disabled={
                uploadResource.isPending ||
                !resourceName ||
                (!resourceFile && !resourceUrl)
              }
            >
              <FileUp className="mr-2 h-4 w-4" /> Adicionar recurso
            </Button>
          </div>
          <div className="divide-y rounded-xl border">
            {resources.data?.map((resource: any) => (
              <div key={resource.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{resource.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {resource.resourceType} ·{" "}
                    {resource.description || resource.url}
                  </p>
                </div>
                <a
                  className="text-sm text-blue-600"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir
                </a>
                <Button
                  aria-label={`Excluir recurso ${resource.name}`}
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteResource.mutate({ id: resource.id })}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          size="lg"
          onClick={() => saveSettings.mutate(settings)}
          disabled={saveSettings.isPending}
        >
          <Save className="mr-2 h-5 w-5" /> Salvar treinamento e configurações
        </Button>
      </div>
    </div>
  );
}

function TrainingCard({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        <Textarea
          className="min-h-40"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="Escreva as instruções que o bot deve seguir..."
        />
      </CardContent>
    </Card>
  );
}

function Capability({
  icon,
  title,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <Switch aria-label={title} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
const whatsappApi = axios.create();
whatsappApi.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
