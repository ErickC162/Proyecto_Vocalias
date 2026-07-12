import { useEffect, useState } from 'react';
import type { EstadisticaGoleador, EstadisticaTarjeta, PosicionEquipo } from '@saas/shared';
import { estadisticasService } from '../../services/estadisticas.service';

export const EstadisticasAdmin = () => {
  const [tabla, setTabla] = useState<PosicionEquipo[]>([]);
  const [goleadores, setGoleadores] = useState<EstadisticaGoleador[]>([]);
  const [tarjetas, setTarjetas] = useState<EstadisticaTarjeta[]>([]);

  useEffect(() => {
    const cargar = async () => {
      const [tablaData, goleadoresData, tarjetasData] = await Promise.all([
        estadisticasService.calcularTabla(),
        estadisticasService.calcularGoleadores(),
        estadisticasService.calcularTarjetas(),
      ]);
      setTabla(tablaData);
      setGoleadores(goleadoresData);
      setTarjetas(tarjetasData);
    };
    cargar();
  }, []);

  return (
    <div className="space-y-5">
      <section className="surface-strong p-5">
        <p className="text-sm font-black uppercase text-emerald-600">Competencia</p>
        <h1 className="text-2xl font-black text-slate-950">Tabla, goleadores y tarjetas</h1>
      </section>

      <section className="surface p-5">
        <h2 className="text-lg font-black">Tabla de posiciones</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2">Equipo</th><th>Pts</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th></tr>
            </thead>
            <tbody>
              {tabla.map((item) => (
                <tr key={item.equipoId} className="border-t border-slate-100">
                  <td className="py-3 font-black">{item.equipo}</td><td>{item.puntos}</td><td>{item.jugados}</td><td>{item.ganados}</td><td>{item.empatados}</td><td>{item.perdidos}</td><td>{item.golesFavor}</td><td>{item.golesContra}</td><td>{item.diferencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="text-lg font-black">Goleadores</h2>
          <div className="mt-4 grid gap-2">
            {goleadores.map((item) => <div key={item.jugadorId} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"><span className="font-bold">{item.jugador}<br /><small className="font-normal text-slate-500">{item.equipo}</small></span><b>{item.goles}</b></div>)}
          </div>
        </section>
        <section className="surface p-5">
          <h2 className="text-lg font-black">Tarjetas</h2>
          <div className="mt-4 grid gap-2">
            {tarjetas.map((item) => <div key={item.jugadorId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="font-bold">{item.jugador}<br /><small className="font-normal text-slate-500">{item.equipo}</small></span><span className="badge bg-yellow-100 text-yellow-700">A {item.amarillas}</span><span className="badge bg-red-100 text-red-700">R {item.rojas}</span></div>)}
          </div>
        </section>
      </div>
    </div>
  );
};
