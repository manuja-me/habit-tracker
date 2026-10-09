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
import { COLOR_PALETTES } from '../lib/utils/icons';
import {
  getProjectsAction,
  saveProjectAction,
  deleteProjectAction,
  saveProjectGroupAction,
  deleteProjectGroupAction,
} from '../lib/server/actions';

const LOCAL_KEY = 'zenith_projects_v1';

type Result = { success: boolean; error?: string };

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
  onChange: (p: Project) => void;
  onDelete: () => void;
}) {
  const [subtaskInput, setSubtaskInput] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');

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

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = subtaskInput.trim();
    if (!title) return;
    onChange({
      ...project,
      tasks: [...project.tasks, { id: crypto.randomUUID(), title, done: false }],
    });
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (taskId: string) => {
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
      setEditingTaskTitle('');
    }
    onChange({
      ...project,
      tasks: project.tasks.filter((t) => t.id !== taskId),
    });
  };

  const handleStartEditSubtask = (task: ProjectTask) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
  };

  const handleSaveEditSubtask = (taskId: string) => {
    const trimmed = editingTaskTitle.trim();
    if (!trimmed) return;
    onChange({
      ...project,
      tasks: project.tasks.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t)),
    });
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const handleCancelEditSubtask = () => {
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono"
      onClick={onClose}
    >
      <div
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
                onChange({ ...project, title });
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
              onChange={(val) => onChange({ ...project, group_id: val || null })}
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
              onClick={() => onChange({ ...project, status: isActive ? 'planned' : 'active' })}
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
              if (e.target.value !== project.notes) {
                onChange({ ...project, notes: e.target.value });
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
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editingTaskTitle}
                          maxLength={200}
                          onChange={(e) => setEditingTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditSubtask(t.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEditSubtask();
                            }
                          }}
                          className="flex-1 h-6 px-1.5 bg-input border border-subtle text-xs font-mono text-main focus:outline-none focus:border-[#FF3B30]"
                          placeholder="Subtask title..."
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditSubtask(t.id)}
                          aria-label={`Save subtask "${t.title}"`}
                          title="Save (Enter)"
                          className="text-[#FF3B30] hover:text-main cursor-pointer p-0.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditSubtask}
                          aria-label="Cancel editing"
                          title="Cancel (Esc)"
                          className="text-sub hover:text-main cursor-pointer p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          onClick={() => handleStartEditSubtask(t)}
                          title="Click to edit subtask"
                          className={`flex-1 text-xs font-mono truncate cursor-pointer hover:text-[#FF3B30] transition-colors ${
                            t.done ? 'line-through text-sub' : 'text-main'
                          }`}
                        >
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditSubtask(t)}
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

          <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5">
            <input
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              placeholder="Add new subtask..."
              maxLength={200}
              className="flex-1 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
            />
            <button
              type="submit"
              aria-label="Add subtask"
              className="h-8 px-3 flex items-center justify-center gap-1 border border-main text-xs font-mono font-bold text-sub hover:text-main hover:bg-subtle cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> ADD
            </button>
          </form>
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
  onDeleteGroup,
}: {
  isOpen: boolean;
  onClose: () => void;
  groups: ProjectGroup[];
  onSaveGroup: (g: ProjectGroup) => void;
  onDeleteGroup: (g: ProjectGroup) => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ProjectGroupKind>('org');
  const [color, setColor] = useState('#FE8019');
  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveGroup({ id: crypto.randomUUID(), name: trimmed, kind, color });
    setName('');
  };

  const sortedGroups = [...groups].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-100 font-mono"
      onClick={onClose}
    >
      <div
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
        <form onSubmit={handleAdd} className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-sub block">
            Add Organization / Person
          </label>
          <div className="flex items-center gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IEEE UWU, Client X, John Doe"
              maxLength={100}
              className="flex-1 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
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
              aria-label="Add"
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
        </form>

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
                          onSaveGroup({ ...g, name: trimmed });
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
                          onClick={() => onSaveGroup({ ...g, color: c.hex })}
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
  onChange: (p: Project) => void;
  onDelete: () => void;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCardTaskId, setEditingCardTaskId] = useState<string | null>(null);
  const [editingCardTaskTitle, setEditingCardTaskTitle] = useState('');
  const done = project.tasks.filter((t) => t.done).length;
  const setTasks = (tasks: ProjectTask[]) => onChange({ ...project, tasks });

  return (
    <>
      <div className="border border-main bg-card transition-all">
        {/* Card Header: Pure focus on Title, Owner badge & Settings Trigger */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-subtle">
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
        <div className="p-3 space-y-2.5">
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
                      onClick={() =>
                        setTasks(
                          project.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x))
                        )
                      }
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
                      <div className="flex-1 flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editingCardTaskTitle}
                          maxLength={200}
                          onChange={(e) => setEditingCardTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = editingCardTaskTitle.trim();
                              if (trimmed) {
                                setTasks(
                                  project.tasks.map((x) =>
                                    x.id === t.id ? { ...x, title: trimmed } : x
                                  )
                                );
                              }
                              setEditingCardTaskId(null);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingCardTaskId(null);
                            }
                          }}
                          onBlur={() => {
                            const trimmed = editingCardTaskTitle.trim();
                            if (trimmed) {
                              setTasks(
                                project.tasks.map((x) =>
                                  x.id === t.id ? { ...x, title: trimmed } : x
                                )
                              );
                            }
                            setEditingCardTaskId(null);
                          }}
                          className="flex-1 h-6 px-1.5 bg-input border border-[#FF3B30] text-xs font-mono text-main focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const trimmed = editingCardTaskTitle.trim();
                            if (trimmed) {
                              setTasks(
                                project.tasks.map((x) =>
                                  x.id === t.id ? { ...x, title: trimmed } : x
                                )
                              );
                            }
                            setEditingCardTaskId(null);
                          }}
                          aria-label={`Save "${t.title}"`}
                          className="text-[#FF3B30] hover:text-main cursor-pointer p-0.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          onDoubleClick={() => {
                            setEditingCardTaskId(t.id);
                            setEditingCardTaskTitle(t.title);
                          }}
                          title="Double-click or click pencil to edit"
                          className={`flex-1 text-xs font-mono leading-tight ${
                            t.done ? 'line-through text-sub' : 'text-main'
                          }`}
                        >
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCardTaskId(t.id);
                            setEditingCardTaskTitle(t.title);
                          }}
                          aria-label={`Edit subtask "${t.title}"`}
                          title="Edit subtask"
                          className="opacity-0 group-hover/task:opacity-100 text-sub hover:text-main cursor-pointer p-0.5 transition-opacity"
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

      <ProjectSettingsModal
        project={project}
        groups={groups}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onChange={onChange}
        onDelete={onDelete}
      />
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
  onAdd: (title: string, groupId: string | null) => void;
}) {
  const [value, setValue] = useState('');
  const [owner, setOwner] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    onAdd(title, owner);
    setValue('');
  };

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
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={200}
        className="flex-1 min-w-0 h-8 px-2.5 bg-input border border-main text-xs font-mono text-main placeholder-muted-custom focus:outline-none focus:border-[#FF3B30]"
      />
      <CustomSelect
        value={owner ?? ''}
        onChange={(val) => setOwner(val || null)}
        options={ownerOptions}
        placeholder="Unassigned"
        align="right"
        ariaLabel="Belongs to"
      />
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

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [isCloud, setIsCloud] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);

  useEffect(() => {
    getProjectsAction().then((res) => {
      if (!res.success) setError(res.error || 'Failed to load projects');
      else if (!res.isConfigured) {
        setIsCloud(false);
        try {
          const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
          const local = Array.isArray(raw) ? { projects: raw, groups: [] } : raw;
          setProjects(
            (local.projects || []).map((p: Project) => ({ ...p, group_id: p.group_id ?? null }))
          );
          setGroups(local.groups || []);
        } catch {}
      } else {
        setProjects(res.projects || []);
        setGroups(res.groups || []);
      }
      setLoading(false);
    });
  }, []);

  const apply = async (
    op: () => Promise<Result>,
    nextProjects = projects,
    nextGroups = groups
  ) => {
    setProjects(nextProjects);
    setGroups(nextGroups);
    setError('');
    if (!isCloud) {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({ projects: nextProjects, groups: nextGroups })
      );
      return;
    }
    const res = await op();
    if (!res.success) setError(res.error || 'Save failed');
  };

  const saveProject = (p: Project) =>
    apply(
      () => saveProjectAction(p),
      projects.some((x) => x.id === p.id)
        ? projects.map((x) => (x.id === p.id ? p : x))
        : [...projects, p]
    );

  const removeProject = (id: string) =>
    apply(() => deleteProjectAction(id), projects.filter((x) => x.id !== id));

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
      groups.some((x) => x.id === g.id)
        ? groups.map((x) => (x.id === g.id ? g : x))
        : [...groups, g]
    );

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
      () => deleteProjectGroupAction(g.id),
      projects.map((p) => (p.group_id === g.id ? { ...p, group_id: null } : p)),
      groups.filter((x) => x.id !== g.id)
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
                    onChange={saveProject}
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
            onClick={() => setIsGlobalSettingsOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 border border-main bg-input hover:bg-subtle text-xs font-mono font-bold text-sub hover:text-main cursor-pointer transition-colors"
            title="Configure Organizations and People"
          >
            <Settings className="w-3.5 h-3.5 text-[#FF3B30]" />
            <span className="hidden sm:inline">ORGANIZATIONS & PEOPLE</span>
          </button>
        </div>

        {loading ? (
          <p className="text-xs font-mono text-sub uppercase tracking-wider">Loading projects...</p>
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
        onDeleteGroup={removeGroup}
      />
    </div>
  );
}
