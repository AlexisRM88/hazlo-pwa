// ─── Types ───────────────────────────────────────────────────────────────────

export interface Prioridad {
  id: string
  texto: string
  hecha: boolean
}

export interface DiaData {
  fecha: string
  prioridades: Prioridad[]
  ordenHecho: boolean
  rachaActual: number
  ultimaApertura: string
}

export interface HistorialEntry {
  fecha: string
  completadas: number
  total: number
  ordenHecho: boolean
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_DIA = 'hazlo_dia'
const KEY_RACHA = 'hazlo_racha'
const KEY_ULTIMA = 'hazlo_ultima_apertura'
const KEY_HISTORIAL = 'hazlo_historial'

// ─── Helpers de fecha ────────────────────────────────────────────────────────

export function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function fechaLegible(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-PR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function diaSemanaCorto(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  return d.toLocaleDateString('es-PR', { weekday: 'short' }).slice(0, 2).toUpperCase()
}

function diffDias(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00')
  const db = new Date(b + 'T12:00:00')
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

// ─── Racha ───────────────────────────────────────────────────────────────────

export function calcularRacha(): number {
  const hoyStr = hoy()
  const ultima = localStorage.getItem(KEY_ULTIMA) || ''
  const rachaGuardada = parseInt(localStorage.getItem(KEY_RACHA) || '0', 10)

  if (!ultima) {
    localStorage.setItem(KEY_ULTIMA, hoyStr)
    localStorage.setItem(KEY_RACHA, '1')
    return 1
  }

  const diff = diffDias(ultima, hoyStr)

  if (diff === 0) return rachaGuardada
  if (diff === 1) {
    const nueva = rachaGuardada + 1
    localStorage.setItem(KEY_ULTIMA, hoyStr)
    localStorage.setItem(KEY_RACHA, String(nueva))
    return nueva
  }
  localStorage.setItem(KEY_ULTIMA, hoyStr)
  localStorage.setItem(KEY_RACHA, '1')
  return 1
}

// ─── Historial ───────────────────────────────────────────────────────────────

export function guardarEnHistorial(dia: DiaData): void {
  const raw = localStorage.getItem(KEY_HISTORIAL)
  const historial: Record<string, HistorialEntry> = raw ? JSON.parse(raw) : {}

  historial[dia.fecha] = {
    fecha: dia.fecha,
    completadas: dia.prioridades.filter((p) => p.hecha).length,
    total: dia.prioridades.length,
    ordenHecho: dia.ordenHecho,
  }

  // Guardar solo los últimos 30 días
  const fechas = Object.keys(historial).sort().slice(-30)
  const limpio: Record<string, HistorialEntry> = {}
  fechas.forEach((f) => (limpio[f] = historial[f]))
  localStorage.setItem(KEY_HISTORIAL, JSON.stringify(limpio))
}

export function cargarHistorial7Dias(): HistorialEntry[] {
  const raw = localStorage.getItem(KEY_HISTORIAL)
  const historial: Record<string, HistorialEntry> = raw ? JSON.parse(raw) : {}

  const resultado: HistorialEntry[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const fecha = d.toISOString().slice(0, 10)
    resultado.push(
      historial[fecha] ?? { fecha, completadas: 0, total: 3, ordenHecho: false }
    )
  }
  return resultado
}

// ─── Día de hoy ──────────────────────────────────────────────────────────────

const SEED_PRIORIDADES: Prioridad[] = [
  { id: '1', texto: 'Recoger el auto (sacar las bicicletas del carro)', hecha: false },
  { id: '2', texto: 'Preparar área de trabajo con cámara para videollamadas', hecha: false },
  { id: '3', texto: 'Planificar tareas del trabajo dentro de las 8 horas', hecha: false },
]

export function cargarDia(): DiaData {
  const hoyStr = hoy()
  const raw = localStorage.getItem(KEY_DIA)

  if (raw) {
    const guardado: DiaData = JSON.parse(raw)
    if (guardado.fecha === hoyStr) {
      return guardado
    }
    // Día nuevo: archivar el anterior en historial
    guardarEnHistorial(guardado)

    const mananaRaw = localStorage.getItem('hazlo_manana')
    const manana: Prioridad[] = mananaRaw ? JSON.parse(mananaRaw) : []
    const nuevasPrioridades =
      manana.length > 0 ? manana.map((p) => ({ ...p, hecha: false })) : SEED_PRIORIDADES

    // Limpiar mañana ya que pasaron a ser el día de hoy
    localStorage.removeItem('hazlo_manana')

    const nuevo: DiaData = {
      fecha: hoyStr,
      prioridades: nuevasPrioridades,
      ordenHecho: false,
      rachaActual: calcularRacha(),
      ultimaApertura: hoyStr,
    }
    guardarDia(nuevo)
    return nuevo
  }

  const primero: DiaData = {
    fecha: hoyStr,
    prioridades: SEED_PRIORIDADES,
    ordenHecho: false,
    rachaActual: calcularRacha(),
    ultimaApertura: hoyStr,
  }
  guardarDia(primero)
  return primero
}

export function guardarDia(dia: DiaData): void {
  localStorage.setItem(KEY_DIA, JSON.stringify(dia))
  // Actualizar historial del día actual en tiempo real
  guardarEnHistorial(dia)
}

// ─── Prioridades de mañana ───────────────────────────────────────────────────

export interface PrioridadManana {
  id: string
  texto: string
}

export function cargarManana(): PrioridadManana[] {
  const raw = localStorage.getItem('hazlo_manana')
  if (!raw) return [{ id: '1', texto: '' }, { id: '2', texto: '' }, { id: '3', texto: '' }]
  return JSON.parse(raw)
}

export function guardarManana(prioridades: PrioridadManana[]): void {
  localStorage.setItem('hazlo_manana', JSON.stringify(prioridades))
}
