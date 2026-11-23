'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  X,
  Building2,
  User,
  ChevronDown,
  Check,
  Settings,
  Pencil,
} from 'lucide-react';
import { Project, ProjectGroup, ProjectGroupKind, ProjectStatus, ProjectTask } from '../lib/types';
import { generateId } from '../lib/utils/storage';
import { COLOR_PALETTES } from '../lib/utils/icons';
import {
  getProjectsAction,
  saveProjectAction,
  deleteProjectAction,
  saveProjectGroupAction,
  deleteProjectGroupAction,
} from '../lib/server/actions';

const LOCAL_KEY = 'zenith_projects_v1';
const getProjectsStorageKey = (uid?: string) => uid ? `zenith_projects_v1_${uid}` : LOCAL_KEY;

type Result = { success: boolean; error?: string };
type ProjectEdit = (project: Project) => Project;
type GroupChanges = Partial<Pick<ProjectGroup, 'name' | 'color'>>;

function AddForm({
  onAdd,
  children,
  className,
}: {
  onAdd: (name: string) => Promise<Result>;
  children: React.ReactNode;
  className: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const input = event.currentTarget.elements.namedItem('name') as HTMLInputElement;
    setPending(true);
    setError('');
    try {
      const result = await onAdd(input.value.trim());
      if (result.success) input.value = '';
      else setError(result.error || 'Could not save. Try again.');
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setPending(false);
      input.focus();
    }
  };

  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} aria-busy={pending} className={className}>
        {children}
      </fieldset>
      {error && <p role="alert" className="mt-1 text-xs text-[#FF3B30]">{error}</p>}
    </form>
  );
}

function GroupIcon({
  kind,
  className = 'w-3.5 h-3.5',
  style,
}: {
  kind: ProjectGroupKind;
  className?: string;
  style?: React.CSSProperties;
}) {
  return kind === 'org' ? <Building2 className={className} style={style} /> : <User className={className} style={style} />;
}

