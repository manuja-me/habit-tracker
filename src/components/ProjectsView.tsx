'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Play, Pause, X } from 'lucide-react';
import { Project, ProjectStatus, ProjectTask } from '../lib/types';
import { getProjectsAction, saveProjectAction, deleteProjectAction } from '../lib/server/actions';

const LOCAL_KEY = 'zenith_projects_v1';

type Result = { success: boolean; error?: string };

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => void }) {
  const [value, setValue] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    onAdd(title);
    setValue('');
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={200}
        className="flex-1 h-8 px-2.5 bg-input/40 border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
      />
      <button
        type="submit"
        aria-label={placeholder}
        className="w-8 h-8 flex items-center justify-center border border-main text-sub hover:text-main hover:bg-subtle cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
    </form>
  );
}

function ProjectCard({
  project,
  onChange,
  onDelete,
}: {
  project: Project;
  onChange: (p: Project) => void;
  onDelete: () => void;
}) {
  const done = project.tasks.filter((t) => t.done).length;
  const setTasks = (tasks: ProjectTask[]) => onChange({ ...project, tasks });
  const isActive = project.status === 'active';

  return (
    <div className={`border bg-card ${isActive ? 'border-main border-l-4 border-l-[#FF3B30]' : 'border-main'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-subtle">
        <input
          defaultValue={project.title}
          aria-label="Project title"
          maxLength={200}
          onBlur={(e) => {
            const title = e.target.value.trim();
            if (!title) e.target.value = project.title;
            else if (title !== project.title) onChange({ ...project, title });
          }}
          className="flex-1 min-w-0 bg-transparent text-sm font-black font-sans uppercase tracking-tight text-main focus:outline-none"
        />
        {project.tasks.length > 0 && (
          <span className="text-[10px] font-mono font-bold text-sub">
            {done}/{project.tasks.length}
          </span>
        )}
        <button
          onClick={() => onChange({ ...project, status: isActive ? 'planned' : 'active' })}
          title={isActive ? 'Move to future projects' : 'Start project'}
          aria-label={isActive ? 'Move to future projects' : 'Start project'}
          className="w-7 h-7 flex items-center justify-center text-sub hover:text-main hover:bg-subtle cursor-pointer"
        >
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => confirm(`Delete project "${project.title}"?`) && onDelete()}
          title="Delete project"
          aria-label="Delete project"
          className="w-7 h-7 flex items-center justify-center text-sub hover:text-[#FF3B30] hover:bg-subtle cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        <textarea
          defaultValue={project.notes}
          aria-label="Project notes"
          placeholder={isActive ? 'Notes, context, next steps...' : 'Plan: goals, scope, resources...'}
          onBlur={(e) => e.target.value !== project.notes && onChange({ ...project, notes: e.target.value })}
          style={{ fieldSizing: 'content' } as React.CSSProperties}
          className="w-full min-h-[38px] bg-input/40 p-2 text-xs font-mono text-main placeholder-muted-custom focus:outline-none resize-none leading-relaxed border-0"
        />

        {project.tasks.length > 0 && (
          <ul className="space-y-1">
            {project.tasks.map((t) => (
              <li key={t.id} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={t.done}
                  aria-label={`Mark "${t.title}" done`}
                  onChange={() => setTasks(project.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                  className="accent-[#FF3B30] cursor-pointer"
                />
                <span className={`flex-1 text-xs font-mono ${t.done ? 'line-through text-sub' : 'text-main'}`}>
                  {t.title}
                </span>
                <button
                  onClick={() => setTasks(project.tasks.filter((x) => x.id !== t.id))}
                  aria-label={`Remove subtask "${t.title}"`}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-sub hover:text-[#FF3B30] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <AddRow
          placeholder="Add subtask"
          onAdd={(title) => setTasks([...project.tasks, { id: crypto.randomUUID(), title, done: false }])}
        />
      </div>
    </div>
  );
}

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCloud, setIsCloud] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjectsAction().then((res) => {
      if (!res.success) setError(res.error || 'Failed to load projects');
      else if (!res.isConfigured) {
        setIsCloud(false);
        try {
          setProjects(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'));
        } catch {}
      } else setProjects(res.projects || []);
      setLoading(false);
    });
  }, []);

  // Optimistic update; on failure keep local edits visible and surface the error so nothing is silently lost
  const apply = async (next: Project[], op: () => Promise<Result>) => {
    setProjects(next);
    setError('');
    if (!isCloud) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
      return;
    }
    const res = await op();
    if (!res.success) setError(res.error || 'Save failed');
  };

  const save = (p: Project) =>
    apply(
      projects.some((x) => x.id === p.id) ? projects.map((x) => (x.id === p.id ? p : x)) : [...projects, p],
      () => saveProjectAction(p)
    );

  const remove = (id: string) => apply(projects.filter((x) => x.id !== id), () => deleteProjectAction(id));

  const create = (title: string, status: ProjectStatus) =>
    save({
      id: crypto.randomUUID(),
      title,
      notes: '',
      status,
      tasks: [],
      order: projects.reduce((m, p) => Math.max(m, p.order), 0) + 1,
      created_at: new Date().toISOString(),
    });

  const section = (status: ProjectStatus, heading: string, sub: string, addLabel: string) => {
    const list = projects.filter((p) => p.status === status).sort((a, b) => a.order - b.order);
    return (
      <section className="space-y-2.5" aria-label={heading}>
        <div className="pb-2.5 border-b border-subtle">
          <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">
            {heading} <span className="text-sub font-mono text-[11px]">({list.length})</span>
          </h3>
          <p className="text-[11px] font-mono text-sub uppercase tracking-wider">{sub}</p>
        </div>
        <AddRow placeholder={addLabel} onAdd={(title) => create(title, status)} />
        {list.map((p) => (
          <ProjectCard key={p.id} project={p} onChange={save} onDelete={() => remove(p.id)} />
        ))}
      </section>
    );
  };

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6">
      <div className="bg-card p-4 sm:p-6 border border-main shadow-xs space-y-8">
        {error && (
          <p role="alert" className="text-xs font-mono text-[#FF3B30] border border-[#FF3B30] px-3 py-2">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-xs font-mono text-sub uppercase tracking-wider">Loading projects...</p>
        ) : (
          <>
            {section('active', 'Ongoing Projects', 'In progress right now', 'Add ongoing project')}
            {section('planned', 'Future Projects', 'Plan before you start', 'Add future project')}
          </>
        )}
      </div>
    </div>
  );
}
