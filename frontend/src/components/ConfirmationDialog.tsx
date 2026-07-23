import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  irreversible?: boolean;
  variant?: 'primary' | 'danger';
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  irreversible = false,
  variant = 'primary',
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  if (!open) return null;

  const confirmClass = variant === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirmation-dialog-title">
      <div className="modal-card max-w-lg">
        <div className="modal-body">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle size={24} />
            </div>
            <div className="min-w-0">
              <h2 id="confirmation-dialog-title" className="text-xl font-black text-slate-950">{title}</h2>
              <div className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</div>
            </div>
          </div>

          {irreversible && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">
              Esta accion es irreversible. Revisa la informacion antes de confirmar.
            </div>
          )}

        </div>
        <div className="modal-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