function TaskTitleEditor({
  task,
  onSave,
  onClose,
  showCancel = false,
}: {
  task: ProjectTask;
  onSave: (title: string) => Promise<Result>;
  onClose: () => void;
  showCancel?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const save = async (form: HTMLFormElement) => {
    if (saving.current) return;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (!title || title === task.title) {
      onClose();
      return;
    }
    saving.current = true;
    setPending(true);
    try {
      if ((await onSave(title)).success) onClose();
    } finally {
      saving.current = false;
      setPending(false);
    }
  };

  return (
    <form
      className="flex-1 flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(e.currentTarget);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) void save(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !saving.current) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <input
        autoFocus
        name="title"
        aria-label="Edit subtask title"
        defaultValue={task.title}
        readOnly={pending}
        maxLength={200}
        placeholder="Subtask title..."
        className="min-w-0 flex-1 h-6 px-1.5 bg-input border border-subtle text-xs font-mono text-main focus:outline-none focus:border-[#FF3B30]"
      />
      <button
        type="submit"
        disabled={pending}
        aria-label={showCancel ? `Save subtask "${task.title}"` : `Save "${task.title}"`}
        className="text-[#FF3B30] hover:text-main cursor-pointer p-0.5"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      {showCancel && (
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          aria-label="Cancel editing"
          className="text-sub hover:text-main cursor-pointer p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </form>
  );
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  ariaLabel,
  align = 'right',
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; group?: string; icon?: React.ReactNode }[];
  placeholder?: string;
  ariaLabel?: string;
  align?: 'left' | 'right';
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
        <ChevronDown
          className={`w-3.5 h-3.5 text-sub transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#FF3B30]' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } z-50 mt-1 min-w-[170px] max-w-[260px] bg-card border border-main shadow-2xl max-h-56 overflow-y-auto`}
        >
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

function ProjectSettingsModal({
  project,
  groups,
  isOpen,
  onClose,
  onChange,
  onDelete,
}: {
  project: Project;
  groups: ProjectGroup[];
  isOpen: boolean;
  onClose: () => void;
  onChange: (edit: ProjectEdit) => Promise<Result>;
  onDelete: () => void;
}) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isActive = project.status === 'active';
  const ownerOptions = [
    { value: '', label: 'Unassigned' },
    ...groups.map((g) => ({
      value: g.id,
      label: g.name,
      group: g.kind === 'org' ? 'Organizations' : 'People',
      icon: <GroupIcon kind={g.kind} className="w-3 h-3 text-sub" />,
    })),
  ];

  const handleAddSubtask = (title: string) => {
    const task = { id: generateId(), title, done: false };
    return onChange((current) => ({ ...current, tasks: [...current.tasks, task] }));
  };

  const handleRemoveSubtask = (taskId: string) => {
    if (editingTaskId === taskId) setEditingTaskId(null);
    onChange((current) => ({
      ...current,
      tasks: current.tasks.filter((t) => t.id !== taskId),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Project settings"
        className="w-full max-w-lg bg-card border border-main p-4 sm:p-6 shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
              PROJECT SETTINGS
            </h2>
            <p className="text-[11px] font-mono text-sub truncate mt-0.5 max-w-xs sm:max-w-md">
              {project.title}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-sub hover:text-main hover:bg-subtle cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Project Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-sub block">
            Project Title
          </label>
          <input
            defaultValue={project.title}
            maxLength={200}
            onBlur={(e) => {
              const title = e.target.value.trim();
              if (title && title !== project.title) {
                onChange((current) => ({ ...current, title }));
              }
            }}
            className="w-full h-9 px-3 bg-input border border-main text-xs font-mono text-main focus:outline-none focus:border-[#FF3B30]"
          />
        </div>

        {/* 2. Belongs To (Organization / Person) & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-sub block">
              Belongs To (Org / Person)
            </label>
            <CustomSelect
              value={project.group_id ?? ''}
              onChange={(val) => onChange((current) => ({ ...current, group_id: val || null }))}
              options={ownerOptions}
              placeholder="Unassigned"
              align="left"
              ariaLabel="Belongs To"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-sub block">
              Status Stage
            </label>
            <button
              type="button"
              onClick={() => onChange((current) => ({ ...current, status: isActive ? 'planned' : 'active' }))}
              className="h-8 px-3 w-full bg-input border border-main hover:border-neutral-400 text-xs font-mono text-main flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {isActive ? <Play className="w-3.5 h-3.5 text-[#FF3B30]" /> : <Pause className="w-3.5 h-3.5 text-sub" />}
                {isActive ? 'Ongoing (Active)' : 'Future (Planned)'}
              </span>
              <span className="text-[10px] uppercase font-bold text-sub">Switch</span>
            </button>
          </div>
        </div>

        {/* 3. Project Notes / Context */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold uppercase tracking-wider text-sub block">
            Project Notes & Subtext
          </label>
          <textarea
            defaultValue={project.notes}
            placeholder={isActive ? 'Notes, context, next steps...' : 'Plan: goals, scope, resources...'}
            rows={3}
            onBlur={(e) => {
              const notes = e.target.value;
              if (notes !== project.notes) {
                onChange((current) => ({ ...current, notes }));
              }
            }}
            className="w-full bg-input p-2.5 text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30] border border-main resize-none leading-relaxed"
          />
        </div>

        {/* 4. Subtasks Management */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-sub block">
              Subtasks ({project.tasks.length})
            </label>
            <span className="text-[10px] font-mono text-muted-custom">
              {project.tasks.filter((t) => t.done).length} completed
            </span>
          </div>

          {project.tasks.length > 0 && (
            <ul className="space-y-1.5 max-h-44 overflow-y-auto p-1 bg-input/40 border border-subtle">
              {project.tasks.map((t) => {
                const isEditing = editingTaskId === t.id;
                return (
                  <li
                    key={t.id}
                    className={`group flex items-center gap-2 px-2 py-1 bg-card border ${
                      isEditing ? 'border-[#FF3B30]' : 'border-subtle hover:border-neutral-500'
                    } transition-colors`}
                  >
                    {isEditing ? (
                      <TaskTitleEditor
                        task={t}
                        showCancel
                        onSave={(title) => onChange((current) => ({
                          ...current,
                          tasks: current.tasks.map((item) => item.id === t.id ? { ...item, title } : item),
                        }))}
                        onClose={() => setEditingTaskId(null)}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onChange((current) => ({
                            ...current,
                            tasks: current.tasks.map((item) => item.id === t.id ? { ...item, done: !item.done } : item),
                          }))}
                          aria-label={`Toggle "${t.title}"`}
                          className={`w-4 h-4 shrink-0 flex items-center justify-center transition-all cursor-pointer border ${
                            t.done ? 'bg-[#FF3B30] text-white border-[#FF3B30]' : 'border-main bg-input hover:border-neutral-400'
                          }`}
                        >
                          <Check className={`w-3 h-3 stroke-[3] ${t.done ? 'opacity-100' : 'opacity-0'}`} />
                        </button>
                        <span
                          onClick={() => setEditingTaskId(t.id)}
                          title="Click to edit subtask"
                          className={`flex-1 text-xs font-mono truncate cursor-pointer hover:text-[#FF3B30] transition-colors ${
                            t.done ? 'line-through text-sub' : 'text-main'
                          }`}
                        >
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(t.id)}
                          aria-label={`Edit subtask "${t.title}"`}
                          title="Edit subtask"
                          className="text-sub hover:text-main cursor-pointer p-0.5"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtask(t.id)}
                          aria-label={`Remove subtask "${t.title}"`}
                          title="Remove subtask"
                          className="text-sub hover:text-[#FF3B30] cursor-pointer p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <AddForm onAdd={handleAddSubtask} className="flex items-center gap-1.5">
            <input
              name="name"
              required
              pattern={'.*\\S.*'}
              title="Enter a subtask title"
              aria-label="Subtask title"
              placeholder="Add new subtask..."
              maxLength={200}
              className="flex-1 min-w-0 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
            />
            <button
              type="submit"
              aria-label="Add subtask"
              className="h-8 px-3 flex items-center justify-center gap-1 border border-main text-xs font-mono font-bold text-sub hover:text-main hover:bg-subtle cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> ADD
            </button>
          </AddForm>
        </div>

        {/* 5. Danger Zone: Delete Project */}
        <div className="pt-3 border-t border-subtle flex items-center justify-between">
          <span className="text-[11px] font-mono text-sub">Delete project and all data</span>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Permanently delete project "${project.title}"?`)) {
                onDelete();
                onClose();
              }
            }}
            className="h-8 px-3 border border-[#FF3B30]/40 text-xs font-mono font-bold text-[#FF3B30] hover:bg-[#FF3B30]/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> DELETE PROJECT
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobalProjectSettingsModal({
  isOpen,
  onClose,
  groups,
  onSaveGroup,
  onUpdateGroup,
  onDeleteGroup,
}: {
  isOpen: boolean;
  onClose: () => void;
  groups: ProjectGroup[];
  onSaveGroup: (g: ProjectGroup) => Promise<Result>;
  onUpdateGroup: (id: string, changes: GroupChanges) => Promise<Result>;
  onDeleteGroup: (g: ProjectGroup) => void;
}) {
  const [kind, setKind] = useState<ProjectGroupKind>('org');
  const [color, setColor] = useState('#FE8019');
  if (!isOpen) return null;

  const handleAdd = (name: string) =>
    onSaveGroup({ id: generateId(), name, kind, color });

  const sortedGroups = [...groups].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Organizations and people"
        className="w-full max-w-lg bg-card border border-main p-4 sm:p-6 shadow-2xl space-y-5 overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#FF3B30]" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-main">
                PROJECT SETTINGS
              </h2>
              <p className="text-[11px] font-mono text-sub mt-0.5">
                Manage Organizations & People
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-sub hover:text-main hover:bg-subtle cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add Org / Person */}
        <AddForm onAdd={handleAdd} className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-sub block">
            Add Organization / Person
          </label>
          <div className="flex items-center gap-1.5">
            <input
              name="name"
              required
              pattern={'.*\\S.*'}
              title="Enter an organization or person name"
              aria-label="Organization or person name"
              placeholder="e.g. IEEE UWU, Client X, John Doe"
              maxLength={100}
              className="flex-1 min-w-0 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
            />
            <CustomSelect
              value={kind}
              onChange={(val) => setKind(val as ProjectGroupKind)}
              options={[
                { value: 'org', label: 'Organization', icon: <Building2 className="w-3 h-3 text-sub" /> },
                { value: 'person', label: 'Person', icon: <User className="w-3 h-3 text-sub" /> },
              ]}
              align="right"
              ariaLabel="Type"
            />
            <button
              type="submit"
              aria-label="Add organization or person"
              className="w-8 h-8 shrink-0 flex items-center justify-center border border-main text-sub hover:text-main hover:bg-subtle cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Color palette selector for the group */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase text-sub block">
              Color Theme
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COLOR_PALETTES.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  className={`w-6 h-6 flex items-center justify-center border transition-all cursor-pointer ${
                    color.toLowerCase() === c.hex.toLowerCase()
                      ? 'border-white scale-110 shadow-xs'
                      : 'border-subtle opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {color.toLowerCase() === c.hex.toLowerCase() && (
                    <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </AddForm>

        {/* Current list */}
        <div className="space-y-2 pt-2 border-t border-subtle">
          <label className="text-xs font-bold uppercase tracking-wider text-sub block">
            Defined Organizations & People ({groups.length})
          </label>

          {sortedGroups.length === 0 ? (
            <p className="text-xs text-sub/70 p-3 bg-input border border-subtle text-center">
              No organizations or people added yet.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {sortedGroups.map((g) => {
                const groupColor = g.color || '#FE8019';
                return (
                  <li
                    key={g.id}
                    className="flex items-center gap-2 p-2 border border-main bg-input text-sub"
                    style={{ borderLeftColor: groupColor, borderLeftWidth: '3px' }}
                  >
                    <GroupIcon kind={g.kind} className="w-3.5 h-3.5 shrink-0" style={{ color: groupColor }} />
                    <input
                      defaultValue={g.name}
                      aria-label={`Rename ${g.name}`}
                      maxLength={100}
                      onBlur={(e) => {
                        const trimmed = e.target.value.trim();
                        if (trimmed && trimmed !== g.name) {
                          onUpdateGroup(g.id, { name: trimmed });
                        } else {
                          e.target.value = g.name;
                        }
                      }}
                      className="flex-1 bg-transparent text-xs font-mono text-main focus:outline-none"
                    />
                    
                    {/* Color switcher per group */}
                    <div className="flex items-center gap-1">
                      {COLOR_PALETTES.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => onUpdateGroup(g.id, { color: c.hex })}
                          title={`Set ${c.name}`}
                          className={`w-3.5 h-3.5 border transition-all cursor-pointer ${
                            (g.color || '#FE8019').toLowerCase() === c.hex.toLowerCase()
                              ? 'border-white scale-125'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>

                    <span className="text-[10px] font-mono text-muted-custom uppercase px-1.5 py-0.5 bg-subtle border border-subtle">
                      {g.kind}
                    </span>
                    <button
                      onClick={() => onDeleteGroup(g)}
                      aria-label={`Delete ${g.name}`}
                      className="w-6 h-6 flex items-center justify-center hover:text-[#FF3B30] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
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
  onChange: (edit: ProjectEdit) => Promise<Result>;
  onDelete: () => void;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCardTaskId, setEditingCardTaskId] = useState<string | null>(null);
  const done = project.tasks.filter((t) => t.done).length;
  const updateTask = (id: string, changes: Partial<ProjectTask>) =>
    onChange((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === id ? { ...item, ...changes } : item),
    }));

  return (
    <>
      <div className="border border-main bg-card transition-all">
        {/* Card Header: Pure focus on Title, Owner badge & Settings Trigger */}
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h4 className="text-sm font-black font-sans uppercase tracking-tight text-main truncate">
              {project.title}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {project.tasks.length > 0 && (
              <span className="text-[10px] font-mono font-bold text-sub mr-1">
                {done}/{project.tasks.length}
              </span>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Project Settings"
              aria-label="Project Settings"
              className="w-7 h-7 flex items-center justify-center text-sub hover:text-main hover:bg-subtle cursor-pointer transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card Body: Clean Tasks & Notes view */}
        <div className="pl-6 pr-3 pb-3 pt-1 space-y-2">
          {/* Notes display */}
          {project.notes ? (
            <p className="text-xs font-mono text-sub leading-relaxed whitespace-pre-wrap bg-input/40 p-2 border border-subtle/50">
              {project.notes}
            </p>
          ) : null}

          {/* Subtasks checklist */}
          {project.tasks.length > 0 ? (
            <ul className="space-y-1.5 pt-0.5">
              {project.tasks.map((t) => {
                const isEditing = editingCardTaskId === t.id;
                return (
                  <li key={t.id} className="group/task flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => updateTask(t.id, { done: !t.done })}
                      aria-label={`Toggle "${t.title}"`}
                      className={`w-4 h-4 shrink-0 flex items-center justify-center transition-all cursor-pointer border ${
                        t.done
                          ? 'bg-[#FF3B30] text-white border-[#FF3B30]'
                          : 'border-main bg-input hover:border-neutral-400'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 stroke-[3] ${t.done ? 'opacity-100' : 'opacity-0'}`}
                      />
                    </button>
                    {isEditing ? (
                      <TaskTitleEditor
                        task={t}
                        onSave={(title) => updateTask(t.id, { title })}
                        onClose={() => setEditingCardTaskId(null)}
                      />
                    ) : (
                      <>
                        <span
                          onDoubleClick={() => setEditingCardTaskId(t.id)}
                          title="Double-click or click pencil to edit"
                          className={`flex-1 text-xs font-mono leading-tight ${
                            t.done ? 'line-through text-sub' : 'text-main'
                          }`}
                        >
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingCardTaskId(t.id)}
                          aria-label={`Edit subtask "${t.title}"`}
                          title="Edit subtask"
                          className="sm:opacity-0 sm:group-hover/task:opacity-100 focus:opacity-100 text-sub hover:text-main cursor-pointer p-0.5 transition-opacity"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : !project.notes ? (
            <div className="text-[11px] font-mono text-muted-custom py-1">
              No tasks or notes yet. Click <Settings className="inline w-3 h-3 mx-0.5" /> to configure.
            </div>
          ) : null}
        </div>
      </div>

      {isSettingsOpen && (
        <ProjectSettingsModal
          project={project}
          groups={groups}
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onChange={onChange}
          onDelete={onDelete}
        />
      )}
    </>
  );
}

function CreateProjectRow({
  groups,
  placeholder,
  onAdd,
}: {
  groups: ProjectGroup[];
  placeholder: string;
  onAdd: (title: string, groupId: string | null) => Promise<Result>;
}) {
  const [owner, setOwner] = useState<string | null>(null);
  const selectedOwner = groups.some((group) => group.id === owner) ? owner : null;

  const ownerOptions = [
    { value: '', label: 'Unassigned' },
    ...groups.map((g) => ({
      value: g.id,
      label: g.name,
      group: g.kind === 'org' ? 'Organizations' : 'People',
      icon: <GroupIcon kind={g.kind} className="w-3 h-3 text-sub" />,
    })),
  ];

  return (
    <AddForm
      onAdd={async (title) => {
        const res = await onAdd(title, selectedOwner);
        if (res.success) setOwner(null);
        return res;
      }}
      className="flex items-center gap-1.5"
    >
      <input
        name="name"
        required
        pattern={'.*\\S.*'}
        title="Enter a project title"
        placeholder={placeholder}
        aria-label="Project title"
        maxLength={200}
        className="flex-1 min-w-0 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
      />
      <CustomSelect
        value={selectedOwner ?? ''}
        onChange={(val) => setOwner(val || null)}
        options={ownerOptions}
        placeholder="Unassigned"
        align="right"
        ariaLabel="Belongs to"
      />
      <button
        type="submit"
        aria-label={placeholder}
        title={placeholder}
        className="w-8 h-8 shrink-0 flex items-center justify-center border border-main text-sub hover:text-main hover:bg-subtle cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
    </AddForm>
  );
}

type ProjectBoard = { projects: Project[]; groups: ProjectGroup[] };
type BoardEdit = (board: ProjectBoard) => ProjectBoard;
const boardWrites = new Map<string, Promise<void>>();

export function ProjectsView({ userId }: { userId: string }) {
  const [board, setBoard] = useState<ProjectBoard>({ projects: [], groups: [] });
  const { projects, groups } = board;
  const saved = useRef(board);
  const pending = useRef<BoardEdit[]>([]);
  const [isCloud, setIsCloud] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // A write can finish after the Projects tab has been closed.
        await boardWrites.get(userId);
        if (!active) return;
        const res = await getProjectsAction(userId);
        if (!active) return;
        if (!res.success) throw new Error(res.error || 'Failed to load projects');
        let initial = { projects: res.projects || [], groups: res.groups || [] };
        if (!res.isConfigured) {
          const raw = JSON.parse(
            localStorage.getItem(getProjectsStorageKey(userId)) ||
            localStorage.getItem(LOCAL_KEY) ||
            '{}'
          );
          const local = Array.isArray(raw) ? { projects: raw, groups: [] } : raw;
          initial = {
            projects: (local.projects || []).map((p: Project) => ({ ...p, group_id: p.group_id ?? null })),
            groups: local.groups || [],
          };
        } else {
          localStorage.setItem(getProjectsStorageKey(userId), JSON.stringify(initial));
        }
        saved.current = initial;
        setBoard(initial);
        setIsCloud(res.isConfigured);
        setLoading(false);
      } catch (err) {
        if (active) {
          try {
            const raw = JSON.parse(
              localStorage.getItem(getProjectsStorageKey(userId)) ||
              localStorage.getItem(LOCAL_KEY) ||
              '{}'
            );
            if (raw.projects && raw.projects.length) {
              saved.current = raw;
              setBoard(raw);
              setLoading(false);
            }
          } catch {}
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  // Replay pending edits over confirmed data so one failed save only rolls back its own change.
  const apply = (op: (next: ProjectBoard) => Promise<Result>, edit: BoardEdit): Promise<Result> => {
    pending.current.push(edit);
    setBoard(edit);
    setError('');
    const write = (boardWrites.get(userId) ?? Promise.resolve()).then(async () => {
      let result: Result;
      try {
        const next = edit(saved.current);
        if (!isCloud) localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        localStorage.setItem(getProjectsStorageKey(userId), JSON.stringify(next));
        result = isCloud ? await op(next) : { success: true };
        if (result.success) saved.current = next;
      } catch {
        result = { success: false, error: 'Could not save changes. Try again.' };
      }
      pending.current.shift();
      setBoard(pending.current.reduce((state, change) => change(state), saved.current));
      if (!result.success) setError(result.error || 'Save failed');
      return result;
    });
    const settled = write.then(() => {}, () => {});
    boardWrites.set(userId, settled);
    void settled.then(() => {
      if (boardWrites.get(userId) === settled) boardWrites.delete(userId);
    });
    return write;
  };

  const addProject = (p: Project) =>
    apply(() => saveProjectAction(p, userId), (state) => ({
      ...state,
      projects: [...state.projects, p],
    }));

  const updateProject = (id: string, edit: ProjectEdit) =>
    apply(async (next) => {
      const project = next.projects.find((item) => item.id === id);
      return project ? saveProjectAction(project, userId) : { success: false, error: 'Project no longer exists.' };
    }, (state) => ({
      ...state,
      projects: state.projects.map((p) => p.id === id ? edit(p) : p),
    }));

  const removeProject = (id: string) =>
    apply(() => deleteProjectAction(id, userId), (state) => ({
      ...state,
      projects: state.projects.filter((x) => x.id !== id),
    }));

  const createProject = (title: string, status: ProjectStatus, group_id: string | null) =>
    addProject({
      id: generateId(),
      title,
      notes: '',
      status,
      group_id,
      tasks: [],
      order: projects.reduce((m, p) => Math.max(m, p.order), 0) + 1,
      created_at: new Date().toISOString(),
    });

  const saveGroup = (g: ProjectGroup) =>
    apply(() => saveProjectGroupAction(g, userId), (state) => ({
      ...state,
      groups: [...state.groups, g],
    }));

  const updateGroup = (id: string, changes: GroupChanges) =>
    apply(async (next) => {
      const group = next.groups.find((item) => item.id === id);
      return group ? saveProjectGroupAction(group, userId) : { success: false, error: 'Organization / person no longer exists.' };
    }, (state) => ({
      ...state,
      groups: state.groups.map((group) => group.id === id ? { ...group, ...changes } : group),
    }));

  const removeGroup = (g: ProjectGroup) => {
    const count = projects.filter((p) => p.group_id === g.id).length;
    if (
      !confirm(
        `Delete "${g.name}"?${
          count ? ` Its ${count} project(s) will become Unassigned.` : ''
        }`
      )
    )
      return;
    apply(
      () => deleteProjectGroupAction(g.id, userId),
      (state) => ({
        projects: state.projects.map((p) => (p.group_id === g.id ? { ...p, group_id: null } : p)),
        groups: state.groups.filter((x) => x.id !== g.id),
      })
    );
  };

  const sortedGroups = [...groups].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  );
  const ownerOf = (p: Project) =>
    groups.some((g) => g.id === p.group_id) ? p.group_id : null;

  const renderSection = (
    status: ProjectStatus,
    heading: string,
    sub: string,
    addLabel: string
  ) => {
    const list = projects.filter((p) => p.status === status).sort((a, b) => a.order - b.order);
    const buckets = [...sortedGroups, null]
      .map((g) => ({ g, items: list.filter((p) => ownerOf(p) === (g?.id ?? null)) }))
      .filter((b) => b.items.length > 0);

    return (
      <section className="space-y-3" aria-label={heading}>
        <div className="pb-2.5 border-b border-subtle">
          <h3 className="text-sm font-black font-sans uppercase tracking-tight text-main">
            {heading} <span className="text-sub font-mono text-[11px]">({list.length})</span>
          </h3>
          <p className="text-[11px] font-mono text-sub uppercase tracking-wider">{sub}</p>
        </div>

        <CreateProjectRow
          groups={sortedGroups}
          placeholder={addLabel}
          onAdd={(t, gid) => createProject(t, status, gid)}
        />

        {buckets.map(({ g, items }) => {
          const groupColor = g?.color || (g ? '#FE8019' : undefined);
          return (
            <div
              key={g?.id ?? 'unassigned'}
              className="p-3.5 sm:p-4 border transition-colors space-y-3 bg-card/40"
              style={{
                borderColor: groupColor || 'var(--border-main)',
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-subtle">
                <h4
                  className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider"
                  style={{ color: groupColor || 'var(--text-sub)' }}
                >
                  {g ? <GroupIcon kind={g.kind} style={{ color: groupColor }} /> : null}
                  <span>{g ? g.name : 'Unassigned'}</span>
                  <span className="text-[10px] opacity-75 font-normal">
                    ({items.length} {items.length === 1 ? 'project' : 'projects'})
                  </span>
                </h4>
              </div>

              <div className="space-y-2.5">
                {items.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    groups={sortedGroups}
                    onChange={(edit) => updateProject(p.id, edit)}
                    onDelete={() => removeProject(p.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    );
  };

  return (
    <div className="w-full max-w-4xl xl:max-w-7xl mx-auto px-4 sm:px-6">
      <div className="bg-card p-4 sm:p-6 border border-main shadow-xs space-y-8">
        {error && (
          <p role="alert" className="text-xs font-mono text-[#FF3B30] border border-[#FF3B30] px-3 py-2">
            {error}
          </p>
        )}

        {/* Top Header bar with clean action: Settings button */}
        <div className="flex items-center justify-between pb-3 border-b border-subtle">
          <div>
            <h2 className="text-sm sm:text-base font-black font-sans uppercase tracking-tight text-main">
              Projects & Directives
            </h2>
            <p className="text-[11px] font-mono text-sub uppercase tracking-wider">
              Manage ongoing execution and strategic planning
            </p>
          </div>

          <button
            disabled={loading}
            onClick={() => setIsGlobalSettingsOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 border border-main bg-input hover:bg-subtle text-xs font-mono font-bold text-sub hover:text-main cursor-pointer transition-colors"
            title="Configure Organizations and People"
          >
            <Settings className="w-3.5 h-3.5 text-[#FF3B30]" />
            <span className="hidden sm:inline">ORGANIZATIONS & PEOPLE</span>
          </button>
        </div>

        {loading ? (
          <p className="text-xs font-mono text-sub uppercase tracking-wider">{error ? 'Reopen the Projects tab to retry.' : 'Loading projects...'}</p>
        ) : (
          <>
            {renderSection('active', 'Ongoing Projects', 'In progress right now', 'Add ongoing project')}
            {renderSection('planned', 'Future Projects', 'Plan before you start', 'Add future project')}
          </>
        )}
      </div>

      <GlobalProjectSettingsModal
        isOpen={isGlobalSettingsOpen}
        onClose={() => setIsGlobalSettingsOpen(false)}
        groups={groups}
        onSaveGroup={saveGroup}
        onUpdateGroup={updateGroup}
        onDeleteGroup={removeGroup}
      />
    </div>
  );
}
