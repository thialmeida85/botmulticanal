import { useState, useRef } from 'react';
import { AlertTriangle, Send, Users, ShieldAlert, Image as ImageIcon, Mic, Clock, Plus, GripVertical, Trash2 } from 'lucide-react';
import { trpc } from "@/lib/trpc";

export function BroadcastForm() {
  const [message, setMessage] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all');
  
  // Busca contatos reais do banco de dados!
  const contactsQuery = trpc.messages.getContacts.useQuery({});
  const allContacts = contactsQuery.data || [];
  
  const filteredContacts = audienceFilter === 'all' 
    ? allContacts 
    : allContacts.filter((c: any) => c.platform === audienceFilter);
    
  const recipientCount = filteredContacts.length;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Inserir variáveis no texto onde o cursor estiver
  const insertVariable = (variable: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || message.length;
    const textBefore = message.substring(0, cursorPosition);
    const textAfter = message.substring(cursorPosition, message.length);
    setMessage(textBefore + variable + textAfter);
    
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursorPosition + variable.length, cursorPosition + variable.length);
    }, 10);
  };

  const handleAttemptSend = () => {
    if (!message && recipientCount === 0) return;
    if (recipientCount > 100) {
      setShowWarning(true);
    } else {
      startBroadcast();
    }
  };

  const startBroadcast = () => {
    setShowWarning(false);
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      alert('🚀 Disparo iniciado em ondas com delay seguro para ' + recipientCount + ' leads!');
    }, 2000);
  };

  return (
    <div className="h-[calc(100vh-6rem)] grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* LADO ESQUERDO: COMPOSIÇÃO DA CAMPANHA */}
      <div className="lg:col-span-2 h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Nova Campanha / Disparo</h2>
            <p className="text-sm text-slate-500">Programe disparos, áudios e imagens em massa.</p>
          </div>
        </div>

        <div className="space-y-4 flex-1">
          {/* Audiência */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-3">1. Selecionar Audiência</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={audienceFilter === 'all'} onChange={() => setAudienceFilter('all')} className="accent-blue-600" />
                <span className="text-slate-700 font-medium">Todos os Contatos ({allContacts.length})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={audienceFilter === 'whatsapp'} onChange={() => setAudienceFilter('whatsapp')} className="accent-green-600" />
                <span className="text-slate-700 font-medium">Só WhatsApp</span>
              </label>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm text-slate-500">Contatos selecionados para esta onda:</span>
              <span className="text-xl font-bold text-blue-600">{recipientCount} leads</span>
            </div>
          </div>

          {/* Mensagem e Mídia */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">2. Conteúdo da Mensagem</label>
            <div className="border border-slate-300 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <textarea
                ref={textareaRef}
                className="w-full p-4 outline-none resize-none min-h-[160px] text-slate-700"
                placeholder="Escreva sua mensagem aqui... Use os botões ao lado para inserir variáveis como o nome do cliente."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="bg-slate-50 border-t border-slate-200 p-3 flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  <ImageIcon className="w-4 h-4 text-emerald-500" /> Anexar Imagem
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  <Mic className="w-4 h-4 text-blue-500" /> Áudio Gravado
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleAttemptSend}
            disabled={recipientCount === 0 || isSending}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Send className="w-5 h-5" />
            {isSending ? 'Processando fila...' : `Iniciar Disparo para ${recipientCount} leads`}
          </button>
        </div>
      </div>

      {/* LADO DIREITO: MENU LATERAL DE VARIÁVEIS E ONDAS */}
      <div className="lg:col-span-1 h-full flex flex-col gap-6">
        
        {/* Caixa de Variáveis */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            ✨ Variáveis Inteligentes
          </h3>
          <p className="text-xs text-slate-500 mb-4">Clique para inserir no texto onde o cursor estiver.</p>
          
          <div className="flex flex-wrap gap-2">
            <button onClick={() => insertVariable('{primeiro_nome}')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors">
              {`{primeiro_nome}`}
            </button>
            <button onClick={() => insertVariable('{nome_completo}')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors">
              {`{nome_completo}`}
            </button>
            <button onClick={() => insertVariable('{telefone}')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors">
              {`{telefone}`}
            </button>
            <button onClick={() => insertVariable('{saudacao}')} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium transition-colors" title="Bom dia, Boa tarde ou Boa noite">
              {`{saudacao}`}
            </button>
          </div>
        </div>

        {/* Caixa de Ondas (Funil de Disparo) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              🌊 Sequência de Ondas
            </h3>
            <p className="text-xs text-slate-500 mt-1">Programe ações em sequência.</p>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto space-y-3">
            <div className="flex items-center gap-3 bg-white border border-blue-200 p-3 rounded-xl shadow-sm ring-1 ring-blue-500 ring-offset-1">
              <GripVertical className="w-5 h-5 text-slate-300 cursor-grab" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700">Onda 1: Enviar Agora</p>
                <p className="text-xs text-slate-500">Mensagem de Texto + Imagem</p>
              </div>
            </div>

            <div className="flex justify-center my-2">
              <div className="w-1 h-6 bg-slate-200 rounded-full"></div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <Clock className="w-5 h-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-700">Atraso Programado</p>
                <p className="text-xs text-slate-500">Esperar 2 horas</p>
              </div>
              <Trash2 className="w-4 h-4 text-red-400 cursor-pointer hover:text-red-600" />
            </div>

            <button className="w-full mt-4 py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-all font-medium text-sm flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Adicionar Próxima Onda
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DE SEGURANÇA ANTI-BANIMENTO */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Risco de Banimento!</h3>
              <p className="text-gray-600 mb-6">
                Você está prestes a enviar <strong>{recipientCount} mensagens</strong> de uma só vez. O WhatsApp monitora envios muito rápidos e pode banir seu número por SPAM.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left w-full text-sm text-yellow-800">
                <p className="font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Medidas de Segurança:</p>
                <ul className="list-disc pl-5 space-y-1"><li>Delay de 10 a 25 segundos entre as mensagens.</li><li>O envio total demorará cerca de {Math.ceil((recipientCount * 15) / 60)} minutos.</li></ul>
              </div>
              <div className="flex gap-3 w-full">
                <button onClick={() => setShowWarning(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Voltar</button>
                <button onClick={startBroadcast} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">Compreendo, Enviar!</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
