import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Gavel, MapPin, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Cancha, Categoria } from '@saas/shared';
import { competicionService, type FlujoCampeonatoResumen } from '../../services/competicion.service';

export const CampeonatoAdmin = () => {
  const [resumen, setResumen] = useState<FlujoCampeonatoResumen | undefined>();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [canchas, setCanchas] = useState<Cancha[]>([]);
  const [canchaNombre, setCanchaNombre] = useState('');

  const cargar = async () => {
    const [resumenData, categoriasData, canchasData] = await Promise.all([
      competicionService.obtenerFlujoCampeonato(),
      competicionService.obtenerCategorias(),
      competicionService.obtenerCanchas(),
    ]);
    setResumen(resumenData);
    setCategorias(categoriasData);
    setCanchas(canchasData);
  };

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, []);

  const crearCancha = async () => {
    try {
      await competicionService.crearCancha(canchaNombre);
      setCanchaNombre('');
      await cargar();
      toast.success('Cancha creada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la cancha.');
    }
  };

  const generarFechas = async () => {
    try {
      if (!resumen?.campeonato) throw new Error('No hay campeonato activo.');
      await competicionService.generarFechasCampeonato(resumen.campeonato.id, resumen.campeonato.cantidadFechas ?? 24);
      await cargar();
      toast.success('Fechas generadas sin duplicar las existentes.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron generar las fechas.');
    }
  };

  const pasos = [
    { label: 'Campeonato configurado', valor: resumen?.campeonato?.estado ?? 'BORRADOR', listo: Boolean(resumen?.campeonato?.fechaInicio && resumen?.campeonato?.fechaFin), to: '/admin/campeonato' },
    { label: 'Equipos inscritos', valor: `${resumen?.equiposInscritos ?? 0} de 12`, listo: (resumen?.equiposInscritos ?? 0) >= 12, to: '/admin/equipos' },
    { label: 'Fechas creadas', valor: `${resumen?.fechasCreadas ?? 0} de ${resumen?.campeonato?.cantidadFechas ?? 24}`, listo: (resumen?.fechasCreadas ?? 0) >= (resumen?.campeonato?.cantidadFechas ?? 24), to: '/admin/campeonato' },
    { label: 'Fixture programado', valor: `${resumen?.partidosProgramados ?? 0} partidos`, listo: (resumen?.partidosProgramados ?? 0) >= 66, to: '/admin/partidos' },
    { label: 'Oficiales asignados', valor: `${resumen?.partidosSinVocal ?? 0} sin vocal / ${resumen?.partidosSinArbitro ?? 0} sin arbitro`, listo: (resumen?.partidosSinVocal ?? 0) === 0 && (resumen?.partidosSinArbitro ?? 0) === 0, to: '/admin/partidos' },
  ];

  return (
    <div className="space-y-5">
      <section className="surface-strong p-5">
        <p className="text-sm font-black uppercase text-emerald-600">Campeonato</p>
        <h1 className="text-2xl font-black text-slate-950">{resumen?.campeonato?.nombre ?? 'Campeonato local'}</h1>
        <p className="text-sm text-slate-500">
          {resumen?.campeonato?.fechaInicio ?? 'Sin inicio'} al {resumen?.campeonato?.fechaFin ?? 'Sin fin'} - {resumen?.campeonato?.cantidadFechas ?? 24} fechas - amarillas para suspension: {resumen?.campeonato?.amarillasParaSuspension ?? 3}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {pasos.map((paso, index) => (
          <Link key={paso.label} to={paso.to} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300">
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">{index + 1}</span>
              {paso.listo && <CheckCircle2 className="text-emerald-600" size={20} />}
            </div>
            <p className="mt-3 text-sm font-black text-slate-950">{paso.label}</p>
            <p className="text-sm font-bold text-slate-500">{paso.valor}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="surface p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black"><CalendarDays size={20} /> Fechas del campeonato</h2>
              <p className="text-sm text-slate-500">Cada card resume programacion, actas y sancionados por fecha.</p>
            </div>
            <button className="btn-primary" onClick={generarFechas}><Plus size={18} /> Generar hasta 24</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {resumen?.fechas.map(({ jornada, partidos, finalizados, pendientes, suspendidos }) => (
              <div key={jornada.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black text-slate-950">{jornada.nombre}</p>
                  <span className="badge bg-emerald-100 text-emerald-700">{jornada.estado}</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{jornada.fechaInicio} al {jornada.fechaFin}</p>
                <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
                  <p>{partidos} partidos programados</p>
                  <p>{finalizados} finalizados / {pendientes} pendientes</p>
                  <p>{suspendidos} jugadores suspendidos</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/admin/partidos" className="btn-secondary">Ver partidos</Link>
                  <Link to="/admin/sanciones" className="btn-secondary">Sancionados</Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Users size={20} /> Categorias</h2>
            <div className="mt-4 grid gap-2">
              {categorias.map((categoria) => <span key={categoria.id} className="badge bg-slate-100 text-slate-700">{categoria.nombre}</span>)}
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><MapPin size={20} /> Canchas</h2>
            <div className="mt-4 flex gap-2">
              <input className="field" placeholder="Nueva cancha" value={canchaNombre} onChange={(e) => setCanchaNombre(e.target.value)} />
              <button className="btn-primary" onClick={crearCancha}><Plus size={18} /></button>
            </div>
            <div className="mt-4 grid gap-2">
              {canchas.map((cancha) => <div key={cancha.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold">{cancha.nombre}</div>)}
            </div>
          </section>

          <section className="surface p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><Gavel size={20} /> Reglas</h2>
            <p className="mt-3 text-sm font-bold text-slate-600">Victoria {resumen?.campeonato?.puntosVictoria ?? 3}, empate {resumen?.campeonato?.puntosEmpate ?? 1}, derrota {resumen?.campeonato?.puntosDerrota ?? 0}.</p>
          </section>
        </aside>
      </div>
    </div>
  );
};
