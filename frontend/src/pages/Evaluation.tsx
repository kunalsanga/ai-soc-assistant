import { BarChart3, AlertCircle } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';

const Evaluation: React.FC = () => {
  const comparisonModels = [
    {
      name: 'Baseline Pretrained LLM Only',
      type: 'Direct Generation',
      grounding: 'None (Parametric Memory)',
      hallucinationRisk: 'High (Prone to fabrication)',
      verification: 'Manual Review Required',
      pros: 'Fast, minimal architecture overhead',
      cons: 'Lacks real-time CVE knowledge, invents remediation parameters',
    },
    {
      name: 'Standard Semantic RAG',
      type: 'Naive Vector Retrieval',
      grounding: 'Unfiltered Context Window',
      hallucinationRisk: 'Moderate (Irrelevant chunk pollution)',
      verification: 'Partial Citations',
      pros: 'Incorporates external documents and documentation',
      cons: 'Retrieves low-relevance SOP chunks without authority ranking',
    },
    {
      name: 'Evidence-Aware SecOps RAG (Our Platform)',
      type: 'Multi-Source Grounded RAG',
      grounding: 'NIST SP 800-61 + MITRE ATT&CK Matrix',
      hallucinationRisk: 'Ultra-Low (Citation Enforced)',
      verification: 'Deterministic Citation Linkage',
      pros: 'Claims mapped to verified NIST/MITRE references, human sign-off',
      cons: 'Higher latency due to validation pipeline',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="RAG Model Research & Evaluation"
        subtitle="Comparative analysis of LLM reasoning modalities, evidence grounding rigor, and hallucination reduction metrics."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Platform' },
          { label: 'Evaluation' },
        ]}
        badge={
          <span className="font-mono text-xs text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/40">
            Empirical Benchmark Pending
          </span>
        }
      />

      {/* Honest Research Status Notice */}
      <div className="card p-5 border-amber-500/30 bg-amber-950/10 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>RESEARCH & BENCHMARKING STATUS: EVALUATION RUN PENDING</span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">
          In adherence to data honesty guidelines, empirical numerical benchmark scores (e.g. F1, BLEU, or hallucination percentage rates) are not fabricated. Quantitative validation runs across synthetic test corpora will populate this dashboard upon completion of the backend test harness.
        </p>
      </div>

      {/* Modality Comparison Matrix */}
      <div className="card p-6 space-y-5 bg-[#090d16] border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">
              Architectural Paradigm Comparison
            </h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase">
            Theoretical Formulation
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {comparisonModels.map((model, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 ${
                idx === 2
                  ? 'bg-cyan-950/20 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                  : 'bg-[#0c101a] border-zinc-800'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-bold text-zinc-100">{model.name}</h3>
                  {idx === 2 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 shrink-0">
                      Our Proposed System
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs font-mono text-zinc-400 pt-2 border-t border-zinc-800/80">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Method:</span>
                    <span className="text-zinc-300">{model.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Grounding:</span>
                    <span className="text-zinc-300 text-right">{model.grounding}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Hallucination:</span>
                    <span
                      className={
                        idx === 2
                          ? 'text-emerald-400 font-bold'
                          : idx === 1
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }
                    >
                      {model.hallucinationRisk}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Verification:</span>
                    <span className="text-zinc-300">{model.verification}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-zinc-800/80 text-xs font-sans">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold block">
                    Advantage:
                  </span>
                  <p className="text-zinc-300 text-[11px] mt-0.5">{model.pros}</p>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-rose-400 uppercase font-semibold block">
                    Vulnerability:
                  </span>
                  <p className="text-zinc-400 text-[11px] mt-0.5">{model.cons}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Planned Evaluation Metrics Framework */}
      <div className="card p-6 bg-[#0c101a] border-zinc-800 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200 border-b border-zinc-800 pb-3">
          Planned Evaluation Dimensions & Methodology
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-1.5">
            <span className="font-mono text-cyan-400 font-semibold text-xs block">
              1. Evidence Grounding Precision
            </span>
            <p className="text-zinc-400 leading-relaxed font-sans">
              Percentage of claims in the generated AI analysis that correlate with an authoritative NIST SP 800-61 or MITRE ATT&CK document citation.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-1.5">
            <span className="font-mono text-cyan-400 font-semibold text-xs block">
              2. Hallucination Suppression Rate
            </span>
            <p className="text-zinc-400 leading-relaxed font-sans">
              Frequency of unverified IP addresses, fake rule recommendations, or non-existent CVE strings generated in incident summaries.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-[#090d16] border border-zinc-800 space-y-1.5">
            <span className="font-mono text-cyan-400 font-semibold text-xs block">
              3. Triage Time-to-Remediation (TTR)
            </span>
            <p className="text-zinc-400 leading-relaxed font-sans">
              Reduction in analyst investigation minutes when presented with pre-correlated context and synthesized containment playbooks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Evaluation;
