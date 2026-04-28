import React, { useState, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Upload, FileText, BarChart2, ShieldAlert, Sparkles, Download, 
  Settings, ChevronRight, AlertTriangle, CheckCircle2, 
  Info, Database, RefreshCw, MessageSquare, Layers, UserCheck, 
  Globe, BookOpen, FilePieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { SAMPLE_DATA, PROTECTED_ATTRIBUTES, DOMAINS, DEMO_PRESETS, COMPLIANCE_MAP, CASE_STUDIES } from './constants';
import { DataRow, BiasFinding, AnalysisSummary, IntersectionalFinding } from './types';
import { streamGeminiAnalysis } from './services/geminiService';

export default function App() {
  // State
  const [activeTab, setActiveTab] = useState<'analyze' | 'results' | 'fix'>('analyze');
  const [data, setData] = useState<DataRow[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [targetColumn, setTargetColumn] = useState('hired');
  const [protectedAttributes, setProtectedAttributes] = useState<string[]>(['gender', 'race']);
  const [domain, setDomain] = useState('Hiring');
  
  // Analysis State
  const [findings, setFindings] = useState<BiasFinding[]>([]);
  const [intersectionalFindings, setIntersectionalFindings] = useState<IntersectionalFinding[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  
  // Simulation State
  const [counterfactualSource, setCounterfactualSource] = useState<DataRow | null>(null);
  const [simulateOutcome, setSimulateOutcome] = useState<{ original: any, flipped: any, isBiased: boolean } | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [checkedFixes, setCheckedFixes] = useState<Record<number, boolean>>(() => {
    const saved = localStorage.getItem('fairlens_checked_fixes');
    return saved ? JSON.parse(saved) : {};
  });

  const handleFixToggle = (index: number) => {
    const newChecked = { ...checkedFixes, [index]: !checkedFixes[index] };
    setCheckedFixes(newChecked);
    localStorage.setItem('fairlens_checked_fixes', JSON.stringify(newChecked));
  };

  // Helpers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          const parsedData = results.data as DataRow[];
          setData(parsedData);
          // Auto-detect protected attributes
          const columns = Object.keys(parsedData[0] || {});
          const detected = columns.filter(col => 
            PROTECTED_ATTRIBUTES.includes(col.toLowerCase())
          );
          setProtectedAttributes(detected);
        }
      });
    }
  };

  const loadSample = () => {
    setData(SAMPLE_DATA);
    setProtectedAttributes(['gender', 'race']);
  };

  const loadPreset = (presetName: string) => {
    const preset = DEMO_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    setData(preset.data as DataRow[]);
    setTargetColumn(preset.target);
    setProtectedAttributes(preset.protected);
    setDomain(preset.domain);
    // Reset results
    setSummary(null);
    setFindings([]);
    setIntersectionalFindings([]);
  };

  const binValue = (val: any, col: string) => {
    if (col.toLowerCase() === 'age' && typeof val === 'number') {
      if (val <= 30) return '18-30 (Young)';
      if (val <= 45) return '31-45 (Mid-career)';
      if (val <= 60) return '46-60 (Senior)';
      return '60+ (Late career)';
    }
    return String(val);
  };

  const generateAIInsights = async (currentFindings: BiasFinding[], currentSummary: AnalysisSummary) => {
    if (!apiKey) return;
    
    setIsAiLoading(true);
    setAiAnalysis('');
    
    const prompt = `
      As an AI Fairness Auditor, analyze the following bias findings for a ${domain} dataset.
      Findings: ${JSON.stringify(currentFindings)}
      Summary: ${JSON.stringify(currentSummary)}
      
      Requirements:
      1. Provide a concise narrative analysis of the biggest risks.
      2. Identify specific demographic groups being disadvantaged.
      3. Explain the severity levels based on legal and ethical standards.
      4. Avoid jargon, speak to business stakeholders.
      Keep it structured with bullet points.
    `;

    try {
      for await (const chunk of streamGeminiAnalysis(apiKey, prompt)) {
        setAiAnalysis(prev => prev + chunk);
      }
    } catch (err) {
      console.error(err);
      setAiAnalysis('Error generating analysis. Please check your API key and network.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const runAnalysis = useCallback(() => {
    if (data.length === 0) return;

    const newFindings: BiasFinding[] = [];
    const interFindings: IntersectionalFinding[] = [];
    let totalImpact = 0;
    let high = 0;
    let med = 0;

    // 1. Single Attribute Analysis
    protectedAttributes.forEach(attr => {
      const binnedData = data.map(row => ({
        ...row,
        [attr]: binValue(row[attr], attr)
      }));

      const groups = Array.from(new Set(binnedData.map(row => String(row[attr]))));
      const rates = groups.map(group => {
        const groupData = binnedData.filter(row => String(row[attr]) === group);
        const positiveOutcomes = groupData.filter(row => !!row[targetColumn]).length;
        const rate = positiveOutcomes / groupData.length;
        return { group: group as string, rate, sampleSize: groupData.length };
      });

      const maxRate = Math.max(...rates.map(r => r.rate)) || 1;
      const minRate = Math.min(...rates.map(r => r.rate));
      const ratio = minRate / maxRate;
      const disparity = (maxRate - minRate) * 100;

      let severity: 'High' | 'Medium' | 'Low' = 'Low';
      if (disparity > 25) {
        severity = 'High';
        high++;
      } else if (disparity > 12) {
        severity = 'Medium';
        med++;
      }

      const disadvantaged = rates.find(r => r.rate === minRate)?.group || 'N/A';

      newFindings.push({
        attribute: attr,
        metric: ratio,
        disparity,
        severity,
        groupsAffected: rates.filter(r => r.rate === minRate).map(r => r.group as string),
        mostDisadvantagedGroup: disadvantaged,
        outcomeRates: rates.map(r => ({ group: r.group as string, rate: r.rate }))
      });

      totalImpact += ratio;
    });

    // 2. Intersectional Analysis (Top 2 attributes)
    if (protectedAttributes.length >= 2) {
      const a1 = protectedAttributes[0];
      const a2 = protectedAttributes[1];
      const matrix: any[] = [];
      const groups1 = Array.from(new Set(data.map(row => binValue(row[a1], a1))));
      const groups2 = Array.from(new Set(data.map(row => binValue(row[a2], a2))));

      groups1.forEach(g1 => {
        groups2.forEach(g2 => {
          const jointData = data.filter(row => binValue(row[a1], a1) === g1 && binValue(row[a2], a2) === g2);
          if (jointData.length > 0) {
            const positives = jointData.filter(row => !!row[targetColumn]).length;
            matrix.push({
              group1: g1,
              group2: g2,
              rate: positives / jointData.length,
              sampleSize: jointData.length
            });
          }
        });
      });

      interFindings.push({ attribute1: a1, attribute2: a2, matrix });
    }

    const fairnessScore = Math.max(0, 100 - (high * 20 + med * 10));
    const avgImpact = totalImpact / protectedAttributes.length;
    const compliance = COMPLIANCE_MAP[domain] || COMPLIANCE_MAP['General'];

    const finalSummary: AnalysisSummary = {
      fairnessScore,
      highSeverityIssues: high,
      mediumSeverityIssues: med,
      avgDisparateImpact: avgImpact,
      complianceViolations: high > 0 ? compliance : []
    };

    setFindings(newFindings);
    setIntersectionalFindings(interFindings);
    setSummary(finalSummary);
    setActiveTab('results');
    
    // Auto-trigger AI if key exists
    if (apiKey) {
      generateAIInsights(newFindings, finalSummary);
    }
    
    // Set counterfactual source if empty
    if (data.length > 0 && !counterfactualSource) {
      setCounterfactualSource(data[0]);
    }
  }, [data, protectedAttributes, targetColumn, apiKey, domain, counterfactualSource]);

  const runSimulation = (attrToFlip: string, newValue: any) => {
    if (!counterfactualSource) return;
    
    // Find average rate for the new group
    const attrFindings = findings.find(f => f.attribute === attrToFlip);
    if (!attrFindings) return;

    const originalGroup = binValue(counterfactualSource[attrToFlip], attrToFlip);
    const flippedGroup = binValue(newValue, attrToFlip);

    const originalRate = attrFindings.outcomeRates.find(r => r.group === originalGroup)?.rate || 0.5;
    const flippedRate = attrFindings.outcomeRates.find(r => r.group === flippedGroup)?.rate || 0.5;

    // A real counterfactual would use a model's predict_proba
    // We simulate by comparing relative probabilities in the training data
    const isBiased = Math.abs(originalRate - flippedRate) > 0.15;

    setSimulateOutcome({
      original: originalGroup,
      flipped: flippedGroup,
      isBiased
    });
  };

  const exportPDF = () => {
    if (!summary) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(12, 12, 26);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('FairLens Bias Audit Report', 15, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`Executive Summary`, 15, 55);
    doc.setFontSize(10);
    doc.text(`Dataset Domain: ${domain}`, 15, 65);
    doc.text(`Fairness Score: ${summary.fairnessScore} / 100`, 15, 70);
    doc.text(`Risk Level: ${summary.highSeverityIssues > 0 ? 'CRITICAL' : summary.mediumSeverityIssues > 0 ? 'MODERATE' : 'LOW'}`, 15, 75);
    
    // Table of Findings
    autoTable(doc, {
      startY: 85,
      head: [['Attribute', 'Impact Ratio', 'Severity', 'Most Disadvantaged']],
      body: findings.map(f => [
        f.attribute, 
        `${(f.metric * 100).toFixed(0)}%`, 
        f.severity, 
        f.mostDisadvantagedGroup
      ]),
      theme: 'grid',
      headStyles: { fillColor: [124, 92, 252] }
    });
    
    // Compliance
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Compliance & Regulatory Analysis', 15, finalY);
    doc.setFontSize(10);
    const violations = summary.complianceViolations.length > 0 ? summary.complianceViolations : ['No major violations detected based on current metrics.'];
    violations.forEach((v, i) => {
      doc.text(`- ${v}`, 15, finalY + 10 + (i * 5));
    });

    doc.save(`FairLens_Audit_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Attribute,Metric,Disparity %,Severity,Groups Affected,Most Disadvantaged\n"
      + findings.map(f => `${f.attribute},${f.metric.toFixed(2)},${f.disparity.toFixed(1)},${f.severity},"${f.groupsAffected.join(', ')}",${f.mostDisadvantagedGroup}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fairness_audit_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-background text-zinc-300 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-surface border-r border-zinc-800 flex flex-col p-6 space-y-8 overflow-y-auto">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <ShieldAlert className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-heading tracking-tight leading-none">FAIRLENS</h1>
            <span className="text-[10px] text-accent font-mono uppercase tracking-widest">Bias Analytics v1.0</span>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-mono uppercase text-zinc-500 block mb-2">Gemini API Key</span>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API Key..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-accent outline-none font-mono"
            />
          </label>

          <div className="pt-4 border-t border-zinc-800/50 space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Demo Presets</span>
              <div className="grid grid-cols-1 gap-2">
                {DEMO_PRESETS.map(preset => (
                  <button 
                    key={preset.name}
                    onClick={() => loadPreset(preset.name)}
                    className="w-full flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg px-3 py-2 text-xs transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-2">
                      <Database size={14} className="text-accent" />
                      <span className="group-hover:text-white">{preset.name}</span>
                    </div>
                    <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-2">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-800 rounded-xl hover:border-accent/50 cursor-pointer transition-all bg-zinc-900/50 group">
                <Upload className="text-zinc-500 group-hover:text-accent mb-2" size={20} />
                <span className="text-[10px] text-zinc-400">Drag & Drop CSV</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {summary && (
          <div className="pt-8 border-t border-zinc-800">
            <div className="relative w-40 h-40 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ value: summary.fairnessScore }, { value: 100 - summary.fairnessScore }]}
                    innerRadius={50}
                    outerRadius={65}
                    startAngle={90}
                    endAngle={450}
                    dataKey="value"
                  >
                    <Cell fill={summary.fairnessScore > 80 ? "#34d399" : summary.fairnessScore > 50 ? "#fbbf24" : "#f87171"} />
                    <Cell fill="#1a1a24" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-heading text-white">{summary.fairnessScore}</span>
                <span className="text-[10px] uppercase text-zinc-500 font-mono tracking-tighter">Fairness Score</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 text-[10px] text-zinc-600 font-mono flex items-center justify-between">
          <span>SECURE PROTOCOL ACTIVE</span>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-surface/50 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-8 z-10">
          <nav className="flex space-x-8">
            {[
              { id: 'analyze', label: 'Analyze', icon: Settings },
              { id: 'results', label: 'Results', icon: BarChart2 },
              { id: 'fix', label: 'Fix & Export', icon: Sparkles },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center space-x-2 h-16 px-1 border-b-2 transition-all text-sm cursor-pointer",
                  activeTab === tab.id 
                    ? "border-accent text-white" 
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                )}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>2.0-FLASH ACTIVE</span>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {activeTab === 'analyze' && (
              <motion.div 
                key="analyze"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-heading">Bias Configuration</h2>
                  <p className="text-zinc-500">Configure the parameters for the Fairness Engine to analyze your dataset.</p>
                </div>

                {data.length > 0 ? (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="bg-surface border border-zinc-800 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center space-x-2 text-white font-medium mb-4">
                        <FileText size={18} className="text-accent" />
                        <h3>Core Parameters</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <label className="block">
                          <span className="text-xs uppercase font-mono text-zinc-500 block mb-2">Target Outcome Column</span>
                          <select 
                            value={targetColumn}
                            onChange={(e) => setTargetColumn(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:border-accent outline-none"
                          >
                            {Object.keys(data[0] || {}).map(col => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-xs uppercase font-mono text-zinc-500 block mb-2">Domain Context</span>
                          <select 
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:border-accent outline-none"
                          >
                            {DOMAINS.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="bg-surface border border-zinc-800 rounded-2xl p-6 flex flex-col">
                      <div className="flex items-center space-x-2 text-white font-medium mb-4">
                        <ShieldAlert size={18} className="text-warning" />
                        <h3>Protected Attributes</h3>
                      </div>
                      
                      <div className="flex-1 border border-zinc-800 rounded-xl bg-zinc-900/50 p-4 overflow-y-auto max-h-[300px]">
                        <div className="grid grid-cols-1 gap-2">
                          {Object.keys(data[0] || {}).map(col => (
                            <label key={col} className="flex items-center space-x-3 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors">
                              <input 
                                type="checkbox"
                                checked={protectedAttributes.includes(col)}
                                onChange={(e) => {
                                  if (e.target.checked) setProtectedAttributes([...protectedAttributes, col]);
                                  else setProtectedAttributes(protectedAttributes.filter(a => a !== col));
                                }}
                                className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-accent focus:ring-accent"
                              />
                              <span className="text-sm font-mono">{col}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 flex justify-center pt-4">
                      <button 
                        onClick={runAnalysis}
                        className="flex items-center space-x-3 bg-accent hover:bg-accent/90 text-white px-10 py-4 rounded-xl font-medium shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      >
                        <RefreshCw size={20} />
                        <span>Run Full Bias Analysis</span>
                      </button>
                    </div>

                    {/* Counterfactual Check Panel */}
                    <div className="col-span-2 bg-surface/50 border border-zinc-800 rounded-2xl p-8 space-y-8 mt-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-accent/20 rounded-lg">
                          <UserCheck className="text-accent" size={20} />
                        </div>
                        <div>
                          <h3 className="text-xl font-heading">Counterfactual Simulator</h3>
                          <p className="text-xs text-zinc-500">Pick an individual and flip a protected attribute to see historical variance.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-8">
                        <div className="space-y-4">
                          <span className="text-[10px] uppercase font-mono text-zinc-500">1. Select Patient/Candidate</span>
                          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 max-h-[150px] overflow-y-auto">
                            {data.slice(0, 10).map((row, i) => (
                              <button 
                                key={i}
                                onClick={() => setCounterfactualSource(row)}
                                className={cn(
                                  "w-full text-left p-2 rounded text-xs transition-colors mb-1",
                                  counterfactualSource?.id === row.id ? "bg-accent text-white" : "hover:bg-zinc-800 text-zinc-400"
                                )}
                              >
                                ID: {row.id} - {binValue(row[protectedAttributes[0]], protectedAttributes[0])}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <span className="text-[10px] uppercase font-mono text-zinc-500">2. Flip Protected Attribute</span>
                          <div className="space-y-2">
                            {protectedAttributes.slice(0, 2).map(attr => {
                              const uniqueVals = Array.from(new Set(data.map(r => r[attr])));
                              return (
                                <div key={attr} className="space-y-1">
                                  <span className="text-[10px] text-zinc-600 font-medium lowercase">Flip {attr}:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {uniqueVals.map(val => (
                                      <button 
                                        key={String(val)}
                                        onClick={() => runSimulation(attr, val)}
                                        className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] hover:border-accent transition-colors"
                                      >
                                        to {binValue(val, attr)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center bg-zinc-900 rounded-2xl border-2 border-zinc-800 p-4">
                          {simulateOutcome ? (
                            <motion.div 
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-center space-y-2"
                            >
                              <div className={cn(
                                "inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight mb-2",
                                simulateOutcome.isBiased ? "bg-danger text-white" : "bg-success text-white"
                              )}>
                                {simulateOutcome.isBiased ? "BIAS DETECTED" : "FAIR RESULT"}
                              </div>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">
                                Changing {simulateOutcome.original} to {simulateOutcome.flipped} 
                                {simulateOutcome.isBiased ? " significantly impacts" : " does not significantly impact"} 
                                historical outcome probabilities.
                              </p>
                            </motion.div>
                          ) : (
                            <div className="text-center text-zinc-600">
                              <RefreshCw size={24} className="mx-auto mb-2 opacity-20" />
                              <p className="text-[10px] uppercase font-mono tracking-wider">Awaiting Simulation</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-96 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center space-y-4 text-zinc-600 bg-zinc-900/20">
                    <Database size={48} className="opacity-20" />
                    <p className="text-lg">Please upload a dataset or load the sample data to begin</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'results' && summary && (
              <motion.div 
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Risk Verdict Banner */}
                <div className={cn(
                  "p-6 rounded-2xl border flex items-center space-x-4",
                  summary.highSeverityIssues > 0 
                    ? "bg-danger/10 border-danger/20 text-danger" 
                    : summary.mediumSeverityIssues > 0 
                      ? "bg-warning/10 border-warning/20 text-warning" 
                      : "bg-success/10 border-success/20 text-success"
                )}>
                  <div className={cn(
                    "p-3 rounded-full",
                    summary.highSeverityIssues > 0 ? "bg-danger/20" : summary.mediumSeverityIssues > 0 ? "bg-warning/20" : "bg-success/20"
                  )}>
                    {summary.highSeverityIssues > 0 ? <AlertTriangle size={24} /> : summary.mediumSeverityIssues > 0 ? <Info size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-heading uppercase tracking-tight">
                      {summary.highSeverityIssues > 0 
                        ? `HIGH LEGAL RISK — ${summary.highSeverityIssues + summary.mediumSeverityIssues} attributes fail the 80% rule` 
                        : summary.mediumSeverityIssues > 0 
                          ? "MODERATE RISK — review before deployment" 
                          : "PASSED — dataset meets fairness thresholds"}
                    </h3>
                    <p className="text-sm opacity-80">
                      Found {summary.highSeverityIssues} high and {summary.mediumSeverityIssues} medium severity disparities in the current selection.
                    </p>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-6">
                  {[
                    { label: 'Fairness Score', value: summary.fairnessScore, icon: ShieldAlert, color: 'text-accent', sub: 'Calculated index' },
                    { label: 'High Severity', value: summary.highSeverityIssues, icon: AlertTriangle, color: 'text-danger', sub: 'Critical failures' },
                    { label: 'Medium Severity', value: summary.mediumSeverityIssues, icon: Info, color: 'text-warning', sub: 'Attention required' },
                    { label: 'Avg Disparate Impact', value: `${(summary.avgDisparateImpact * 100).toFixed(0)}%`, icon: BarChart2, color: 'text-success', sub: 'Legal minimum: 80%' },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-surface border border-zinc-800 p-6 rounded-2xl"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">{stat.label}</span>
                        <stat.icon size={16} className={stat.color} />
                      </div>
                      <div className="text-3xl font-heading text-white">{stat.value}</div>
                      <div className="mt-2 text-[10px] uppercase font-mono text-zinc-600">{stat.sub}</div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-8">
                  {/* AI Stream Panel */}
                  <div className="col-span-2 space-y-6">
                    <div className="bg-surface border border-zinc-800 rounded-3xl p-8 relative overflow-hidden min-h-[300px]">
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="text-accent" size={20} />
                          <h3 className="text-xl font-heading">AI Narrative Analysis</h3>
                        </div>
                        {isAiLoading && <div className="text-xs text-accent font-mono animate-pulse">GENERATING...</div>}
                      </div>
                      
                      <div className="prose prose-invert max-w-none text-zinc-400 font-sans leading-relaxed whitespace-pre-wrap">
                        {aiAnalysis || "Aggregating findings for intelligent report..."}
                        {isAiLoading && <div className="inline-block w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin ml-2 align-middle" />}
                      </div>
                    </div>

                    <div className="bg-surface border border-zinc-800 rounded-3xl p-8">
                      <div className="flex items-center space-x-2 mb-6">
                        <Layers size={20} className="text-accent" />
                        <h3 className="text-xl font-heading">Intersectional Heatmap</h3>
                      </div>
                      
                      {intersectionalFindings.length > 0 ? (
                        <div className="space-y-6">
                          <p className="text-xs text-zinc-500">Analysis of how {intersectionalFindings[0].attribute1} and {intersectionalFindings[0].attribute2} interact to create unique bias clusters.</p>
                          <div className="grid grid-cols-1 overflow-x-auto border border-zinc-800 rounded-xl">
                            <table className="w-full text-[10px] uppercase font-mono">
                              <thead>
                                <tr className="bg-zinc-900 border-b border-zinc-800">
                                  <th className="p-3 text-left">{intersectionalFindings[0].attribute1} / {intersectionalFindings[0].attribute2}</th>
                                  {Array.from(new Set(intersectionalFindings[0].matrix.map(m => m.group2))).map(g2 => (
                                    <th key={g2} className="p-3 border-l border-zinc-800">{g2}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from(new Set(intersectionalFindings[0].matrix.map(m => m.group1))).map(g1 => (
                                  <tr key={g1} className="border-b border-zinc-800">
                                    <td className="p-3 bg-zinc-900 font-bold">{g1}</td>
                                    {Array.from(new Set(intersectionalFindings[0].matrix.map(m => m.group2))).map(g2 => {
                                      const cell = intersectionalFindings[0].matrix.find(m => m.group1 === g1 && m.group2 === g2);
                                      const rate = cell?.rate || 0;
                                      return (
                                        <td 
                                          key={g2} 
                                          className="p-3 border-l border-zinc-800 text-center transition-all hover:scale-110"
                                          style={{ 
                                            backgroundColor: rate > 0.8 ? 'rgba(52, 211, 153, 0.2)' : rate > 0.5 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)',
                                            color: rate > 0.8 ? '#34d399' : rate > 0.5 ? '#fbbf24' : '#f87171'
                                          }}
                                        >
                                          {(rate * 100).toFixed(0)}%
                                          <div className="text-[8px] opacity-50">n={cell?.sampleSize || 0}</div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-zinc-500 text-center py-10 font-mono text-xs">Run analysis with at least 2 protected attributes to see intersectional clusters.</p>
                      )}
                    </div>

                    <div className="bg-surface border border-zinc-800 rounded-3xl p-8">
                      <h3 className="text-xl font-heading mb-6">Bias Findings Detail</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-zinc-800 font-mono text-[10px] uppercase text-zinc-500">
                              <th className="pb-4 pt-0">Attribute</th>
                              <th className="pb-4 pt-0">Impact Ratio</th>
                              <th className="pb-4 pt-0">Score Bar</th>
                              <th className="pb-4 pt-0">Severity</th>
                              <th className="pb-4 pt-0">Most Disadvantaged</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {findings.map((f, i) => (
                              <tr key={i} className="group hover:bg-zinc-900/30 transition-colors">
                                <td className="py-4 text-sm font-medium text-white">{f.attribute}</td>
                                <td className="py-4 text-sm font-mono">{(f.metric * 100).toFixed(0)}%</td>
                                <td className="py-4">
                                  <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        f.severity === 'High' ? "bg-danger" : f.severity === 'Medium' ? "bg-warning" : "bg-success"
                                      )}
                                      style={{ width: `${f.metric * 100}%` }}
                                    />
                                  </div>
                                </td>
                                <td className="py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase",
                                    f.severity === 'High' ? "bg-danger/10 text-danger" : 
                                    f.severity === 'Medium' ? "bg-warning/10 text-warning" : 
                                    "bg-success/10 text-success"
                                  )}>
                                    {f.severity}
                                  </span>
                                </td>
                                <td className="py-4 text-sm text-zinc-400 font-medium italic">{f.mostDisadvantagedGroup}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Visuals */}
                  <div className="space-y-6">
                    {/* Compliance Panel */}
                    <div className="bg-surface border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-accent/5 rounded-bl-full border-l border-b border-accent/20" />
                      <div className="flex items-center space-x-2 mb-4">
                        <Globe size={16} className="text-accent" />
                        <h4 className="text-xs uppercase font-mono text-zinc-400">Compliance Audit</h4>
                      </div>
                      <div className="space-y-3">
                        {(summary.complianceViolations.length > 0 ? summary.complianceViolations : ['EEOC Compliance Preferred']).map((reg, i) => (
                          <div key={i} className="flex items-start space-x-2">
                            <div className={cn(
                              "mt-1 w-1.5 h-1.5 rounded-full shrink-0",
                              summary.highSeverityIssues > 0 ? "bg-danger" : "bg-success"
                            )} />
                            <span className="text-[11px] font-medium leading-tight text-zinc-300">{reg}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 pt-4 border-t border-zinc-800/50">
                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                          <span>RISK PROFILE</span>
                          <span className={cn(
                            "font-bold",
                            summary.highSeverityIssues > 0 ? "text-danger" : "text-success"
                          )}>
                            {summary.highSeverityIssues > 0 ? 'FAIL' : 'PASS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {findings.map((f, i) => (
                      <div key={i} className="bg-surface border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs uppercase font-mono text-zinc-400">{f.attribute} Distribution</h4>
                        </div>
                        <p className="text-[10px] text-zinc-600 mb-4">% {targetColumn} by {f.attribute} group</p>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={f.outcomeRates}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                              <XAxis dataKey="group" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis domain={[0, 1]} stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #333', fontSize: '12px' }}
                                labelStyle={{ color: '#fff' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                              />
                              {/* 80% Threshold Line hack with Recharts or SVG */}
                              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                                {f.outcomeRates.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.rate < 0.8 * Math.max(...f.outcomeRates.map(r => r.rate)) ? "#f87171" : "#7c5cfc"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 border-t border-zinc-800/50 pt-2 flex justify-between items-center">
                          <span className="text-[10px] font-mono text-zinc-600 uppercase">Threshold</span>
                          <div className="flex-1 mx-2 border-b border-danger/30 border-dashed" />
                          <span className="text-[10px] font-mono text-danger uppercase opacity-50">80% Impact</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'fix' && (
              <motion.div 
                key="fix"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-heading">Bias Remediation</h2>
                  <div className="flex space-x-3">
                    <button 
                      onClick={exportPDF}
                      className="flex items-center space-x-2 bg-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-accent/90 transition-all cursor-pointer shadow-lg shadow-accent/20"
                    >
                      <FilePieChart size={16} />
                      <span>Professional Audit PDF</span>
                    </button>
                    <button 
                      onClick={exportCSV}
                      className="flex items-center space-x-2 bg-zinc-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-zinc-700 transition-all cursor-pointer"
                    >
                      <Download size={16} />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      {[
                        { title: 'Reweighing (Pre-processing)', desc: 'Assign higher importance weights to under-represented groups during model training.', icon: Settings },
                        { title: 'Feature Decoupling', desc: 'Identify and remove proxy features (e.g., zip codes) that correlate strongly with protected attributes.', icon: ShieldAlert },
                        { title: 'Fairness Constraints', desc: 'Inject Lagrangian multipliers or adversarial loss to penalize disparity during optimization.', icon: BarChart2 },
                        { title: 'Threshold Calibration', desc: 'Apply target-specific decision boundaries to equalize False Negative Rates across groups.', icon: ChevronRight },
                      ].map((rem, i) => (
                        <div 
                          key={i}
                          className={cn(
                            "bg-surface border p-6 rounded-2xl flex items-start space-x-4 transition-all",
                            checkedFixes[i] ? "border-success/30 bg-success/5" : "border-zinc-800"
                          )}
                        >
                          <button 
                            onClick={() => handleFixToggle(i)}
                            className={cn(
                              "mt-1 w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer",
                              checkedFixes[i] ? "bg-success border-success text-black" : "border-zinc-700 bg-zinc-900 group-hover:border-accent"
                            )}
                          >
                            {checkedFixes[i] && <CheckCircle2 size={16} />}
                          </button>
                          
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className={cn("text-lg font-medium transition-all", checkedFixes[i] ? "text-success" : "text-white")}>
                                {rem.title}
                              </h4>
                            </div>
                            <p className="text-zinc-500 text-sm">{rem.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-accent/5 border border-accent/20 rounded-3xl p-8 space-y-6">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="text-accent" size={24} />
                        <h3 className="text-xl font-heading">Ask the Fairness Expert</h3>
                      </div>
                      
                      <div className="flex space-x-4">
                        <input 
                          value={customQuestion}
                          onChange={(e) => setCustomQuestion(e.target.value)}
                          placeholder="e.g. How can I justify removing ZIP codes to stakeholders?"
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 text-sm focus:border-accent outline-none font-sans"
                        />
                        <button 
                          onClick={() => {
                            const q = customQuestion;
                            setCustomQuestion('');
                            setAiAnalysis(prev => prev + `\n\nUser: ${q}\nAI: `);
                            setActiveTab('results');
                          }}
                          className="bg-accent text-white h-[58px] px-8 rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center cursor-pointer"
                        >
                          <ChevronRight size={24} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Case Studies Sidebar */}
                  <div className="space-y-6">
                    <div className="flex items-center space-x-2 mb-2">
                      <BookOpen size={20} className="text-accent" />
                      <h3 className="text-xl font-heading">Why This Matters</h3>
                    </div>
                    {CASE_STUDIES.map((study, i) => (
                      <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-3">
                        <h4 className="text-sm font-bold text-white uppercase tracking-tight">{study.title}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed italic">"{study.summary}"</p>
                        <div className="bg-accent/10 p-3 rounded-lg border border-accent/20">
                          <p className="text-[10px] text-accent font-medium"><span className="uppercase font-bold">Key Lesson:</span> {study.lesson}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
