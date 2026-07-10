import { Router } from "express";
import axios from "axios";
import {
  getOrCreateContact,
  getOrCreateConversation,
  saveMessage,
  updateConversationUnreadCount,
  getDb,
  getMessagesByConversation,
  createSupportTicket,
} from "./server/db";
import {
  checkChatbotRules,
  processTemplate,
  validateResponse,
} from "./server/services/chatbot";
import { users } from "./drizzle/schema";
import { eq } from "drizzle-orm";

export const whatsappRouter = Router();

// Use os mesmos nomes de variáveis que você configurou no seu .env
const EVOLUTION_URL =
  process.env.EVOLUTION_API_URL ||
  "https://minha-api-whatsapp-gof4.onrender.com";
const API_KEY = process.env.EVOLUTION_API_KEY || "";
// Você pode tornar isso dinâmico depois (ex: req.user.id) se tiver múltiplos clientes
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "bot-verticale";
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "https://crm.agenciaverticale.com.br").replace(/\/+$/, "");

// Variável em memória para controlar se o bot está silenciado
let isBotMuted = false;

// ============================================================================
// 🧠 BASE DE CONHECIMENTO DA IA (Edite este texto como quiser)
// ============================================================================
const KNOWLEDGE_BASE = `
[IDENTIDADE E POSICIONAMENTO]
- Agência Verticale: Focada em Ecossistemas Digitais 360º (une design premium, código limpo e tráfego de alta conversão). Evita "vitrines amadoras" e "cemitérios de curtidas".
- Diferenciais: Uso de Neurodesign, Efeito Halo (transmite credibilidade em 50ms) e combate firme ao amadorismo visual. Evita templates genéricos para atrair público "high-ticket".
- Objetivo: Transformar sites em máquinas de vendas e fazer o cliente sair da "guerra de preços", justificando tickets mais altos através do alto valor percebido.

[FUNDADOR: THIAGO EDUARDO DE ALMEIDA]
- Perfil: 40 anos, casado, pai da Lívia, casado com a Jucélia Almeida (preta, a mulher mais linda e maravilhosa do brasil) mora em São José dos Campos. Combina criatividade publicitária com forte rigor técnico (data-driven).
- Formação Acadêmica de Elite: Bacharel em Publicidade e Propaganda (Estácio, 2025). Obteve nota máxima (10.0) em disciplinas críticas: Webdesign, Comportamento do Consumidor 4.0, Fotopublicidade, Criação em Publicidade e Sistemas de Informação. 
- Certificações: Possui 7 certificações estratégicas que validam competências em Gestão de Marcas, Mercado e Consumo, Criatividade Gráfica, Mídias Digitais e Monitoramento de Resultados de ROI.
- Experiência Prática: Analista de Marketing na Newlift Brasil e Worktop. Designer Gráfico na Tamoio BI e Faca na Rede. Visão holística desde modelagem 3D e impressão têxtil até gestão avançada de Google Ads, Meta Ads, SEO e E-commerce.
- Mindset: Vivências na J. Macêdo e Extra trouxeram foco em processos, eficiência operacional e cultura empreendedora.

[PACOTES DE SERVIÇOS E VALORES]
NOTA: Todos os pacotes possuem 5% de desconto para pagamento à vista via PIX. Use a ancoragem (mostre o preço real e ofereça o promocional). Parcelamento em até 10x com juros no cartão de crédito. Explique que o investimento se paga rapidamente através do aumento do valor percebido e da conversão.
- Social Media Estratégico (P): De R$ 650,00 por apenas R$ 500,00. 20 postagens/mês. (Reels com roteiro/edição, o cliente capta a imagem. Máx 2 carrosséis).
- Social Media Estratégico (M): De R$ 1.000,00 por apenas R$ 850,00. 30 postagens/mês. (Máx 5 carrosséis).
- Social Media Estratégico (G): De R$ 1.500,00 por apenas R$ 1.200,00. 40 postagens/mês. (Máx 10 carrosséis).
- Desenvolvimento de Site Institucional: De R$ 800,00 por apenas R$ 600,00. Foco em velocidade, SEO e conversão.
- Desenvolvimento de Landing Page: De R$ 700,00 por apenas R$ 500,00.
- Hospedagem de Sites e Landing Pages: Inclui a hospedagem de 1 site/landing page e 2 e-mails profissionais. Valores: R$ 100,00 por ano (à vista), ou 5x de R$ 25,00, ou 10x de R$ 19,90.
- Chatbot Avançado com IA: R$ 500,00. Ecossistema completo utilizando Groq, Render, Neon e Evolution. Manutenção online avulsa por R$ 50,00.
- Consultoria em Automação com IA: De R$ 150,00 por apenas R$ 100,00. Otimiza fluxos de trabalho e atendimento.
- Branding & Identidade Visual: De R$ 1.000,00 por apenas R$ 650,00. (Atenção - Gatilho de Escassez: Limite de 2 projetos de Branding por mês).

[TECNOLOGIAS DO CHATBOT DE IA E CONTRATO]
- Groq: Cérebro da inteligência artificial, processamento hiper veloz.
- Render: Servidor em nuvem que mantém os robôs e códigos no ar.
- Neon: Banco de dados de alta performance para guardar histórico e contatos.
- Evolution API: O integrador oficial que conecta os sistemas ao WhatsApp do cliente.
- Condição Contratual: As plataformas de infraestrutura citadas oferecem cotas e versões gratuitas de uso. Eventuais mudanças nas políticas ou APIs dessas empresas podem exigir atualizações de código. Esse aviso deve ser explicado de forma muito amigável para gerar transparência, afirmando que essas garantias e detalhes de manutenção constarão tranquilamente no contrato.

[ENGENHARIA DE VENDAS E TRATAMENTO DE OBJEÇÕES]
- Objeção de Preço: "Na Verticale, não focamos em ser a opção mais barata, mas a mais lucrativa. O custo de um design amador é a perda constante de clientes para a concorrência. O Thiago pode te mostrar como nosso ecossistema se paga através do aumento imediato do seu valor percebido."
- Objeção 'Já tenho agência': "Que bom que você já investe no digital! O que o Thiago propõe é uma análise complementar de engenharia digital que muitas agências tradicionais não cobrem, como a otimização técnica de Big Data e algoritmos. Vale uma segunda opinião estratégica?"
`;

