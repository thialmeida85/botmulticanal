import { useEffect, useMemo, useState } from "react";
import { Kanban, Loader2, Plus, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SalesFunnel() {
  const utils = trpc.useUtils();
  const pipelines = trpc.sales.listPipelines.useQuery();
  const contacts = trpc.messages.getContacts.useQuery({});
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newDealStage, setNewDealStage] = useState<number | null>(null);
  const [dealContactId, setDealContactId] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");

  useEffect(() => {
    if (!pipelineId && pipelines.data?.length) setPipelineId(pipelines.data[0].id);
  }, [pipelineId, pipelines.data]);

  const selectedPipeline = pipelines.data?.find((pipeline) => pipeline.id === pipelineId);
  const board = trpc.sales.getBoard.useQuery(
    { pipelineId: pipelineId || 0 },
    { enabled: Boolean(pipelineId) }
  );
  const dealsByStage = useMemo(() => {
    const map = new Map<number, NonNullable<typeof board.data>["deals"]>();
    board.data?.stages.forEach((stage: any) => map.set(stage.id, []));
    board.data?.deals.forEach((deal: any) => map.get(deal.stageId)?.push(deal));
    return map;
  }, [board.data]);

  const createPipeline = trpc.sales.createPipeline.useMutation({
    onSuccess: async (pipeline) => {
      setNewPipelineName("");
      setPipelineId(pipeline.id);
      await utils.sales.listPipelines.invalidate();
    },
  });
  const createStage = trpc.sales.createStage.useMutation({
    onSuccess: async () => {
      setNewStageName("");
      await Promise.all([utils.sales.listPipelines.invalidate(), utils.sales.getBoard.invalidate()]);
    },
  });
  const createDeal = trpc.sales.createDeal.useMutation({
    onSuccess: async () => {
      setNewDealStage(null);
      setDealContactId("");
      setDealTitle("");
      setDealValue("");
      await utils.sales.getBoard.invalidate();
    },
  });
  const moveDeal = trpc.sales.moveDeal.useMutation({ onSuccess: () => utils.sales.getBoard.invalidate() });

  if (pipelines.isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mr-auto">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Kanban className="h-5 w-5 text-emerald-600" /> Funil de Vendas</h2>
          <p className="text-sm text-slate-500">Organize oportunidades e mova os cards entre as etapas.</p>
        </div>
        {pipelines.data?.length ? (
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={pipelineId || ""} onChange={(event) => setPipelineId(Number(event.target.value))}>
            {pipelines.data.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
          </select>
        ) : null}
        <Input className="w-52" placeholder="Nome do novo funil" value={newPipelineName} onChange={(event) => setNewPipelineName(event.target.value)} />
        <Button disabled={!newPipelineName.trim() || createPipeline.isPending} onClick={() => createPipeline.mutate({ name: newPipelineName })}><Plus className="mr-1 h-4 w-4" /> Criar funil</Button>
      </div>

      {!selectedPipeline ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
          <Kanban className="mb-3 h-12 w-12 text-slate-300" />
          <h3 className="font-semibold text-slate-700">Crie seu primeiro funil</h3>
          <p className="text-sm text-slate-500">Ele começará com quatro etapas prontas para uso.</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-3">
          {board.data?.stages.map((stage: any) => (
            <section
              key={stage.id}
              className="flex w-80 shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-100/70"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const dealId = Number(event.dataTransfer.getData("text/deal-id"));
                if (dealId) moveDeal.mutate({ dealId, stageId: stage.id });
              }}
            >
              <header className="flex items-center gap-2 border-b border-slate-200 p-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
                <h3 className="font-semibold text-slate-700">{stage.name}</h3>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{dealsByStage.get(stage.id)?.length || 0}</span>
                <button className="rounded p-1 text-slate-500 hover:bg-white" onClick={() => setNewDealStage(stage.id)} aria-label={`Adicionar card em ${stage.name}`}><Plus className="h-4 w-4" /></button>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {newDealStage === stage.id && (
                  <div className="space-y-2 rounded-xl border border-blue-200 bg-white p-3 shadow-sm">
                    <select className="h-9 w-full rounded-md border px-2 text-sm" value={dealContactId} onChange={(event) => {
                      const id = event.target.value;
                      setDealContactId(id);
                      const contact = contacts.data?.find((item: any) => item.id === Number(id));
                      if (contact) setDealTitle(contact.name || contact.company || "Nova oportunidade");
                    }}>
                      <option value="">Selecione o contato</option>
                      {contacts.data?.map((contact: any) => <option key={contact.id} value={contact.id}>{contact.name || contact.phoneNumber}</option>)}
                    </select>
                    <Input placeholder="Título da oportunidade" value={dealTitle} onChange={(event) => setDealTitle(event.target.value)} />
                    <Input type="number" min="0" step="0.01" placeholder="Valor (R$)" value={dealValue} onChange={(event) => setDealValue(event.target.value)} />
                    <div className="flex gap-2"><Button size="sm" disabled={!dealContactId || !dealTitle.trim()} onClick={() => createDeal.mutate({ pipelineId: selectedPipeline.id, stageId: stage.id, contactId: Number(dealContactId), title: dealTitle, value: Math.round(Number(dealValue || 0) * 100) })}>Criar card</Button><Button size="sm" variant="ghost" onClick={() => setNewDealStage(null)}>Cancelar</Button></div>
                  </div>
                )}
                {dealsByStage.get(stage.id)?.map((deal: any) => (
                  <article key={deal.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/deal-id", String(deal.id))} className="cursor-grab rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:cursor-grabbing">
                    <h4 className="font-semibold text-slate-800">{deal.title}</h4>
                    <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><UserRound className="h-3.5 w-3.5" /> {deal.contact.name || deal.contact.phoneNumber || "Contato"}</p>
                    {deal.contact.company && <p className="mt-1 text-xs text-slate-400">{deal.contact.company}</p>}
                    {deal.value > 0 && <p className="mt-3 text-sm font-bold text-emerald-600">{(deal.value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                    <label className="mt-3 block text-xs text-slate-500">
                      Etapa
                      <select
                        className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                        value={deal.stageId}
                        onChange={(event) => moveDeal.mutate({ dealId: deal.id, stageId: Number(event.target.value) })}
                      >
                        {board.data?.stages.map((targetStage: any) => <option key={targetStage.id} value={targetStage.id}>{targetStage.name}</option>)}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            </section>
          ))}
          <section className="w-72 shrink-0 rounded-2xl border border-dashed border-slate-300 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-slate-600">Nova etapa</h3>
            <Input placeholder="Ex.: Qualificação" value={newStageName} onChange={(event) => setNewStageName(event.target.value)} />
            <Button className="mt-2 w-full" variant="outline" disabled={!newStageName.trim()} onClick={() => createStage.mutate({ pipelineId: selectedPipeline.id, name: newStageName, color: "#64748b" })}><Plus className="mr-1 h-4 w-4" /> Adicionar coluna</Button>
          </section>
        </div>
      )}
    </div>
  );
}
