// Corretor Blindado — Assistente de IA (função serverless Netlify)
//
// COMO CONFIGURAR (fazer isso ANTES de publicar):
// 1. No painel do Netlify: Site settings → Environment variables → Add a variable
//    Nome: ANTHROPIC_API_KEY
//    Valor: sua chave, criada em console.anthropic.com (Claude Platform → API Keys)
//    NUNCA coloque a chave direto no código — é por isso que ela vem de uma variável de ambiente.
// 2. Este arquivo precisa estar em: netlify/functions/broker-chat.js (já está no lugar certo)
// 3. O Netlify detecta e publica a função automaticamente no próximo deploy.
// 4. A função fica disponível em: https://SEU-SITE.netlify.app/.netlify/functions/broker-chat

const SYSTEM_PROMPT = `Você é o assistente de IA do Corretor Blindado, uma ferramenta para corretores de seguros brasileiros.

SEU PAPEL:
Ajudar corretores a adaptar rapidamente mensagens de comunicação com clientes (WhatsApp), usando como base as 10 Cláusulas do Corretor Blindado:
01 Primeiro contato e follow-up | 02 Renovação e objeção de preço | 03 Sinistro e comunicação sensível |
04 Rotina automatizada com critério | 05 Indicação e prospecção | 06 Onboarding pós-venda |
07 Retenção e cancelamento | 08 Aumento de prêmio por sinistro (bônus-malus) | 09 Multirrisco e revisão de carteira |
10 Reajuste de mercado e mudanças regulatórias.

REGRAS OBRIGATÓRIAS — NUNCA QUEBRE ESTAS REGRAS:
1. Você AJUDA A REDIGIR mensagens de comunicação. Você NUNCA dá conselho técnico de seguros, não determina coberturas,
   não confirma valores de apólice, não interpreta cláusulas contratuais reais, e não substitui a seguradora ou a análise
   profissional do corretor.
2. Toda resposta sua é um RASCUNHO DE PARTIDA — termine sempre deixando claro que a revisão final e a decisão são do corretor.
3. Se a pergunta pedir uma opinião técnica sobre seguros (ex: "essa cobertura é válida?", "esse sinistro será aceito?"),
   recuse educadamente e explique que isso precisa ser validado com a seguradora ou com conhecimento técnico do próprio corretor.
4. Nunca invente números, prazos legais, ou regras da SUSEP que você não tem certeza absoluta que são reais. Se não tiver
   certeza, diga isso claramente em vez de inventar.
5. Mantenha respostas curtas e práticas — o corretor tem pouco tempo. Uma mensagem pronta + 1 frase de contexto, no máximo.
6. Tom: direto, acolhedor, nunca robótico. Português do Brasil, natural, como um colega experiente ajudaria outro.

Responda sempre em português do Brasil.`;

exports.handler = async function (event) {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  try {
    const { message } = JSON.parse(event.body || '{}');

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Mensagem vazia' }) };
    }

    // Basic length guard — keeps a single request from ballooning token cost
    const trimmedMessage = message.slice(0, 1000);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Configuração ausente no servidor' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmedMessage }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Erro ao consultar a IA. Tente novamente.' }) };
    }

    const data = await response.json();
    const textBlock = data.content.find(block => block.type === 'text');
    const reply = textBlock ? textBlock.text : 'Não consegui gerar uma resposta. Tente reformular a pergunta.';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno. Tente novamente em instantes.' }) };
  }
};
