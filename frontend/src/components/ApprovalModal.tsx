import { useState } from "react";

export interface ApprovalModalProps {
  sql: string;
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ApprovalModal({
  sql,
  reason,
  onConfirm,
  onCancel,
}: ApprovalModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText === "CONFIRM";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white shadow-2xl">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg text-red-600"
              aria-hidden
            >
              ⚠
            </span>
            <div>
              <h2
                id="approval-modal-title"
                className="text-base font-semibold text-red-900"
              >
                Dangerous SQL detected
              </h2>
              <p className="mt-1 text-sm text-red-700">
                The generated query contains a dangerous operation and was not
                executed automatically.
              </p>
              {reason && (
                <p className="mt-2 text-sm font-medium text-red-800">{reason}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
            <code>{sql}</code>
          </pre>

          <p className="text-sm text-slate-600">
            Type <span className="font-mono font-semibold text-red-700">CONFIRM</span>{" "}
            below to proceed with running this query.
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type CONFIRM"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalModal;
