import { useState, useEffect, useRef, useCallback } from 'react'
import {
  cargarDia,
  guardarDia,
  fechaLegible,
  hoy,
  cargarManana,
  guardarManana,
  type DiaData,
  type PrioridadManana,
} from './store'

// ─── Timer de 10 minutos ─────────────────────────────────────────────────────

const TIMER_SEGUNDOS = 10 * 60

function useTimer(onComplete: () => void) {
  const [segundosRestantes, setSegundosRestantes] = useState(TIMER_SEGUNDOS)
  const [corriendo, setCorriendo] = useState(false)
  const [terminado, setTerminado] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const iniciar = useCallback(() => {
    if (terminado) return
    setCorriendo(true)
  }, [terminado])

  const pausar = useCallback(() => setCorriendo(false), [])

  const reiniciar = useCallback(() => {
    setCorriendo(false)
    setTerminado(false)
    setSegundosRestantes(TIMER_SEGUNDOS)
  }, [])

  useEffect(() => {
    if (!corriendo) return
    intervalRef.current = setInterval(() => {
      setSegundosRestantes((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          setCorriendo(false)
          setTerminado(true)
          onComplete()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [corriendo, onComplete])

  const minutos = Math.floor(segundosRestantes / 60)
  const segundos = segundosRestantes % 60
  const display = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
  const progreso = ((TIMER_SEGUNDOS - segundosRestantes) / TIMER_SEGUNDOS) * 100

  return { display, corriendo, terminado, progreso, iniciar, pausar, reiniciar }
}

// ─── Componente racha ────────────────────────────────────────────────────────

function Racha({ dias }: { dias: number }) {
  const texto = dias === 1 ? 'día seguido' : 'días seguidos'
  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <span className="text-lg">🔥</span>
      <span className="text-slate-400 text-sm font-medium">
        {dias} {texto}
      </span>
    </div>
  )
}

// ─── Modal planear mañana ────────────────────────────────────────────────────

function ModalManana({ onCerrar }: { onCerrar: () => void }) {
  const [prioridades, setPrioridades] = useState<PrioridadManana[]>(cargarManana)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  function actualizar(id: string, valor: string) {
    setPrioridades((prev) =>
      prev.map((p) => (p.id === id ? { ...p, texto: valor } : p))
    )
  }

  function guardar() {
    const filtradas = prioridades.filter((p) => p.texto.trim())
    if (filtradas.length === 0) return
    guardarManana(prioridades)
    onCerrar()
  }

  const labels = ['1', '2', '3']
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md mb-4 border border-slate-700">
        <h2 className="text-white font-bold text-lg mb-1">Mañana empieza esta noche</h2>
        <p className="text-slate-400 text-sm mb-5">Escribe tus 3 prioridades de mañana</p>

        <div className="space-y-3 mb-6">
          {prioridades.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="text-slate-500 font-bold text-sm w-4">{labels[i]}</span>
              <input
                ref={(el) => {
                  inputs.current[i] = el
                  if (i === 0) inputRef.current = el
                }}
                type="text"
                value={p.texto}
                onChange={(e) => actualizar(p.id, e.target.value)}
                placeholder={`Prioridad ${labels[i]}…`}
                className="flex-1 bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 border border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && i < 2) inputs.current[i + 1]?.focus()
                  if (e.key === 'Enter' && i === 2) guardar()
                }}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCerrar}
            className="flex-1 py-3 rounded-xl text-slate-400 text-sm font-medium bg-slate-700 active:bg-slate-600"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            className="flex-1 py-3 rounded-xl text-white text-sm font-bold bg-indigo-600 active:bg-indigo-500"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App principal ───────────────────────────────────────────────────────────

export default function App() {
  const [dia, setDia] = useState<DiaData>(() => cargarDia())
  const [mostrarModal, setMostrarModal] = useState(false)
  const [mananaGuardado, setMananaGuardado] = useState(() => {
    const raw = localStorage.getItem('hazlo_manana')
    if (!raw) return false
    const m: PrioridadManana[] = JSON.parse(raw)
    return m.some((p) => p.texto.trim())
  })

  const esNoche = new Date().getHours() >= 20

  const marcarOrdenCompleto = useCallback(() => {
    setDia((prev) => {
      const actualizado = { ...prev, ordenHecho: true }
      guardarDia(actualizado)
      return actualizado
    })
  }, [])

  const timer = useTimer(marcarOrdenCompleto)

  function togglePrioridad(id: string) {
    setDia((prev) => {
      const actualizado = {
        ...prev,
        prioridades: prev.prioridades.map((p) =>
          p.id === id ? { ...p, hecha: !p.hecha } : p
        ),
      }
      guardarDia(actualizado)
      return actualizado
    })
  }

  function cerrarModal() {
    setMostrarModal(false)
    const raw = localStorage.getItem('hazlo_manana')
    if (raw) {
      const m: PrioridadManana[] = JSON.parse(raw)
      setMananaGuardado(m.some((p) => p.texto.trim()))
    }
  }

  const hechas = dia.prioridades.filter((p) => p.hecha).length
  const total = dia.prioridades.length
  const todas = hechas === total && total > 0

  return (
    <div className="min-h-svh bg-[#0f0f23] text-white flex flex-col max-w-md mx-auto px-4 pt-10 pb-8">

      {/* Cabecera */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black tracking-tight text-white">hazlo</h1>
        <p className="text-slate-400 text-sm mt-1 capitalize">{fechaLegible(hoy())}</p>
        <Racha dias={dia.rachaActual} />
      </div>

      {/* Prioridades del día */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Mis 3 de hoy
          </h2>
          <span className="text-xs text-slate-500 font-medium">{hechas}/{total}</span>
        </div>

        <div className="space-y-2">
          {dia.prioridades.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePrioridad(p.id)}
              className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                p.hecha
                  ? 'bg-emerald-950/40 border-emerald-800/40'
                  : 'bg-slate-800/60 border-slate-700/50'
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  p.hecha
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-slate-500'
                }`}
              >
                {p.hecha && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-sm leading-relaxed transition-all ${p.hecha ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                {p.texto}
              </span>
            </button>
          ))}
        </div>

        {todas && (
          <div className="mt-4 text-center py-3 rounded-2xl bg-emerald-900/30 border border-emerald-700/30">
            <p className="text-emerald-400 text-sm font-bold">Cumpliste las 3. Ese es el trabajo. ✓</p>
          </div>
        )}
      </section>

      {/* Timer de orden */}
      <section className="mb-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Orden físico · 10 min
        </h2>

        <div className={`rounded-2xl border p-5 transition-all ${
          dia.ordenHecho
            ? 'bg-emerald-950/40 border-emerald-800/40'
            : 'bg-slate-800/60 border-slate-700/50'
        }`}>
          {dia.ordenHecho ? (
            <div className="text-center py-1">
              <p className="text-emerald-400 font-bold">✓ Orden del día: listo</p>
              <p className="text-slate-500 text-xs mt-1">Espacio limpio, mente clara</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white font-bold text-2xl tabular-nums">{timer.display}</p>
                  <p className="text-slate-400 text-xs mt-1">
                    {timer.corriendo ? 'Recoge, tira, ordena…' : 'Recoge, tira, ordena. 10 minutos.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!timer.corriendo && !timer.terminado && (
                    <button
                      onClick={timer.iniciar}
                      className="bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:bg-indigo-500"
                    >
                      Iniciar
                    </button>
                  )}
                  {timer.corriendo && (
                    <button
                      onClick={timer.pausar}
                      className="bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:bg-slate-600"
                    >
                      Pausar
                    </button>
                  )}
                  {!timer.corriendo && !timer.terminado && timer.display !== '10:00' && (
                    <button
                      onClick={timer.reiniciar}
                      className="bg-slate-700 text-slate-300 text-sm px-3 py-2.5 rounded-xl active:bg-slate-600"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                  style={{ width: `${timer.progreso}%` }}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Planear mañana */}
      <section className="mb-6">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Mañana empieza esta noche
        </h2>

        <button
          onClick={() => setMostrarModal(true)}
          className={`w-full p-4 rounded-2xl border text-sm font-medium transition-all active:scale-[0.98] ${
            mananaGuardado
              ? 'bg-indigo-950/40 border-indigo-700/40 text-indigo-300'
              : esNoche
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-slate-800/60 border-slate-700/50 text-slate-400'
          }`}
        >
          {mananaGuardado
            ? '✓  Prioridades de mañana guardadas · toca para editar'
            : esNoche
            ? '🌙  Escribe tus 3 prioridades de mañana'
            : 'Planear mañana · se activa a las 8:00 PM'}
        </button>
      </section>

      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-slate-800/60">
        <p className="text-slate-700 text-xs text-center leading-relaxed italic">
          "Ordena tu día antes de que el día te ordene a ti"
        </p>
      </div>

      {mostrarModal && <ModalManana onCerrar={cerrarModal} />}
    </div>
  )
}
