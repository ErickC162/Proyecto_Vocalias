import { useEffect, useState } from 'react';
import { CalendarPlus, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { Cancha, Categoria, Equipo, Jornada, Usuario } from '@saas/shared';
import { adminPartidosService, type CrearPartidoInput, type PartidoAdminResumen } from '../../services/adminPartidos.service';
import { competicionService } from '../../services/competicion.service';
import { equiposService } from '../../services/equipos.service';
import { usuariosService } from '../../services/usuarios.service';

const inicial: CrearPartidoInput = {
  campeonatoId: 'camp-1',
  categoriaId: 'cat-maxima',
  jornadaId: 'jor-1',
  canchaId: 'cancha-central',
  fecha: '',
  hora: '',
  equipoLocalId: '',
  equipoVisitanteId: '',
  vocalId: '',
  arbitroId: '',
};

export const PartidosAdmin = () => {
  const [partidos, setPartidos] = useState<PartidoAdminResumen[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [vocales, setVocales] = useState<Usuario[]>([]);
  const [arbitros, setArbitros] = useState<Usuario[]>([]);
  const [form, setForm] = useState<CrearPartidoInput>(inicial);

  const cargar = async () => {
    const [resumen, equiposData, categoriasData, canchasData, jornadasData, vocalesData, arbitrosData] = await Promise.all([
      adminPartidosService.obtenerResumen(),
      equiposService.obtenerTodos(),
      competicionService.obtenerCategorias(),
      competicionService.obtenerCanchas(),
      competicionService.obtenerJornadas(),
      usuariosService.obtenerActivosPorRol('VOCAL'),
      usuariosService.obtenerActivosPorRol('ARBITRO'),
    ]);
    setPartidos(resumen);
    setEquipos(equiposData.filter((equipo) => equipo.activo !== false));
    setCategorias(categoriasData);
    setCanchas(canchasData.filter((cancha) => cancha.activa));
    setJornadas(jornadasData);
    setVocales(vocalesData);
    setArbitros(arbitrosData);
    setForm((prev) => ({ ...prev, equipoLocalId: prev.equipoLocalId || equiposData[0]?.id || '', equipoVisitanteId: prev.equipoVisitanteId || equiposData[1]?.id || '' }));
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const crear = async () => {
    try {
      await adminPartidosService.crear({ ...form, vocalId: form.vocalId || undefined, arbitroId: form.arbitroId || undefined });
      toast.success('Partido creado y asignaciones registradas.');
      setForm(inicial);
      await cargar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el partido.');
    }
  };

  return (
    <div className="space-y-5">
      <section className="surface-strong p-5">
        <p className="text-sm font-black uppercase text-emerald-600">Fixture</p>
        <h1 className="text-2xl font-black text-slate-950">Partidos y asignaciones</h1>
      </section>

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><CalendarPlus size={20} /> Nuevo partido</h2>
          <div className="mt-4 grid gap-3">
            <select className="field" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>{categorias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.jornadaId} onChange={(e) => setForm({ ...form, jornadaId: e.target.value })}>{jornadas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.canchaId} onChange={(e) => setForm({ ...form, canchaId: e.target.value })}>{canchas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <input className="field" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            <input className="field" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            <select className="field" value={form.equipoLocalId} onChange={(e) => setForm({ ...form, equipoLocalId: e.target.value })}>{equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.equipoVisitanteId} onChange={(e) => setForm({ ...form, equipoVisitanteId: e.target.value })}>{equipos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
            <select className="field" value={form.vocalId} onChange={(e) => setForm({ ...form, vocalId: e.target.value })}><option value="">Sin vocal</option>{vocales.map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.apellido}</option>)}</select>
            <select className="field" value={form.arbitroId} onChange={(e) => setForm({ ...form, arbitroId: e.target.value })}><option value="">Sin arbitro</option>{arbitros.map((item) => <option key={item.id} value={item.id}>{item.nombre} {item.apellido}</option>)}</select>
            <button className="btn-primary" onClick={crear}>Crear partido</button>
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-black"><ClipboardList size={20} /> Calendario competitivo</h2>
          <div className="mt-4 grid gap-3">
            {partidos.map(({ partido, local, visitante, cancha, vocal, arbitro, jornada, suspendidosLocal, suspendidosVisitante }) => (
              <div key={partido.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black">{local?.nombre ?? partido.equipoLocalId} vs {visitante?.nombre ?? partido.equipoVisitanteId}</p>
                    <p className="text-sm text-slate-500">{partido.fecha} {partido.hora} · {cancha?.nombre ?? partido.escenario} · {jornada?.nombre ?? partido.jornada}</p>
                  </div>
                  <span className="badge bg-emerald-100 text-emerald-700">{partido.estado}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <p><b>Vocal:</b> {vocal ? `${vocal.nombre} ${vocal.apellido ?? ''}` : 'Pendiente'}</p>
                  <p><b>Arbitro:</b> {arbitro ? `${arbitro.nombre} ${arbitro.apellido ?? ''}` : 'Pendiente'}</p>
                  <p><b>{local?.nombreCorto ?? 'Local'}:</b> {suspendidosLocal > 0 ? `${suspendidosLocal} suspendidos` : 'Plantilla completa'}</p>
                  <p><b>{visitante?.nombreCorto ?? 'Visitante'}:</b> {suspendidosVisitante > 0 ? `${suspendidosVisitante} suspendidos` : 'Plantilla completa'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
