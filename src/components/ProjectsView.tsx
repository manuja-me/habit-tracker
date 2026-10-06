'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, Play, Pause, X, Building2, User, ChevronDown, Check } from 'lucide-react';
import { Project, ProjectGroup, ProjectGroupKind, ProjectStatus, ProjectTask } from '../lib/types';
import {
  getProjectsAction,
  saveProjectAction,
  deleteProjectAction,
  saveProjectGroupAction,
  deleteProjectGroupAction,
} from '../lib/server/actions';

const LOCAL_KEY = 'zenith_projects_v1';

type Result = { success: boolean; error?: string };

function GroupIcon({ kind, className = 'w-3.5 h-3.5' }: { kind: ProjectGroupKind; className?: string }) {
  return kind === 'org' ? <Building2 className={className} /> : <User className={className} />;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; group?: string; icon?: React.ReactNode }[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const selectedOpt = options.find((o) => o.value === value);

  // Group options if groups exist
  const groups = Array.from(new Set(options.map((o) => o.group || '')));

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-8 px-2.5 bg-input border border-main hover:border-neutral-400 text-xs font-mono text-main flex items-center justify-between gap-2 transition-colors cursor-pointer select-none"
      >
        <span className="truncate flex items-center gap-1.5 max-w-[130px] sm:max-w-[180px]">
          {selectedOpt?.icon}
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-sub transition-transform duration-150 ${isOpen ? 'rotate-180 text-[#FF3B30]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 z-50 mt-1 min-w-[160px] max-w-[240px] bg-card border border-main shadow-2xl max-h-56 overflow-y-auto">
          {groups.map((group) => {
            const groupOpts = options.filter((o) => (o.group || '') === group);
            return (
              <div key={group || 'default'}>
                {group && (
                  <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-muted-custom bg-subtle/60 border-b border-subtle">
                    {group}
                  </div>
                )}
                {groupOpts.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs font-mono flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF3B30]/15 text-[#FF3B30] font-bold'
                          : 'text-main hover:bg-subtle hover:text-main'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {opt.icon}
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#FF3B30] shrink-0 stroke-[2.5]" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddRow({
  placeholder,
  onAdd,
  children,
}: {
  placeholder: string;
  onAdd: (title: string) => void;
  children?: React.ReactNode;
}) {
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
        className="flex-1 min-w-0 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
      />
      {children}
      <button
        type="submit"
        aria-label={placeholder}
        className="w-8 h-8 shrink-0 flex items-center justify-center border border-main text-sub hover:text-main hover:bg-subtle cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
    </form>
  );
}

function OwnerSelect({
  groups,
  value,
  onChange,
  label,
}: {
  groups: ProjectGroup[];
  value: string | null;
  onChange: (groupId: string | null) => void;
  label: string;
}) {
  const options = [
    { value: '', label: 'Unassigned' },
    ...groups.map((g) => ({
      value: g.id,
      label: g.name,
      group: g.kind === 'org' ? 'Organizations' : 'People',
      icon: <GroupIcon kind={g.kind} className="w-3 h-3 text-sub" />,
    })),
  ];

  return (
    <CustomSelect
      value={value ?? ''}
      onChange={(val) => onChange(val || null)}
      options={options}
      placeholder="Unassigned"
      ariaLabel={label}
    />
  );
}

function NewProjectForm({
  groups,
  placeholder,
  onAdd,
}: {
  groups: ProjectGroup[];
  placeholder: string;
  onAdd: (title: string, groupId: string | null) => void;
}) {
  const [owner, setOwner] = useState<string | null>(null);
  return (
    <AddRow placeholder={placeholder} onAdd={(t) => onAdd(t, owner)}>
      <OwnerSelect groups={groups} value={owner} onChange={setOwner} label="Belongs to" />
    </AddRow>
  );
}

function NewGroupForm({ onAdd }: { onAdd: (name: string, kind: ProjectGroupKind) => void }) {
  const [kind, setKind] = useState<ProjectGroupKind>('org');
  return (
    <AddRow placeholder="Add organization or person" onAdd={(n) => onAdd(n.slice(0, 100), kind)}>
      <CustomSelect
        value={kind}
        onChange={(val) => setKind(val as ProjectGroupKind)}
        options={[
          { value: 'org', label: 'Organization', icon: <Building2 className="w-3 h-3 text-sub" /> },
          { value: 'person', label: 'Person', icon: <User className="w-3 h-3 text-sub" /> },
        ]}
        ariaLabel="Type"
      />
    </AddRow>
  );
}

function ProjectCard({
  project,
  groups,
  onChange,
  onDelete,
}: {
  project: Project;
  groups: ProjectGroup[];
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
        <OwnerSelect
          groups={groups}
          value={project.group_id}
          onChange={(group_id) => onChange({ ...project, group_id })}
          label="Transfer to organization / person"
        />
        <button
          onClick={() => onChange({ ...project, status: isActive ? 'planned' : 'active' })}
          title={isActive ? 'Move to future projects' : 'Start project'}
          aria-label={isActive ? 'Move to future projects' : 'Start project'}
          className="w-7 h-7 shrink-0 flex items-center justify-center text-sub hover:text-main hover:bg-subtle cursor-pointer"
        >
          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => confirm(`Delete project "${project.title}"?`) && onDelete()}
          title="Delete project"
          aria-label="Delete project"
          className="w-7 h-7 shrink-0 flex items-center justify-center text-sub hover:text-[#FF3B30] hover:bg-subtle cursor-pointer"
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
          className="w-full min-h-[38px] bg-input p-2 text-xs font-mono text-main placeholder-muted-custom focus:outline-none resize-none leading-relaxed border-0"
        />

        {project.tasks.length > 0 && (
          <ul className="space-y-1.5">
            {project.tasks.map((t) => (
              <li key={t.id} className="group flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setTasks(project.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                  aria-label={`Toggle "${t.title}"`}
                  className={`w-4 h-4 shrink-0 flex items-center justify-center transition-all cursor-pointer border ${
                    t.done
                      ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                      : 'border-main bg-input hover:border-neutral-400'
                  }`}
                >
                  <Check className={`w-3 h-3 stroke-[3] ${t.done ? 'opacity-100' : 'opacity-0'}`} />
                </button>
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
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [isCloud, setIsCloud] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjectsAction().then((res) => {
      if (!res.success) setError(res.error || 'Failed to load projects');
      else if (!res.isConfigured) {
        setIsCloud(false);
        try {
          const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
          // Older local format stored a bare project array
          const local = Array.isArray(raw) ? { projects: raw, groups: [] } : raw;
          setProjects((local.projects || []).map((p: Project) => ({ ...p, group_id: p.group_id ?? null })));
          setGroups(local.groups || []);
        } catch {}
      } else {
        setProjects(res.projects || []);
        setGroups(res.groups || []);
      }
      setLoading(false);
    });
  }, []);

  // Optimistic update; on failure keep local edits visible and surface the error so nothing is silently lost
  const apply = async (op: () => Promise<Result>, nextProjects = projects, nextGroups = groups) => {
    setProjects(nextProjects);
    setGroups(nextGroups);
    setError('');
    if (!isCloud) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ projects: nextProjects, groups: nextGroups }));
      return;
    }
    const res = await op();
    if (!res.success) setError(res.error || 'Save failed');
  };

  const saveProject = (p: Project) =>
    apply(
      () => saveProjectAction(p),
      projects.some((x) => x.id === p.id) ? projects.map((x) => (x.id === p.id ? p : x)) : [...projects, p]
    );

  const removeProject = (id: string) => apply(() => deleteProjectAction(id), projects.filter((x) => x.id !== id));

  const createProject = (title: string, status: ProjectStatus, group_id: string | null) =>
    saveProject({
      id: crypto.randomUUID(),
      title,
      notes: '',
      status,
      group_id,
      tasks: [],
      order: projects.reduce((m, p) => Math.max(m, p.order), 0) + 1,
      created_at: new Date().toISOString(),
    });

  const saveGroup = (g: ProjectGroup) =>
    apply(
      () => saveProjectGroupAction(g),
      projects,
      groups.some((x) => x.id === g.id) ? groups.map((x) => (x.id === g.id ? g : x)) : [...groups, g]
    );

  const removeGroup = (g: ProjectGroup) => {
    const count = projects.filter((p) => p.group_id === g.id).length;
    if (!confirm(`Delete "${g.name}"?${count ? ` Its ${count} project(s) will become Unassigned.` : ''}`)) return;
    apply(
      () => deleteProjectGroupAction(g.id),
      projects.map((p) => (p.group_id === g.id ? { ...p, group_id: null } : p)),
      groups.filter((x) => x.id !== g.id)
    );
  };

  const sortedGroups = [...groups].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  const ownerOf = (p: Project) => (groups.some((g) => g.id === p.group_id) ? p.group_id : null);

  const section = (status: ProjectStatus, heading: string, sub: string, addLabel: string) => {
    const list = projects.filter((p) => p.status === status).sort((a, b) => a.order - b.order);
    const buckets = [...sortedGroups, null]
      .map((g) => ({ g, items: list.filter((p) => ownerOf(p) === (g?.id ?? null)) }))
      .filter((b) => b.items.length > 0);

    return (
      <section className="space-y-2.5" aria-label={heading}>
        <div className="pb-2.5 border-b border-subtle">
          <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">
            {heading} <span className="text-sub font-mono text-[11px]">({list.length})</span>
          </h3>
          <p className="text-[11px] font-mono text-sub uppercase tracking-wider">{sub}</p>
        </div>
        <NewProjectForm groups={sortedGroups} placeholder={addLabel} onAdd={(t, gid) => createProject(t, status, gid)} />
        {buckets.map(({ g, items }) => (
          <div key={g?.id ?? 'unassigned'} className="space-y-2">
            <h4 className="flex items-center gap-1.5 pt-2 text-[11px] font-mono font-bold uppercase tracking-wider text-sub">
              {g ? <GroupIcon kind={g.kind} /> : null}
              {g ? g.name : 'Unassigned'}
              <span className="opacity-60">· {items.length}</span>
            </h4>
            {items.map((p) => (
              <ProjectCard key={p.id} project={p} groups={sortedGroups} onChange={saveProject} onDelete={() => removeProject(p.id)} />
            ))}
          </div>
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
            <section className="space-y-2.5" aria-label="Organizations and people">
              <div className="pb-2.5 border-b border-subtle">
                <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">Organizations & People</h3>
                <p className="text-[11px] font-mono text-sub uppercase tracking-wider">Who each project belongs to</p>
              </div>
              <NewGroupForm onAdd={(name, kind) => saveGroup({ id: crypto.randomUUID(), name, kind })} />
              {sortedGroups.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {sortedGroups.map((g) => (
                    <li key={g.id} className="flex items-center gap-1.5 h-7 pl-2 pr-1 border border-main bg-subtle text-sub">
                      <GroupIcon kind={g.kind} className="w-3 h-3 shrink-0" />
                      <input
                        defaultValue={g.name}
                        aria-label={`Rename ${g.name}`}
                        maxLength={100}
                        size={Math.max(4, g.name.length)}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (!name) e.target.value = g.name;
                          else if (name !== g.name) saveGroup({ ...g, name });
                        }}
                        className="bg-transparent text-[11px] font-mono font-bold text-main focus:outline-none"
                      />
                      <button
                        onClick={() => removeGroup(g)}
                        aria-label={`Delete ${g.name}`}
                        className="w-5 h-5 flex items-center justify-center hover:text-[#FF3B30] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {section('active', 'Ongoing Projects', 'In progress right now', 'Add ongoing project')}
            {section('planned', 'Future Projects', 'Plan before you start', 'Add future project')}
          </>
        )}
      </div>
    </div>
  );
}
