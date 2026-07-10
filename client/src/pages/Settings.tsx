import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [whatsappToken, setWhatsappToken] = useState("");
  const [instagramToken, setInstagramToken] = useState("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleKeywords, setNewRuleKeywords] = useState("");
  const [newRuleResponse, setNewRuleResponse] = useState("");

  const apiCredentials = trpc.settings.getApiCredentials.useQuery({ platform: "whatsapp" });
  const saveApiCredentials = trpc.settings.saveApiCredentials.useMutation();
  const chatbotRules = trpc.settings.getChatbotRules.useQuery();
  const createRule = trpc.settings.createChatbotRule.useMutation();
  const deleteRule = trpc.settings.deleteChatbotRule.useMutation();
  const notificationSettings = trpc.settings.getNotificationSettings.useQuery();
  const saveNotificationSettings = trpc.settings.saveNotificationSettings.useMutation();

  const handleSaveWhatsappCredentials = async () => {
    if (!whatsappToken.trim()) {
      toast.error("Token é obrigatório");
      return;
    }

    try {
      await saveApiCredentials.mutateAsync({
        platform: "whatsapp",
        token: whatsappToken,
      });
      toast.success("Credenciais do WhatsApp salvas com sucesso");
      setWhatsappToken("");
    } catch (error) {
      toast.error("Erro ao salvar credenciais");
    }
  };

  const handleCreateRule = async () => {
    if (!newRuleName.trim() || !newRuleKeywords.trim() || !newRuleResponse.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      await createRule.mutateAsync({
        name: newRuleName,
        triggerKeywords: newRuleKeywords,
        responseTemplate: newRuleResponse,
        platform: "both",
      });
      toast.success("Regra criada com sucesso");
      setNewRuleName("");
      setNewRuleKeywords("");
      setNewRuleResponse("");
      chatbotRules.refetch();
    } catch (error) {
      toast.error("Erro ao criar regra");
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      await deleteRule.mutateAsync({ ruleId });
      toast.success("Regra deletada com sucesso");
      chatbotRules.refetch();
    } catch (error) {
      toast.error("Erro ao deletar regra");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Gerencie suas integrações e preferências</p>
        </div>

        <Tabs defaultValue="apis" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white border">
            <TabsTrigger value="apis">APIs</TabsTrigger>
            <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
            <TabsTrigger value="notifications">Notificações</TabsTrigger>
          </TabsList>

          {/* APIs Tab */}
          <TabsContent value="apis" className="space-y-6">
            {/* WhatsApp */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>WhatsApp (Evolution API)</CardTitle>
                    <CardDescription>Configure sua integração com WhatsApp</CardDescription>
                  </div>
                  {apiCredentials.data?.hasToken && (
                    <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Configurado
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Token de Acesso
                  </label>
                  <Input
                    type="password"
                    placeholder="Cole seu token aqui"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSaveWhatsappCredentials}
                  disabled={saveApiCredentials.isPending}
                  className="w-full"
                >
                  {saveApiCredentials.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Salvar Credenciais"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Instagram */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Instagram (Meta Graph API)</CardTitle>
                <CardDescription>Configure sua integração com Instagram</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Token de Acesso
                  </label>
                  <Input
                    type="password"
                    placeholder="Cole seu token aqui"
                    value={instagramToken}
                    onChange={(e) => setInstagramToken(e.target.value)}
                  />
                </div>
                <Button className="w-full">Salvar Credenciais</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chatbot Tab */}
          <TabsContent value="chatbot" className="space-y-6">
            {/* Create New Rule */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Criar Nova Regra</CardTitle>
                <CardDescription>Adicione uma nova regra de automação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Nome da Regra
                  </label>
                  <Input
                    placeholder="Ex: Saudação Automática"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Palavras-chave (separadas por vírgula)
                  </label>
                  <Input
                    placeholder="Ex: olá, oi, tudo bem"
                    value={newRuleKeywords}
                    onChange={(e) => setNewRuleKeywords(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Resposta Automática
                  </label>
                  <Textarea
                    placeholder="Ex: Olá! Obrigado por entrar em contato. Como posso ajudar?"
                    value={newRuleResponse}
                    onChange={(e) => setNewRuleResponse(e.target.value)}
                    className="h-24"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Variáveis disponíveis: {"{contactName}"}, {"{date}"}, {"{time}"}, {"{platform}"}
                  </p>
                </div>
                <Button
                  onClick={handleCreateRule}
                  disabled={createRule.isPending}
                  className="w-full"
                >
                  {createRule.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Regra
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Existing Rules */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Regras Ativas</h3>
              {chatbotRules.data?.map((rule: any) => (
                <Card key={rule.id} className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{rule.name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Palavras-chave: {rule.triggerKeywords}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Resposta: {rule.responseTemplate.substring(0, 50)}...
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={deleteRule.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Configurações de Notificação</CardTitle>
                <CardDescription>Customize como você recebe notificações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Notificações por E-mail</p>
                    <p className="text-sm text-gray-600">Receba alertas por e-mail</p>
                  </div>
                  <Switch defaultChecked={notificationSettings.data?.emailNotificationsEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Notificar em Cada Mensagem</p>
                    <p className="text-sm text-gray-600">Receba notificação para cada mensagem nova</p>
                  </div>
                  <Switch defaultChecked={notificationSettings.data?.notifyOnEveryMessage} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Limite de Mensagens Não Respondidas
                  </label>
                  <Input
                    type="number"
                    defaultValue={notificationSettings.data?.unreadMessageThreshold || 10}
                    min="1"
                    max="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Você será notificado quando atingir este limite
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Palavras-chave Importantes (separadas por vírgula)
                  </label>
                  <Textarea
                    placeholder="Ex: urgente, problema, reclamação"
                    defaultValue={notificationSettings.data?.notifyOnImportantKeywords || ""}
                    className="h-20"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Você será notificado quando mensagens contiverem estas palavras
                  </p>
                </div>

                <Button className="w-full">Salvar Configurações</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
