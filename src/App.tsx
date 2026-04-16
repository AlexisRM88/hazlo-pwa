import { useState, useEffect, useRef, useCallback } from 'react'
import {
  cargarDia,
  guardarDia,
  fechaLegible,
  hoy,
  cargarManana,
  guardarManana,
  cargarHistorial7Dias,
  diaSemanaCorto,
  type DiaData,
  type PrioridadManana,
  type HistorialEntry,
} from './store'

// ─── Timer 10 min ────────────────────────────────────────────────────────────

const TIMER_SEGUNDOS = 10 * 60

function useTimer(onComplete: () => void) {
  const [seg, setSeg] = useState(TIMER_SEGUNDOS)
  const [corriendo, setCorriendo] = useState(false)
  const [terminado, setTerminado] = useState(false)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  const iniciar = useCallback(() => { if (!terminado) setCorriendo(true) }, [terminado])
  const pausar = useCallback(() => setCorriendo(false), [])
  const reiniciar = useCallback(() => {
    setCorriendo(false); setTerminado(false); setSeg(TIMER_SEGUNDOS)
  }, [])

  useEffect(() => {
    if (!corriendo) return
    ref.current = setInterval(() => {
      setSeg((s) => {
        if (s <= 1) {
          clearInterval(ref.current!); setCorriendo(false); setTerminado(true); onComplete(); return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(ref.current!)
  }, [corriendo, onComplete])

  const m = Math.floor(seg / 60)
  const s = seg % 60
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  const progreso = ((TIMER_SEGUNDOS - seg) / TIMER_SEGUNDOS) * 100

  return { display, corriendo, terminado, progreso, iniciar, pausar, reiniciar, esInicial: seg === TIMER_SEGUNDOS }
}

// ─── Hook de notificaciones ───────────────────────────────────────────────────

function useNotificaciones(mananaGuardado: boolean) {
  const [permiso, setPermiso] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!('Notification' in window)) return 'unsupported'
    return Notification.permission
  })

  async function pedirPermiso() {
    if (!('Notification' in window)) return
    const resultado = await Notification.requestPermission()
    setPermiso(resultado)
    localStorage.setItem('hazlo_notif_asked', '1')
  }

  // Programar notificación a las 8 PM si la app está abierta
  useEffect(() => {
    if (permiso !== 'granted' || mananaGuardado) return

    function mostrar() {
      new Notification('hazlo 🌙', {
        body: '¿Ya tienes tus 3 de mañana?',
        icon: '/pwa-192x192.png',
        tag: 'hazlo-noche', // evita duplicados
      })
    }

    const ahora = new Date()
    const objetivo = new Date()
    objetivo.setHours(20, 0, 0, 0)
    const msRestantes = objetivo.getTime() - ahora.getTime()

    // Ya son las 8 PM+ y no hay mañana guardado → notificar ahora (una vez por sesión)
    if (ahora.getHours() >= 20) {
      const ultima = localStorage.getItem('hazlo_ultima_notif')
      const hace1h = Date.now() - 60 * 60 * 1000
      if (!ultima || parseInt(ultima) < hace1h) {
        mostrar()
        localStorage.setItem('hazlo_ultima_notif', String(Date.now()))
      }
      return
    }

    // Programar para las 8 PM
    if (msRestantes > 0) {
      const t = setTimeout(() => {
        if (!mananaGuardado) {
          mostrar()
          localStorage.setItem('hazlo_ultima_notif', String(Date.now()))
        }
      }, msRestantes)
      return () => clearTimeout(t)
    }
  }, [permiso, mananaGuardado])

  const noSolicitado = permiso === 'default' && !localStorage.getItem('hazlo_notif_asked')
  return { permiso, noSolicitado, pedirPermiso }
}

// ─── Banner de notificaciones ─────────────────────────────────────────────────

function BannerNotif({ onAceptar, onIgnorar }: { onAceptar: () => void; onIgnorar: () => void }) {
  return (
    <div className="mb-5 bg-indigo-900/40 border border-indigo-700/50 rounded-2xl p-4">
      <p className="text-indigo-200 text-sm font-semibold mb-1">Activa los recordatorios</p>
      <p className="text-slate-400 text-xs mb-3 leading-relaxed">
        Te avisamos a las 8 PM para planear mañana. Sin notificaciones la racha muere el primer día ocupado.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onAceptar}
          className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold active:bg-indigo-500"
        >
          Activar
        </button>
        <button
          onClick={onIgnorar}
          className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-400 text-xs active:bg-slate-600"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}

// ─── Racha ────────────────────────────────────────────────────────────────────

function Racha({ dias }: { dias: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <span className="text-lg">🔥</span>
      <span className="text-slate-400 text-sm font-medium">
        {dias} {dias === 1 ? 'día seguido' : 'días seguidos'}
      </span>
    </div>
  )
}

// ─── Historial 7 días ─────────────────────────────────────────────────────────

function Historial7Dias() {
  const [abierto, setAbierto] = useState(false)
  const entries: HistorialEntry[] = cargarHistorial7Dias()
  const hoyStr = hoy()

  function colorDia(entry: HistorialEntry) {
    if (entry.fecha > hoyStr) return 'bg-slate-800 border-slate-700'
    if (entry.total === 0) return 'bg-slate-800 border-slate-700'
    if (entry.completadas === entry.total) return 'bg-emerald-900/60 border-emerald-700/50'
    if (entry.completadas > 0) return 'bg-yellow-900/40 border-yellow-700/40'
    return 'bg-slate-800/60 border-slate-700/50'
  }

  function iconoDia(entry: HistorialEntry) {
    if (entry.fecha > hoyStr) return <span className="text-slate-700 text-xs">—</span>
    if (entry.completadas === entry.total && entry.total > 0)
      return <span className="text-emerald-400 text-xs font-bold">{entry.completadas}/{entry.total}</span>
    if (entry.completadas > 0)
      return <span className="text-yellow-400 text-xs font-bold">{entry.completadas}/{entry.total}</span>
    return <span className="text-slate-600 text-xs">0/{entry.total}</span>
  }

  const totalSemana = entries.filter(e => e.fecha <= hoyStr && e.completadas === e.total && e.total > 0).length

  return (
    <section className="mb-6">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between mb-3"
      >
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Últimos 7 días
        </h2>
        <span className="text-slate-500 text-xs">
          {totalSemana}/7 días completos {abierto ? '▲' : '▼'}
        </span>
      </button>

      {abierto && (
        <div className="grid grid-cols-7 gap-1.5">
          {entries.map((entry) => (
            <div
              key={entry.fecha}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border ${colorDia(entry)} ${entry.fecha === hoyStr ? 'ring-1 ring-indigo-500' : ''}`}
            >
              <span className="text-slate-500 text-xs font-medium">{diaSemanaCorto(entry.fecha)}</span>
              {iconoDia(entry)}
              {entry.ordenHecho && entry.fecha <= hoyStr && (
                <span className="text-indigo-400 text-xs" title="Orden hecho">·</span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Modal planear mañana ─────────────────────────────────────────────────────

function ModalManana({ onCerrar }: { onCerrar: () => void }) {
  const [prioridades, setPrioridades] = useState<PrioridadManana[]>(cargarManana)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { setTimeout(() => inputs.current[0]?.focus(), 100) }, [])

  function actualizar(id: string, valor: string) {
    setPrioridades((prev) => prev.map((p) => (p.id === id ? { ...p, texto: valor } : p)))
  }

  function guardar() {
    if (!prioridades.some((p) => p.texto.trim())) return
    guardarManana(prioridades)
    onCerrar()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md mb-4 border border-slate-700">
        <h2 className="text-white font-bold text-lg mb-1">Mañana empieza esta noche</h2>
        <p className="text-slate-400 text-sm mb-5">Escribe tus 3 prioridades de mañana</p>
        <div className="space-y-3 mb-6">
          {prioridades.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="text-slate-500 font-bold text-sm w-4">{i + 1}</span>
              <input
                ref={(el) => { inputs.current[i] = el }}
                type="text"
                value={p.texto}
                onChange={(e) => actualizar(p.id, e.target.value)}
                placeholder={`Prioridad ${i + 1}…`}
                className="flex-1 bg-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (i < 2) inputs.current[i + 1]?.focus()
                    else guardar()
                  }
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onCerrar} className="flex-1 py-3 rounded-xl text-slate-400 text-sm bg-slate-700 active:bg-slate-600">
            Cancelar
          </button>
          <button onClick={guardar} className="flex-1 py-3 rounded-xl text-white text-sm font-bold bg-indigo-600 active:bg-indigo-500">
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App principal ────────────────────────────────────────────────────────────

export default function App() {
  const [dia, setDia] = useState<DiaData>(() => cargarDia())
  const [mostrarModal, setMostrarModal] = useState(false)
  const [mostrarBannerNotif, setMostrarBannerNotif] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdit, setTextoEdit] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const [mananaGuardado, setMananaGuardado] = useState(() => {
    const raw = localStorage.getItem('hazlo_manana')
    if (!raw) return false
    return (JSON.parse(raw) as PrioridadManana[]).some((p) => p.texto.trim())
  })

  const esNoche = new Date().getHours() >= 20

  const { permiso, noSolicitado, pedirPermiso } = useNotificaciones(mananaGuardado)

  // Mostrar banner de notificaciones después de 3 segundos si no se ha pedido
  useEffect(() => {
    if (noSolicitado && permiso !== 'unsupported') {
      const t = setTimeout(() => setMostrarBannerNotif(true), 3000)
      return () => clearTimeout(t)
    }
  }, [noSolicitado, permiso])

  const marcarOrdenCompleto = useCallback(() => {
    setDia((prev) => {
      const actualizado = { ...prev, ordenHecho: true }
      guardarDia(actualizado)
      return actualizado
    })
  }, [])

  const timer = useTimer(marcarOrdenCompleto)

  function togglePrioridad(id: string) {
    if (editandoId === id) return // no toggle mientras editas
    setDia((prev) => {
      const actualizado = {
        ...prev,
        prioridades: prev.prioridades.map((p) => (p.id === id ? { ...p, hecha: !p.hecha } : p)),
      }
      guardarDia(actualizado)
      return actualizado
    })
  }

  function iniciarEdicion(id: string, textoActual: string) {
    setEditandoId(id)
    setTextoEdit(textoActual)
    setTimeout(() => editInputRef.current?.focus(), 80)
  }

  function confirmarEdicion(id: string) {
    const texto = textoEdit.trim()
    if (texto) {
      setDia((prev) => {
        const actualizado = {
          ...prev,
          prioridades: prev.prioridades.map((p) => (p.id === id ? { ...p, texto } : p)),
        }
        guardarDia(actualizado)
        return actualizado
      })
    }
    setEditandoId(null)
    setTextoEdit('')
  }

  function cerrarModal() {
    setMostrarModal(false)
    const raw = localStorage.getItem('hazlo_manana')
    if (raw) {
      setMananaGuardado((JSON.parse(raw) as PrioridadManana[]).some((p) => p.texto.trim()))
    }
  }

  function ignorarBanner() {
    localStorage.setItem('hazlo_notif_asked', '1')
    setMostrarBannerNotif(false)
  }

  async function aceptarNotif() {
    await pedirPermiso()
    setMostrarBannerNotif(false)
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

      {/* Banner de notificaciones */}
      {mostrarBannerNotif && (
        <BannerNotif onAceptar={aceptarNotif} onIgnorar={ignorarBanner} />
      )}

      {/* Prioridades del día */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mis 3 de hoy</h2>
          <span className="text-xs text-slate-500">{hechas}/{total}</span>
        </div>

        <div className="space-y-2">
          {dia.prioridades.map((p) => (
            <div
              key={p.id}
              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                p.hecha ? 'bg-emerald-950/40 border-emerald-800/40' : 'bg-slate-800/60 border-slate-700/50'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => togglePrioridad(p.id)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  p.hecha ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'
                }`}
              >
                {p.hecha && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Texto o input de edición */}
              {editandoId === p.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={textoEdit}
                  onChange={(e) => setTextoEdit(e.target.value)}
                  onBlur={() => confirmarEdicion(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmarEdicion(p.id)
                    if (e.key === 'Escape') { setEditandoId(null); setTextoEdit('') }
                  }}
                  className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <span
                  className={`flex-1 text-sm leading-relaxed transition-all cursor-text ${
                    p.hecha ? 'line-through text-slate-500' : 'text-slate-200'
                  }`}
                  onDoubleClick={() => !p.hecha && iniciarEdicion(p.id, p.texto)}
                  title={!p.hecha ? 'Doble toque para editar' : undefined}
                >
                  {p.texto}
                </span>
              )}

              {/* Botón editar (solo si no está hecha) */}
              {!p.hecha && editandoId !== p.id && (
                <button
                  onClick={() => iniciarEdicion(p.id, p.texto)}
                  className="flex-shrink-0 text-slate-600 hover:text-slate-400 active:text-slate-300 transition-colors p-1"
                  title="Editar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
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
          dia.ordenHecho ? 'bg-emerald-950/40 border-emerald-800/40' : 'bg-slate-800/60 border-slate-700/50'
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
                    {timer.corriendo ? 'Recoge, tira, ordena…' : 'Recoge, tira, ordena. 10 min.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!timer.corriendo && !timer.terminado && (
                    <button onClick={timer.iniciar} className="bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:bg-indigo-500">
                      Iniciar
                    </button>
                  )}
                  {timer.corriendo && (
                    <button onClick={timer.pausar} className="bg-slate-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl active:bg-slate-600">
                      Pausar
                    </button>
                  )}
                  {!timer.corriendo && !timer.terminado && !timer.esInicial && (
                    <button onClick={timer.reiniciar} className="bg-slate-700 text-slate-300 text-sm px-3 py-2.5 rounded-xl active:bg-slate-600">
                      ↺
                    </button>
                  )}
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${timer.progreso}%` }} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Historial 7 días */}
      <Historial7Dias />

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
