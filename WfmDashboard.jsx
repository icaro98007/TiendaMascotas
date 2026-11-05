import React, { useState, useRef } from "react";
import {
  UploadCloud,
  Cpu,
  AlertTriangle,
  Users,
  Moon,
  CheckCircle2,
  FileSpreadsheet,
  FileX,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  X
} from "lucide-react";

export default function WfmDashboard() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Manejo de archivo CSV
  const handleFile = (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Por favor selecciona un archivo CSV con la malla actual.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    setShowResults(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleRemoveFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    setShowResults(false);
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Simulación de análisis Erlang C con retardo de 1.5s
  const handleAnalyze = () => {
    // Validación 4: Si no hay archivo seleccionado, mostrar alerta visual en rosa/rojo con FileX
    if (!selectedFile) {
      setErrorMessage("Por favor selecciona un archivo CSV con la malla actual.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);
    setShowResults(false);

    // Retardo simulado de 1.5 segundos
    setTimeout(() => {
      setIsLoading(false);
      setShowResults(true);
    }, 1500);
  };

  // Listado de franjas y dotación crítica recomendada
  const dotacionCritica = [
    {
      horario: "09:00 - 17:00",
      linea: "Consulta General",
      agentes: 2,
      badgeColor: "border-blue-500/30 bg-blue-500/10 text-blue-400"
    },
    {
      horario: "08:00 - 16:00",
      linea: "Asesoría Técnica",
      agentes: 2,
      badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    },
    {
      horario: "14:00 - 22:00",
      linea: "Asesoría Técnica",
      agentes: 2,
      badgeColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    },
    {
      horario: "14:00 - 22:00",
      linea: "Esp. Comercial",
      agentes: 1,
      badgeColor: "border-purple-500/30 bg-purple-500/10 text-purple-400"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col justify-center items-center">
      <div className="w-full max-w-5xl space-y-8">
        
        {/* Tarjeta Central Principal */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 relative overflow-hidden backdrop-blur-sm">
          {/* Acento de brillo en fondo */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* 2. Cabecera */}
          <header className="border-b border-slate-800 pb-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30 shrink-0">
                  <Cpu className="w-8 h-8 text-white animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                      Motor de Capacidad WFM
                    </h1>
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      Erlang Core
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1 font-medium">
                    Servicontact &bull; Consola PQR & Dimensión de Capacidad
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 self-start sm:self-auto">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-semibold text-slate-300">Algoritmo Erlang C</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">SLA Target 80/20</span>
              </div>
            </div>
          </header>

          {/* 3. Zona de Carga de Archivos */}
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-200 flex items-center justify-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-400" />
                Cargar Malla de Turnos
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Selecciona o arrastra el archivo CSV con la distribución de turnos para calcular la dotación.
              </p>
            </div>

            {/* Etiqueta estilizada con input type="file" oculto */}
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group ${
                isDragging
                  ? "border-blue-400 bg-blue-500/10 shadow-lg shadow-blue-500/10 scale-[1.01]"
                  : selectedFile
                  ? "border-emerald-500/50 bg-slate-950/80 shadow-inner"
                  : "border-slate-700/80 hover:border-blue-500/70 bg-slate-950/50 hover:bg-slate-950/80 shadow-md"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {!selectedFile ? (
                <div className="flex flex-col items-center space-y-3">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl group-hover:border-blue-500/40 group-hover:scale-105 transition-all duration-200 shadow-md shadow-black/40">
                    <UploadCloud className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                      Haz clic para subir o arrastra aquí tu archivo CSV
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Formato soportado: CSV estructurado (.csv)</p>
                  </div>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between bg-slate-900/90 border border-emerald-500/30 p-4 rounded-xl shadow-lg">
                  <div className="flex items-center space-x-3.5 text-left truncate">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-bold text-slate-100 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-emerald-400/90 font-medium">
                        {(selectedFile.size / 1024).toFixed(1)} KB &bull; Archivo listo para procesar
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-colors shrink-0 ml-3"
                    title="Remover archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </label>

            {/* 4. Manejo de Errores en Frontend: Alerta con FileX en color rosa/rojo */}
            {errorMessage && (
              <div className="flex items-center space-x-3 text-rose-400 bg-rose-500/10 border border-rose-500/30 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 shadow-lg shadow-rose-950/30">
                <FileX className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* 5. Botón de Acción Principal ("Analizar Malla" con icono FileSpreadsheet y spinner SVG) */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isLoading}
                className={`w-full sm:w-auto min-w-[260px] px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center space-x-2.5 shadow-xl ${
                  isLoading
                    ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700 shadow-none"
                    : "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-blue-600/30 hover:shadow-blue-500/40 border border-blue-400/30 ring-1 ring-blue-500/50"
                }`}
              >
                {isLoading ? (
                  <>
                    {/* Spinner animado SVG */}
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span className="text-blue-200">Calculando Erlang...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5 text-blue-200" />
                    <span>Analizar Malla</span>
                    <ArrowRight className="w-4 h-4 text-blue-200" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 6. Estado de Resultados (Fade-in slide-in tras 1.5s) */}
          {showResults && (
            <section className="mt-10 pt-8 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-6 duration-500 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4 gap-2">
                <div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                    Diagnóstico de Capacidad WFM
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Cálculo Erlang C Completado
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Resultados generados a partir de los tiempos promedio de atención (AHT) y volumen de la malla.
                  </p>
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  Malla evaluada: <span className="text-slate-200 font-bold">{selectedFile?.name}</span>
                </div>
              </div>

              {/* Grid organizado en 3 tarjetas/secciones */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Panel Izquierdo: "Resumen de Dotación Crítica" (Icono Users) */}
                <div className="lg:col-span-6 bg-slate-950/60 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-100 text-base">
                            Resumen de Dotación Crítica
                          </h4>
                          <p className="text-xs text-slate-400">
                            Listado de franjas por línea de servicio y cantidad de agentes recomendados
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-slate-300 border border-slate-800">
                        4 Franjas
                      </span>
                    </div>

                    {/* Listado de franjas */}
                    <div className="space-y-3">
                      {dotacionCritica.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors gap-3"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center text-xs font-semibold text-slate-300 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 shrink-0">
                              <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                              {item.horario}
                            </div>
                            <span className="text-sm font-semibold text-slate-200">
                              {item.linea}
                            </span>
                          </div>

                          <div className="flex items-center self-end sm:self-auto">
                            <span
                              className={`text-xs font-bold px-3 py-1 rounded-full border ${item.badgeColor}`}
                            >
                              {item.agentes} {item.agentes === 1 ? "Agente" : "Agentes"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Total posiciones concurrentes en pico:</span>
                    <span className="font-bold text-emerald-400 text-sm">7 Agentes</span>
                  </div>
                </div>

                {/* Paneles Derechos (Superior: Riesgos, Inferior: Estrategia Nocturna) */}
                <div className="lg:col-span-6 flex flex-col space-y-6">
                  
                  {/* Panel Derecho Superior: "Riesgos Operativos Detectados" (Fondo rojizo/rose-950/30, Icono AlertTriangle) */}
                  <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                    <div className="flex items-center space-x-3 border-b border-rose-500/20 pb-4 mb-4">
                      <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-rose-300 text-base flex items-center gap-2">
                          Riesgos Operativos Detectados
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            Peligro
                          </span>
                        </h4>
                        <p className="text-xs text-rose-200/70">
                          Picos de carga que exceden el umbral base (superiores a 50 min/hr)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Viñeta 1 */}
                      <div className="p-3.5 bg-slate-950/70 border border-rose-500/20 rounded-xl flex items-start space-x-3">
                        <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          <strong className="text-rose-300 font-semibold">Pico Consulta General:</strong> A las{" "}
                          <span className="underline decoration-rose-500/50 font-semibold text-white">09:00</span>. Carga excede umbral base llegando a{" "}
                          <span className="font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                            57 min/hr
                          </span>
                          .
                        </div>
                      </div>

                      {/* Viñeta 2 */}
                      <div className="p-3.5 bg-slate-950/70 border border-rose-500/20 rounded-xl flex items-start space-x-3">
                        <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          <strong className="text-rose-300 font-semibold">Pico Asesoría Técnica:</strong> A las{" "}
                          <span className="underline decoration-rose-500/50 font-semibold text-white">17:00</span>. Carga llega a{" "}
                          <span className="font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                            65 min/hr
                          </span>
                          .
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel Derecho Inferior: "Estrategia Nocturna" (Fondo índigo/indigo-950/30, Icono Moon) */}
                  <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                    <div className="flex items-center space-x-3 border-b border-indigo-500/20 pb-4 mb-4">
                      <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/30">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-indigo-300 text-base flex items-center gap-2">
                          Estrategia Nocturna
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            Optimización
                          </span>
                        </h4>
                        <p className="text-xs text-indigo-200/70">
                          Recomendación de consolidación para turnos de baja intensidad
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/70 border border-indigo-500/20 rounded-xl">
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        <span className="font-semibold text-indigo-300">Franja 22:00 - 06:00.</span>{" "}
                        Carga total combinada estimada en{" "}
                        <span className="font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                          49 minutos máximos
                        </span>
                        . Se recomienda consolidar la atención en{" "}
                        <span className="text-emerald-400 font-semibold underline decoration-emerald-500/40">
                          1 agente transversal multiskill
                        </span>{" "}
                        para garantizar cobertura cumpliendo SLA sin sobrecostos.
                      </p>
                    </div>
                  </div>

                </div>

              </div>

            </section>
          )}

        </div>

      </div>
    </div>
  );
}
