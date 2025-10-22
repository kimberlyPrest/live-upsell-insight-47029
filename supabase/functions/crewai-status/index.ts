const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-user-authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
};

const CREWAI_API_BASE = 'https://upsell-navigator-live-performance-analyzer--dd4ca982.crewai.com';
const CREWAI_BEARER_TOKEN = 'e8d887d0c44e';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // Compatibilidade: aceitar run_id ou task_id via query (front pode continuar usando run_id)

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro obrigatório ausente: task_id ou run_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching status for task_id:', taskId);

    // Headers obrigatórios e repasse de escopo de usuário (se vier do front)
    const forwardHeaders: Record<string, string> = {
      'Authorization': `Bearer ${CREWAI_BEARER_TOKEN}`,
    };
    const userScope = req.headers.get('x-user-authorization');
    if (userScope) {
      forwardHeaders['X-User-Authorization'] = userScope;
    }

    // Novo formato: path param
    const response = await fetch(
      `${CREWAI_API_BASE}/status/${encodeURIComponent(taskId)}`,
      { method: 'GET', headers: forwardHeaders }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CrewAI status error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch status from CrewAI',
          status: response.status,
          details: errorText
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusData = await response.json();
    console.log('CrewAI status response:', statusData);

    return new Response(
      JSON.stringify(statusData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Status check error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
