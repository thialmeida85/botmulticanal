import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  CloudCog,
  CreditCard,
  Loader2,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const SECRET_KEYS = [
  "RENDER_API_KEY",
  "NEON_API_KEY",
  "DATABASE_URL",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE_NAME",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPSEEK_API_KEY",
  "JWT_SECRET",
] as const;
type SecretKey = (typeof SECRET_KEYS)[number];
type TenantRow = {
  id: number;
  name: string;
  slug: string;
  contactEmail: string | null;
  status: "trial" | "active" | "suspended" | "cancelled";
  createdAt: Date;
};
type PlanRow = { id: number; name: string; code: string; priceCents: number };
type InstallationRow = {
  id: number;
  tenantId: number;
  status: "draft" | "provisioning" | "active" | "failed" | "suspended";
  renderServiceId: string | null;
  neonProjectId: string | null;
};
type SecretRow = { key: string; valueHint: string | null };
type AuditRow = {
  id: number;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  tenantId: number | null;
};

export default function AdminPanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const overview = trpc.admin.overview.useQuery(undefined, { enabled: isAdmin });
  const plans = trpc.admin.listPlans.useQuery(undefined, { enabled: isAdmin });
  const audit = trpc.admin.auditLog.useQuery(undefined, { enabled: isAdmin });
  const [selectedInstallationId, setSelectedInstallationId] = useState<
    number | null
  >(null);
  const installation = trpc.admin.getInstallation.useQuery(
    { installationId: selectedInstallationId || 0 },
    { enabled: Boolean(selectedInstallationId) }
  );
  const [tenantForm, setTenantForm] = useState({
    name: "",
    slug: "",
    contactEmail: "",
    planId: "",
    trialDays: "14",
  });
  const [planForm, setPlanForm] = useState({
    name: "",
    code: "",
    price: "0",
    users: "5",
    messages: "5000",
  });
  const [installationForm, setInstallationForm] = useState({
    tenantId: "",
    repositoryUrl: "",
    branch: "main",
    renderServiceId: "",
    publicUrl: "",
    neonProjectId: "",
  });
  const [secretForm, setSecretForm] = useState<{
    key: SecretKey;
    value: string;
  }>({ key: "DATABASE_URL", value: "" });

  const createTenant = trpc.admin.createTenant.useMutation({
    onSuccess: async () => {
      toast.success("Cliente criado");
      setTenantForm({
        name: "",
        slug: "",
        contactEmail: "",
        planId: "",
        trialDays: "14",
      });
      await utils.admin.overview.invalidate();
    },
  });
  const savePlan = trpc.admin.savePlan.useMutation({
    onSuccess: async () => {
      toast.success("Plano salvo");
      setPlanForm({
        name: "",
        code: "",
        price: "0",
        users: "5",
        messages: "5000",
      });
      await utils.admin.listPlans.invalidate();
    },
  });
  const createInstallation = trpc.admin.createInstallation.useMutation({
    onSuccess: async created => {
      toast.success("Instalação criada");
      setSelectedInstallationId(created.id);
      await utils.admin.overview.invalidate();
    },
  });
  const saveSecret = trpc.admin.saveSecret.useMutation({
    onSuccess: async () => {
      toast.success("Credencial criptografada e salva");
      setSecretForm(current => ({ ...current, value: "" }));
      await installation.refetch();
    },
  });
  const testConnection = trpc.admin.testConnection.useMutation({
    onSuccess: () => toast.success("Conexão validada"),
    onError: error => toast.error(error.message),
  });
  const deploy = trpc.admin.deploy.useMutation({
    onSuccess: async () => {
      toast.success("Deploy iniciado na Render");
      await utils.admin.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateStatus = trpc.admin.updateTenantStatus.useMutation({
    onSuccess: () => utils.admin.overview.invalidate(),
  });

  const metrics = useMemo(() => {
    const tenants = overview.data?.tenants || [];
    const installations = overview.data?.installations || [];
    return {
      clients: tenants.length,
      active: tenants.filter((item: TenantRow) => item.status === "active")
        .length,
      installations: installations.length,
      failures: installations.filter(
        (item: InstallationRow) => item.status === "failed"
      ).length,
    };
  }, [overview.data]);

  if (user && user.role !== "admin") return <DashboardLayout><Card><CardContent className="py-16 text-center"><ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-semibold">Acesso restrito</h1><p className="text-muted-foreground">Esta área exige uma conta administradora da plataforma.</p></CardContent></Card></DashboardLayout>;
  if (overview.isLoading)
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Administração da plataforma
          </h1>
          <p className="text-muted-foreground">
            Clientes, planos e instalações isoladas em Render e Neon.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Clientes", value: metrics.clients, icon: Building2 },
            { label: "Ativos", value: metrics.active, icon: ShieldCheck },
            {
              label: "Instalações",
              value: metrics.installations,
              icon: CloudCog,
            },
            { label: "Com falha", value: metrics.failures, icon: Rocket },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-3xl font-bold">{value}</p>
                </div>
                <Icon className="h-8 w-8 text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Tabs defaultValue="clients">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="installations">Instalações</TabsTrigger>
            <TabsTrigger value="configuration">Configuração</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="clients" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Novo cliente</CardTitle>
                <CardDescription>
                  Cria a empresa, período de teste e assinatura inicial.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-5">
                <div>
                  <Label htmlFor="tenant-name">Nome</Label>
                  <Input
                    id="tenant-name"
                    value={tenantForm.name}
                    onChange={e =>
                      setTenantForm({ ...tenantForm, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-slug">Identificador</Label>
                  <Input
                    id="tenant-slug"
                    value={tenantForm.slug}
                    onChange={e =>
                      setTenantForm({
                        ...tenantForm,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "-"),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-email">E-mail</Label>
                  <Input
                    id="tenant-email"
                    type="email"
                    value={tenantForm.contactEmail}
                    onChange={e =>
                      setTenantForm({
                        ...tenantForm,
                        contactEmail: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Plano</Label>
                  <Select
                    value={tenantForm.planId}
                    onValueChange={value =>
                      setTenantForm({ ...tenantForm, planId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.data?.map((plan: PlanRow) => (
                        <SelectItem key={plan.id} value={String(plan.id)}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={createTenant.isPending}
                    onClick={() =>
                      createTenant.mutate({
                        name: tenantForm.name,
                        slug: tenantForm.slug,
                        contactEmail: tenantForm.contactEmail,
                        planId: tenantForm.planId
                          ? Number(tenantForm.planId)
                          : undefined,
                        trialDays: Number(tenantForm.trialDays),
                      })
                    }
                  >
                    Criar cliente
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.data?.tenants.map((tenant: TenantRow) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">
                          {tenant.name}
                          <span className="block text-xs text-muted-foreground">
                            {tenant.slug}
                          </span>
                        </TableCell>
                        <TableCell>{tenant.contactEmail}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tenant.status === "active"
                                ? "default"
                                : tenant.status === "suspended"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {tenant.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(tenant.createdAt).toLocaleDateString(
                            "pt-BR"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={tenant.status}
                            onValueChange={(
                              status:
                                | "trial"
                                | "active"
                                | "suspended"
                                | "cancelled"
                            ) =>
                              updateStatus.mutate({
                                tenantId: tenant.id,
                                status,
                              })
                            }
                          >
                            <SelectTrigger className="ml-auto w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="trial">Teste</SelectItem>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="suspended">
                                Suspenso
                              </SelectItem>
                              <SelectItem value="cancelled">
                                Cancelado
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Novo plano</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-6">
                <Input
                  placeholder="Nome"
                  value={planForm.name}
                  onChange={e =>
                    setPlanForm({ ...planForm, name: e.target.value })
                  }
                />
                <Input
                  placeholder="Código"
                  value={planForm.code}
                  onChange={e =>
                    setPlanForm({
                      ...planForm,
                      code: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                />
                <Input
                  type="number"
                  placeholder="Preço em R$"
                  value={planForm.price}
                  onChange={e =>
                    setPlanForm({ ...planForm, price: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Usuários"
                  value={planForm.users}
                  onChange={e =>
                    setPlanForm({ ...planForm, users: e.target.value })
                  }
                />
                <Input
                  type="number"
                  placeholder="Mensagens"
                  value={planForm.messages}
                  onChange={e =>
                    setPlanForm({ ...planForm, messages: e.target.value })
                  }
                />
                <Button
                  onClick={() =>
                    savePlan.mutate({
                      name: planForm.name,
                      code: planForm.code,
                      priceCents: Math.round(Number(planForm.price) * 100),
                      billingInterval: "month",
                      limits: {
                        users: Number(planForm.users),
                        messages: Number(planForm.messages),
                      },
                      isActive: true,
                    })
                  }
                >
                  Salvar plano
                </Button>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.data?.map((plan: PlanRow) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.code}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">
                      {(plan.priceCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mês
                      </span>
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="installations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vincular ambiente do cliente</CardTitle>
                <CardDescription>
                  Informe os identificadores dos recursos que pertencem ao
                  cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Select
                  value={installationForm.tenantId}
                  onValueChange={value =>
                    setInstallationForm({
                      ...installationForm,
                      tenantId: value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {overview.data?.tenants.map((tenant: TenantRow) => (
                      <SelectItem key={tenant.id} value={String(tenant.id)}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="URL do repositório"
                  value={installationForm.repositoryUrl}
                  onChange={e =>
                    setInstallationForm({
                      ...installationForm,
                      repositoryUrl: e.target.value,
                    })
                  }
                />
                <Input
                  placeholder="Render Service ID"
                  value={installationForm.renderServiceId}
                  onChange={e =>
                    setInstallationForm({
                      ...installationForm,
                      renderServiceId: e.target.value,
                    })
                  }
                />
                <Input
                  placeholder="URL pública"
                  value={installationForm.publicUrl}
                  onChange={e =>
                    setInstallationForm({
                      ...installationForm,
                      publicUrl: e.target.value,
                    })
                  }
                />
                <Input
                  placeholder="Neon Project ID"
                  value={installationForm.neonProjectId}
                  onChange={e =>
                    setInstallationForm({
                      ...installationForm,
                      neonProjectId: e.target.value,
                    })
                  }
                />
                <Button
                  onClick={() =>
                    createInstallation.mutate({
                      tenantId: Number(installationForm.tenantId),
                      repositoryUrl: installationForm.repositoryUrl,
                      branch: installationForm.branch,
                      renderServiceId:
                        installationForm.renderServiceId || undefined,
                      publicUrl: installationForm.publicUrl || undefined,
                      neonProjectId:
                        installationForm.neonProjectId || undefined,
                    })
                  }
                >
                  Criar instalação
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Render</TableHead>
                      <TableHead>Neon</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.data?.installations.map((item: InstallationRow) => (
                      <TableRow key={item.id}>
                        <TableCell>#{item.id}</TableCell>
                        <TableCell>
                          {
                            overview.data.tenants.find(
                              (tenant: TenantRow) => tenant.id === item.tenantId
                            )?.name
                          }
                        </TableCell>
                        <TableCell>{item.renderServiceId || "—"}</TableCell>
                        <TableCell>{item.neonProjectId || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            onClick={() => setSelectedInstallationId(item.id)}
                          >
                            Configurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="configuration" className="space-y-4">
            {!selectedInstallationId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Selecione uma instalação na aba Instalações.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Credenciais da instalação #{selectedInstallationId}
                    </CardTitle>
                    <CardDescription>
                      Os valores são criptografados com AES-256-GCM e nunca são
                      devolvidos pelo servidor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-[240px_1fr_auto]">
                    <Select
                      value={secretForm.key}
                      onValueChange={(key: SecretKey) =>
                        setSecretForm({ ...secretForm, key })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SECRET_KEYS.map(key => (
                          <SelectItem key={key} value={key}>
                            {key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Novo valor"
                      value={secretForm.value}
                      onChange={e =>
                        setSecretForm({ ...secretForm, value: e.target.value })
                      }
                    />
                    <Button
                      disabled={!secretForm.value || saveSecret.isPending}
                      onClick={() =>
                        saveSecret.mutate({
                          installationId: selectedInstallationId,
                          ...secretForm,
                        })
                      }
                    >
                      Salvar com segurança
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Conexões e deploy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {(
                        [
                          "render",
                          "neon",
                          "database",
                          "groq",
                          "openai",
                          "gemini",
                          "deepseek",
                          "health",
                        ] as const
                      ).map(provider => (
                        <Button
                          key={provider}
                          variant="outline"
                          disabled={testConnection.isPending}
                          onClick={() =>
                            testConnection.mutate({
                              installationId: selectedInstallationId,
                              provider,
                            })
                          }
                        >
                          Testar {provider}
                        </Button>
                      ))}
                      <Button
                        disabled={deploy.isPending}
                        onClick={() =>
                          deploy.mutate({
                            installationId: selectedInstallationId,
                          })
                        }
                      >
                        <Rocket className="mr-2 h-4 w-4" />
                        Publicar na Render
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {installation.data?.secrets.map((secret: SecretRow) => (
                        <div
                          key={secret.key}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <span className="font-mono text-sm">
                            {secret.key}
                          </span>
                          <Badge variant="secondary">{secret.valueHint}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Auditoria</CardTitle>
                <CardDescription>
                  Operações administrativas sem exposição de credenciais.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Cliente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.data?.map((entry: AuditRow) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.createdAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{entry.action}</TableCell>
                        <TableCell>
                          {entry.entityType} {entry.entityId}
                        </TableCell>
                        <TableCell>{entry.tenantId || "Plataforma"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
