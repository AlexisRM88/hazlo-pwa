// ─── Types ───────────────────────────────────────────────────────────────────

export interface Prioridad {
  id: string
  texto: string
  hecha: boolean
}

export interface DiaData {
  fecha: string          // "2026-04-16"
  prioridades: Prioridad[]
  ordenHecho: boolean    // timer de 10 min completado
  rachaActual: number    // días seguidos que abriste la app
  ultimaApertura: string // fecha de la última apertura "2026-04-15"
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEY_DIA = 'hazlo_dia'
const KEY_RACHA = 'hazlo_racha'
const KEY_ULTIMA = 'hazlo_ultima_apertura'

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
    // Primera vez
    localStorage.setItem(KEY_ULTIMA, hoyStr)
    localStorage.setItem(KEY_RACHA, '1')
    return 1
  }

  const diff = diffDias(ultima, hoyStr)

  if (diff === 0) return rachaGuardada // ya abrió hoy
  if (diff === 1) {
    // Día siguiente: racha sigue
    const nueva = rachaGuardada + 1
    localStorage.setItem(KEY_ULTIMA, hoyStr)
    localStorage.setItem(KEY_RACHA, String(nueva))
    return nueva
  }
  // Rompió racha — pero sin drama: empieza en 1 de nuevo
  localStorage.setItem(KEY_ULTIMA, hoyStr)
  localStorage.setItem(KEY_RACHA, '1')
  return 1
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
    // Es un día nuevo: las prioridades "mañana" pasan a ser las de hoy
    // Guardamos las de mañana que el usuario escribió ayer
    const mananaRaw = localStorage.getItem('hazlo_manana')
    const manana: Prioridad[] = mananaRaw ? JSON.parse(mananaRaw) : []
    const nuevasPrioridades =
      manana.length > 0 ? manana.map((p) => ({ ...p, hecha: false })) : SEED_PRIORIDADES
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

  // Primera vez absoluta
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
