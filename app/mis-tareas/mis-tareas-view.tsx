"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeTaskAction } from "./actions";
import type { MisTarea, TaskStatus } from "./types";

type MisTareasResponse = {
  items: MisTarea[];
  hasMore: boolean;
};

type MisTareasViewProps = {
  initialPendingTasks: MisTarea[];
  initialPendingHasMore: boolean;
  initialCompletedTasks: MisTarea[];
  initialCompletedHasMore: boolean;
  pageSize: number;
};

const INITIAL_COMPLETE_TASK_STATE = {
  error: null,
  success: false,
};

function buildMeta(task: MisTarea) {
  if (task.overdue) {
    return `ATRASADA - ${task.dueDateLabel ?? "Sin fecha limite"}`;
  }
  return `${task.statusLabel} - ${task.dueDateLabel ?? "Sin fecha limite"}`;
}

type CompleteTaskFormProps = {
  task: MisTarea;
  onClose: () => void;
};

function CompleteTaskForm({ task, onClose }: CompleteTaskFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    completeTaskAction,
    INITIAL_COMPLETE_TASK_STATE,
  );

  useEffect(() => {
    if (!state.success) return;
    onClose();
    router.refresh();
  }, [onClose, router, state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-3 pt-1">
      <input type="hidden" name="taskId" value={task.id} />

      <div className="flex w-full flex-col gap-[6px]">
        <label className="text-[12px] leading-none font-normal text-[#405C62]">
          Comentario
        </label>
        <textarea
          name="comment"
          rows={3}
          defaultValue={task.comment ?? ""}
          placeholder="Escribe un comentario para completar"
          className="w-full resize-none rounded-[12px] border border-[#B3B5B3] bg-white p-3 text-[14px] leading-none font-normal text-[#0D3233] outline-none placeholder:text-[#8A9BA7]"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-[12px] border-0 bg-[#0D3233] text-[14px] leading-none font-normal text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Marcar como completada"}
      </button>

      {state.error ? (
        <p className="m-0 text-[12px] leading-none font-normal text-[#A43E2A]">
          {state.error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white text-[14px] leading-none font-normal text-[#0D3233]"
      >
        Volver
      </button>
    </form>
  );
}

export default function MisTareasView({
  initialPendingTasks,
  initialPendingHasMore,
  initialCompletedTasks,
  initialCompletedHasMore,
  pageSize,
}: MisTareasViewProps) {
  const [activeTab, setActiveTab] = useState<TaskStatus>("pendiente");
  const [selectedTask, setSelectedTask] = useState<MisTarea | null>(null);

  const [pendingTasks, setPendingTasks] = useState(initialPendingTasks);
  const [pendingHasMore, setPendingHasMore] = useState(initialPendingHasMore);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [completedTasks, setCompletedTasks] = useState(initialCompletedTasks);
  const [completedHasMore, setCompletedHasMore] = useState(initialCompletedHasMore);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isCompletedTask = selectedTask?.status === "completada";

  const activeTasks = activeTab === "pendiente" ? pendingTasks : completedTasks;
  const activeHasMore = activeTab === "pendiente" ? pendingHasMore : completedHasMore;
  const activeLoading = activeTab === "pendiente" ? pendingLoading : completedLoading;
  const activeError = activeTab === "pendiente" ? pendingError : completedError;

  useEffect(() => {
    setPendingTasks(initialPendingTasks);
    setPendingHasMore(initialPendingHasMore);
    setPendingError(null);
    setPendingLoading(false);
  }, [initialPendingHasMore, initialPendingTasks]);

  useEffect(() => {
    setCompletedTasks(initialCompletedTasks);
    setCompletedHasMore(initialCompletedHasMore);
    setCompletedError(null);
    setCompletedLoading(false);
  }, [initialCompletedHasMore, initialCompletedTasks]);

  const loadMore = useCallback(
    async (status: TaskStatus) => {
      const isPending = status === "pendiente";
      const items = isPending ? pendingTasks : completedTasks;
      const hasMore = isPending ? pendingHasMore : completedHasMore;
      const isLoading = isPending ? pendingLoading : completedLoading;

      if (isLoading || !hasMore) return;

      if (isPending) {
        setPendingLoading(true);
        setPendingError(null);
      } else {
        setCompletedLoading(true);
        setCompletedError(null);
      }

      try {
        const params = new URLSearchParams({
          status,
          offset: String(items.length),
          limit: String(pageSize),
        });
        const response = await fetch(`/api/mis-tareas?${params.toString()}`);

        if (!response.ok) {
          throw new Error("No se pudieron cargar mas tareas.");
        }

        const payload = (await response.json()) as MisTareasResponse;

        if (isPending) {
          setPendingTasks((current) => {
            const seen = new Set(current.map((item) => item.id));
            const next = payload.items.filter((item) => !seen.has(item.id));
            return current.concat(next);
          });
          setPendingHasMore(payload.hasMore);
        } else {
          setCompletedTasks((current) => {
            const seen = new Set(current.map((item) => item.id));
            const next = payload.items.filter((item) => !seen.has(item.id));
            return current.concat(next);
          });
          setCompletedHasMore(payload.hasMore);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error cargando tareas.";
        if (isPending) {
          setPendingError(message);
        } else {
          setCompletedError(message);
        }
      } finally {
        if (isPending) {
          setPendingLoading(false);
        } else {
          setCompletedLoading(false);
        }
      }
    },
    [
      completedHasMore,
      completedLoading,
      completedTasks,
      pageSize,
      pendingHasMore,
      pendingLoading,
      pendingTasks,
    ],
  );

  useEffect(() => {
    if (!activeHasMore || activeLoading) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          void loadMore(activeTab);
        }
      },
      { rootMargin: "180px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeHasMore, activeLoading, activeTab, loadMore]);

  const filteredTasks = useMemo(() => activeTasks, [activeTasks]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        <div className="flex h-10 w-full gap-1 rounded-[12px] border border-[#B3B5B3] bg-[#E9EDE9] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("pendiente")}
            className={`h-full w-full rounded-[8px] text-[12px] leading-none font-normal ${
              activeTab === "pendiente" ? "bg-[#0D3233] text-white" : "text-[#5A7984]"
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completada")}
            className={`h-full w-full rounded-[8px] text-[12px] leading-none font-normal ${
              activeTab === "completada" ? "bg-[#0D3233] text-white" : "text-[#5A7984]"
            }`}
          >
            Completadas
          </button>
        </div>

        <section className="mt-4 flex w-full flex-col gap-3">
          {filteredTasks.length === 0 ? (
            <div className="rounded-[12px] border border-[#B3B5B3] bg-white p-4 text-center text-[14px] text-[#405C62]">
              No hay tareas para esta vista.
            </div>
          ) : null}

          {filteredTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => setSelectedTask(task)}
              className={`flex h-[72px] w-full flex-col items-start justify-center gap-1 rounded-[12px] border px-3 py-0 text-left ${
                task.overdue
                  ? "border-[#D4A64A] bg-[#F5EED6]"
                  : "border-transparent bg-[#5A7A84]"
              }`}
            >
              <span
                className={`text-[14px] leading-none font-normal ${
                  task.overdue ? "text-[#0D3233]" : "text-white"
                }`}
              >
                {task.title}
              </span>
              <span
                className={`text-[12px] leading-none font-normal ${
                  task.overdue ? "text-[#5A7984]" : "text-[#E9EDE9]"
                }`}
              >
                {buildMeta(task)}
              </span>
            </button>
          ))}

          <div ref={sentinelRef} className="h-6 w-full" aria-hidden="true" />

          {activeLoading ? (
            <p className="m-0 pb-2 text-center text-[12px] text-[#405C62]">Cargando tareas...</p>
          ) : null}

          {activeError ? (
            <button
              type="button"
              onClick={() => void loadMore(activeTab)}
              className="h-10 w-full rounded-[10px] border border-[#B3B5B3] bg-white text-[13px] text-[#0D3233]"
            >
              {activeError} Reintentar
            </button>
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full bg-[#E9EDE9] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
        <Link
          href="/home"
          className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#8A9BA7] bg-white text-[14px] leading-none font-normal text-[#0D3233] shadow-[0_2px_8px_0_#0D32330F]"
        >
          Volver
        </Link>
      </div>

      {selectedTask ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-transparent p-4">
          <div className="w-full rounded-[12px] border border-[#B3B5B3] bg-[#E9EDE9] p-4">
            <div className="flex flex-col gap-3">
              <p className="m-0 text-[16px] leading-none font-normal text-[#0D3233]">
                {selectedTask.title}
              </p>
              <p className="m-0 text-[13px] leading-none font-normal text-[#5A7984]">
                {selectedTask.description ?? "Sin descripcion."}
              </p>
              <p className="m-0 text-[12px] leading-none font-normal text-[#405C62]">
                Estado: {selectedTask.statusLabel} - Fecha limite:{" "}
                {selectedTask.dueDateLabel ?? "Sin fecha limite"}
              </p>

              {isCompletedTask ? (
                <div className="flex w-full flex-col gap-[6px]">
                  <label className="text-[12px] leading-none font-normal text-[#405C62]">
                    Comentario registrado
                  </label>
                  <div className="min-h-[84px] w-full rounded-[12px] border border-[#B3B5B3] bg-white p-3 text-[14px] text-[#0D3233]">
                    {selectedTask.comment?.trim() || "Sin comentarios."}
                  </div>
                </div>
              ) : null}

              {!isCompletedTask ? (
                <CompleteTaskForm
                  key={selectedTask.id}
                  task={selectedTask}
                  onClose={() => setSelectedTask(null)}
                />
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTask(null)}
                    className="h-11 w-full rounded-[12px] border border-[#B3B5B3] bg-white text-[14px] leading-none font-normal text-[#0D3233]"
                  >
                    Volver
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


