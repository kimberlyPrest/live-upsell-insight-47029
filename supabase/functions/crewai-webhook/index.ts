import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== CrewAI Webhook Called ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the webhook payload
    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    const { run_id, status, result, error, report_metadata, report_base64, report_url } = payload;

    if (!run_id) {
      console.error('Missing run_id in webhook payload');
      return new Response(
        JSON.stringify({ error: 'run_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the analysis run in database
    const updateData: any = {
      status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'processing',
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' && result) {
      // Store the report data - CrewAI sends the DOCX as base64 or URL
      if (result.report_url) {
        updateData.report_url = result.report_url;
      } else if (result.report_base64) {
        // If we get base64, we could store it in Supabase Storage
        // For now, we'll just log it
        console.log('Received base64 report (not storing yet)');
      }
      updateData.progress = 100;
    }

    // Also check top-level fields for report
    if (report_url) {
      updateData.report_url = report_url;
    } else if (report_base64) {
      // Create data URL for base64
      updateData.report_url = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${report_base64}`;
    } else if (report_metadata && typeof report_metadata === 'object') {
      // Extract from metadata
      const metadataUrl = report_metadata.url || report_metadata.report_url;
      if (metadataUrl) {
        updateData.report_url = metadataUrl;
      }
    }

    if (error) {
      updateData.error_message = typeof error === 'string' ? error : JSON.stringify(error);
    }

    console.log('Updating run:', run_id, 'with data:', updateData);

    const { data, error: dbError } = await supabase
      .from('analysis_runs')
      .update(updateData)
      .eq('run_id', run_id)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to update analysis run', details: dbError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated analysis run:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
