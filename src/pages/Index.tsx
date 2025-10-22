import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUpload } from "@/components/FileUpload";
import { toast } from "sonner";
import { fileToBase64 } from "@/lib/fileUtils";

const formSchema = z.object({
  liveName: z.string().trim().min(1, { message: "Nome da live é obrigatório" }),
  salesResult: z.string().trim().min(1, { message: "Resultado de vendas é obrigatório" }),
});

type FormData = z.infer<typeof formSchema>;

const Index = () => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    // Validate all files are uploaded
    if (!csvFile || !chatFile || !transcriptFile) {
      toast.error("Por favor, faça upload de todos os arquivos obrigatórios");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare FormData
      const formData = new FormData();
      
      // Add inputs as JSON string
      formData.append('inputs', JSON.stringify({
        live_name: data.liveName,
        sales_result: data.salesResult,
      }));
      
      // Add files with correct names
      formData.append('participantes.csv', csvFile);
      formData.append('chat.txt', chatFile);
      formData.append('transcricao.txt', transcriptFile);

      // Send to API
      console.log("Enviando requisição para a API...");
      console.log("Inputs:", {
        live_name: data.liveName,
        sales_result: data.salesResult,
      });

      const response = await fetch(
        "https://upsell-navigator-live-performance-analyzer--dd4ca982.crewai.com/kickoff",
        {
          method: "POST",
          headers: {
            "Authorization": "Bearer e8d887d0c44e",
          },
          body: formData,
        }
      );

      console.log("Response status:", response.status);
      console.log("Response statusText:", response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Erro ao processar análise: ${response.status} - ${errorText || response.statusText}`);
      }

      const result = await response.json();
      console.log("Success response:", result);

      toast.success("Análise enviada com sucesso! O relatório será gerado em breve.");
      
      // Reset form
      setCsvFile(null);
      setChatFile(null);
      setTranscriptFile(null);
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
      </div>
    </div>
  );
};

export default Index;