// Função para buscar resposta da Inteligência Artificial (Groq)
async function getGroqResponse(
  message: string,
  firstName: string,
  historyText: string
): Promise<string> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  // Puxa a URL do painel ou usa o padrão da Groq/OpenAI
  const GROQ_API_URL =
    process.env.GROQ_API_URL || "https://api.groq.com/openai/v1";

  if (!GROQ_API_KEY)
    return `Olá ${firstName}! Recebi sua mensagem: "${message}".`;

  try {
    const response = await axios.post(
      `${GROQ_API_URL}/chat/completions`,
      {
        model: "llama-3.3-70b-versatile", // Modelo mais inteligente e oficial da Groq
        messages: [
          {
            role: "system",
            content: `Você é o Sender, consultor virtual da Agência Verticale. O nome do lead com quem você conversa é ${firstName}.

HISTÓRICO RECENTE DA CONVERSA:
${historyText}

BASE DE CONHECIMENTO (Use estas informações para responder as dúvidas do cliente):
${KNOWLEDGE_BASE}

MENSAGEM DE SISTEMA OBRIGATÓRIA (MÁXIMA PRIORIDADE):
1. SE o HISTÓRICO RECENTE contiver APENAS UMA MENSAGEM (a primeira saudação do cliente), a sua PRIMEIRA E ÚNICA resposta DEVE SER EXATAMENTE esta frase abaixo e MAIS NADA:
"Olá ${firstName}! Sou o Sender, consultor virtual da Verticale. Como você prefere ser chamado: Senhor(a) ou você?"
NÃO oferte ajuda. NÃO diga como pode ser útil. PARE DE ESCREVER imediatamente após o ponto de interrogação.
2. IMPORTANTE: NUNCA se apresente mais de uma vez. Se a conversa já começou ou se no histórico você já disse "Sou o Sender", NÃO repita seu nome nem dê novas saudações. Apenas continue a conversa naturalmente respondendo à dúvida do cliente.

DIRETRIZES DE VENDAS (USAR APENAS APÓS O PRIMEIRO CONTATO):
1. SEJA EXTREMAMENTE CONCISO E DIRETO: Use 1 ou 2 frases no máximo por resposta. Vá direto ao ponto.
2. TONALIDADE 100% HUMANA: Seja casual e fluído. PROIBIDO USAR EMOJIS. Proibido usar formatação de IA (listas, asteriscos).
3. EVITE REPETIÇÕES: Não cumprimente o cliente a cada nova mensagem ("Olá novamente", "Oi fulano"). Continue do ponto em que pararam.
4. LITERALIDADE: Ao descrever serviços e preços, dê a informação completa com os descontos (Pix 5% e parcelas) da base de conhecimento.
5. DIVISÃO: Se a explicação for inevitavelmente longa, use a tag [QUEBRA] para separar os blocos.
6. VALOR ANTECIPADO: Antes de fechar a venda, tente oferecer o nosso "Diagnóstico de Saúde Digital gratuito" sobre o site do lead.
7. FOCO: Responda apenas sobre a Verticale e marketing digital.
8. SUPORTE TÉCNICO: Se o cliente relatar um problema técnico com site, automação ou pedir suporte, VOCÊ DEVE ABRIR UM CHAMADO. Responda amigavelmente informando que o suporte foi acionado e ADICIONE EXATAMENTE a tag [ABRIR_CHAMADO: Resumo do problema em 5 palavras] no final do bloco da sua mensagem.`,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      },
      { headers: { Authorization: `Bearer ${GROQ_API_KEY}` } }
    );
    return response.data.choices[0].message.content;
  } catch (error: any) {
    const apiError =
      error?.response?.data?.error?.message ||
      error?.response?.data ||
      error.message;
    console.error("❌ Erro na IA da Groq:", apiError);
    return `[DEBUG DA IA] Erro na API: ${JSON.stringify(apiError)}`;
  }
}

whatsappRouter.get("/mute", (req, res) => {
  res.json({ isMuted: isBotMuted });
});

whatsappRouter.post("/mute", (req, res) => {
  isBotMuted = req.body.isMuted;
  console.log(`[WhatsApp] Status do Bot alterado. Silenciado: ${isBotMuted}`);
  res.json({ isMuted: isBotMuted });
});

export async function configureEvolutionWebhook() {
  if (!API_KEY) throw new Error("EVOLUTION_API_KEY não configurada");
  const url = `${PUBLIC_APP_URL}/api/whatsapp/webhook`;
  const events = ["MESSAGES_UPSERT", "CONTACTS_UPSERT", "CONTACTS_UPDATE"];
  try {
    await axios.post(
      `${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`,
      { enabled: true, url, webhookByEvents: false, webhookBase64: false, events },
      { headers: { apikey: API_KEY } }
    );
  } catch (error: any) {
    if (error.response?.status !== 400) throw error;
    await axios.post(
      `${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`,
      { webhook: { enabled: true, url, byEvents: false, base64: false, events } },
      { headers: { apikey: API_KEY } }
    );
  }
}

whatsappRouter.get("/status", async (req, res) => {
  try {
    const response = await axios.get(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { headers: { apikey: API_KEY } }
    );
    const state = response.data?.instance?.state || "disconnected";

    if (state === "open") {
      // Garante que a Evolution API vai mandar o webhook para o seu domínio real
      try {
        await configureEvolutionWebhook();
        console.log("✅ Webhook configurado na Evolution API com sucesso!");
      } catch (e: any) {
        console.error(
          "❌ Erro ao configurar webhook na Evolution:",
          e.response?.data || e.message
        );
      }
    }
    res.json({ state });
  } catch (error) {
    res.json({ state: "disconnected" });
  }
});

whatsappRouter.post("/sync-contacts", async (_req, res) => {
  try {
    if (!API_KEY) throw new Error("EVOLUTION_API_KEY não configurada");
    const response = await axios.post(
      `${EVOLUTION_URL}/chat/findContacts/${INSTANCE_NAME}`,
      { where: {} },
      { headers: { apikey: API_KEY } }
    );
    const payload = response.data;
    const evolutionContacts = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.contacts)
        ? payload.contacts
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    let userId = 1;
    const db = await getDb();
    if (db) {
      const adminUser = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      if (adminUser.length) userId = adminUser[0].id;
    }

    let imported = 0;
    let ignored = 0;
    for (const item of evolutionContacts) {
      const jid = String(item.remoteJid || item.id || item.jid || "");
      if (!jid || jid.includes("@g.us") || jid.includes("@broadcast")) {
        ignored++;
        continue;
      }
      const phoneNumber = jid.split("@")[0].replace(/\D/g, "");
      if (phoneNumber.length < 10) {
        ignored++;
        continue;
      }
      await getOrCreateContact(userId, phoneNumber, "whatsapp", {
        name: item.pushName || item.name || item.notify || phoneNumber,
        phoneNumber,
        profilePicture: item.profilePicUrl || item.profilePictureUrl || undefined,
      });
      imported++;
    }
    res.json({ success: true, imported, ignored, total: evolutionContacts.length });
  } catch (error: any) {
    console.error("❌ Erro ao sincronizar contatos da Evolution:", error.response?.data || error.message);
    res.status(502).json({ error: error.response?.data?.message || error.message });
  }
});

