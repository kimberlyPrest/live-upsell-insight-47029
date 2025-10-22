import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Target, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/FileUpload";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const formSchema = z.object({
  liveName: z.string().trim().min(1, { message: "Nome da live é obrigatório" }),
  salesResult: z.string().trim().min(1, { message: "Resultado de vendas é obrigatório" }),
});

type FormData = z.infer<typeof formSchema>;

interface AnalysisRun {
  id: string;
  run_id: string;
  live_name: string;
  sales_result: string;
  status: 'submitted' | 'processing' | 'completed' | 'failed';
  progress: number;
  report_url: string | null;
  error_message: string | null;
  created_at: string;
}

const Index = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentRuns, setRecentRuns] = useState<AnalysisRun[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // Load recent runs on mount
  useEffect(() => {
    loadRecentRuns();
  }, []);

  const loadRecentRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('analysis_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentRuns(data || []);
    } catch (error) {
      console.error('Error loading recent runs:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    // Validate all files are uploaded
    if (!csvFile || !chatFile || !transcriptFile) {
      toast.error("Por favor, faça upload de todos os arquivos obrigatórios");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get webhook URL (our edge function)
      const webhookUrl = `${window.location.origin}/functions/v1/crewai-webhook`;
      
           // Helper: remove BOM (Byte Order Mark)
      const removeBOM = (text: string): string => text.replace(/^\uFEFF/, '');

      // Helper: normalize CSV headers from Zoom
      const normalizeCsvHeaders = (csvText: string): string => {
      const clean = removeBOM(csvText);
      const lines = clean.split(/\r?\n/);
      if (lines.length === 0) return clean;

      const header = lines[0];
      const replacedHeader = header
        .replace(/Name \(original name\)/i, 'Name')
        .replace(/User Name \(original name\)/i, 'Name')
        .replace(/Name \(Original Name\)/i, 'Name') // sua var. original
        .replace(/Duration \(minutes\)/i, 'Duration')
        .replace(/Recording disclaimer response/i, 'Recording disclaimer')
        .trim();

      if (replacedHeader !== header) {
        lines[0] = replacedHeader;
        return lines.join('\r\n');
      }
      return clean;
      };

      // Read files as text
      console.log("Lendo arquivos...");
      const [csvText, chatText, transcriptText] = await Promise.all([
        csvFile.text(),
        chatFile.text(),
        transcriptFile.text(),
      ]);

      // Clean and normalize content
      const cleanedCsvText = normalizeCsvHeaders(removeBOM(csvText));
      const cleanedChatText = removeBOM(chatText);
      const cleanedTranscriptText = removeBOM(transcriptText);

      // Prepare JSON payload
      const payload = {
        live_name: data.liveName,
        sales_result: data.salesResult,
        participants_csv: cleanedCsvText,
        chat_txt: cleanedChatText,
        transcription_txt: cleanedTranscriptText,
        webhook_url: webhookUrl,
        filename: `relatorio_${data.liveName}.docx`
      };

      // ADICIONE ESTES LOGS TAMBÉM:
      console.log('=== DEBUG PAYLOAD ===');
      console.log('live_name:', data.liveName);
      console.log('sales_result:', data.salesResult);
      console.log('participants_csv length:', cleanedCsvText.length);
      console.log('chat_txt length:', cleanedChatText.length);
      console.log('transcription_txt length:', cleanedTranscriptText.length);
      console.log('webhook_url:', webhookUrl);
      console.log('filename:', payload.filename);

      console.log("Enviando kickoff para CrewAI...");
      console.log("Webhook URL:", webhookUrl);

      // Send to CrewAI as JSON
      const response = await fetch(
        "https://upsell-navigator-live-performance-analyzer--dd4ca982.crewai.com/kickoff",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer e8d887d0c44e",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("CrewAI error:", errorText);
        throw new Error(`Erro ao processar análise: ${response.status} - ${errorText || response.statusText}`);
      }

      const result = await response.json();
      console.log("CrewAI kickoff response:", result);

      // Save to database
      const { data: dbData, error: dbError } = await supabase
        .from('analysis_runs')
        .insert({
          run_id: result.run_id,
          live_name: data.liveName,
          sales_result: data.salesResult,
          status: 'submitted',
          progress: 0,
        })
        .select()
        .single();

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error("Erro ao salvar análise no banco de dados");
      }

      console.log("Análise salva no banco:", dbData);

      toast.success("Análise enviada com sucesso! Acompanhe o progresso abaixo.");
      
      // Reset form
      reset();
      setCsvFile(null);
      setChatFile(null);
      setTranscriptFile(null);

      // Reload recent runs
      loadRecentRuns();
    } catch (error) {
      console.error("Error submitting form:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Erro ao enviar análise. Por favor, tente novamente.";
      
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = csvFile && chatFile && transcriptFile;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      case 'processing':
        return 'Processando';
      case 'submitted':
        return 'Enviado';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <Target className="h-8 w-8 text-primary" />
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Upsell Navigator
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Análise de Performance de Live
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema de análise completa de webinars e lives de vendas
          </p>
        </div>

        {/* Main Form Card */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-card rounded-xl shadow-[var(--shadow-elevated)] p-6 sm:p-8 space-y-6"
        >
          {/* Text Inputs */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="liveName">Nome da Live *</Label>
              <Input
                id="liveName"
                placeholder="Ex: Webinar Elite de Vendas - Janeiro 2024"
                {...register("liveName")}
                className={errors.liveName ? "border-destructive" : ""}
              />
              {errors.liveName && (
                <p className="text-sm text-destructive mt-1">
                  {errors.liveName.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="salesResult">Resultado de Vendas *</Label>
              <Input
                id="salesResult"
                placeholder="Ex: 7 vendas"
                {...register("salesResult")}
                className={errors.salesResult ? "border-destructive" : ""}
              />
              {errors.salesResult && (
                <p className="text-sm text-destructive mt-1">
                  {errors.salesResult.message}
                </p>
              )}
            </div>
          </div>

          {/* File Uploads */}
          <div className="space-y-4">
            <FileUpload
              label="CSV de Participantes *"
              helpText="Deve conter: Name | Join time | Leave time | Duration | Guest | Recording disclaimer"
              accept=".csv"
              file={csvFile}
              onFileChange={setCsvFile}
              error={
                !csvFile && isSubmitting
                  ? "Arquivo CSV é obrigatório"
                  : undefined
              }
            />

            <FileUpload
              label="Chat da Live *"
              helpText="Formato: Nome: mensagem (uma por linha)"
              accept=".txt"
              file={chatFile}
              onFileChange={setChatFile}
              error={
                !chatFile && isSubmitting
                  ? "Arquivo do chat é obrigatório"
                  : undefined
              }
            />

            <FileUpload
              label="Transcrição *"
              helpText="Transcrição completa da apresentação"
              accept=".txt,.json,.srt,.vtt"
              file={transcriptFile}
              onFileChange={setTranscriptFile}
              error={
                !transcriptFile && isSubmitting
                  ? "Arquivo de transcrição é obrigatório"
                  : undefined
              }
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                🚀 Analisar Performance
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Tamanho máximo por arquivo: 50MB
          </p>
        </form>

        {/* Recent Runs Section */}
        {recentRuns.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Análises Recentes</h2>
            <div className="space-y-3">
              {recentRuns.map((run) => (
                <Card key={run.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(run.status)}
                        <div>
                          <h3 className="font-semibold">{run.live_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {run.sales_result} • {new Date(run.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{getStatusText(run.status)}</span>
                        {run.progress > 0 && run.status !== 'completed' && (
                          <span className="text-sm text-muted-foreground">({run.progress}%)</span>
                        )}
                      </div>
                      {run.error_message && (
                        <p className="text-sm text-destructive mt-1">{run.error_message}</p>
                      )}
                    </div>
                    {run.report_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(run.report_url!, '_blank')}
                      >
                        Download Relatório
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
