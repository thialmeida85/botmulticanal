import { useState, useEffect } from 'react';
import { QrCode, RefreshCw, Smartphone, VolumeX, Volume2, CheckCircle2, Users } from 'lucide-react';
import axios from 'axios';

export function WhatsAppConfig() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/whatsapp/mute').then(res => setIsMuted(res.data.isMuted)).catch(() => {});
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    let interval: any;
    // Se o QR Code está na tela, fica checando a cada 5 segundos se o celular já leu
    if (qrCode && status !== 'connected') {
      interval = setInterval(() => checkConnectionStatus(), 5000);
    }
    return () => clearInterval(interval);
  }, [qrCode, status]);

  const checkConnectionStatus = async () => {
    try {
      const res = await axios.get('/api/whatsapp/status');
      if (res.data.state === 'open') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    } catch {
      setStatus('disconnected');
    }
  };

  const toggleMute = async () => {
    try {
      const res = await axios.post('/api/whatsapp/mute', { isMuted: !isMuted });
      setIsMuted(res.data.isMuted);
    } catch (err) {
      console.error('Erro ao alterar status do bot');
    }
  };

  const fetchQRCode = async () => {
    setLoading(true);
    setError(null);
    try {
      // Chama a rota que criamos no backend
      const response = await axios.get('/api/whatsapp/qrcode');
      setQrCode(response.data.qrCode);
    } catch (err: any) {
      console.error('Erro na requisição do QR Code:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Não foi possível carregar o QR Code. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const syncContacts = async () => {
    setSyncingContacts(true);
    setSyncResult(null);
    try {
      const response = await axios.post('/api/whatsapp/sync-contacts');
      setSyncResult(`${response.data.imported} contatos sincronizados com o CRM.`);
    } catch (err: any) {
      setSyncResult(err.response?.data?.error || 'Falha ao sincronizar contatos.');
    } finally {
      setSyncingContacts(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-green-100 text-green-600 rounded-lg">
          <Smartphone className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">WhatsApp Bot</h2>
            <button 
              onClick={toggleMute}
              className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
              title={isMuted ? "Ativar Bot" : "Silenciar Bot"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-sm text-gray-500">
            {isMuted ? "Bot silenciado (Não enviará respostas)" : "Conecte seu aparelho escaneando o código"}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 min-h-[300px]">
        {status === 'checking' ? (
          <div className="flex flex-col items-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
            <p>Verificando conexão...</p>
          </div>
        ) : status === 'connected' ? (
          <div className="flex flex-col items-center text-green-600">
            <CheckCircle2 className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-bold text-gray-800">Bot Conectado!</h3>
            <p className="text-gray-600 text-center mt-2">Seu WhatsApp está ativo e recebendo mensagens.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
            <p>Gerando conexão segura...</p>
          </div>
        ) : qrCode ? (
          <div className="flex flex-col items-center">
            <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded shadow-sm bg-white p-2" />
            <p className="mt-4 text-sm font-medium text-gray-600 text-center">Abra o WhatsApp no celular e escaneie o código acima.</p>
          </div>
        ) : (
          <button
            onClick={fetchQRCode}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            <QrCode className="w-5 h-5" />
            Gerar QR Code
          </button>
        )}
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </div>
      {status === 'connected' && (
        <div className="mt-4">
          <button onClick={syncContacts} disabled={syncingContacts} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
            {syncingContacts ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}
            {syncingContacts ? 'Sincronizando...' : 'Sincronizar contatos do WhatsApp'}
          </button>
          {syncResult && <p className="mt-2 text-center text-sm text-slate-600">{syncResult}</p>}
        </div>
      )}
    </div>
  );
}