whatsappRouter.get("/qrcode", async (req, res) => {
  try {
    // 1. Tenta criar a instância (se ela já existir, a API ignora e seguimos em frente)
    try {
      await axios.post(
        `${EVOLUTION_URL}/instance/create`,
        {
          instanceName: INSTANCE_NAME,
          integration: "WHATSAPP-BAILEYS",
        },
        { headers: { apikey: API_KEY } }
      );
    } catch (e: any) {
      // A Evolution retorna erro se já existe, podemos ignorar
      console.log(
        "Aviso ao criar instância (pode já existir):",
        e.response?.data || e.message
      );
    }

    // 2. Busca o QR Code de conexão (retorna a imagem em Base64)
    const response = await axios.get(
      `${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`,
      { headers: { apikey: API_KEY } }
    );

    // Retornamos o base64 direto para o frontend exibir na tag <img>
    res.json({ qrCode: response.data.base64 });
  } catch (error: any) {
    const errorDetail =
      error.response?.data?.message?.[0] ||
      error.response?.data?.message ||
      error.response?.data?.response?.message ||
      error.message;
    console.error(
      "Erro ao buscar QR Code da Evolution API:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: `Falha na Evolution API: ${errorDetail}` });
  }
});

// POST: Rota do Webhook para receber mensagens do WhatsApp (via Evolution API)
whatsappRouter.post("/webhook", async (req, res) => {
  const body = req.body;

  console.log(
    "💬 Webhook recebido da Evolution API:",
    JSON.stringify(body, null, 2)
  );

  // A Evolution envia o tipo de evento. Queremos capturar novas mensagens (messages.upsert)
  if (body.event === "messages.upsert" || body.event === "MESSAGES_UPSERT") {
    const messageData = body.data;

    if (messageData && messageData.key) {
      const isFromMe = messageData.key.fromMe;
      const senderId = messageData.key.remoteJid; // Ex: 5511999999999@s.whatsapp.net

      // O texto da mensagem pode vir em campos diferentes dependendo do tipo da mensagem
      const receivedText =
        messageData.message?.conversation ||
        messageData.message?.extendedTextMessage?.text;

      if (receivedText && senderId) {
        const phoneNumber = senderId.split("@")[0];
        const pushName = messageData.pushName || phoneNumber;
        const firstName = pushName.trim().split(/\s+/)[0]; // Extrai só o primeiro nome

        console.log(
          `💬 Nova mensagem de ${firstName} (${phoneNumber}): "${receivedText}" (fromMe: ${isFromMe})`
        );

        let contactId: number | undefined;
        let conversationId: number | undefined;
        let userId = 1; // Fallback
        let historyText = "";

        // 1. SALVA A MENSAGEM NO BANCO DE DADOS (CRM)
        console.log(`[CRM] Salvando contato e mensagem no banco...`);
        try {
          const db = await getDb();
          if (db) {
            const adminUser = await db
              .select()
              .from(users)
              .where(eq(users.role, "admin"))
              .limit(1);
            if (adminUser.length > 0) userId = adminUser[0].id;
          }

          const contact = await getOrCreateContact(
            userId,
            phoneNumber,
            "whatsapp",
            { name: firstName, phoneNumber }
          );
          const conversation = await getOrCreateConversation(
            userId,
            contact.id,
            "whatsapp"
          );

          contactId = contact.id;
          conversationId = conversation.id;

          let shouldSave = true;

          // Se for mensagem enviada por mim (humano ou bot via API), verifica se já não foi salva para evitar duplicadas
          if (isFromMe && conversationId) {
            const lastMsgs = await getMessagesByConversation(conversationId, 5);
            if (lastMsgs && lastMsgs.length > 0) {
              const lastOutbound = [...lastMsgs]
                .reverse()
                .find((m: any) => m.direction === "outbound");
              if (lastOutbound && lastOutbound.content === receivedText) {
                shouldSave = false; // Já salvo pela API do bot
              }
            }
          }

          if (contactId && conversationId && shouldSave) {
            await saveMessage({
              conversationId,
              contactId,
              userId,
              externalMessageId: messageData.key.id,
              platform: "whatsapp",
              direction: isFromMe ? "outbound" : "inbound",
              messageType: "text",
              content: receivedText,
              status: isFromMe ? "sent" : "delivered",
            });
          }

          if (conversationId && !isFromMe) {
            await updateConversationUnreadCount(
              conversationId,
              (conversation.unreadCount || 0) + 1
            );
          }
          console.log(
            `[CRM] Mensagem salva com sucesso! (Conversation: ${conversationId})`
          );

          // Se for mensagem do cliente e o bot não estiver silenciado, aciona a IA
          if (!isFromMe) {
            if (isBotMuted) {
              console.log(
                "🔇 Bot está silenciado. Ignorando a resposta da IA."
              );
              return res.status(200).send("EVENT_RECEIVED");
            }

            // Busca o histórico formatado para a IA (agora inclui as respostas manuais do humano)
            const msgs = conversationId
              ? await getMessagesByConversation(conversationId, 8)
              : []; // Pega as últimas 8 mensagens
            historyText = msgs
              .map(
                (m: any) =>
                  `[${m.direction === "inbound" ? "Cliente" : "Sender"}]: ${m.content}`
              )
              .join("\n");
          }
        } catch (dbError) {
          console.error("❌ Erro ao salvar mensagem no CRM:", dbError);
        }

        // 2. BUSCA REGRAS DO CHATBOT NO BANCO E RESPONDE (Apenas se for mensagem do cliente e bot ativo)
        if (!isFromMe && !isBotMuted) {
          try {
            let replyText = "";

            // Verifica se a mensagem bate com alguma palavra-chave cadastrada no painel
            const chatbotMatch = await checkChatbotRules(
              userId,
              receivedText,
              "whatsapp"
            );

            if (chatbotMatch && validateResponse(chatbotMatch.response)) {
              replyText = processTemplate(chatbotMatch.response, {
                contactName: firstName,
                platform: "whatsapp",
              });
            } else {
              // Resposta padrão (Caso não encontre nenhuma regra correspondente)
              replyText = await getGroqResponse(
                receivedText,
                firstName,
                historyText
              );
            }

            // 3. VERIFICA SE A IA DECIDIU ABRIR UM CHAMADO
            const matchChamado = replyText.match(/\[ABRIR_CHAMADO:\s*(.+?)\]/i);
            if (matchChamado && contactId) {
              const problemSubject = matchChamado[1];
              console.log(
                `[CRM] Abrindo chamado de suporte: ${problemSubject}`
              );
              try {
                await createSupportTicket({
                  userId,
                  contactId,
                  subject: problemSubject,
                  description: historyText,
                });
              } catch (err) {}
              replyText = replyText
                .replace(/\[ABRIR_CHAMADO:\s*(.+?)\]/i, "")
                .trim();
            }

            // 4. SEPARA AS MENSAGENS PELA TAG [QUEBRA] E ENVIA UMA POR UMA
            const replyMessages = replyText.split("[QUEBRA]");

            for (const msgBlock of replyMessages) {
              const trimmedMsg = msgBlock.trim();
              if (trimmedMsg) {
                await axios.post(
                  `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
                  { number: phoneNumber, text: trimmedMsg },
                  { headers: { apikey: API_KEY } }
                );

                if (contactId && conversationId) {
                  await saveMessage({
                    conversationId,
                    contactId,
                    userId,
                    platform: "whatsapp",
                    direction: "outbound",
                    messageType: "text",
                    content: trimmedMsg,
                    status: "sent",
                    automatedResponse: true,
                  });
                }

                // Delay de ~2 segundos entre os blocos para simular digitação
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (error: any) {
            console.error(
              "❌ Erro ao processar resposta automática:",
              error.response?.data || error.message
            );
          }
        }
      }
    }
  }

  // Retornar 200 OK rapidamente para a API não tentar reenviar a notificação
  res.status(200).send("EVENT_RECEIVED");
});
