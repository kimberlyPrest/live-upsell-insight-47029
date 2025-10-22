-- Create function to update timestamps (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create enum for analysis status
CREATE TYPE public.analysis_status AS ENUM (
  'submitted',
  'processing',
  'completed',
  'failed'
);

-- Create table for analysis runs
CREATE TABLE public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL UNIQUE,
  live_name TEXT NOT NULL,
  sales_result TEXT NOT NULL,
  status analysis_status NOT NULL DEFAULT 'submitted',
  progress INTEGER DEFAULT 0,
  report_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (public access for this MVP)
CREATE POLICY "Anyone can view analysis runs"
  ON public.analysis_runs
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create analysis runs"
  ON public.analysis_runs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update analysis runs"
  ON public.analysis_runs
  FOR UPDATE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_analysis_runs_updated_at
  BEFORE UPDATE ON public.analysis_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX idx_analysis_runs_run_id ON public.analysis_runs(run_id);
CREATE INDEX idx_analysis_runs_status ON public.analysis_runs(status);
CREATE INDEX idx_analysis_runs_created_at ON public.analysis_runs(created_at DESC);